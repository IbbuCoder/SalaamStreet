import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct SalaamStreetWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        TodayTimesWidget()
        AyahWidget()
        PrayerLiveActivity()
        if #available(iOS 18.0, *) {
            CountdownControl()
        }
    }
}

// MARK: Timeline

struct PrayerEntry: TimelineEntry {
    let date: Date
    let snap: PrayerSnapshot?
}

/// One entry now and one at each coming prayer time, so the widgets move on
/// to the next prayer by themselves. The data is the website's latest snapshot.
struct PrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry { PrayerEntry(date: Date(), snap: .preview) }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(PrayerEntry(date: Date(), snap: SharedStore.loadSnapshot() ?? .preview))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        guard let snap = SharedStore.loadSnapshot() else {
            return completion(Timeline(entries: [PrayerEntry(date: now, snap: nil)], policy: .after(now.addingTimeInterval(3600))))
        }
        var dates = [now]
        dates += snap.times(includeSunrise: true).map(\.date).filter { $0 > now && $0 < now.addingTimeInterval(36 * 3600) }
        // Midnight in the location's zone: a new Ayah of the Day and tracker day.
        if let midnight = snap.calendar.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime) {
            dates.append(midnight)
        }
        let entries = Array(Set(dates)).sorted().prefix(30).map { PrayerEntry(date: $0, snap: snap) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: Style (the website's Home hero)

enum Hero {
    static let gradient = LinearGradient(colors: [Color(red: 0.043, green: 0.42, blue: 0.314), Color(red: 0.024, green: 0.306, blue: 0.231), Color(red: 0.008, green: 0.173, blue: 0.133)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing)
    static let glow = RadialGradient(colors: [Color(red: 0.79, green: 0.64, blue: 0.15).opacity(0.25), .clear], center: .topTrailing, startRadius: 0, endRadius: 140)
    static let text = Color(red: 0.937, green: 0.988, blue: 0.961)  // #effcf5
    static let soft = Color(red: 0.82, green: 0.98, blue: 0.898)    // --em-100
    static let label = Color(red: 0.655, green: 0.953, blue: 0.816) // --em-200
    static let gold = Color(red: 0.85, green: 0.71, blue: 0.26)

    static var background: some View { ZStack { gradient; glow } }
}

extension View {
    /// Language and reading direction of the website.
    func siteLocale(_ snap: PrayerSnapshot?) -> some View {
        environment(\.layoutDirection, snap?.rtl == true ? .rightToLeft : .leftToRight)
            .environment(\.locale, Locale(identifier: snap?.locale ?? "en"))
    }
}

struct NoDataView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image("LogoMark").resizable().frame(width: 28, height: 28)
            Text("Open SalaamStreet to set up your prayer times.").font(.caption).multilineTextAlignment(.center).foregroundStyle(Hero.soft)
        }
    }
}

// MARK: Next prayer

