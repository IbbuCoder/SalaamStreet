namespace SalaamStreet.Desktop.Services;

/// <summary>Great-circle bearing to the Kaaba, computed entirely on-device.</summary>
public static class QiblaService
{
    private const double KaabaLat = 21.4225;
    private const double KaabaLng = 39.8262;

    /// <summary>Initial bearing from (lat,lng) to the Kaaba, degrees from true North.</summary>
    public static double Bearing(double lat, double lng)
    {
        double Rad(double d) => d * Math.PI / 180.0;
        double p1 = Rad(lat), p2 = Rad(KaabaLat), dl = Rad(KaabaLng - lng);
        double y = Math.Sin(dl) * Math.Cos(p2);
        double x = Math.Cos(p1) * Math.Sin(p2) - Math.Sin(p1) * Math.Cos(p2) * Math.Cos(dl);
        return (Math.Atan2(y, x) * 180.0 / Math.PI + 360.0) % 360.0;
    }
}
