import Foundation

/// Qibla direction and distance, computed on the device (same formula as the website).
public enum Qibla {
    public static let kaabaLatitude = 21.4225
    public static let kaabaLongitude = 39.8262

    /// Initial great-circle bearing from a point to the Kaaba, degrees clockwise from true north (0..<360).
    public static func bearing(latitude: Double, longitude: Double) -> Double {
        let r = Double.pi / 180
        let p1 = latitude * r, p2 = kaabaLatitude * r, dl = (kaabaLongitude - longitude) * r
        let y = sin(dl) * cos(p2)
        let x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)
        let deg = atan2(y, x) * 180 / Double.pi
        return (deg + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Great-circle distance to the Kaaba in kilometres (haversine, mean Earth radius).
    public static func distanceKm(latitude: Double, longitude: Double) -> Double {
        let r = Double.pi / 180
        let dLat = (kaabaLatitude - latitude) * r, dLng = (kaabaLongitude - longitude) * r
        let a = sin(dLat / 2) * sin(dLat / 2) + cos(latitude * r) * cos(kaabaLatitude * r) * sin(dLng / 2) * sin(dLng / 2)
        return 6371.0088 * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    /// How far to turn from the current heading to face the Qibla, in -180...180 (positive = turn right).
    public static func turn(heading: Double, qibla: Double) -> Double {
        var d = (qibla - heading).truncatingRemainder(dividingBy: 360)
        if d > 180 { d -= 360 }
        if d < -180 { d += 360 }
        return d
    }

    /// Facing the Qibla within the tolerance (degrees) the website uses for its lock-on.
    public static func isAligned(heading: Double, qibla: Double, tolerance: Double = 5) -> Bool {
        abs(turn(heading: heading, qibla: qibla)) <= tolerance
    }

    /// "NE", "SSW" … for a bearing.
    public static func compassPoint(_ bearing: Double) -> String {
        let points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        let i = Int(((bearing.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 22.5).rounded()) % 16
        return points[i]
    }
}