struct NextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextPrayer", provider: PrayerProvider()) { entry in
            NextPrayerView(entry: entry)
                .containerBackground(for: .widget) { Hero.background }
                .widgetURL(URL(string: "salaamstreet://page/home"))
                .siteLocale(entry.snap)
        }
        .configurationDisplayName("Next prayer")
        .description("The next prayer, its time and a countdown — with an \"I prayed\" button.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct NextPrayerView: View {
    let entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if let snap = entry.snap, let next = snap.next(after: entry.date) {
            switch family {
            case .accessoryInline:
                Text("\(next.name) \(snap.format(next.date))")
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Text(next.name).font(.system(size: 11, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.6)
                    Text(snap.format(next.date)).font(.system(size: 13, weight: .bold)).lineLimit(1).minimumScaleFactor(0.5)
                }
                .widgetAccentable()
                .containerBackground(for: .widget) { AccessoryWidgetBackground() }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(snap.label("next", "Next prayer")).font(.caption2).foregroundStyle(.secondary)
                    Text("\(next.name) · \(snap.format(next.date))").font(.headline).widgetAccentable()
                    Text(timerInterval: entry.date...max(entry.date, next.date), countsDown: true).font(.caption).monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                medium(snap, next)
            default:
                small(snap, next)
            }
        } else {
            NoDataView()
        }
    }

    private func small(_ snap: PrayerSnapshot, _ next: PrayerTime) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(snap.label("next", "Next prayer")).font(.caption.weight(.semibold)).foregroundStyle(Hero.label)
            Text(next.name).font(.system(size: 26, weight: .heavy)).foregroundStyle(Hero.text).lineLimit(1).minimumScaleFactor(0.6)
            Text(snap.format(next.date)).font(.subheadline).foregroundStyle(Hero.soft)
            Spacer(minLength: 2)
            Text(timerInterval: entry.date...max(entry.date, next.date), countsDown: true)
                .font(.system(size: 22, weight: .heavy)).monospacedDigit().foregroundStyle(Hero.text)
            Text(snap.location.label).font(.caption2).foregroundStyle(Hero.soft).lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func medium(_ snap: PrayerSnapshot, _ next: PrayerTime) -> some View {
        HStack(alignment: .top) {
            small(snap, next)
            VStack(alignment: .trailing, spacing: 8) {
                PrayedButton(snap: snap, now: entry.date)
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    ForEach(PrayerKey.five, id: \.self) { k in
                        Circle()
                            .fill(snap.isPrayed(k, day: snap.dayString(for: entry.date)) ? Hero.label : Hero.text.opacity(0.22))
                            .frame(width: 9, height: 9)
                    }
                }
            }
        }
    }
}

/// "Did you pray Asr?" → tick it without opening the app (like the Home page check-in).
struct PrayedButton: View {
    let snap: PrayerSnapshot
    let now: Date

    var body: some View {
        if let cur = snap.previous(before: now), cur.key != .sunrise, !snap.isPrayed(cur.key, day: cur.day),
           let p = PrayerAppEnum(rawValue: cur.key.rawValue) {
            Button(intent: MarkPrayedIntent(prayer: p, day: cur.day)) {
                Label(snap.label("prayed", "I prayed"), systemImage: "checkmark")
                    .font(.caption.weight(.bold))
                    .lineLimit(1)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Hero.text.opacity(0.16), in: Capsule())
                    .foregroundStyle(Hero.text)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(snap.label("prayed", "I prayed")): \(cur.name)")
        }
    }
}

// MARK: Today's times

struct TodayTimesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayTimes", provider: PrayerProvider()) { entry in
            TodayTimesView(entry: entry)
                .containerBackground(for: .widget) { Color("Surface") }
                .widgetURL(URL(string: "salaamstreet://page/prayer"))
                .siteLocale(entry.snap)
        }
        .configurationDisplayName("Today's prayer times")
        .description("All of today's times for your location, with the ones you've prayed ticked.")
        .supportedFamilies([.systemMedium, .systemLarge, .accessoryRectangular])
    }
}

