import Foundation
import UIKit
import SalaamStreetCore

/// Downloads for offline use, kept in Application Support/Offline (excluded
/// from iCloud backup, since everything can be downloaded again).
///
/// • One small manifest (manifest.json) records what is stored and what is
///   still downloading, so downloads survive the app closing and carry on at
///   the next launch, skipping whatever is already stored.
/// • Files are written atomically and checked when read: a damaged file is
///   removed and the person is told, instead of the app showing bad text.
/// • Free space is checked before starting, and a full disk stops the download
///   with a clear message rather than retrying.
@MainActor
final class OfflineLibrary: ObservableObject {
    struct Progress: Equatable {
        var done: Int
        var total: Int
        var bytes: Int64
        var fraction: Double { total == 0 ? 0 : Double(done) / Double(total) }
    }

    @Published private(set) var manifest: OfflineManifest
    @Published private(set) var progress: [String: Progress] = [:]
    /// Bytes actually on disk (measured), and free space on the device.
    @Published private(set) var diskBytes: Int64?
    @Published private(set) var freeSpace: Int64?
    /// A message for the person (shown once, then cleared by the view).
    @Published var notice: String?

    let root: URL
    private var runner: Task<Void, Never>?
    private var runningID: String?
    private var stopReason: [String: JobStatus] = [:] // pause or cancel requested
    private var cancelling: Set<String> = []
    private var online = true
    /// Bumped by removeAll(): a download still finishing must not write anything back (as on the website).
    private var generation = 0
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        var dir = support.appendingPathComponent("Offline", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? dir.setResourceValues(values)
        root = dir
        var m = (try? JSONDecoder().decode(OfflineManifest.self, from: Data(contentsOf: dir.appendingPathComponent("manifest.json")))) ?? OfflineManifest()
        m.restoreAfterLaunch()
        manifest = m
        verifyStoredFiles()
        refreshDiskUsage()
        kick()
    }

    // MARK: - Reading (used by the Qur'an reader, tafsir, player and hadith)

    func hasText(surah: Int, editions: [String]) -> Bool { editions.allSatisfy { manifest.has(.text($0), unit: surah) } }

    /// Ayah texts for a surah in one edition, or nil when not downloaded (or damaged — then it is removed).
    func surahText(_ surah: Int, edition: String) -> [String]? {
        readJSON([String].self, pack: .text(edition), unit: surah)
    }

    func tafsir(surah: Int) -> [String]? { readJSON([String].self, pack: .tafsir, unit: surah) }

    func hasAudio(reciter: String, surah: Int) -> Bool { manifest.has(.audio(reciter), unit: surah) }

    /// A playable local file for an ayah, if its surah is downloaded.
    func audioFile(reciter: String, surah: Int, ayah: Int) -> URL? {
        guard hasAudio(reciter: reciter, surah: surah) else { return nil }
        let url = root.appendingPathComponent(OfflinePaths.audioFile(reciter: reciter, surah: surah, ayah: ayah))
        guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 0 else {
            forgetDamaged(.audio(reciter), unit: surah)
            return nil
        }
        return url
    }

    func hadith(collection: String, arabic: Bool) -> HadithEdition? {
        readJSON(HadithEdition.self, pack: .hadith(collection), unit: arabic ? 2 : 1)
    }

    private func readJSON<T: Decodable>(_ type: T.Type, pack: OfflinePackID, unit: Int) -> T? {
        guard manifest.has(pack, unit: unit) else { return nil }
        let url = root.appendingPathComponent(OfflinePaths.file(for: pack, unit: unit))
        do {
            return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
        } catch {
            forgetDamaged(pack, unit: unit)
            return nil
        }
    }

    private func forgetDamaged(_ pack: OfflinePackID, unit: Int) {
        try? FileManager.default.removeItem(at: root.appendingPathComponent(OfflinePaths.file(for: pack, unit: unit)))
        manifest.forget(pack, units: [unit])
        save()
        notice = OfflineError.corrupt.message
    }

