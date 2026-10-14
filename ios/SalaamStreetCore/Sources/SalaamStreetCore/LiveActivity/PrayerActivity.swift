import Foundation
#if canImport(ActivityKit) && os(iOS)
import ActivityKit
#endif

/// What the prayer Live Activity shows. Platform-independent, so the planning
/// rules are unit-tested; the ActivityKit attributes below wrap it.
public struct PrayerCountdownState: Codable, Hashable, Sendable {
    public var prayer: Prayer
    public var englishName: String
    public var arabicName: String
    public var prayerTime: Date
    /// The prayer after this one (shown in the expanded Dynamic Island when enabled).
    public var followingName: String?
    public var followingTime: Date?
    public var locationName: String
    /// Times are shown in the location's clock, as everywhere else in the app (not the phone's, if they differ).
    public var timeZoneIdentifier: String

    public var timeZone: TimeZone { TimeZone(identifier: timeZoneIdentifier) ?? .current }

    public init(prayer: Prayer, englishName: String, arabicName: String, prayerTime: Date,
                followingName: String?, followingTime: Date?, locationName: String, timeZoneIdentifier: String) {
        self.prayer = prayer
        self.englishName = englishName
        self.arabicName = arabicName
        self.prayerTime = prayerTime
        self.followingName = followingName
        self.followingTime = followingTime
        self.locationName = locationName
        self.timeZoneIdentifier = timeZoneIdentifier
    }
}

/// Display choices for the Live Activity (Settings → Live Activity).
public struct LiveActivityPreferences: Codable, Equatable, Hashable, Sendable {
    public var enabled: Bool
    /// Start automatically whenever SalaamStreet is opened (iOS only lets apps start them in the foreground).
    public var autoStart: Bool
    public var showArabicName: Bool
    public var showFollowingPrayer: Bool

    public init(enabled: Bool = false, autoStart: Bool = true, showArabicName: Bool = true, showFollowingPrayer: Bool = true) {
        self.enabled = enabled
        self.autoStart = autoStart
        self.showArabicName = showArabicName
        self.showFollowingPrayer = showFollowingPrayer
    }
}

/// Decides what the Live Activity should say and when that becomes out of date.
public enum PrayerActivityPlanner {
    /// The activity keeps showing "It's time for X" this long after the prayer begins.
    public static let holdAfterStart: TimeInterval = 15 * 60

    /// State for `now`: the upcoming prayer, unless one began within the last 15 minutes
    /// (then that one, so the Lock Screen says it's time).
    public static func state(builder: PrayerScheduleBuilder, now: Date) -> PrayerCountdownState? {
        let upcoming = builder.upcoming(after: now.addingTimeInterval(-holdAfterStart), count: 2)
        guard let first = upcoming.first else { return nil }
        let second = upcoming.count > 1 ? upcoming[1] : nil
        return PrayerCountdownState(prayer: first.prayer, englishName: first.englishName, arabicName: first.arabicName,
                                    prayerTime: first.date, followingName: second?.englishName, followingTime: second?.date,
                                    locationName: builder.location.name, timeZoneIdentifier: builder.location.timeZoneIdentifier)
    }

    /// The countdown ends at the prayer time. iOS then redraws the activity as
    /// stale, and it says the prayer has begun (accurate however long it is shown)
    /// until the app moves it on to the next prayer.
    public static func staleDate(for state: PrayerCountdownState) -> Date {
        state.prayerTime
    }

    /// Higher for prayers that are close, so iOS ranks the activity sensibly.
    public static func relevance(for state: PrayerCountdownState, now: Date) -> Double {
        let mins = state.prayerTime.timeIntervalSince(now) / 60
        if mins <= 0 { return 100 }
        return max(1, 100 - mins / 6)
    }

    /// Whether `state` needs replacing at `now` (the prayer's hold period is over, or the location changed).
    public static func needsUpdate(_ state: PrayerCountdownState, builder: PrayerScheduleBuilder, now: Date) -> Bool {
        guard let fresh = self.state(builder: builder, now: now) else { return false }
        return fresh != state
    }
}

#if canImport(ActivityKit) && os(iOS)
/// The ActivityKit attributes for the prayer countdown. Static attributes hold
/// the display preferences; changing them restarts the activity.
public struct PrayerActivityAttributes: ActivityAttributes {
    public typealias ContentState = PrayerCountdownState
    public var showArabicName: Bool
    public var showFollowingPrayer: Bool

    public init(showArabicName: Bool, showFollowingPrayer: Bool) {
        self.showArabicName = showArabicName
        self.showFollowingPrayer = showFollowingPrayer
    }
}
#endif