struct TodayTimesView: View {
    let entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if let snap = entry.snap {
            let day = snap.dayString(for: entry.date)
            let rows = snap.times(includeSunrise: true).filter { $0.day == day }
            let next = snap.next(after: entry.date)
            if family == .accessoryRectangular {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(rows.filter { $0.key != .sunrise }.prefix(5)) { p in
                        HStack {
                            Text(p.name).fontWeight(p.id == next?.id ? .bold : .regular)
                            Spacer()
                            Text(snap.format(p.date)).monospacedDigit()
                        }
                        .font(.system(size: 11))
                    }
                }
                .widgetAccentable()
            } else {
                VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 3) {
                    HStack {
                        Text(snap.label("today", "Today")).font(.headline).foregroundStyle(Color("BrandStrong"))
                        Spacer()
                        Text(snap.location.label).font(.caption).foregroundStyle(Color("TextSecondary")).lineLimit(1)
                    }
                    if family == .systemLarge, let h = snap.today(entry.date)?.hijri {
                        Text(h).font(.caption).foregroundStyle(Color("TextSecondary"))
                    }
                    ForEach(rows) { p in
                        let isNext = p.id == next?.id
                        HStack {
                            if p.key != .sunrise {
                                Image(systemName: snap.isPrayed(p.key, day: day) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(Color("Brand"))
                                    .font(.caption)
                            } else {
                                Image(systemName: "sunrise").foregroundStyle(Color("TextSecondary")).font(.caption)
                            }
                            Text(p.name).fontWeight(isNext ? .bold : .medium)
                            Spacer()
                            Text(snap.format(p.date)).monospacedDigit().fontWeight(isNext ? .bold : .regular)
                        }
                        .font(family == .systemLarge ? .body : .caption)
                        .foregroundStyle(isNext ? Color("BrandStrong") : Color("TextPrimary"))
                        .padding(.horizontal, isNext ? 6 : 0)
                        .padding(.vertical, isNext && family == .systemLarge ? 4 : 0)
                        .background(isNext ? Color("Surface2") : .clear, in: RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        } else {
            NoDataView().foregroundStyle(Color("TextPrimary"))
        }
    }
}

// MARK: Ayah of the Day

struct AyahWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahOfTheDay", provider: PrayerProvider()) { entry in
            AyahView(entry: entry)
                .containerBackground(for: .widget) { Color("Surface") }
                .widgetURL(URL(string: entry.snap?.ayah(for: entry.date).map { "salaamstreet://page/surah/\($0.surah)/\($0.ayah)" } ?? "salaamstreet://page/home"))
                .siteLocale(entry.snap)
        }
        .configurationDisplayName("Ayah of the Day")
        .description("The same ayah as on the SalaamStreet Home page, in Arabic with your translation.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct AyahView: View {
    let entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if let snap = entry.snap, let a = snap.ayah(for: entry.date) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(snap.label("ayahOfDay", "Ayah of the day")).font(.caption.weight(.semibold)).foregroundStyle(Color("BrandStrong"))
                    Spacer()
                    Text(a.ref).font(.caption2).foregroundStyle(Color("TextSecondary"))
                }
                Text(a.arabic)
                    .font(.system(size: family == .systemLarge ? 22 : 17))
                    .environment(\.layoutDirection, .rightToLeft)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .lineLimit(family == .systemLarge ? 6 : 2)
                    .minimumScaleFactor(0.7)
                    .foregroundStyle(Color("TextPrimary"))
                Text(a.translation)
                    .font(family == .systemLarge ? .callout : .caption)
                    .foregroundStyle(Color("TextSecondary"))
                    .environment(\.layoutDirection, a.dir == "rtl" ? .rightToLeft : .leftToRight)
                    .lineLimit(family == .systemLarge ? 8 : 3)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            NoDataView().foregroundStyle(Color("TextPrimary"))
        }
    }
}

// MARK: Control Centre (iOS 18)

@available(iOS 18.0, *)
struct CountdownControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.salaamstreet.app.countdown", provider: CountdownValueProvider()) { isOn in
            ControlWidgetToggle("Prayer countdown", isOn: isOn, action: CountdownToggleIntent()) { on in
                Label(on ? "On" : "Off", systemImage: on ? "timer.circle.fill" : "timer")
            }
        }
        .displayName("Prayer countdown")
        .description("Shows the countdown to the next prayer on the Lock Screen and in the Dynamic Island.")
    }
}

@available(iOS 18.0, *)
struct CountdownValueProvider: ControlValueProvider {
    var previewValue: Bool { false }
    func currentValue() async throws -> Bool {
        !Activity<PrayerActivityAttributes>.activities.isEmpty
    }
}

// MARK: Preview data

extension PrayerSnapshot {
    static var preview: PrayerSnapshot {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        let today = f.string(from: Date())
        return PrayerSnapshot(location: .init(label: "London", lat: 51.5, lng: -0.12, tz: TimeZone.current.identifier),
                              days: [.init(date: today, hijri: nil, timings: ["Fajr": "05:31", "Sunrise": "07:12", "Dhuhr": "12:52", "Asr": "15:41", "Maghrib": "18:22", "Isha": "19:51"])],
                              ayahs: [.init(date: today, arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", translation: "Indeed, with hardship comes ease.", ref: "Ash-Sharh 94:6", surah: 94, ayah: 6, dir: "ltr")])
    }
}
