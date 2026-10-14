import Foundation
import AVFoundation
import MediaPlayer
import Combine
import UIKit
import SalaamStreetCore

/// Qur'an recitation, ayah by ayah (the same files as the website), with:
/// • background playback (UIBackgroundModes: audio) and an AVAudioSession for spoken audio;
/// • Lock Screen / Control Centre / Dynamic Island media controls via MPNowPlayingInfoCenter
///   and MPRemoteCommandCenter (play, pause, next/previous ayah, scrubbing within the ayah);
/// • interruption handling (calls, Siri, other apps) and pausing when headphones are unplugged;
/// • downloaded recitation played from the device, so it works offline and in the background.
@MainActor
final class QuranAudioPlayer: ObservableObject {
    struct Position: Equatable { var surah: Int; var ayah: Int }

    @Published private(set) var position: Position?
    @Published private(set) var reciter = "ar.alafasy"
    @Published private(set) var isPlaying = false
    @Published private(set) var isBuffering = false
    @Published private(set) var elapsed: Double = 0
    @Published private(set) var duration: Double = 0
    @Published private(set) var playingFromDevice = false
    @Published var errorMessage: String?
    /// Times each ayah is recited: 1 (no repeat), 3, 5, 10 (memorisation).
    @Published var repeatTimes = 1 { didSet { rebuildQueueAhead() } }
    @Published var rate: Float = 1.0 { didSet { if isPlaying { player.rate = rate }; updateNowPlaying() } }

    var continuousPlay: () -> Bool = { false }
    private let offline: OfflineLibrary
    private let player = AVQueuePlayer()
    private var itemPositions: [ObjectIdentifier: (position: Position, pass: Int)] = [:]
    private var bitrateIndex = 0
    private var bag: Set<AnyCancellable> = []
    private var itemBag: [ObjectIdentifier: AnyCancellable] = [:]
    private var timeObserver: Any?
    private lazy var artwork: MPMediaItemArtwork? = {
        guard let image = UIImage(named: "NowPlayingArtwork") else { return nil }
        return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    }()

    init(offline: OfflineLibrary) {
        self.offline = offline
        player.actionAtItemEnd = .advance
        observePlayer()
        observeSession()
        configureRemoteCommands()
    }

    var surahMeta: ContentLibrary.Surah? { position.flatMap { ContentLibrary.shared.surah($0.surah) } }
    var reciterName: String { ContentLibrary.shared.reciter(reciter)?.englishName ?? reciter }
    var isActive: Bool { position != nil }

    // MARK: - Controls

    func play(surah: Int, ayah: Int = 1, reciter: String) {
        errorMessage = nil
        self.reciter = reciter
        bitrateIndex = 0
        guard activateSession() else { return }
        start(at: Position(surah: surah, ayah: ayah))
    }

    func toggle() { isPlaying ? pause() : resume() }

    func pause() {
        player.pause()
        isPlaying = false
        updateNowPlaying()
    }

    func resume() {
        guard position != nil else { return }
        guard activateSession() else { return }
        if player.currentItem == nil, let p = position { start(at: p); return }
        player.playImmediately(atRate: rate)
        isPlaying = true
        updateNowPlaying()
    }

    func next() {
        guard let p = position, let n = advance(p, pass: repeatTimes)?.position else { return }
        start(at: n)
    }

    func previous() {
        guard let p = position else { return }
        if elapsed > 3 { seek(to: 0); return }
        start(at: p.ayah > 1 ? Position(surah: p.surah, ayah: p.ayah - 1) : p)
    }

    func seek(to seconds: Double) {
        player.seek(to: CMTime(seconds: seconds, preferredTimescale: 600)) { [weak self] _ in
            Task { @MainActor in self?.updateNowPlaying() }
        }
    }

