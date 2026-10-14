// swift-tools-version:5.9
// SalaamStreetCore — the platform-independent heart of the SalaamStreet iOS app:
// prayer-time astronomy, Qibla maths, the shared content library, the offline
// download model, the prayer tracker and the Live Activity state. It has no
// UIKit/SwiftUI dependencies (Live Activity attributes are compiled only where
// ActivityKit exists), so `swift test` runs on macOS and Linux alike.
import PackageDescription

let package = Package(
    name: "SalaamStreetCore",
    defaultLocalization: "en",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "SalaamStreetCore", targets: ["SalaamStreetCore"]),
    ],
    targets: [
        .target(
            name: "SalaamStreetCore",
            resources: [.copy("Resources/content.json")]
        ),
        .testTarget(
            name: "SalaamStreetCoreTests",
            dependencies: ["SalaamStreetCore"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
