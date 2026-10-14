import Foundation

/// Prayer times calculated on the device — a line-for-line port of the
/// website's `js/praytimes.js` (PrayTimes.org formulas, AlAdhan method
/// parameters), so the app and salaamstreet.com agree to the minute and both
/// work with no connection. `PrayerCalculatorTests` checks every method and
/// both Asr schools against fixtures produced by the JavaScript version.
public enum PrayerCalculator {

    /// Twilight angles (degrees below the horizon), or Isha as minutes after Maghrib.
    public struct MethodParameters: Equatable, Sendable {
        public let fajrAngle: Double
        public let ishaAngle: Double?
        public let ishaMinutes: Double?
    }

    /// AlAdhan method ids → parameters (same table as the website).
    public static let methods: [Int: MethodParameters] = [
        1: .init(fajrAngle: 18, ishaAngle: 18, ishaMinutes: nil),     // University of Islamic Sciences, Karachi
        2: .init(fajrAngle: 15, ishaAngle: 15, ishaMinutes: nil),     // ISNA (North America)
        3: .init(fajrAngle: 18, ishaAngle: 17, ishaMinutes: nil),     // Muslim World League
        4: .init(fajrAngle: 18.5, ishaAngle: nil, ishaMinutes: 90),   // Umm al-Qura, Makkah
        5: .init(fajrAngle: 19.5, ishaAngle: 17.5, ishaMinutes: nil), // Egyptian General Authority of Survey
        12: .init(fajrAngle: 12, ishaAngle: 12, ishaMinutes: nil),    // UOIF (France)
        13: .init(fajrAngle: 18, ishaAngle: 17, ishaMinutes: nil),    // Diyanet (Türkiye)
    ]

    /// Decimal clock hours at the location (NaN where the sun never reaches the angle).
    public struct Hours: Equatable, Sendable {
        public var fajr, sunrise, dhuhr, asr, sunset, maghrib, isha, imsak, midnight: Double
    }

    private static let rad = Double.pi / 180
    private static func sin(_ d: Double) -> Double { Foundation.sin(d * rad) }
    private static func cos(_ d: Double) -> Double { Foundation.cos(d * rad) }
    private static func tan(_ d: Double) -> Double { Foundation.tan(d * rad) }
    private static func asin(_ x: Double) -> Double { Foundation.asin(x) / rad }
    private static func acos(_ x: Double) -> Double { Foundation.acos(x) / rad }
    private static func atan2(_ y: Double, _ x: Double) -> Double { Foundation.atan2(y, x) / rad }
    private static func acot(_ x: Double) -> Double { Foundation.atan(1 / x) / rad }
    private static func fix(_ a: Double, _ b: Double) -> Double {
        let r = a - b * (a / b).rounded(.down)
        return r < 0 ? r + b : r
    }

    static func julian(_ year: Int, _ month: Int, _ day: Int) -> Double {
        var y = Double(year), m = Double(month)
        if m <= 2 { y -= 1; m += 12 }
        let a = (y / 100).rounded(.down)
        let b = 2 - a + (a / 4).rounded(.down)
        return (365.25 * (y + 4716)).rounded(.down) + (30.6001 * (m + 1)).rounded(.down) + Double(day) + b - 1524.5
    }

    private static func sunPosition(_ jd: Double) -> (decl: Double, eqt: Double) {
        let d = jd - 2451545.0
        let g = fix(357.529 + 0.98560028 * d, 360)
        let q = fix(280.459 + 0.98564736 * d, 360)
        let l = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360)
        let e = 23.439 - 0.00000036 * d
        let ra = atan2(cos(e) * sin(l), cos(l)) / 15
        return (asin(sin(e) * sin(l)), q / 15 - fix(ra, 24))
    }

    /// Times for a calendar day at a location. `tzOffsetMinutes` is minutes east of UTC on that day.
    public static func hours(year: Int, month: Int, day: Int, latitude lat: Double, longitude lng: Double,
                             method: Int, school: AsrSchool, tzOffsetMinutes: Int) -> Hours {
        let m = methods[method] ?? methods[3]!
        let asrFactor: Double = school == .hanafi ? 2 : 1
        let tz = Double(tzOffsetMinutes) / 60
        let jd = julian(year, month, day) - lng / (15 * 24)

        func midDay(_ t: Double) -> Double { fix(12 - sunPosition(jd + t).eqt, 24) }
        func sunAngleTime(_ angle: Double, _ t: Double, ccw: Bool) -> Double {
            let decl = sunPosition(jd + t).decl, noon = midDay(t)
            let x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))
            if x < -1 || x > 1 { return .nan }
            let h = acos(x) / 15
            return noon + (ccw ? -h : h)
        }
        func asrTime(_ factor: Double, _ t: Double) -> Double {
            let decl = sunPosition(jd + t).decl
            let angle = -acot(factor + tan(abs(lat - decl)))
            return sunAngleTime(angle, t, ccw: false)
        }

        var fajr = 5.0, sunrise = 6.0, dhuhr = 12.0, asr = 13.0, sunset = 18.0, isha = 18.0
        for _ in 0..<2 {
            let (pf, ps, pd, pa, pss, pi) = (fajr / 24, sunrise / 24, dhuhr / 24, asr / 24, sunset / 24, isha / 24)
            fajr = sunAngleTime(m.fajrAngle, pf, ccw: true)
            sunrise = sunAngleTime(0.833, ps, ccw: true)
            dhuhr = midDay(pd)
            asr = asrTime(asrFactor, pa)
            sunset = sunAngleTime(0.833, pss, ccw: false)
            isha = m.ishaMinutes != nil ? .nan : sunAngleTime(m.ishaAngle ?? 17, pi, ccw: false)
        }
        let shift = tz - lng / 15
        fajr += shift; sunrise += shift; dhuhr += shift; asr += shift; sunset += shift; isha += shift
        if let mins = m.ishaMinutes { isha = sunset + mins / 60 }

        // High latitudes: cap Fajr and Isha at angle/60 of the night (AlAdhan's default rule).
        let night = 24 + sunrise - sunset
        let fajrMax = night * m.fajrAngle / 60
        if fajr.isNaN || sunrise - fajr > fajrMax { fajr = sunrise - fajrMax }
        if m.ishaMinutes == nil, let ishaAngle = m.ishaAngle {
            let ishaMax = night * ishaAngle / 60
            if isha.isNaN || isha - sunset > ishaMax { isha = sunset + ishaMax }
        }
        return Hours(fajr: fajr, sunrise: sunrise, dhuhr: dhuhr, asr: asr, sunset: sunset, maghrib: sunset,
                     isha: isha, imsak: fajr - 10.0 / 60, midnight: sunset + night / 2)
    }

    /// Minutes after local midnight (0..<1440), rounded as the website rounds; nil when undefined.
    public static func minutes(_ h: Double) -> Int? {
        guard h.isFinite else { return nil }
        return Int((fix(h, 24) * 60).rounded(.toNearestOrAwayFromZero)) % 1440
    }

    /// "HH:MM" — identical to the website's output (used by the tests and the timetable).
    public static func hhmm(_ h: Double) -> String {
        guard let m = minutes(h) else { return "--:--" }
        return String(format: "%02d:%02d", m / 60, m % 60)
    }
}
