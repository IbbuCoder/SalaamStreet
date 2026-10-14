import SwiftUI
import SalaamStreetCore

/// Spacing and shape tokens (the website's 16 px gutter, 18/12/10 px radii).
enum Layout {
    static let gutter: CGFloat = 16
    static let radius: CGFloat = 18
    static let radiusSmall: CGFloat = 12
    static let minTouch: CGFloat = 44
}

/// A quiet surface for grouped content. Used sparingly — most screens are lists.
struct Panel<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.surface, in: RoundedRectangle(cornerRadius: Layout.radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Layout.radius, style: .continuous).strokeBorder(Brand.border, lineWidth: 1))
    }
}

/// Small uppercase section heading, as on the website.
struct SectionLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .foregroundStyle(Brand.text3)
            .accessibilityAddTraits(.isHeader)
    }
}

/// An inline message: offline, outdated information, an error or a success.
struct StatusBanner: View {
    enum Kind { case info, offline, warning, error, success }
    let kind: Kind
    let text: String
    var actionTitle: String?
    var action: (() -> Void)?

    private var icon: String {
        switch kind {
        case .info: return "info.circle"
        case .offline: return "wifi.slash"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.octagon"
        case .success: return "checkmark.circle"
        }
    }
    private var tint: Color {
        switch kind {
        case .info, .offline: return Brand.text2
        case .warning: return Brand.gold
        case .error: return Brand.danger
        case .success: return Brand.primary
        }
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: icon).foregroundStyle(tint).accessibilityHidden(true)
            Text(text).font(.subheadline).foregroundStyle(Brand.text).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            if let actionTitle, let action {
                Button(actionTitle, action: action).font(.subheadline.weight(.semibold))
            }
        }
        .padding(12)
        .background(Brand.surface2, in: RoundedRectangle(cornerRadius: Layout.radiusSmall, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// The logo mark.
struct LogoMark: View {
    var size: CGFloat = 32
    var body: some View {
        Image("LogoMark")
            .resizable()
            .interpolation(.high)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// Arabic text in the Qur'an font, sized with Dynamic Type and the reader's own scale.
struct ArabicText: View {
    let text: String
    var size: CGFloat = 28
    var scale: Double = 1
    var body: some View {
        Text(text)
            .font(Brand.quran(size: size * scale))
            .lineSpacing(size * scale * 0.45)
            // Inside a right-to-left environment, "leading" is the right edge.
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar"))
            .textSelection(.enabled)
    }
}

/// A slim determinate progress bar with the brand colour.
struct ThinProgress: View {
    let value: Double
    var body: some View {
        ProgressView(value: min(max(value, 0), 1))
            .progressViewStyle(.linear)
            .tint(Brand.primary)
            .accessibilityValue("\(Int((value * 100).rounded())) percent")
    }
}

/// A pill-shaped tag.
struct Pill: View {
    let text: String
    var systemImage: String?
    var prominent = false
    var body: some View {
        HStack(spacing: 4) {
            if let systemImage { Image(systemName: systemImage).imageScale(.small) }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .foregroundStyle(prominent ? Brand.onPrimary : Brand.primaryStrong)
        .background(prominent ? Brand.primary : Brand.primarySoft, in: Capsule())
    }
}

extension Date {
    /// "5:42 PM" in the given time zone, following the person's 12/24-hour setting.
    func clockTime(in zone: TimeZone) -> String {
        let f = DateFormatter()
        f.timeZone = zone
        f.timeStyle = .short
        f.dateStyle = .none
        return f.string(from: self)
    }
}
