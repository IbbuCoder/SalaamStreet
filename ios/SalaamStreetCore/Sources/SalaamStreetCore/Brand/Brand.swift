#if canImport(SwiftUI) && canImport(UIKit)
import SwiftUI
import UIKit

/// The SalaamStreet palette — the website's tokens (css/styles.css) and the
/// logo's deep green and mint, with light and dark variants. Shared by the
/// app and the Live Activity so both look like one product.
public enum Brand {
    static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }

    /// Logo background green.
    public static let deepGreen = Color(uiColor: UIColor(hex: 0x0B4A31))
    /// Logo mint.
    public static let mint = Color(uiColor: UIColor(hex: 0x7FD9A8))

    /// Primary actions and highlights (emerald-700 light / emerald-500 dark, as on the website).
    public static let primary = dynamic(0x047857, 0x10B981)
    public static let primaryStrong = dynamic(0x065F46, 0x6EE7B7)
    public static let primarySoft = dynamic(0xECFDF5, 0x0F2A20)
    public static let onPrimary = dynamic(0xFFFFFF, 0x03120B)

    public static let background = dynamic(0xF6FAF7, 0x0A100D)
    public static let surface = dynamic(0xFFFFFF, 0x111A15)
    public static let surface2 = dynamic(0xEEF4F0, 0x18241E)
    public static let border = dynamic(0xDBE6DF, 0x24362E)

    public static let text = dynamic(0x0B1210, 0xEDF5F0)
    public static let text2 = dynamic(0x425249, 0xB0C2B8)
    public static let text3 = dynamic(0x64746B, 0x87998F)

    public static let gold = dynamic(0xA8841A, 0xD9B542)
    public static let danger = dynamic(0xC62828, 0xF87171)

    /// The Qur'an font bundled with the app (Scheherazade New, SIL OFL), as on the website.
    public static func quran(size: CGFloat) -> Font { .custom("ScheherazadeNew-Regular", size: size, relativeTo: .title) }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}
#endif
