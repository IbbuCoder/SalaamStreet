import ActivityKit
import Foundation

/// The prayer countdown on the Lock Screen and in the Dynamic Island.
/// Clock times are formatted in the *location's* time zone before they are
/// stored here, so the Lock Screen never shows the phone's own clock for a
/// city in another zone. The countdown itself is a duration, so it is the same
/// in every zone.
struct PrayerActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var key: String
        var name: String
        var at: Date
        /// e.g. "3:45 PM" in the location's time zone.
        var timeText: String
        var followingName: String?
        var followingTimeText: String?
        /// Prayers ticked today (0–5), from the website's tracker.
        var prayedToday: Int
    }

    var city: String
    var tz: String
    var locale: String
    var rtl: Bool
    var labelNext: String
    var labelIn: String
    var labelNow: String
}

extension PrayerSnapshot {
    /// The Live Activity's content for `now`, or nil when no future time is known.
    func activityState(now: Date = Date()) -> PrayerActivityAttributes.ContentState? {
        guard let next = next(after: now) else { return nil }
        let following = self.following(after: next)
        let today = dayString(for: now)
        let prayed = PrayerKey.five.filter { isPrayed($0, day: today) }.count
        return .init(key: next.key.rawValue, name: next.name, at: next.date, timeText: format(next.date),
                     followingName: following?.name, followingTimeText: following.map { format($0.date) }, prayedToday: prayed)
    }

    var activityAttributes: PrayerActivityAttributes {
        PrayerActivityAttributes(city: location.label, tz: location.tz, locale: locale, rtl: rtl,
                                 labelNext: label("next", "Next prayer"), labelIn: label("in", "in"), labelNow: label("now", "Now"))
    }
}

#if !WIDGET_EXTENSION
/// Starts, updates and ends the countdown. Runs in the app's process (the
/// intents that use it are LiveActivityIntents).
@MainActor
final class PrayerActivityController {
    static let shared = PrayerActivityController()
    private static let wantedKey = "liveActivity.wanted"

    var activities: [Activity<PrayerActivityAttributes>] { Activity<PrayerActivityAttributes>.activities }
    var isRunning: Bool { activities.contains { $0.activityState == .active || $0.activityState == .stale } }
    var status: [String: Any] {
        ["running": isRunning, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled]
    }

    /// The person asked for the countdown (kept across launches, so a new day's
    /// countdown starts again when the app next runs).
    var wanted: Bool {
        get { AppGroup.defaults.bool(forKey: Self.wantedKey) }
        set { AppGroup.defaults.set(newValue, forKey: Self.wantedKey) }
    }

    @discardableResult
    func start(from snap: PrayerSnapshot) async throws -> [String: Any] {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw ActivityError.disabled }
        guard let state = snap.activityState() else { throw ActivityError.noTimes }
        wanted = true
        if let a = activities.first {
            await a.update(ActivityContent(state: state, staleDate: state.at.addingTimeInterval(60)))
        } else {
            _ = try Activity.request(attributes: snap.activityAttributes,
                                     content: ActivityContent(state: state, staleDate: state.at.addingTimeInterval(60)),
                                     pushType: nil)
        }
        return status
    }

    func stopAll() async {
        wanted = false
        for a in activities { await a.end(nil, dismissalPolicy: .immediate) }
    }

    /// Move the countdown on to the next prayer (after a prayer time passes,
    /// or when the website's times, language or location change).
    func refresh(from snap: PrayerSnapshot) async {
        guard wanted || isRunning else { return }
        guard let state = snap.activityState() else { return }
        let attrs = snap.activityAttributes
        if let a = activities.first {
            if a.attributes.city != attrs.city || a.attributes.tz != attrs.tz || a.attributes.locale != attrs.locale {
                await a.end(nil, dismissalPolicy: .immediate)
                _ = try? Activity.request(attributes: attrs, content: ActivityContent(state: state, staleDate: state.at.addingTimeInterval(60)), pushType: nil)
            } else if a.content.state != state {
                await a.update(ActivityContent(state: state, staleDate: state.at.addingTimeInterval(60)))
            }
        } else if wanted {
            _ = try? Activity.request(attributes: attrs, content: ActivityContent(state: state, staleDate: state.at.addingTimeInterval(60)), pushType: nil)
        }
    }

    enum ActivityError: LocalizedError {
        case disabled, noTimes
        var errorDescription: String? {
            switch self {
            case .disabled: return "Live Activities are turned off for SalaamStreet in Settings."
            case .noTimes: return "Open SalaamStreet once so it knows your prayer times."
            }
        }
    }
}
#endif
