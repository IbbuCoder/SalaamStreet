import Foundation

/// The Hijri date from the Umm al-Qura calendar (as the website does when offline).
/// Local moon-sighting can differ by a day; the app says so wherever it shows the date.
public struct HijriDate: Equatable, Sendable {
    public let day: Int
    public let month: Int
    public let year: Int

    public static let englishMonths = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani",
                                       "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul-Qi'dah", "Dhul-Hijjah"]
    public static let arabicMonths = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
                                      "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"]

    public init(day: Int, month: Int, year: Int) {
        self.day = day
        self.month = month
        self.year = year
    }

    public init(date: Date, timeZone: TimeZone = .current) {
        var c = Calendar(identifier: .islamicUmmAlQura)
        c.timeZone = timeZone
        let d = c.dateComponents([.day, .month, .year], from: date)
        self.init(day: d.day ?? 1, month: d.month ?? 1, year: d.year ?? 1)
    }

    public var englishMonth: String { Self.englishMonths[max(0, min(11, month - 1))] }
    public var arabicMonth: String { Self.arabicMonths[max(0, min(11, month - 1))] }
    public var english: String { "\(day) \(englishMonth) \(year) AH" }
    public var arabic: String { "\(day) \(arabicMonth) \(year) هـ" }
    public var isRamadan: Bool { month == 9 }
}
