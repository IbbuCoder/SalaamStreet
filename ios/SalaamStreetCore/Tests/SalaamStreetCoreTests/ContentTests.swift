import XCTest
@testable import SalaamStreetCore

final class ContentTests: XCTestCase {
    func testBundledLibraryIsComplete() throws {
        let lib = try ContentLibrary.load()
        XCTAssertEqual(lib.surahs.count, 114)
        XCTAssertEqual(lib.surahs.map(\.ayahCount).reduce(0, +), 6236)
        XCTAssertEqual(lib.namesOfAllah.count, 99)
        XCTAssertEqual(lib.juz.count, 30)
        XCTAssertFalse(lib.duas.isEmpty)
        XCTAssertTrue(lib.duas.allSatisfy { !$0.source.isEmpty && !$0.arabic.isEmpty }, "every dua carries its source")
        XCTAssertTrue(lib.duas.allSatisfy { d in lib.duaCategories.contains { $0.id == d.category } })
        XCTAssertTrue(lib.dhikrPresets.allSatisfy { $0.target > 0 && !$0.source.isEmpty })
        XCTAssertEqual(Set(lib.calculationMethods.map(\.id)), Set(PrayerCalculator.methods.keys), "every method the app offers can be calculated")
        XCTAssertNotNil(lib.reciter("ar.alafasy"))
        XCTAssertNotNil(lib.translation("en.sahih"))
    }

    func testAyahNumbering() {
        XCTAssertEqual(QuranMath.totalAyahs, 6236)
        XCTAssertEqual(QuranMath.globalAyah(surah: 2, ayah: 255), 262)
        XCTAssertEqual(QuranMath.location(ofGlobalAyah: 262).surah, 2)
        XCTAssertEqual(QuranMath.location(ofGlobalAyah: 262).ayah, 255)
        XCTAssertEqual(QuranMath.location(ofGlobalAyah: 6236).surah, 114)
        XCTAssertEqual(QuranMath.juz(surah: 2, ayah: 142), 2)
        XCTAssertEqual(QuranMath.juz(surah: 114, ayah: 6), 30)
        XCTAssertEqual(QuranMath.audioURL(reciter: "ar.alafasy", bitrate: 128, surah: 1, ayah: 1).absoluteString,
                       "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3")
        XCTAssertEqual(QuranMath.bitrates(for: "ar.abdulbasitmurattal").first, 192)
    }

    func testBasmalaIsShownSeparately() {
        let first = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ الٓمٓ"
        XCTAssertEqual(QuranMath.stripBasmala(first, surah: 2), "الٓمٓ")
        XCTAssertEqual(QuranMath.stripBasmala(first, surah: 1), first, "in Al-Fatihah the basmala is ayah 1")
        XCTAssertEqual(QuranMath.stripBasmala("قُلْ هُوَ ٱللَّهُ أَحَدٌ", surah: 112), "قُلْ هُوَ ٱللَّهُ أَحَدٌ")
    }

    func testSurahResponseIsValidated() throws {
        let json = #"{"data":[{"edition":{"identifier":"quran-uthmani"},"ayahs":[{"numberInSurah":2,"text":"b"},{"numberInSurah":1,"text":"a"}]},{"edition":{"identifier":"en.sahih"},"ayahs":[{"numberInSurah":1,"text":"A"},{"numberInSurah":2,"text":"B"}]}]}"#
        let r = try JSONDecoder().decode(SurahEditionsResponse.self, from: Data(json.utf8))
        XCTAssertEqual(try r.texts(editions: ["quran-uthmani", "en.sahih"], ayahCount: 2)["quran-uthmani"], ["a", "b"])
        XCTAssertThrowsError(try r.texts(editions: ["quran-uthmani"], ayahCount: 3))
        XCTAssertThrowsError(try r.texts(editions: ["fr.hamidullah"], ayahCount: 2))
    }

    func testHijri() {
        // 1 Ramadan 1447 AH = 18 February 2026 (Umm al-Qura).
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Asia/Riyadh")!
        let d = c.date(from: DateComponents(year: 2026, month: 2, day: 18, hour: 12))!
        let h = HijriDate(date: d, timeZone: c.timeZone)
        XCTAssertEqual(h.month, 9)
        XCTAssertEqual(h.year, 1447)
        XCTAssertTrue(h.isRamadan)
        XCTAssertEqual(h.english, "\(h.day) Ramadan 1447 AH")
    }
}