    /// At launch: anything the manifest lists but the disk no longer has is forgotten.
    private func verifyStoredFiles() {
        var changed = false
        for (key, pack) in manifest.packs {
            guard let id = OfflinePackID(string: key) else { manifest.packs[key] = nil; changed = true; continue }
            for unit in pack.units.keys {
                let path = root.appendingPathComponent(OfflinePaths.file(for: id, unit: unit))
                var ok = FileManager.default.fileExists(atPath: path.path)
                if ok, id.kind == .audio, let count = ContentLibrary.shared.surah(unit)?.ayahCount {
                    ok = ((try? FileManager.default.contentsOfDirectory(atPath: path.path))?.count ?? 0) >= count
                }
                if !ok { manifest.forget(id, units: [unit]); changed = true }
            }
        }
        if changed { save() }
    }

    // MARK: - Downloading

    /// Queue a download. Asks nothing; the view confirms large downloads first.
    func download(_ id: OfflinePackID, units: [Int]) {
        let wanted = units.filter { !manifest.has(id, unit: $0) }
        guard !wanted.isEmpty else { return }
        refreshFreeSpace()
        if let free = freeSpace, estimate(id, units: wanted) + 200 * OfflineEstimate.megabyte > free {
            notice = OfflineError.quota.message
            return
        }
        manifest.enqueue(id, units: wanted)
        save()
        kick()
    }

    func pause(_ id: OfflinePackID) {
        guard let i = manifest.jobs.firstIndex(where: { $0.pack == id }) else { return }
        if runningID == id.description { stopReason[id.description] = .paused; runner?.cancel() }
        else { manifest.jobs[i].status = .paused; save() }
    }

    func resume(_ id: OfflinePackID) {
        guard let i = manifest.jobs.firstIndex(where: { $0.pack == id }), runningID != id.description else { return }
        manifest.jobs[i].status = .queued
        manifest.jobs[i].failure = nil
        save()
        kick()
    }

    /// Stop and drop the download. Finished recitation surahs are kept; a half-downloaded
    /// text, tafsir or hadith pack is removed (it can't be read in part), as on the website.
    func cancel(_ id: OfflinePackID) {
        if runningID == id.description {
            cancelling.insert(id.description)
            stopReason[id.description] = .failed
            runner?.cancel()
        } else {
            finishCancel(id)
        }
    }

    private func finishCancel(_ id: OfflinePackID) {
        manifest.jobs.removeAll { $0.pack == id }
        if id.kind != .audio && !manifest.isComplete(id) { removeFiles(id, units: nil) }
        progress[id.description] = nil
        save()
        refreshDiskUsage()
    }

    /// Remove a pack, or some of its units (e.g. one surah's recitation).
    func remove(_ id: OfflinePackID, units: [Int]? = nil) {
        if units == nil, manifest.job(id) != nil { cancel(id) }
        removeFiles(id, units: units)
        save()
        refreshDiskUsage()
    }

