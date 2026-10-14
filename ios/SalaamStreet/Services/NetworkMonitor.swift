import Foundation
import Network

/// Online/offline status for the interface (banners, the Offline page, what can be streamed).
@MainActor
final class NetworkMonitor: ObservableObject {
    @Published private(set) var isOnline = true
    @Published private(set) var isExpensive = false
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            let expensive = path.isExpensive
            Task { @MainActor in
                self?.isOnline = online
                self?.isExpensive = expensive
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.salaamstreet.network"))
    }

    deinit { monitor.cancel() }
}
