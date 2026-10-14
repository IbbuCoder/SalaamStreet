import SwiftUI
import SalaamStreetCore

/// Home: the next prayer and its countdown, today's prayers with the tracker,
/// Jumu'ah on Fridays, and quick ways into everything else.
struct TodayView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var router: Router
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var liveActivity: LiveActivityController

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                if !network.isOnline {
                    StatusBanner(kind: .offline, text: "You're offline. Prayer times, the Qibla, duas, dhikr and anything you've downloaded still work.",
                                 actionTitle: "Offline") { router.show(.offline) }
                }
                if model.isUsingDefaultLocation {
                    StatusBanner(kind: .info, text: "Showing times for Makkah until you choose your location.",
                                 actionTitle: "Choose") { router.show(.settings) }
                }
                NextPrayerCard()
                if model.today.isFriday { JumuahCard() }
                todayList
                if !model.settings.liveActivity.enabled && liveActivity.systemAllowsActivities { lockScreenPrompt }
                quickLinks
            }
            .padding(Layout.gutter)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.background)
        .navigationTitle("SalaamStreet")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { LogoMark(size: 28) }
            ToolbarItem(placement: .topBarTrailing) {
                Button { router.show(.offline) } label: { Image(systemName: "arrow.down.circle") }
                    .accessibilityLabel("Offline downloads")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { router.show(.settings) } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("Settings")
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(model.clock.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                .font(.title2.weight(.bold))
                .foregroundStyle(Brand.text)
            HStack(spacing: 6) {
                Text(model.hijri.english)
                Text("·").accessibilityHidden(true)
                Label(model.location.name, systemImage: "location.fill").labelStyle(.titleAndIcon)
            }
            .font(.subheadline)
            .foregroundStyle(Brand.text2)
        }
        .accessibilityElement(children: .combine)
    }

    private var todayList: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionLabel(text: "Today")
                Spacer()
                let done = model.log.count(on: model.todayKey)
                Text("\(done) of 5 prayed").font(.caption).foregroundStyle(Brand.text3)
            }
            Panel(padding: 4) {
                VStack(spacing: 0) {
                    ForEach(model.today.times) { t in
                        PrayerRow(time: t, zone: model.location.timeZone,
                                  isNext: model.nextPrayer?.id == t.id,
                                  prayed: t.prayer.isObligatory ? model.prayed(t.prayer) : nil,
                                  canTick: t.date <= model.clock) {
                            model.togglePrayed(t.prayer)
                        }
                        if t.id != model.today.times.last?.id { Divider().padding(.leading, 16) }
                    }
                }
            }
        }
    }

    private var lockScreenPrompt: some View {
        Panel {
            HStack(spacing: 14) {
                Image(systemName: "lock.iphone").font(.title2).foregroundStyle(Brand.primary).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Countdown on your Lock Screen").font(.subheadline.weight(.semibold))
                    Text("See the next prayer in the Dynamic Island and on the Lock Screen.")
                        .font(.caption).foregroundStyle(Brand.text2)
                }
                Spacer(minLength: 8)
                Button("Turn on") { model.settings.liveActivity.enabled = true }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
            }
        }
    }

    private var quickLinks: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "Explore")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                QuickLink(title: "Qibla", icon: "location.north.line") { router.tab = .qibla }
                QuickLink(title: "Duas", icon: "hands.and.sparkles") { router.show(.duas) }
                QuickLink(title: "Dhikr", icon: "circle.dotted") { router.show(.dhikr) }
                QuickLink(title: "Mosques", icon: "building.columns") { router.show(.mosques) }
                QuickLink(title: "99 Names", icon: "sparkles") { router.show(.names) }
                QuickLink(title: "Offline", icon: "arrow.down.circle") { router.show(.offline) }
            }
        }
    }
}

