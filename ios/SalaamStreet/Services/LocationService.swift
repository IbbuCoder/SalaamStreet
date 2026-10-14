import Foundation
import CoreLocation
import SalaamStreetCore

/// Location for prayer times, the Qibla and the mosque finder. Used only after
/// the person chooses; rounded to ~1 km; never leaves the device except as a
/// place search the person types (Apple's geocoder).
@MainActor
final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    enum Failure: LocalizedError {
        case denied, unavailable, notFound, offline
        var errorDescription: String? {
            switch self {
            case .denied: return "Location access is off for SalaamStreet. You can turn it on in the Settings app, or search for your city instead."
            case .unavailable: return "Your iPhone couldn't find your location just now. Try again, or search for your city."
            case .notFound: return "No place with that name was found. Try adding the country, e.g. \"Naperville, USA\"."
            case .offline: return "Searching for a city needs an internet connection. Prayer times for your saved location keep working offline."
            }
        }
    }

    @Published private(set) var authorization: CLAuthorizationStatus
    private let manager = CLLocationManager()
    private var pending: CheckedContinuation<CLLocation, Error>?

    override init() {
        authorization = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// One fix, asking for permission the first time.
    func currentLocation() async throws -> CLLocation {
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { throw Failure.denied }
        if let p = pending { p.resume(throwing: Failure.unavailable); pending = nil }
        return try await withCheckedThrowingContinuation { cont in
            pending = cont
            if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
            else { manager.requestLocation() }
        }
    }

    /// The device's location as a named prayer location with its own time zone.
    func devicePrayerLocation() async throws -> PrayerLocation {
        let loc = try await currentLocation()
        let placemark = try? await CLGeocoder().reverseGeocodeLocation(loc).first
        let name = placemark?.locality ?? placemark?.administrativeArea ?? "My location"
        let tz = placemark?.timeZone?.identifier ?? TimeZone.current.identifier
        return PrayerLocation(latitude: loc.coordinate.latitude, longitude: loc.coordinate.longitude, name: name, timeZoneIdentifier: tz)
    }

    /// Search for a city by name.
    func search(_ query: String) async throws -> [PrayerLocation] {
        do {
            let marks = try await CLGeocoder().geocodeAddressString(query)
            let out = marks.compactMap { m -> PrayerLocation? in
                guard let c = m.location?.coordinate else { return nil }
                let parts = [m.locality ?? m.name, m.administrativeArea, m.country].compactMap { $0 }
                var seen = Set<String>()
                let label = parts.filter { seen.insert($0).inserted }.joined(separator: ", ")
                return PrayerLocation(latitude: c.latitude, longitude: c.longitude, name: label.isEmpty ? query : label,
                                      timeZoneIdentifier: m.timeZone?.identifier ?? TimeZone.current.identifier)
            }
            if out.isEmpty { throw Failure.notFound }
            return out
        } catch let e as CLError where e.code == .network {
            throw Failure.offline
        } catch let e as CLError where e.code == .geocodeFoundNoResult {
            throw Failure.notFound
        }
    }

    // MARK: CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.authorization = status
            guard let p = self.pending else { return }
            switch status {
            case .authorizedWhenInUse, .authorizedAlways: self.manager.requestLocation()
            case .denied, .restricted: p.resume(throwing: Failure.denied); self.pending = nil
            default: break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor in
            self.pending?.resume(returning: loc)
            self.pending = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let denied = (error as? CLError)?.code == .denied
        Task { @MainActor in
            self.pending?.resume(throwing: denied ? Failure.denied : Failure.unavailable)
            self.pending = nil
        }
    }
}
