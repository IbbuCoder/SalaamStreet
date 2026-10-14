import Foundation

/// What the person is told when a download stops. Mirrors the website's
/// quota | offline | storage | failed reasons, plus a corrupted-file case.
public enum OfflineError: String, Error, Codable, Sendable, Equatable {
    case offline, quota, storage, badResponse, notFound, failed, corrupt

    public var message: String {
        switch self {
        case .offline: return "You're offline. The download will carry on when you're connected again."
        case .quota: return "There isn't enough free space on this iPhone. Free up some space or download less."
        case .storage: return "SalaamStreet couldn't save to this iPhone's storage. Try again."
        case .badResponse: return "The download source sent something unexpected. Try again later."
        case .notFound: return "This content isn't available from its source right now."
        case .failed: return "The download didn't finish. Try again."
        case .corrupt: return "A downloaded file was damaged, so it was removed. Download it again to use it offline."
        }
    }
}

/// The kinds of content that can be downloaded.
public enum OfflineKind: String, Codable, Sendable, CaseIterable {
    case quranText, tafsir, audio, hadith
}

/// A downloadable thing, identified the same way as on the website:
/// "text:<edition>", "tafsir", "audio:<reciter>", plus "hadith:<collection>".
public struct OfflinePackID: Hashable, Codable, Sendable, CustomStringConvertible {
    public let kind: OfflineKind
    public let key: String

    public init(kind: OfflineKind, key: String = "") {
        self.kind = kind
        self.key = key
    }

    public static func text(_ edition: String) -> Self { .init(kind: .quranText, key: edition) }
    public static let tafsir = Self(kind: .tafsir)
    public static func audio(_ reciter: String) -> Self { .init(kind: .audio, key: reciter) }
    public static func hadith(_ collection: String) -> Self { .init(kind: .hadith, key: collection) }

    public var description: String {
        switch kind {
        case .quranText: return "text:" + key
        case .tafsir: return "tafsir"
        case .audio: return "audio:" + key
        case .hadith: return "hadith:" + key
        }
    }

    public init?(string: String) {
        if string == "tafsir" { self = .tafsir; return }
        let parts = string.split(separator: ":", maxSplits: 1).map(String.init)
        guard parts.count == 2, !parts[1].isEmpty else { return nil }
        switch parts[0] {
        case "text": self = .text(parts[1])
        case "audio": self = .audio(parts[1])
        case "hadith": self = .hadith(parts[1])
        default: return nil
        }
    }

    /// How many units make the pack complete: 114 surahs, or a hadith collection's two editions.
    public var unitCount: Int { kind == .hadith ? 2 : 114 }
}

/// What has been downloaded for one pack: unit → bytes stored. Units are surah
/// numbers (text, tafsir, audio) or 1 = English and 2 = Arabic (hadith).
public struct OfflinePack: Codable, Sendable, Equatable {
    public var id: String
    public var units: [Int: Int64]
    public var updatedAt: Date

    public init(id: OfflinePackID, units: [Int: Int64] = [:], updatedAt: Date = Date()) {
        self.id = id.description
        self.units = units
        self.updatedAt = updatedAt
    }

    public var packID: OfflinePackID? { OfflinePackID(string: id) }
    public var bytes: Int64 { units.values.reduce(0, +) }
    public var isComplete: Bool { units.count >= (packID?.unitCount ?? 114) }
}

public enum JobStatus: String, Codable, Sendable {
    case queued, running, paused, waitingForNetwork, failed
}

/// A download in progress; persisted, so it carries on after the app is closed.
public struct DownloadJob: Codable, Sendable, Identifiable, Equatable {
    public var id: String { pack.description }
    public var pack: OfflinePackID
    /// The units this job wants (e.g. the surahs chosen for recitation).
    public var units: [Int]
    public var status: JobStatus
    public var failure: OfflineError?
    public var createdAt: Date

    public init(pack: OfflinePackID, units: [Int], status: JobStatus = .queued, failure: OfflineError? = nil, createdAt: Date = Date()) {
        self.pack = pack
        self.units = units.sorted()
        self.status = status
        self.failure = failure
        self.createdAt = createdAt
    }
}

/// Everything the offline store knows: kept as one small JSON file next to the downloads.
public struct OfflineManifest: Codable, Sendable, Equatable {
    public var version = 1
    public var packs: [String: OfflinePack] = [:]
    public var jobs: [DownloadJob] = []

    public init() {}

    public func pack(_ id: OfflinePackID) -> OfflinePack? { packs[id.description] }
    public func has(_ id: OfflinePackID, unit: Int) -> Bool { packs[id.description]?.units[unit] != nil }
    public func isComplete(_ id: OfflinePackID) -> Bool { packs[id.description]?.isComplete ?? false }
    public func bytes(_ id: OfflinePackID) -> Int64 { packs[id.description]?.bytes ?? 0 }
    public var totalBytes: Int64 { packs.values.reduce(0) { $0 + $1.bytes } }
    public func job(_ id: OfflinePackID) -> DownloadJob? { jobs.first { $0.pack == id } }

    public mutating func record(_ id: OfflinePackID, unit: Int, bytes: Int64, at date: Date = Date()) {
        var p = packs[id.description] ?? OfflinePack(id: id)
        p.units[unit] = bytes
        p.updatedAt = date
        packs[id.description] = p
    }

