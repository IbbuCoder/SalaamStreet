import CoreLocation

/// navigator.geolocation for the website, through Core Location. One iOS
/// prompt ("Allow while using the app"), instead of a second web prompt.
@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {
    static let shared = LocationService()
    private let manager = CLLocationManager()
    private var waiting: [UUID: CheckedContinuation<CLLocation, Error>] = [:]
    private var authWaiting: [CheckedContinuation<Void, Never>] = []

    enum Failure: Error { case denied, unavailable, timeout }

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// The Permissions API's words: "granted", "denied" or "prompt".
    var statusString: String {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }

    func current(highAccuracy: Bool) async throws -> CLLocation {
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { c in
                authWaiting.append(c)
                manager.requestWhenInUseAuthorization()
            }
        }
        guard statusString == "granted" else { throw BridgeError.failed("geo:1") }
        manager.desiredAccuracy = highAccuracy ? kCLLocationAccuracyBest : kCLLocationAccuracyHundredMeters
        if let last = manager.location, last.timestamp.timeIntervalSinceNow > -600, last.horizontalAccuracy < 1000 { return last }
        return try await withCheckedThrowingContinuation { c in
            let token = UUID()
            waiting[token] = c
            manager.requestLocation()
            DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
                self?.waiting.removeValue(forKey: token)?.resume(throwing: BridgeError.failed("geo:3"))
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard manager.authorizationStatus != .notDetermined else { return }
            let w = self.authWaiting
            self.authWaiting = []
            w.forEach { $0.resume() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor in
            let w = self.waiting
            self.waiting = [:]
            w.values.forEach { $0.resume(returning: loc) }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            let w = self.waiting
            self.waiting = [:]
            let denied = (error as? CLError)?.code == .denied
            w.values.forEach { $0.resume(throwing: BridgeError.failed(denied ? "geo:1" : "geo:2")) }
        }
    }
}
