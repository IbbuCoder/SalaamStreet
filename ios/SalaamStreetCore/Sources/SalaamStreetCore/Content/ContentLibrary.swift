import Foundation

/// Content shared with the website: generated from its data files by
/// `tools/build-ios-content.js` and bundled, so it is always available offline.
public struct ContentLibrary: Decodable, Sendable {
    public struct Surah: Decodable, Hashable, Sendable, Identifiable {
        public let number: Int
        public let arabicName: String
        public let englishName: String
        public let meaning: String
        public let ayahCount: Int
        public let revelation: String
        public var id: Int { number }
        public var isMeccan: Bool { revelation == "meccan" }
    }
    public struct Juz: Decodable, Hashable, Sendable, Identifiable {
        public let number: Int, surah: Int, ayah: Int
        public var id: Int { number }
    }
    public struct Translation: Decodable, Hashable, Sendable, Identifiable {
        public let id: String, label: String, language: String
        public let rightToLeft: Bool
    }
    public struct Reciter: Decodable, Hashable, Sendable, Identifiable {
        public let id: String, englishName: String, arabicName: String
    }
    public struct CalculationMethod: Decodable, Hashable, Sendable, Identifiable {
        public let id: Int, englishName: String, arabicName: String
    }
    public struct DuaCategory: Decodable, Hashable, Sendable, Identifiable {
        public let id: String, symbol: String, englishName: String, arabicName: String
    }
    public struct Dua: Decodable, Hashable, Sendable, Identifiable {
        public let id: String, category: String, title: String, arabic: String
        public let transliteration: String, translation: String, source: String
    }
    public struct DhikrPreset: Decodable, Hashable, Sendable, Identifiable {
        public let id: String, arabic: String, title: String, meaning: String
        public let target: Int
        public let source: String
    }
    public struct NameOfAllah: Decodable, Hashable, Sendable, Identifiable {
        public let number: Int, arabic: String, transliteration: String, meaning: String
        public var id: Int { number }
    }
    public struct HadithCollection: Decodable, Hashable, Sendable, Identifiable {
        public let id: String, group: String, englishName: String, arabicName: String
        public let englishEdition: String, arabicEdition: String
        /// The forty-hadith collections, read as a whole; the large books are browsed by number.
        public let complete: Bool
        public let lastNumber: Int
        public let mixedGrades: Bool
        public let citation: String
    }
    public struct IslamicEvent: Decodable, Hashable, Sendable {
        public let month: Int, day: Int, englishName: String, arabicName: String, note: String
    }
    public struct Sources: Decodable, Sendable {
        public let alquran: String, aladhan: String, audio: String
        public let audioBitrates: [Int]
        public let tafsirMirrors: [String]
        public let tafsirEdition: String
        public let hadith: String
    }

    public let surahs: [Surah]
    public let juz: [Juz]
    public let translations: [Translation]
    public let reciters: [Reciter]
    public let calculationMethods: [CalculationMethod]
    public let duaCategories: [DuaCategory]
    public let duas: [Dua]
    public let dhikrPresets: [DhikrPreset]
    public let namesOfAllah: [NameOfAllah]
    public let hadithCollections: [HadithCollection]
    public let islamicEvents: [IslamicEvent]
    public let sources: Sources

    /// The bundled library. Loading can only fail if the app was built without its resources.
    public static let shared: ContentLibrary = {
        do { return try load() } catch { fatalError("SalaamStreetCore: bundled content.json is missing or invalid: \(error)") }
    }()

    public static func load() throws -> ContentLibrary {
        guard let url = Bundle.module.url(forResource: "content", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try JSONDecoder().decode(ContentLibrary.self, from: Data(contentsOf: url))
    }

    public func surah(_ n: Int) -> Surah? { (1...surahs.count).contains(n) ? surahs[n - 1] : nil }
    public func reciter(_ id: String) -> Reciter? { reciters.first { $0.id == id } }
    public func translation(_ id: String) -> Translation? { translations.first { $0.id == id } }
    public func duas(in category: String) -> [Dua] { duas.filter { $0.category == category } }
    public func hadithCollection(_ id: String) -> HadithCollection? { hadithCollections.first { $0.id == id } }
}