    func stop() {
        player.pause()
        player.removeAllItems()
        itemPositions = [:]
        itemBag = [:]
        position = nil
        isPlaying = false
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - Queue

    private func start(at p: Position) {
        player.removeAllItems()
        itemPositions = [:]
        itemBag = [:]
        position = p
        elapsed = 0
        duration = 0
        enqueue(p, pass: 1)
        rebuildQueueAhead()
        player.playImmediately(atRate: rate)
        isPlaying = true
        updateNowPlaying()
    }

    /// The ayah after `p`: the same one again while repeating, else the next ayah (or next surah if chosen).
    private func advance(_ p: Position, pass: Int) -> (position: Position, pass: Int)? {
        if pass < repeatTimes { return (p, pass + 1) }
        guard let count = ContentLibrary.shared.surah(p.surah)?.ayahCount else { return nil }
        if p.ayah < count { return (Position(surah: p.surah, ayah: p.ayah + 1), 1) }
        if continuousPlay() && p.surah < 114 { return (Position(surah: p.surah + 1, ayah: 1), 1) }
        return nil
    }

    /// Keep two ayahs queued after the current one, so recitation flows without gaps.
    private func rebuildQueueAhead() {
        let items = player.items()
        guard let current = items.first, let info = itemPositions[ObjectIdentifier(current)] else { return }
        for extra in items.dropFirst() {
            player.remove(extra)
            itemPositions[ObjectIdentifier(extra)] = nil
            itemBag[ObjectIdentifier(extra)] = nil
        }
        var cursor = info
        for _ in 0..<2 {
            guard let n = advance(cursor.position, pass: cursor.pass) else { break }
            enqueue(n.position, pass: n.pass)
            cursor = n
        }
    }

    private func enqueue(_ p: Position, pass: Int) {
        let local = offline.audioFile(reciter: reciter, surah: p.surah, ayah: p.ayah)
        let bitrates = QuranMath.bitrates(for: reciter)
        let known = LocalStore.load(Int.self, key: "bitrate." + reciter)
        let br = bitrateIndex == 0 ? (known ?? bitrates[0]) : bitrates[min(bitrateIndex, bitrates.count - 1)]
        let url = local ?? QuranMath.audioURL(reciter: reciter, bitrate: br, surah: p.surah, ayah: p.ayah)
        let item = AVPlayerItem(url: url)
        item.audioTimePitchAlgorithm = .spectral // keeps the reciter's pitch at other speeds
        let key = ObjectIdentifier(item)
        itemPositions[key] = (p, pass)
        itemBag[key] = item.publisher(for: \.status).sink { [weak self, weak item] status in
            guard status == .failed, let item else { return }
            Task { @MainActor in self?.itemFailed(item, local: local != nil) }
        }
        player.insert(item, after: player.items().last)
    }

    private func itemFailed(_ item: AVPlayerItem, local: Bool) {
        guard let info = itemPositions[ObjectIdentifier(item)], player.items().first === item else { return }
        if !local && bitrateIndex < QuranMath.bitrates(for: reciter).count - 1 {
            // Not hosted at this bitrate: try the next, as the website does.
            bitrateIndex += 1
            start(at: info.position)
            return
        }
        pause()
        errorMessage = local
            ? "This downloaded recitation couldn't be played. Remove it and download it again from Offline."
            : "Recitation couldn't be loaded. Check your connection, or download this surah's recitation in Offline to listen without internet."
    }

    // MARK: - Observing

    private func observePlayer() {
        player.publisher(for: \.currentItem).sink { [weak self] item in
            Task { @MainActor in self?.currentItemChanged(item) }
        }.store(in: &bag)
        player.publisher(for: \.timeControlStatus).sink { [weak self] status in
            Task { @MainActor in
                guard let self else { return }
                self.isBuffering = status == .waitingToPlayAtSpecifiedRate
                if status == .playing { self.isPlaying = true }
            }
        }.store(in: &bag)
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] t in
            Task { @MainActor in
                guard let self else { return }
                self.elapsed = t.seconds.isFinite ? t.seconds : 0
                if let d = self.player.currentItem?.duration.seconds, d.isFinite { self.duration = d }
            }
        }
    }

    private func currentItemChanged(_ item: AVPlayerItem?) {
        guard let item, let info = itemPositions[ObjectIdentifier(item)] else {
            if position != nil && player.items().isEmpty {
                // Reached the end of the surah.
                isPlaying = false
                updateNowPlaying()
            }
            return
        }
        // Forget items that have finished.
        let live = Set(player.items().map(ObjectIdentifier.init))
        for key in itemPositions.keys where !live.contains(key) { itemPositions[key] = nil; itemBag[key] = nil }
        position = info.position
        playingFromDevice = item.asset is AVURLAsset && ((item.asset as? AVURLAsset)?.url.isFileURL ?? false)
        elapsed = 0
        duration = 0
        rebuildQueueAhead()
        updateNowPlaying()
    }

    // MARK: - Audio session

    private func activateSession() -> Bool {
        let s = AVAudioSession.sharedInstance()
        do {
            try s.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
            try s.setActive(true)
            return true
        } catch {
            errorMessage = "Audio couldn't start (\(error.localizedDescription))."
            return false
        }
    }

    private func observeSession() {
        let nc = NotificationCenter.default
        nc.publisher(for: AVAudioSession.interruptionNotification).sink { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            let optsRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let opts = AVAudioSession.InterruptionOptions(rawValue: optsRaw)
            Task { @MainActor in
                guard let self else { return }
                if type == .began { self.isPlaying = false; self.updateNowPlaying() }
                else if opts.contains(.shouldResume), self.position != nil { self.resume() }
            }
        }.store(in: &bag)
        nc.publisher(for: AVAudioSession.routeChangeNotification).sink { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable else { return }
            Task { @MainActor in self?.pause() } // headphones unplugged: don't recite out loud
        }.store(in: &bag)
        nc.publisher(for: AVAudioSession.mediaServicesWereResetNotification).sink { [weak self] _ in
            Task { @MainActor in
                guard let self, let p = self.position else { return }
                self.configureRemoteCommands()
                if self.isPlaying { self.start(at: p) }
            }
        }.store(in: &bag)
    }

    // MARK: - Lock Screen and Control Centre

    private func configureRemoteCommands() {
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in self?.toggle(); return .success }
        c.nextTrackCommand.addTarget { [weak self] _ in self?.next(); return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in self?.previous(); return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.seek(to: e.positionTime)
            return .success
        }
        c.skipForwardCommand.isEnabled = false
        c.skipBackwardCommand.isEnabled = false
    }

    private func updateNowPlaying() {
        guard let p = position, let meta = ContentLibrary.shared.surah(p.surah) else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: "\(meta.englishName) · Ayah \(p.ayah)",
            MPMediaItemPropertyArtist: reciterName,
            MPMediaItemPropertyAlbumTitle: "Surah \(meta.number) · \(meta.arabicName) — SalaamStreet",
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? Double(rate) : 0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyPlaybackQueueIndex: p.ayah - 1,
            MPNowPlayingInfoPropertyPlaybackQueueCount: meta.ayahCount,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
        if let artwork { info[MPMediaItemPropertyArtwork] = artwork }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        let c = MPRemoteCommandCenter.shared()
        c.previousTrackCommand.isEnabled = true
        c.nextTrackCommand.isEnabled = advance(p, pass: repeatTimes) != nil
    }
}