    /// Remove every download from this device.
    func removeAll() {
        generation += 1
        runner?.cancel()
        runner = nil
        runningID = nil
        stopReason = [:]
        cancelling = []
        progress = [:]
        manifest = OfflineManifest()
        if let items = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
            items.forEach { try? FileManager.default.removeItem(at: $0) }
        }
        save()
        refreshDiskUsage()
    }

    func networkChanged(online: Bool) {
        self.online = online
        if online {
            var any = false
            for i in manifest.jobs.indices where manifest.jobs[i].status == .waitingForNetwork {
                manifest.jobs[i].status = .queued
                any = true
            }
            if any { save(); kick() }
        } else if let id = runningID {
            stopReason[id] = .waitingForNetwork
            runner?.cancel()
        }
    }

    private func removeFiles(_ id: OfflinePackID, units: [Int]?) {
        let fm = FileManager.default
        if let units {
            units.forEach { try? fm.removeItem(at: root.appendingPathComponent(OfflinePaths.file(for: id, unit: $0))) }
            manifest.forget(id, units: units)
        } else {
            try? fm.removeItem(at: root.appendingPathComponent(OfflinePaths.folder(for: id)))
            manifest.forget(id)
        }
    }

    func estimate(_ id: OfflinePackID, units: [Int]) -> Int64 {
        switch id.kind {
        case .quranText: return OfflineEstimate.edition(id.key) * Int64(units.count) / 114
        case .tafsir: return OfflineEstimate.tafsir * Int64(units.count) / 114
        case .audio: return OfflineEstimate.audio(reciter: id.key, surahs: units, bitrate: LocalStore.load(Int.self, key: "bitrate." + id.key) ?? 128)
        case .hadith:
            let last = ContentLibrary.shared.hadithCollection(id.key)?.lastNumber ?? 40
            return OfflineEstimate.hadith(lastNumber: last) * Int64(units.count) / 2
        }
    }

    /// Run the next queued job (one at a time; each runs a few requests in parallel).
    private func kick() {
        guard runner == nil else { return }
        if !online {
            for i in manifest.jobs.indices where manifest.jobs[i].status == .queued {
                manifest.jobs[i].status = .waitingForNetwork
            }
            save()
            return
        }
        guard let job = manifest.jobs.first(where: { $0.status == .queued }) else { endBackgroundTask(); return }
        beginBackgroundTask()
        runningID = job.id
        setStatus(job.pack, .running, failure: nil)
        let gen = generation
        runner = Task { [weak self] in
            await self?.run(job)
            guard let self, gen == self.generation else { return } // removeAll() already reset the runner
            self.runner = nil
            self.runningID = nil
            self.kick()
        }
    }

    private func run(_ job: DownloadJob) async {
        let id = job.pack
        let gen = generation
        let remaining = manifest.remaining(job)
        progress[job.id] = Progress(done: job.units.count - remaining.count, total: job.units.count,
                                    bytes: job.units.reduce(0) { $0 + (manifest.pack(id)?.units[$1] ?? 0) })
        var failure: OfflineError?
        do {
            var bitrate = 128
            if id.kind == .audio { bitrate = try await Self.findBitrate(reciter: id.key); LocalStore.save(bitrate, key: "bitrate." + id.key) }
            let root = self.root
            try await withThrowingTaskGroup(of: (Int, Int64).self) { group in
                var queue = remaining[...]
                let parallel = id.kind == .audio ? 1 : 4 // audio runs 4 ayahs at a time inside each surah
                func launch() {
                    guard let unit = queue.popFirst() else { return }
                    group.addTask { (unit, try await Self.fetch(id, unit: unit, bitrate: bitrate, root: root)) }
                }
                for _ in 0..<parallel { launch() }
                while let result = try await group.next() {
                    guard gen == generation else { group.cancelAll(); return }
                    let (unit, bytes) = result
                    manifest.record(id, unit: unit, bytes: bytes)
                    save()
                    progress[job.id]?.done += 1
                    progress[job.id]?.bytes += bytes
                    launch()
                }
            }
        } catch {
            failure = Self.classify(error)
        }

        let key = job.id
        guard gen == generation else { return } // everything was removed meanwhile
        if cancelling.remove(key) != nil {
            stopReason[key] = nil
            finishCancel(id)
            return
        }
        if let reason = stopReason.removeValue(forKey: key) {
            setStatus(id, reason, failure: reason == .waitingForNetwork ? .offline : nil)
        } else if let failure {
            setStatus(id, failure == .offline ? .waitingForNetwork : .failed, failure: failure)
            notice = failure.message
        } else {
            manifest.jobs.removeAll { $0.pack == id }
            progress[key] = nil
            save()
            notice = "Downloaded. It's now available without an internet connection."
        }
        refreshDiskUsage()
    }

    private func setStatus(_ id: OfflinePackID, _ status: JobStatus, failure: OfflineError?) {
        guard let i = manifest.jobs.firstIndex(where: { $0.pack == id }) else { return }
        manifest.jobs[i].status = status
        manifest.jobs[i].failure = failure
        save()
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(manifest) else { return }
        do { try data.write(to: root.appendingPathComponent("manifest.json"), options: .atomic) }
        catch { notice = OfflineError.storage.message }
    }

    // MARK: - Storage figures

    func refreshFreeSpace() {
        let v = try? root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        freeSpace = v?.volumeAvailableCapacityForImportantUsage
    }

    /// Measure what SalaamStreet's downloads take on disk (off the main thread).
    func refreshDiskUsage() {
        refreshFreeSpace()
        let root = self.root
        Task.detached(priority: .utility) {
            var total: Int64 = 0
            if let e = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileSizeKey]) {
                for case let url as URL in e {
                    let v = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileSizeKey])
                    total += Int64(v?.totalFileAllocatedSize ?? v?.fileSize ?? 0)
                }
            }
            await MainActor.run { [weak self] in self?.diskBytes = total }
        }
    }

    // MARK: - Background time (a download keeps going briefly when the app is closed)

    private func beginBackgroundTask() {
        guard backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "SalaamStreet downloads") { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                if let id = self.runningID { self.stopReason[id] = .queued; self.runner?.cancel() }
                self.endBackgroundTask()
            }
        }
    }

    private func endBackgroundTask() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    // MARK: - Network work (off the main actor)

    private static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 30
        c.waitsForConnectivity = false
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: c)
    }()

    nonisolated static func classify(_ error: Error) -> OfflineError {
        if let e = error as? OfflineError { return e }
        if error is CancellationError { return .failed }
        if let e = error as? URLError {
            switch e.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .internationalRoamingOff: return .offline
            case .fileDoesNotExist: return .notFound
            case .cannotWriteToFile: return .storage
            default: return .failed
            }
        }
        let ns = error as NSError
        if ns.domain == NSCocoaErrorDomain && (ns.code == NSFileWriteOutOfSpaceError) { return .quota }
        if ns.domain == NSPOSIXErrorDomain && ns.code == Int(ENOSPC) { return .quota }
        if ns.domain == NSCocoaErrorDomain { return .storage }
        return .failed
    }

    /// GET with a few retries and back-off; never retries a lost connection or a full disk.
    nonisolated static func getData(_ url: URL) async throws -> Data {
        var attempt = 0
        while true {
            attempt += 1
            do {
                let (data, response) = try await session.data(from: url)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if status == 404 { throw OfflineError.notFound }
                guard (200..<300).contains(status), !data.isEmpty else { throw OfflineError.badResponse }
                return data
            } catch {
                let why = classify(error)
                if Task.isCancelled || why == .offline || why == .notFound || attempt >= 3 { throw error }
                try await Task.sleep(nanoseconds: UInt64(800_000_000 * (1 << (attempt - 1))))
            }
        }
    }

    nonisolated static func write(_ data: Data, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }

    /// The bitrate the CDN serves this reciter at (remembered after the first probe).
    nonisolated static func findBitrate(reciter: String) async throws -> Int {
        if let known = LocalStore.load(Int.self, key: "bitrate." + reciter) { return known }
        for br in QuranMath.bitrates(for: reciter) {
            var req = URLRequest(url: QuranMath.audioURL(reciter: reciter, bitrate: br, surah: 1, ayah: 1))
            req.httpMethod = "HEAD"
            let (_, response) = try await session.data(for: req)
            if (response as? HTTPURLResponse)?.statusCode == 200 { return br }
        }
        throw OfflineError.notFound
    }

    /// Download one unit and return the bytes stored.
    nonisolated static func fetch(_ id: OfflinePackID, unit: Int, bitrate: Int, root: URL) async throws -> Int64 {
        try Task.checkCancellation()
        switch id.kind {
        case .quranText:
            guard let count = ContentLibrary.shared.surah(unit)?.ayahCount else { throw OfflineError.badResponse }
            let data = try await getData(QuranMath.surahTextURL(surah: unit, editions: [id.key]))
            let texts = try JSONDecoder().decode(SurahEditionsResponse.self, from: data).texts(editions: [id.key], ayahCount: count)[id.key] ?? []
            let out = try JSONEncoder().encode(texts)
            try write(out, to: root.appendingPathComponent(OfflinePaths.file(for: id, unit: unit)))
            return Int64(out.count)

        case .tafsir:
            guard let count = ContentLibrary.shared.surah(unit)?.ayahCount else { throw OfflineError.badResponse }
            var lastError: Error = OfflineError.notFound
            for mirror in 0..<ContentLibrary.shared.sources.tafsirMirrors.count {
                guard let url = QuranMath.tafsirSurahURL(surah: unit, mirror: mirror) else { continue }
                do {
                    let data = try await getData(url)
                    let texts = try TafsirFile.texts(from: data, surah: unit, ayahCount: count)
                    let out = try JSONEncoder().encode(texts)
                    try write(out, to: root.appendingPathComponent(OfflinePaths.file(for: id, unit: unit)))
                    return Int64(out.count)
                } catch {
                    if classify(error) == .offline || Task.isCancelled { throw error }
                    lastError = error
                }
            }
            throw lastError

        case .hadith:
            guard let c = ContentLibrary.shared.hadithCollection(id.key) else { throw OfflineError.notFound }
            let data = try await getData(QuranMath.hadithEditionURL(unit == 2 ? c.arabicEdition : c.englishEdition))
            let edition = try JSONDecoder().decode(HadithEdition.self, from: data)
            guard !edition.hadiths.isEmpty else { throw OfflineError.badResponse }
            try write(data, to: root.appendingPathComponent(OfflinePaths.file(for: id, unit: unit)))
            return Int64(data.count)

        case .audio:
            guard let count = ContentLibrary.shared.surah(unit)?.ayahCount else { throw OfflineError.badResponse }
            let reciter = id.key
            return try await withThrowingTaskGroup(of: Int64.self) { group in
                var next = 1
                func launch() {
                    guard next <= count else { return }
                    let ayah = next
                    next += 1
                    group.addTask {
                        let dest = root.appendingPathComponent(OfflinePaths.audioFile(reciter: reciter, surah: unit, ayah: ayah))
                        if let size = try? dest.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 0 { return Int64(size) }
                        let data = try await getData(QuranMath.audioURL(reciter: reciter, bitrate: bitrate, surah: unit, ayah: ayah))
                        guard data.count > 512 else { throw OfflineError.badResponse }
                        try write(data, to: dest)
                        return Int64(data.count)
                    }
                }
                for _ in 0..<4 { launch() }
                var total: Int64 = 0
                while let bytes = try await group.next() {
                    total += bytes
                    launch()
                }
                return total
            }
        }
    }
}

