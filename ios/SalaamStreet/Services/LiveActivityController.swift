import Foundation
import ActivityKit
import SalaamStreetCore

/// Starts, updates and ends the prayer countdown Live Activity.
///
/// What iOS allows (and what this does):
/// • An app can start a Live Activity only while it is open, so it starts when
///   the person turns it on, presses Start, or (if they chose) opens the app.
/// • The countdown itself ticks on the Lock Screen and in the Dynamic Island
///   without the app running (`Text(timerInterval:)`).
/// • Moving on to the next prayer needs the app: it does so whenever it's open,
///   and on background refreshes iOS grants. If neither happens, the content is
///   marked stale 15 minutes after the prayer begins and the activity says so.
@MainActor
final class LiveActivityController: ObservableObject {
    typealias PrayerActivity = Activity<PrayerActivityAttributes>

    @Published private(set) var isRunning = false
    @Published private(set) var systemAllowsActivities = ActivityAuthorizationInfo().areActivitiesEnabled
    @Published private(set) var lastError: String?

    init() {
        isRunning = !PrayerActivity.activities.isEmpty
        Task { [weak self] in
            for await enabled in ActivityAuthorizationInfo().activityEnablementUpdates {
                await MainActor.run { self?.systemAllowsActivities = enabled }
            }
        }
    }

    /// Bring the activity in line with the preferences. `restart` ends and
    /// restarts it (display preferences are fixed when an activity starts).
    func apply(preferences: LiveActivityPreferences, builder: PrayerScheduleBuilder, restart: Bool) {
        systemAllowsActivities = ActivityAuthorizationInfo().areActivitiesEnabled
        guard preferences.enabled else { endAll(); return }
        if restart {
            endAll { [weak self] in self?.start(preferences: preferences, builder: builder) }
        } else if PrayerActivity.activities.isEmpty {
            if preferences.autoStart { start(preferences: preferences, builder: builder) }
        } else {
            refreshIfNeeded(builder: builder)
        }
    }

    func start(preferences: LiveActivityPreferences, builder: PrayerScheduleBuilder) {
        lastError = nil
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            lastError = "Live Activities are turned off for SalaamStreet in the Settings app."
            isRunning = false
            return
        }
        guard PrayerActivity.activities.isEmpty else { refreshIfNeeded(builder: builder); return }
        guard let state = PrayerActivityPlanner.state(builder: builder, now: Date()) else { return }
        let attributes = PrayerActivityAttributes(showArabicName: preferences.showArabicName,
                                                  showFollowingPrayer: preferences.showFollowingPrayer)
        do {
            _ = try PrayerActivity.request(attributes: attributes, content: content(for: state), pushType: nil)
            isRunning = true
        } catch {
            lastError = "iOS didn't start the Live Activity (\(error.localizedDescription))."
            isRunning = false
        }
    }

    /// Move on to the next prayer if the shown one is over (cheap; safe to call often).
    func refreshIfNeeded(builder: PrayerScheduleBuilder) {
        let activities = PrayerActivity.activities
        isRunning = !activities.isEmpty
        guard let fresh = PrayerActivityPlanner.state(builder: builder, now: Date()) else { return }
        for activity in activities where activity.content.state != fresh {
            let c = content(for: fresh)
            Task { await activity.update(c) }
        }
    }

    func endAll(then next: (() -> Void)? = nil) {
        let activities = PrayerActivity.activities
        isRunning = false
        guard !activities.isEmpty else { next?(); return }
        Task {
            for a in activities { await a.end(nil, dismissalPolicy: .immediate) }
            await MainActor.run { next?() }
        }
    }

    private func content(for state: PrayerCountdownState) -> ActivityContent<PrayerCountdownState> {
        ActivityContent(state: state, staleDate: PrayerActivityPlanner.staleDate(for: state),
                        relevanceScore: PrayerActivityPlanner.relevance(for: state, now: Date()))
    }
}