/// The one emphasised element on Home: the next prayer, live.
struct NextPrayerCard: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            if let next = model.builder.next(after: now) {
                let previous = model.builder.current(at: now)
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Next prayer").font(.caption.weight(.semibold)).foregroundStyle(Brand.mint)
                            Text(next.englishName).font(.largeTitle.weight(.bold)).foregroundStyle(.white)
                        }
                        Spacer()
                        Text(next.arabicName).font(.title).foregroundStyle(Brand.mint)
                            .environment(\.locale, Locale(identifier: "ar"))
                    }
                    HStack(alignment: .lastTextBaseline) {
                        Text(Countdown.short(from: now, to: next.date))
                            .font(.system(size: 40, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                            .contentTransition(.numericText())
                            .accessibilityLabel("in " + Countdown.spoken(from: now, to: next.date))
                        Spacer()
                        Text(next.date.clockTime(in: model.location.timeZone))
                            .font(.title3.weight(.semibold)).foregroundStyle(.white.opacity(0.85))
                    }
                    if let previous {
                        let total = next.date.timeIntervalSince(previous.date)
                        ProgressView(value: min(1, max(0, now.timeIntervalSince(previous.date) / max(total, 1))))
                            .tint(Brand.mint)
                            .accessibilityHidden(true)
                    }
                }
                .padding(20)
                .background(Brand.deepGreen, in: RoundedRectangle(cornerRadius: Layout.radius, style: .continuous))
                .accessibilityElement(children: .combine)
            } else {
                StatusBanner(kind: .warning, text: "Prayer times can't be calculated for this location today (the sun doesn't reach the required angle). Choose another calculation method in Settings.")
            }
        }
    }
}

/// Jumu'ah reminder with a direct way to Surah Al-Kahf.
struct JumuahCard: View {
    @EnvironmentObject private var router: Router

    var body: some View {
        Panel {
            HStack(spacing: 14) {
                Image(systemName: "building.columns.fill").font(.title2).foregroundStyle(Brand.gold).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Jumu'ah Mubarak").font(.headline)
                    Text("It's Friday — a good day to read Surah Al-Kahf and send salawat on the Prophet ﷺ.")
                        .font(.subheadline).foregroundStyle(Brand.text2)
                }
                Spacer(minLength: 8)
            }
            Button {
                router.open(URL(string: "salaamstreet://quran/18")!)
            } label: {
                Label("Read Al-Kahf", systemImage: "book")
            }
            .buttonStyle(.bordered)
            .padding(.top, 8)
        }
    }
}

/// One prayer in a list, with its tracker tick.
struct PrayerRow: View {
    let time: PrayerTime
    let zone: TimeZone
    var isNext = false
    /// nil for sunrise (not tracked).
    var prayed: Bool?
    var canTick = true
    var toggle: () -> Void = {}

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(time.englishName).font(.body.weight(isNext ? .semibold : .regular))
                Text(time.arabicName).font(.caption).foregroundStyle(Brand.text3)
            }
            if isNext { Pill(text: "Next") }
            Spacer()
            Text(time.date.clockTime(in: zone))
                .font(.body.monospacedDigit().weight(isNext ? .semibold : .regular))
                .foregroundStyle(isNext ? Brand.primary : Brand.text)
            if let prayed {
                Button(action: toggle) {
                    Image(systemName: prayed ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(prayed ? Brand.primary : Brand.text3)
                        .frame(width: Layout.minTouch, height: Layout.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!canTick && !prayed)
                .opacity(!canTick && !prayed ? 0.35 : 1)
                .accessibilityLabel(prayed ? "\(time.englishName) prayed" : "Mark \(time.englishName) as prayed")
                .sensoryFeedback(.success, trigger: prayed)
            } else {
                Image(systemName: "sunrise").foregroundStyle(Brand.gold)
                    .frame(width: Layout.minTouch, height: Layout.minTouch).accessibilityHidden(true)
            }
        }
        .padding(.leading, 12)
        .padding(.vertical, 2)
        .background(isNext ? Brand.primarySoft : .clear, in: RoundedRectangle(cornerRadius: Layout.radiusSmall))
    }
}

struct QuickLink: View {
    let title: String
    let icon: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon).font(.title3).foregroundStyle(Brand.primary)
                Text(title).font(.footnote.weight(.medium)).foregroundStyle(Brand.text)
            }
            .frame(maxWidth: .infinity, minHeight: 76)
            .background(Brand.surface, in: RoundedRectangle(cornerRadius: Layout.radiusSmall, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Layout.radiusSmall, style: .continuous).strokeBorder(Brand.border))
        }
        .buttonStyle(.plain)
    }
}