    public mutating func forget(_ id: OfflinePackID, units: [Int]? = nil) {
        guard var p = packs[id.description] else { return }
        if let units { units.forEach { p.units[$0] = nil } } else { p.units = [:] }
        packs[id.description] = p.units.isEmpty ? nil : p
    }

    /// Units a job still has to fetch.
    public func remaining(_ job: DownloadJob) -> [Int] { job.units.filter { !has(job.pack, unit: $0) } }

    /// Add a job, or merge more units into an existing one for the same pack (no duplicate downloads).
    public mutating func enqueue(_ id: OfflinePackID, units: [Int], at date: Date = Date()) {
        let wanted = units.filter { !has(id, unit: $0) }
        guard !wanted.isEmpty else { return }
        if let i = jobs.firstIndex(where: { $0.pack == id }) {
            jobs[i].units = Array(Set(jobs[i].units + wanted)).sorted()
            if jobs[i].status != .running { jobs[i].status = .queued; jobs[i].failure = nil }
        } else {
            jobs.append(DownloadJob(pack: id, units: wanted, createdAt: date))
        }
    }

    /// After a relaunch: anything that was running starts again; paused or failed jobs wait for the person.
    public mutating func restoreAfterLaunch() {
        for i in jobs.indices where jobs[i].status == .running || jobs[i].status == .waitingForNetwork {
            jobs[i].status = .queued
        }
    }
}

/// Where each unit lives, relative to the offline folder.
public enum OfflinePaths {
    public static func file(for id: OfflinePackID, unit: Int) -> String {
        switch id.kind {
        case .quranText: return "quran/text/\(id.key)/\(unit).json"
        case .tafsir: return "quran/tafsir/ibn-kathir/\(unit).json"
        case .audio: return "audio/\(id.key)/\(unit)" // a folder of ayah files: <global ayah>.mp3
        case .hadith: return "hadith/\(id.key)/\(unit == 2 ? "ara" : "eng").json"
        }
    }

    public static func audioFile(reciter: String, surah: Int, ayah: Int) -> String {
        "audio/\(reciter)/\(surah)/\(QuranMath.globalAyah(surah: surah, ayah: ayah)).mp3"
    }

    /// The folder that removing a whole pack deletes.
    public static func folder(for id: OfflinePackID) -> String {
        switch id.kind {
        case .quranText: return "quran/text/\(id.key)"
        case .tafsir: return "quran/tafsir/ibn-kathir"
        case .audio: return "audio/\(id.key)"
        case .hadith: return "hadith/\(id.key)"
        }
    }
}

/// Sizes shown before downloading (real sizes replace them afterwards). Same
/// figures as the website's js/offline.js, plus hadith collections.
public enum OfflineEstimate {
    public static let megabyte: Int64 = 1_048_576
    static let textMB: [String: Double] = [
        "quran-uthmani": 1.4, "en.transliteration": 0.9, "en.sahih": 0.8, "ur.jalandhry": 1.3, "id.indonesian": 0.9,
        "tr.diyanet": 0.8, "bn.bengali": 2.2, "fr.hamidullah": 0.9, "ms.basmeih": 0.9, "es.cortes": 0.8, "de.bubenheim": 0.9,
    ]
    static let secondsPerPage: [String: Double] = ["ar.alafasy": 105, "ar.husary": 130, "ar.abdulbasitmurattal": 150, "ar.minshawi": 135]
    static let pageStart: [Int] = [1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312, 322, 332,
        342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502,
        507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568,
        570, 572, 574, 575, 577, 578, 580, 582, 583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596,
        597, 597, 598, 598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604]
    static let weights: [Double] = {
        var w: [Double] = []
        for i in 0..<114 {
            let span = i < 113 ? Double(pageStart[i + 1] - pageStart[i]) : 0
            w.append(max(span, 0.3))
        }
        let sum = w.reduce(0, +)
        return w.map { $0 / sum }
    }()

    public static func edition(_ id: String) -> Int64 { Int64(((textMB[id] ?? 0.9) * Double(megabyte)).rounded()) }
    public static var tafsir: Int64 { 16 * megabyte }

    public static func audio(reciter: String, surahs: [Int], bitrate: Int = 128) -> Int64 {
        let whole = (secondsPerPage[reciter] ?? 120) * 604 * Double(bitrate) * 1000 / 8
        let w = surahs.filter { (1...114).contains($0) }.reduce(0.0) { $0 + weights[$1 - 1] }
        return Int64((whole * w).rounded())
    }

    /// About 1.2 KB per hadith for English and Arabic together.
    public static func hadith(lastNumber: Int) -> Int64 { Int64(lastNumber) * 1200 }
}

/// "820 KB", "1.4 MB", "1.1 GB" — the website's format.
public enum ByteSize {
    public static func format(_ bytes: Int64) -> String {
        let b = Double(max(bytes, 0))
        if b >= 1_073_741_824 { return String(format: "%.1f GB", b / 1_073_741_824) }
        if b >= 1_048_576 { return String(format: "%.1f MB", b / 1_048_576) }
        return "\(max(1, Int((b / 1024).rounded()))) KB"
    }

    public static func approx(_ bytes: Int64) -> String { "about " + format(bytes) }
}
