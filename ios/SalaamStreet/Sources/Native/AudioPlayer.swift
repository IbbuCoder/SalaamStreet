import AVFoundation
import MediaPlayer
import UIKit

/// Qur'an recitation through AVPlayer instead of the web view's <audio>, so it
/// keeps playing with the phone locked, shows on the Lock Screen, in Control
/// Centre and the Dynamic Island, and answers headphone and CarPlay buttons.
///
/// The website still decides what plays (js/app.js, through bridge.js). With
/// each ayah it sends the ayahs that follow — the same order its own "ended"
/// handler would pick (repeats, continuous play, story ranges) — because iOS
/// pauses the page's JavaScript while the phone is locked. The player walks
/// that list on its own and tells the page each time it moves on; when the
/// page catches up it adopts the ayah already playing instead of restarting.
@MainActor
final class AudioPlayer: NSObject {
    static let shared = AudioPlayer()

    struct Item {
        let key: String
        let remote: URL?
        let fileKey: String?
        let title: String
        var seq: Int = 0
    }

    /// Sends events to the website (set by the app).
    var emit: (String, [String: Any]) -> Void = { _, _ in }

    private let player = AVQueuePlayer()
    private var current: Item?
    private var upcoming: [Item] = []
    private var enqueuedNext: (item: Item, avItem: AVPlayerItem)?
    private var seqCounter = 0
    private var rate: Float = 1
    private var isPaused = true
    private var artist = ""
    private var timeObserver: Any?
    private var sleepTimer: Timer?
    private var pendingRemote: (action: String, at: Date)?
    private var itemObservations: [NSKeyValueObservation] = []
    private var configured = false

    private override init() { super.init() }

    // MARK: Setup

    func configure() {
        guard !configured else { return }
        configured = true
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
        player.actionAtItemEnd = .advance
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        NotificationCenter.default.addObserver(self, selector: #selector(itemEnded(_:)), name: AVPlayerItem.didPlayToEndTimeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(itemFailed(_:)), name: AVPlayerItem.failedToPlayToEndTimeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted(_:)), name: AVAudioSession.interruptionNotification, object: nil)
        setUpRemoteCommands()
    }

    private func setUpRemoteCommands() {
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.addTarget { [weak self] _ in self?.resume(fromRemote: true); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.pause(fromRemote: true); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            self.isPaused ? self.resume(fromRemote: true) : self.pause(fromRemote: true)
            return .success
        }
        c.nextTrackCommand.addTarget { [weak self] _ in self?.remote("nexttrack"); return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in self?.remote("previoustrack"); return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] e in
            guard let e = e as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.seek(to: e.positionTime); return .success
        }
        c.skipForwardCommand.isEnabled = false
        c.skipBackwardCommand.isEnabled = false
    }

    // MARK: Commands from the website

    /// payload: { key, src, fileKey?, title, artist?, rate?, adoptSeq?, plan: [{key, src, fileKey?, title}] }
    func play(_ p: Payload) throws -> [String: Any] {
        configure()
        let item = try Self.item(from: p.raw)
        let plan = (p.raw["plan"] as? [[String: Any]] ?? []).prefix(400).compactMap { try? Self.item(from: $0) }
        if let a = p.optString("artist", max: 300) { artist = a }
        if let r = p.optNumber("rate", in: 0.25...4) { rate = Float(r) }
        pendingRemote = nil

        if let adopt = p.optNumber("adoptSeq", in: 0...1e9).map(Int.init), let cur = current {
            if adopt < cur.seq { return ["seq": cur.seq, "adopted": true] } // the page is catching up: keep playing
            if adopt == cur.seq, cur.key == item.key {
                upcoming = plan
                refreshEnqueuedNext()
                if isPaused { resume() }
                return ["seq": cur.seq, "adopted": true]
            }
        }
        start(item, then: plan)
        return ["seq": current?.seq ?? 0, "adopted": false]
    }

    func pause(fromRemote: Bool = false) {
        player.pause()
        isPaused = true
        updateNowPlaying()
        emit("audio", ["type": "pause", "seq": current?.seq ?? 0])
    }

    func resume(fromRemote: Bool = false) {
        guard current != nil else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        player.playImmediately(atRate: rate)
        isPaused = false
        updateNowPlaying()
        emit("audio", ["type": "play", "seq": current?.seq ?? 0])
    }

