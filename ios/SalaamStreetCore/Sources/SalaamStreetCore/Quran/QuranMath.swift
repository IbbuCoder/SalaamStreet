import Foundation

/// Ayah numbering and recitation URLs (same scheme as the website's js/surahs.js and js/core.js).
public enum QuranMath {
    public static let ayahCounts: [Int] = ContentLibrary.shared.surahs.map(\.ayahCount)

    /// offsets[surah - 1] + ayah = global ayah number (1...6236).
    public static let offsets: [Int] = {
        var out = [0]
        for i in 0..<(ayahCounts.count - 1) { out.append(out[i] + ayahCounts[i]) }
        return out
    }()

    public static var totalAyahs: Int { offsets[113] + ayahCounts[113] }

    public static func globalAyah(surah: Int, ayah: Int) -> Int { offsets[surah - 1] + ayah }

    public static func location(ofGlobalAyah g: Int) -> (surah: Int, ayah: Int) {
        var s = 1
        while s < 114 && offsets[s] < g { s += 1 }
        return (s, g - offsets[s - 1])
    }

    /// Bitrates each reciter is hosted at on the Islamic Network CDN, best first.
    /// Unknown reciters fall back to the website's probing order.
    public static func bitrates(for reciter: String) -> [Int] {
        let known: [String: [Int]] = [
            "ar.alafasy": [128, 64],
            "ar.husary": [128, 64],
            "ar.abdulbasitmurattal": [192, 64],
            "ar.minshawi": [128, 64],
        ]
        let fallback = ContentLibrary.shared.sources.audioBitrates
        return (known[reciter] ?? []) + fallback.filter { !(known[reciter] ?? []).contains($0) }
    }

    public static func audioURL(reciter: String, bitrate: Int, surah: Int, ayah: Int) -> URL {
        let s = ContentLibrary.shared.sources.audio
            .replacingOccurrences(of: "{bitrate}", with: String(bitrate))
            .replacingOccurrences(of: "{edition}", with: reciter)
            .replacingOccurrences(of: "{ayah}", with: String(globalAyah(surah: surah, ayah: ayah)))
        return URL(string: s)!
    }

    /// One request for a surah in several editions (Arabic, translation, transliteration).
    public static func surahTextURL(surah: Int, editions: [String]) -> URL {
        URL(string: ContentLibrary.shared.sources.alquran + "/surah/\(surah)/editions/" + editions.joined(separator: ","))!
    }

    public static func tafsirSurahURL(surah: Int, mirror: Int) -> URL? {
        let m = ContentLibrary.shared.sources.tafsirMirrors
        guard mirror < m.count else { return nil }
        return URL(string: m[mirror] + "/" + ContentLibrary.shared.sources.tafsirEdition + "/\(surah).json")
    }

    public static func hadithEditionURL(_ edition: String) -> URL {
        URL(string: ContentLibrary.shared.sources.hadith + "/" + edition + ".min.json")!
    }

    public static func hadithURL(edition: String, number: Int) -> URL {
        URL(string: ContentLibrary.shared.sources.hadith + "/" + edition + "/\(number).min.json")!
    }

    /// AlQuran Cloud prefixes ayah 1 with the basmala (except Al-Fatihah); the reader shows it
    /// separately, so it is removed — comparing letters only, since diacritics vary (website: stripBasmala).
    public static func stripBasmala(_ text: String, surah: Int) -> String {
        guard surah != 1 && surah != 9 else { return text }
        let words = text.replacingOccurrences(of: "\u{FEFF}", with: "").split(whereSeparator: { $0.isWhitespace })
        guard words.count >= 4 else { return text }
        let bare = String(String.UnicodeScalarView(words.prefix(4).joined(separator: " ").unicodeScalars.compactMap { u -> Unicode.Scalar? in
            switch u.value {
            case 0x064B...0x065F, 0x0670, 0x06D6...0x06ED, 0x0640: return nil
            case 0x0671: return Unicode.Scalar(0x0627)
            default: return u
            }
        }))
        return bare == "بسم الله الرحمن الرحيم" ? words.dropFirst(4).joined(separator: " ") : text
    }

    /// Juz containing an ayah.
    public static func juz(surah: Int, ayah: Int) -> Int {
        let g = globalAyah(surah: surah, ayah: ayah)
        var j = 1
        for entry in ContentLibrary.shared.juz where globalAyah(surah: entry.surah, ayah: entry.ayah) <= g { j = entry.number }
        return j
    }
}

/// The AlQuran Cloud response for several editions of one surah, decoded leniently and validated.
public struct SurahEditionsResponse: Decodable {
    public struct Edition: Decodable {
        public struct Ayah: Decodable { public let numberInSurah: Int; public let text: String }
        public struct Info: Decodable { public let identifier: String }
        public let edition: Info
        public let ayahs: [Ayah]
    }
    public let data: [Edition]

    /// Texts per edition, checked: every edition present with exactly `ayahCount` ayahs.
    public func texts(editions: [String], ayahCount: Int) throws -> [String: [String]] {
        var out: [String: [String]] = [:]
        for ed in editions {
            guard let e = data.first(where: { $0.edition.identifier == ed }), e.ayahs.count == ayahCount else {
                throw OfflineError.badResponse
            }
            out[ed] = e.ayahs.sorted { $0.numberInSurah < $1.numberInSurah }.map(\.text)
        }
        return out
    }
}