/// A hadith-api edition file.
struct HadithEdition: Codable {
    struct Hadith: Codable, Identifiable {
        struct Grade: Codable, Hashable { let name: String; let grade: String }
        struct Reference: Codable, Hashable { let book: Double?; let hadith: Double? }
        let hadithnumber: Double
        let text: String
        let grades: [Grade]?
        let reference: Reference?
        var id: Double { hadithnumber }
        var numberLabel: String {
            hadithnumber == hadithnumber.rounded() ? String(Int(hadithnumber)) : String(hadithnumber)
        }
    }
    struct Metadata: Codable { let name: String? }
    let metadata: Metadata?
    let hadiths: [Hadith]
}

/// spa5k tafsir_api per-surah files: { ayahs: [{ surah, ayah, text }] } (or "tafsirs").
enum TafsirFile {
    struct Entry: Decodable { let surah: Int?; let ayah: Int?; let text: String? }
    struct File: Decodable { let ayahs: [Entry]?; let tafsirs: [Entry]? }

    static func texts(from data: Data, surah: Int, ayahCount: Int) throws -> [String] {
        let f = try JSONDecoder().decode(File.self, from: data)
        guard let list = f.ayahs ?? f.tafsirs else { throw OfflineError.badResponse }
        var texts = Array(repeating: "", count: ayahCount)
        for e in list {
            guard let text = e.text, let a = e.ayah else { continue }
            if let s = e.surah, s != surah { throw OfflineError.badResponse }
            if (1...ayahCount).contains(a) { texts[a - 1] = text }
        }
        guard texts.contains(where: { !$0.isEmpty }) else { throw OfflineError.badResponse }
        return texts
    }
}
