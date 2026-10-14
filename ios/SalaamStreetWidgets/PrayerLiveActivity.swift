import ActivityKit
import WidgetKit
import SwiftUI
import SalaamStreetCore

@main
struct SalaamStreetWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrayerLiveActivityWidget()
    }
}

/// The prayer countdown on the Lock Screen and in the Dynamic Island.
/// Every presentation opens the Prayer screen (salaamstreet://prayer).
struct PrayerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Brand.deepGreen)
                .activitySystemActionForegroundColor(Brand.mint)
                .widgetURL(URL(string: "salaamstreet://prayer"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Image("LogoMark").resizable().frame(width: 30, height: 30)
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(begun(context) ? "Now" : "Next").font(.caption2).foregroundStyle(Brand.mint)
                            Text(context.state.englishName).font(.headline).foregroundStyle(.white).lineLimit(1)
                        }
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        CountdownText(context: context)
                            .font(.title2.weight(.semibold).monospacedDigit())
                            .foregroundStyle(.white)
                        Text(context.state.prayerTime, style: .time).font(.caption).foregroundStyle(.white.opacity(0.75))
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        if context.attributes.showArabicName {
                            Text(context.state.arabicName).font(.subheadline).foregroundStyle(Brand.mint)
                        }
                        Spacer()
                        if context.attributes.showFollowingPrayer, let name = context.state.followingName, let time = context.state.followingTime {
                            Text("Then \(name) ") .font(.caption).foregroundStyle(.white.opacity(0.75))
                                + Text(time, style: .time).font(.caption).foregroundStyle(.white.opacity(0.75))
                        } else {
                            Label(context.state.locationName, systemImage: "location.fill")
                                .font(.caption).foregroundStyle(.white.opacity(0.75)).lineLimit(1)
                        }
                    }
                    .padding(.horizontal, 4)
                    if context.isStale {
                        Text("Open SalaamStreet to move on to the next prayer.")
                            .font(.caption2).foregroundStyle(.white.opacity(0.7))
                    }
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image("LogoMark").resizable().frame(width: 20, height: 20)
                        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                    Text(short(context.state.englishName)).font(.caption.weight(.semibold)).foregroundStyle(Brand.mint)
                }
                .accessibilityLabel(context.state.englishName)
            } compactTrailing: {
                CountdownText(context: context)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .frame(maxWidth: 56)
            } minimal: {
                Image("LogoMark").resizable().frame(width: 20, height: 20)
                    .clipShape(Circle())
                    .accessibilityLabel("\(context.state.englishName) at \(context.state.prayerTime.formatted(date: .omitted, time: .shortened))")
            }
            .widgetURL(URL(string: "salaamstreet://prayer"))
            .keylineTint(Brand.mint)
        }
    }

    private func begun(_ context: ActivityViewContext<PrayerActivityAttributes>) -> Bool {
        context.isStale || context.state.prayerTime <= Date()
    }

    /// Short labels for the compact Dynamic Island.
    private func short(_ name: String) -> String {
        switch name {
        case "Maghrib": return "Magh."
        case "Jumu'ah": return "Jum."
        default: return name
        }
    }
}

/// Counts down to the prayer by itself (no app needed); says "Now" once it has begun.
struct CountdownText: View {
    let context: ActivityViewContext<PrayerActivityAttributes>

    var body: some View {
        let end = context.state.prayerTime
        if context.isStale || end <= Date() {
            Text("Now")
        } else {
            Text(timerInterval: Date()...end, countsDown: true, showsHours: true)
                .multilineTextAlignment(.trailing)
        }
    }
}

struct LockScreenView: View {
    let context: ActivityViewContext<PrayerActivityAttributes>

    private var begun: Bool { context.isStale || context.state.prayerTime <= Date() }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                Image("LogoMark").resizable().frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(begun ? "It's time for" : "Next prayer").font(.caption).foregroundStyle(Brand.mint)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(context.state.englishName).font(.title3.weight(.bold)).foregroundStyle(.white)
                        if context.attributes.showArabicName {
                            Text(context.state.arabicName).font(.subheadline).foregroundStyle(Brand.mint)
                        }
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    if begun {
                        Text("began").font(.caption).foregroundStyle(.white.opacity(0.75))
                        Text(context.state.prayerTime, style: .time).font(.title2.weight(.semibold)).foregroundStyle(.white)
                    } else {
                        CountdownText(context: context)
                            .font(.title.weight(.semibold).monospacedDigit())
                            .foregroundStyle(.white)
                        Text("at ") .font(.caption).foregroundStyle(.white.opacity(0.75))
                            + Text(context.state.prayerTime, style: .time).font(.caption).foregroundStyle(.white.opacity(0.75))
                    }
                }
            }
            HStack {
                if context.attributes.showFollowingPrayer, let name = context.state.followingName, let time = context.state.followingTime {
                    Text("Then \(name) ").font(.caption) + Text(time, style: .time).font(.caption)
                }
                Spacer()
                Label(context.state.locationName, systemImage: "location.fill").font(.caption).lineLimit(1)
            }
            .foregroundStyle(.white.opacity(0.75))
            if context.isStale {
                Text("Open SalaamStreet to move on to the next prayer.")
                    .font(.caption2).foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(16)
        .accessibilityElement(children: .combine)
    }
}
