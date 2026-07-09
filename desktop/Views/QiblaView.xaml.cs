using System.Windows.Controls;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class QiblaView : UserControl
{
    public QiblaView()
    {
        InitializeComponent();
        var s = App.Settings;
        var bearing = QiblaService.Bearing(s.Lat, s.Lng);
        LocLabel.Text = "📍 " + s.LocationLabel;
        Degrees.Text = $"{bearing:F1}°";
        NeedleRot.Angle = bearing; // needle points toward the Qibla relative to North-up
    }
}
