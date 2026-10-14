import Foundation
import SalaamStreetCore

/// A surah ready to read.
struct SurahContent {
    var arabic: [String]
    var translation: [String]?
    var transliteration: [String]?
    enum Origin { case device, network, recentCache }
    var origin: Origin
    /// Something the reader should say (e.g. the translation isn't downloaded).
    var note: String?
}

enum QuranLoadError: LocalizedError {
    case unavailableOffline
    case failed
    var errorDescription: String? {
        switch self {
        case .unavailableOffline: return "This surah isn't downloaded and you're offline. Download the Qur'an in Offline to read it anywhere."
        case .failed: return "The surah couldn't be loaded. Check your connection and try again."
        }
    }
}

/// Reads surahs from downloads first, then the network (AlQuran Cloud, as on the
/// website). Surahs read online are kept in a small cache (Caches folder, which
/// iOS may clear) so recently read ones also open offline — like the website.
@MainActor
enum QuranRepository {
    static let transliteration = "en.transliteration"
    static let arabicEdition = "quran-uthmani"

    private static var cacheDir: URL {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("RecentlyRead", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    static func load(surah: Int, translation: String, offline: OfflineLibrary) async throws -> SurahContent {
        guard let meta = ContentLibrary.shared.surah(surah) else { throw QuranLoadError.failed }
        let deviceArabic = offline.surahText(surah, edition: arabicEdition)
        let deviceTranslation = offline.surahText(surah, edition: translation)
        let deviceTranslit = offline.surahText(surah, edition: transliteration)
        if let a = deviceArabic, let t = deviceTranslation, let tl = deviceTranslit {
            return SurahContent(arabic: a, translation: t, transliteration: tl, origin: .device)
        }

        let editions = [arabicEdition, translation, transliteration]
        let cacheFile = cacheDir.appendingPathComponent("\(surah)-\(translation).json")
        do {
            let (data, response) = try await URLSession.shared.data(from: QuranMath.surahTextURL(surah: surah, editions: editions))
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw QuranLoadError.failed }
            let texts = try JSONDecoder().decode(SurahEditionsResponse.self, from: data).texts(editions: editions, ayahCount: meta.ayahCount)
            try? JSONEncoder().encode(texts).write(to: cacheFile, options: .atomic)
            return SurahContent(arabic: texts[arabicEdition] ?? [], translation: texts[translation], transliteration: texts[transliteration], origin: .network)
        } catch {
            if let data = try? Data(contentsOf: cacheFile), let texts = try? JSONDecoder().decode([String: [String]].self, from: data),
               let a = texts[arabicEdition], a.count == meta.ayahCount {
                return SurahContent(arabic: a, translation: texts[translation], transliteration: texts[transliteration], origin: .recentCache)
            }
            if let a = deviceArabic {
                return SurahContent(arabic: a, translation: deviceTranslation, transliteration: deviceTranslit, origin: .device,
                                    note: deviceTranslation == nil ? "Your chosen translation isn't downloaded, so only the Arabic is shown. Add it in Offline." : nil)
            }
            let offlineError = (error as? URLError).map { [.notConnectedToInternet, .networkConnectionLost, .dataNotAllowed].contains($0.code) } ?? false
            throw offlineError ? QuranLoadError.unavailableOffline : QuranLoadError.failed
        }
    }

    /// Tafsir Ibn Kathir for an ayah: downloaded copy first, then the network.
    static func tafsir(surah: Int, ayah: Int, offline: OfflineLibrary) async throws -> String {
        if let texts = offline.tafsir(surah: surah), ayah <= texts.count, !texts[ayah - 1].isEmpty { return texts[ayah - 1] }
        guard let count = ContentLibrary.shared.surah(surah)?.ayahCount else { throw QuranLoadError.failed }
        for mirror in 0..<ContentLibrary.shared.sources.tafsirMirrors.count {
            guard let url = QuranMath.tafsirSurahURL(surah: surah, mirror: mirror) else { continue }
            if let (data, _) = try? await URLSession.shared.data(from: url),
               let texts = try? TafsirFile.texts(from: data, surah: surah, ayahCount: count), !texts[ayah - 1].isEmpty {
                return texts[ayah - 1]
            }
        }
        throw QuranLoadError.unavailableOffline
    }
}