    func stop() {
        player.pause()
        player.removeAllItems()
        current = nil
        upcoming = []
        enqueuedNext = nil
        isPaused = true
        sleepTimer?.invalidate()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func seek(to seconds: Double) {
        player.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
        updateNowPlaying()
    }

    func setRate(_ r: Float) {
        rate = r
        if !isPaused { player.rate = r }
        updateNowPlaying()
    }

    func setMetadata(title: String?, artist: String?) {
        if let artist { self.artist = artist }
        updateNowPlaying(title: title)
    }

    /// The website's sleep timer (0 = off). Runs natively so it works with the phone locked.
    func sleep(minutes: Double) {
        sleepTimer?.invalidate()
        sleepTimer = nil
        guard minutes > 0 else { return }
        sleepTimer = Timer.scheduledTimer(withTimeInterval: minutes * 60, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.pause()
                self?.emit("audio", ["type": "sleep"])
            }
        }
    }

    // MARK: Downloaded recitation (Offline page)

    static var filesDir: URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("Recitation", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func isSafeKey(_ key: String) -> Bool {
        !key.isEmpty && key.count <= 120 && key.range(of: "^[A-Za-z0-9._-]+$", options: .regularExpression) != nil && !key.contains("..")
    }

    func fileURL(key: String) -> URL? {
        guard Self.isSafeKey(key) else { return nil }
        return Self.filesDir.appendingPathComponent(key + ".mp3")
    }

    func hasFile(key: String) -> Bool { fileURL(key: key).map { FileManager.default.fileExists(atPath: $0.path) } ?? false }

    /// A recitation file the website keeps in its Cache storage, copied here so
    /// AVPlayer can play it with no connection.
    func storeFile(key: String, base64: String) throws {
        guard let url = fileURL(key: key) else { throw BridgeError.invalid("fileKey") }
        guard let data = Data(base64Encoded: base64), !data.isEmpty else { throw BridgeError.invalid("data") }
        try data.write(to: url, options: .atomic)
        if enqueuedNext?.item.fileKey == key { refreshEnqueuedNext(force: true) }
    }

    // MARK: Queue

    private static func item(from d: [String: Any]) throws -> Item {
        guard let key = d["key"] as? String, key.count <= 200 else { throw BridgeError.invalid("key") }
        let src = d["src"] as? String ?? ""
        let remote = URL(string: src).flatMap { ($0.scheme == "https") ? $0 : nil }
        let fileKey = (d["fileKey"] as? String).flatMap { isSafeKey($0) ? $0 : nil }
        guard remote != nil || fileKey != nil else { throw BridgeError.invalid("src") }
        let title = String((d["title"] as? String ?? "").prefix(300))
        return Item(key: key, remote: remote, fileKey: fileKey, title: title)
    }

    private func avItem(for item: Item) -> AVPlayerItem? {
        if let k = item.fileKey, let url = fileURL(key: k), FileManager.default.fileExists(atPath: url.path) {
            return AVPlayerItem(url: url)
        }
        return item.remote.map { AVPlayerItem(url: $0) }
    }

    private func start(_ item: Item, then plan: [Item]) {
        player.removeAllItems()
        enqueuedNext = nil
        var it = item
        seqCounter += 1
        it.seq = seqCounter
        current = it
        upcoming = plan
        guard let av = avItem(for: it) else {
            emit("audio", ["type": "error", "seq": it.seq])
            return
        }
        watch(av)
        player.insert(av, after: nil)
        refreshEnqueuedNext()
        try? AVAudioSession.sharedInstance().setActive(true)
        player.playImmediately(atRate: rate)
        isPaused = false
        updateNowPlaying()
        emit("audio", ["type": "play", "seq": it.seq])
    }

    /// Keep exactly one item queued after the current one, for a gapless move to the next ayah.
    private func refreshEnqueuedNext(force: Bool = false) {
        let next = upcoming.first
        if !force, let e = enqueuedNext, let n = next, e.item.key == n.key, e.item.fileKey == n.fileKey { return }
        if let e = enqueuedNext { player.remove(e.avItem) }
        enqueuedNext = nil
        guard let n = next, let av = avItem(for: n) else { return }
        watch(av)
        player.insert(av, after: player.items().first)
        enqueuedNext = (n, av)
    }

    private func watch(_ av: AVPlayerItem) {
        itemObservations.append(av.observe(\.status, options: [.new]) { [weak self] item, _ in
            DispatchQueue.main.async {
                guard let self, item === self.player.currentItem else { return }
                if item.status == .readyToPlay {
                    self.emit("audio", ["type": "loaded", "seq": self.current?.seq ?? 0, "duration": item.duration.seconds.isFinite ? item.duration.seconds : 0])
                    self.updateNowPlaying()
                } else if item.status == .failed {
                    self.emit("audio", ["type": "error", "seq": self.current?.seq ?? 0])
                }
            }
        })
        if itemObservations.count > 40 { itemObservations.removeFirst(20) }
    }

    @objc private func itemEnded(_ n: Notification) {
        guard let ended = n.object as? AVPlayerItem else { return }
        DispatchQueue.main.async { self.advance(after: ended) }
    }

    private func advance(after ended: AVPlayerItem) {
        let endedSeq = current?.seq ?? 0
        if let e = enqueuedNext, !upcoming.isEmpty {
            // AVQueuePlayer has already moved on to the queued item.
            var next = upcoming.removeFirst()
            seqCounter += 1
            next.seq = seqCounter
            current = next
            enqueuedNext = nil
            if player.currentItem !== e.avItem { player.insert(e.avItem, after: nil) }
            refreshEnqueuedNext()
            updateNowPlaying()
            emit("audio", ["type": "advance", "ended": endedSeq, "seq": next.seq, "key": next.key])
        } else {
            isPaused = true
            updateNowPlaying()
            emit("audio", ["type": "ended", "seq": endedSeq])
        }
    }

    @objc private func itemFailed(_ n: Notification) {
        DispatchQueue.main.async { self.emit("audio", ["type": "error", "seq": self.current?.seq ?? 0]) }
    }

    @objc private func interrupted(_ n: Notification) {
        guard let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        DispatchQueue.main.async {
            if type == .began {
                if !self.isPaused { self.pause() }
            } else if let o = n.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt,
                      AVAudioSession.InterruptionOptions(rawValue: o).contains(.shouldResume) {
                self.resume()
            }
        }
    }

    /// Next/previous from the Lock Screen: the website picks the ayah (its
    /// mediaSession handlers). If the page doesn't answer — JavaScript is
    /// paused while locked — the player moves on by itself.
    private func remote(_ action: String) {
        pendingRemote = (action, Date())
        emit("remote", ["action": action])
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            guard let self, let p = self.pendingRemote, p.action == action else { return }
            self.pendingRemote = nil
            if action == "nexttrack", !self.upcoming.isEmpty {
                let next = self.upcoming.removeFirst()
                self.start(next, then: self.upcoming)
            }
        }
    }

