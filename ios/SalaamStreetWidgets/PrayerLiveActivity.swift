import ActivityKit
import SwiftUI
import WidgetKit

/// The prayer countdown on the Lock Screen, in StandBy and in the Dynamic Island.
struct PrayerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
            LockScreenCountdown(context: context)
                .activityBackgroundTint(Color(red: 0.024, green: 0.306, blue: 0.231))
                .activitySystemActionForegroundColor(Hero.text)
                .widgetURL(URL(string: "salaamstreet://page/home"))
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.labelNext).font(.caption2).foregroundStyle(Hero.label)
                        Text(s.name).font(.title3.weight(.heavy)).foregroundStyle(Hero.text)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(s.timeText).font(.caption).foregroundStyle(Hero.soft)
                        countdown(s).font(.title3.weight(.heavy)).foregroundStyle(Hero.text)
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Label(context.attributes.city, systemImage: "location.fill").font(.caption2).foregroundStyle(Hero.soft).lineLimit(1)
                        Spacer()
                        if let n = s.followingName, let t = s.followingTimeText {
                            Text("\(n) \(t)").font(.caption2).foregroundStyle(Hero.soft)
                        }
                        dots(s.prayedToday)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: "moon.stars.fill").font(.caption2)
                    Text(s.name).font(.caption.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7)
                }
                .foregroundStyle(Hero.label)
                .padding(.leading, 4)
            } compactTrailing: {
                // Room for "10:59:59"; the label never truncates.
                countdown(s).font(.caption.weight(.bold).monospacedDigit()).foregroundStyle(Hero.text)
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .frame(width: 58, alignment: .trailing)
                    .padding(.trailing, 2)
            } minimal: {
                Image(systemName: "moon.stars.fill").foregroundStyle(Hero.label)
            }
            .widgetURL(URL(string: "salaamstreet://page/home"))
            .keylineTint(Hero.label)
        }
    }
}

private func countdown(_ s: PrayerActivityAttributes.ContentState) -> some View {
    let now = Date()
    return Text(timerInterval: now...max(now, s.at), countsDown: true).monospacedDigit().multilineTextAlignment(.trailing)
}

private func dots(_ n: Int) -> some View {
    HStack(spacing: 3) {
        ForEach(0..<5, id: \.self) { i in
            Circle().fill(i < n ? Hero.label : Hero.text.opacity(0.25)).frame(width: 6, height: 6)
        }
    }
    .accessibilityLabel("\(n)/5")
}

struct LockScreenCountdown: View {
    let context: ActivityViewContext<PrayerActivityAttributes>

    var body: some View {
        let s = context.state
        let a = context.attributes
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(a.labelNext).font(.caption.weight(.semibold)).foregroundStyle(Hero.label)
                Text(s.name).font(.system(size: 28, weight: .heavy)).foregroundStyle(Hero.text)
                HStack(spacing: 6) {
                    Text(s.timeText).foregroundStyle(Hero.soft)
                    Text("·").foregroundStyle(Hero.soft)
                    Text(a.city).foregroundStyle(Hero.soft).lineLimit(1)
                }
                .font(.footnote)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                countdown(s).font(.system(size: 30, weight: .heavy)).foregroundStyle(Hero.text)
                HStack(spacing: 6) {
                    if let n = s.followingName, let t = s.followingTimeText {
                        Text("\(n) \(t)").font(.caption2).foregroundStyle(Hero.soft)
                    }
                    dots(s.prayedToday)
                }
            }
        }
        .padding(16)
        .background(Hero.background)
        .environment(\.layoutDirection, a.rtl ? .rightToLeft : .leftToRight)
        .environment(\.locale, Locale(identifier: a.locale))
    }
}
