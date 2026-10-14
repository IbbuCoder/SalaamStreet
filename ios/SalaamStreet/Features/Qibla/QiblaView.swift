import SwiftUI
import CoreLocation
import SalaamStreetCore

/// Live heading from the iPhone's compass (true north when location is allowed).
@MainActor
final class CompassModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var heading: Double?
    @Published private(set) var isTrueNorth = false
    /// Degrees of uncertainty; large values mean the compass needs calibrating.
    @Published private(set) var accuracy: Double = -1
    let available = CLLocationManager.headingAvailable()
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.headingFilter = 1
    }

    func start() {
        guard available else { return }
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation() // lets iOS report true (not magnetic) north
        }
        manager.startUpdatingHeading()
    }

    func stop() {
        manager.stopUpdatingHeading()
        manager.stopUpdatingLocation()
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading h: CLHeading) {
        let trueH = h.trueHeading, mag = h.magneticHeading, acc = h.headingAccuracy
        Task { @MainActor in
            self.isTrueNorth = trueH >= 0
            self.heading = trueH >= 0 ? trueH : mag
            self.accuracy = acc
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {}
    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
    nonisolated func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { true }
}

struct QiblaView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var router: Router
    @StateObject private var compass = CompassModel()

    private var qibla: Double { Qibla.bearing(latitude: model.location.latitude, longitude: model.location.longitude) }
    private var distanceKm: Double { Qibla.distanceKm(latitude: model.location.latitude, longitude: model.location.longitude) }
    /// Within ~2 km of the Kaaba a compass bearing means nothing: face the Kaaba itself.
    private var atTheKaaba: Bool { distanceKm < 2 }

    var body: some View {
        let heading = compass.heading
        let turn = heading.map { Qibla.turn(heading: $0, qibla: qibla) }
        let aligned = heading.map { Qibla.isAligned(heading: $0, qibla: qibla) } ?? false

        ScrollView {
            VStack(spacing: 24) {
                if model.isUsingDefaultLocation {
                    StatusBanner(kind: .info, text: "Choose your location for an accurate Qibla direction.", actionTitle: "Choose") { router.show(.settings) }
                }
                if atTheKaaba {
                    VStack(spacing: 10) {
                        Image(systemName: "building.columns.fill").font(.system(size: 54)).foregroundStyle(Brand.primary)
                        Text("You're at the Haram").font(.title2.weight(.bold))
                        Text("Within about 2 km of the Kaaba a compass direction isn't meaningful — face the Kaaba itself.")
                            .multilineTextAlignment(.center).foregroundStyle(Brand.text2)
                    }
                    .padding(.vertical, 24)
                    .accessibilityElement(children: .combine)
                } else {
                Text(instruction(turn: turn, aligned: aligned))
                    .font(.title2.weight(.bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(aligned ? Brand.primary : Brand.text)
                    .contentTransition(.opacity)
                    .accessibilityAddTraits(.updatesFrequently)

                CompassDial(heading: heading ?? 0, qibla: qibla, aligned: aligned, live: heading != nil)
                    .frame(maxWidth: 320)
                    .sensoryFeedback(.success, trigger: aligned) { _, now in now }

                VStack(spacing: 6) {
                    Text("Qibla: \(Int(qibla.rounded()))° \(Qibla.compassPoint(qibla)) from true north")
                        .font(.headline)
                    Text("\(Int(distanceKm.rounded()).formatted()) km to the Kaaba · \(model.location.name)")
                        .font(.subheadline).foregroundStyle(Brand.text2)
                }
                .multilineTextAlignment(.center)
                }

                if atTheKaaba {
                    EmptyView()
                } else if !compass.available {
                    StatusBanner(kind: .info, text: "This device has no compass. Face \(Int(qibla.rounded()))° clockwise from north using a map or the sun.")
                } else if compass.accuracy < 0 || compass.accuracy > 25 {
                    StatusBanner(kind: .warning, text: "Compass accuracy is low. Move your iPhone in a figure-of-eight, away from metal and magnets.")
                } else if heading != nil && !compass.isTrueNorth {
                    StatusBanner(kind: .info, text: "Using magnetic north. Allow location access for true north, which is more accurate.")
                }
                Text("Hold your iPhone flat, top edge pointing ahead. Calculated on your device — works offline.")
                    .font(.footnote).foregroundStyle(Brand.text3).multilineTextAlignment(.center)
            }
            .padding(Layout.gutter)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.background)
        .navigationTitle("Qibla")
        .onAppear { compass.start() }
        .onDisappear { compass.stop() }
    }

    private func instruction(turn: Double?, aligned: Bool) -> String {
        guard let turn else { return compass.available ? "Finding north…" : "Qibla direction" }
        if aligned { return "You're facing the Qibla" }
        let deg = Int(abs(turn).rounded())
        return turn > 0 ? "Turn right \(deg)°" : "Turn left \(deg)°"
    }
}

struct CompassDial: View {
    let heading: Double
    let qibla: Double
    let aligned: Bool
    let live: Bool

    var body: some View {
        GeometryReader { g in
            let r = min(g.size.width, g.size.height) / 2
            ZStack {
                Circle().fill(Brand.surface)
                Circle().strokeBorder(aligned ? Brand.primary : Brand.border, lineWidth: aligned ? 4 : 2)
                // The dial turns so its N points to real north.
                ZStack {
                    ForEach(0..<72) { i in
                        Capsule()
                            .fill(i % 18 == 0 ? Brand.text : Brand.text3.opacity(0.5))
                            .frame(width: i % 18 == 0 ? 3 : 1.5, height: i % 18 == 0 ? 14 : 7)
                            .offset(y: -(r - 14))
                            .rotationEffect(.degrees(Double(i) * 5))
                    }
                    ForEach(Array(["N", "E", "S", "W"].enumerated()), id: \.offset) { i, label in
                        Text(label)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(label == "N" ? Brand.danger : Brand.text2)
                            .rotationEffect(.degrees(heading - Double(i) * 90)) // keep letters upright
                            .offset(y: -(r - 38))
                            .rotationEffect(.degrees(Double(i) * 90))
                    }
                    // The Qibla: a needle from the centre and the Kaaba marker near the rim.
                    Capsule()
                        .fill(aligned ? Brand.primary : Brand.gold)
                        .frame(width: 4, height: r * 0.55)
                        .offset(y: -r * 0.275)
                        .rotationEffect(.degrees(qibla))
                    Image(systemName: "building.columns.fill")
                        .font(.system(size: max(14, r * 0.12)))
                        .foregroundStyle(aligned ? Brand.primary : Brand.gold)
                        .rotationEffect(.degrees(heading - qibla))
                        .offset(y: -(r * 0.55 + 16))
                        .rotationEffect(.degrees(qibla))
                }
                .rotationEffect(.degrees(-heading))
                .animation(live ? .interpolatingSpring(stiffness: 60, damping: 14) : nil, value: heading)

                // Fixed pointer at the top: the way the iPhone faces.
                Triangle().fill(Brand.text).frame(width: 14, height: 12).offset(y: -r + 4)
                Circle().fill(aligned ? Brand.primary : Brand.text3).frame(width: 12, height: 12)
            }
            .frame(width: r * 2, height: r * 2)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel(live ? "Compass. The Qibla is \(Int(abs(Qibla.turn(heading: heading, qibla: qibla)).rounded())) degrees to your \(Qibla.turn(heading: heading, qibla: qibla) >= 0 ? "right" : "left")." : "Compass")
    }
}

struct Triangle: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.midX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.closeSubpath()
        return p
    }
}