    private func tick() {
        guard let item = player.currentItem, current != nil else { return }
        let t = player.currentTime().seconds
        let d = item.duration.seconds
        if UIApplication.shared.applicationState == .active {
            emit("audio", ["type": "time", "seq": current?.seq ?? 0, "time": t.isFinite ? t : 0, "duration": d.isFinite ? d : 0])
        }
    }

    // MARK: Lock Screen

    private static let artwork: MPMediaItemArtwork? = {
        guard let img = UIImage(named: "NowPlaying") else { return nil }
        return MPMediaItemArtwork(boundsSize: img.size) { _ in img }
    }()

    private func updateNowPlaying(title: String? = nil) {
        guard let cur = current else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title ?? cur.title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: "SalaamStreet",
            MPNowPlayingInfoPropertyPlaybackRate: isPaused ? 0 : Double(rate),
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime().seconds.isFinite ? player.currentTime().seconds : 0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if let d = player.currentItem?.duration.seconds, d.isFinite { info[MPMediaItemPropertyPlaybackDuration] = d }
        if let art = Self.artwork { info[MPMediaItemPropertyArtwork] = art }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = isPaused ? .paused : .playing
        MPRemoteCommandCenter.shared().nextTrackCommand.isEnabled = true
        MPRemoteCommandCenter.shared().previousTrackCommand.isEnabled = true
    }
}
