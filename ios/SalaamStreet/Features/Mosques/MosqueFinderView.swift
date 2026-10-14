import SwiftUI
import MapKit
import SalaamStreetCore

/// Mosques near the chosen location, from Apple Maps. Needs an internet connection.
struct MosqueFinderView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var router: Router
    @State private var results: [MKMapItem] = []
    @State private var state: LoadState = .idle
    @State private var camera: MapCameraPosition = .automatic
    @State private var selection: MKMapItem?

    enum LoadState: Equatable { case idle, loading, loaded, failed(String) }

    private var center: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: model.location.latitude, longitude: model.location.longitude)
    }

    var body: some View {
        VStack(spacing: 0) {
            Map(position: $camera, selection: $selection) {
                Annotation(model.location.name, coordinate: center) {
                    Image(systemName: "location.circle.fill").font(.title2).foregroundStyle(Brand.primary)
                }
                ForEach(results, id: \.self) { item in
                    Marker(item.name ?? "Mosque", systemImage: "building.columns", coordinate: item.placemark.coordinate)
                        .tint(Brand.primary)
                        .tag(item)
                }
            }
            .frame(minHeight: 240)

            List {
                if !network.isOnline {
                    StatusBanner(kind: .offline, text: "Finding mosques needs an internet connection. Prayer times and the Qibla keep working offline.")
                        .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                }
                if model.isUsingDefaultLocation {
                    StatusBanner(kind: .info, text: "Choose your location to find mosques near you.", actionTitle: "Choose") { router.show(.settings) }
                        .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                }
                switch state {
                case .loading:
                    HStack { Spacer(); ProgressView("Searching…"); Spacer() }
                case .failed(let message):
                    StatusBanner(kind: .error, text: message, actionTitle: "Try again") { Task { await search() } }
                        .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                case .loaded where results.isEmpty:
                    ContentUnavailableView("No mosques found nearby", systemImage: "building.columns",
                                           description: Text("Apple Maps doesn't list a mosque within about 15 km of \(model.location.name)."))
                default:
                    ForEach(results, id: \.self) { item in
                        Button { selection = item } label: { MosqueRow(item: item, from: center) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Mosques")
        .navigationBarTitleDisplayMode(.inline)
        .task { await search() }
        .refreshable { await search() }
        .onChange(of: selection) { _, item in
            if let item { camera = .item(item) }
        }
        .safeAreaInset(edge: .bottom) {
            if let item = selection {
                Button {
                    item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault])
                } label: {
                    Label("Directions to \(item.name ?? "mosque")", systemImage: "arrow.triangle.turn.up.right.diamond")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .padding(Layout.gutter)
                .background(.bar)
            }
        }
    }

    private func search() async {
        guard network.isOnline else { state = .failed("You're offline. Connect to the internet to find mosques."); return }
        state = .loading
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "mosque"
        request.resultTypes = .pointOfInterest
        request.region = MKCoordinateRegion(center: center, latitudinalMeters: 30_000, longitudinalMeters: 30_000)
        do {
            let response = try await MKLocalSearch(request: request).start()
            let here = CLLocation(latitude: center.latitude, longitude: center.longitude)
            results = response.mapItems
                .filter { ($0.placemark.location?.distance(from: here) ?? .infinity) < 25_000 }
                .sorted { ($0.placemark.location?.distance(from: here) ?? 0) < ($1.placemark.location?.distance(from: here) ?? 0) }
            state = .loaded
            camera = .region(MKCoordinateRegion(center: center, latitudinalMeters: 12_000, longitudinalMeters: 12_000))
        } catch {
            results = []
            if (error as? MKError)?.code == .placemarkNotFound { state = .loaded }
            else { state = .failed("Mosques couldn't be loaded just now. Check your connection and try again.") }
        }
    }
}

struct MosqueRow: View {
    let item: MKMapItem
    let from: CLLocationCoordinate2D

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "building.columns.fill").foregroundStyle(Brand.primary).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name ?? "Mosque").font(.body.weight(.medium))
                if let address = item.placemark.title { Text(address).font(.caption).foregroundStyle(Brand.text3).lineLimit(2) }
            }
            Spacer()
            if let loc = item.placemark.location {
                let m = loc.distance(from: CLLocation(latitude: from.latitude, longitude: from.longitude))
                Text(Measurement(value: m, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated, usage: .road)))
                    .font(.footnote.monospacedDigit()).foregroundStyle(Brand.text2)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
