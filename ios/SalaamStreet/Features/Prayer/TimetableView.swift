import SwiftUI
import SalaamStreetCore

/// A month of prayer times, calculated on the device.
struct TimetableView: View {
    @EnvironmentObject private var model: AppModel
    @State private var monthOffset = 0

    private var month: (year: Int, month: Int) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = model.location.timeZone
        let d = cal.date(byAdding: .month, value: monthOffset, to: model.clock) ?? model.clock
        let c = cal.dateComponents([.year, .month], from: d)
        return (c.year!, c.month!)
    }

    var body: some View {
        let m = month
        let days = model.builder.month(year: m.year, month: m.month)
        let zone = model.location.timeZone
        ScrollView([.vertical]) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Button { monthOffset -= 1 } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                        .accessibilityLabel("Previous month")
                    Spacer()
                    Text(monthTitle(m)).font(.headline)
                    Spacer()
                    Button { monthOffset += 1 } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
                        .accessibilityLabel("Next month")
                }
                Grid(alignment: .trailing, horizontalSpacing: 10, verticalSpacing: 8) {
                    GridRow {
                        Text("Day").gridColumnAlignment(.leading)
                        ForEach([Prayer.fajr, .sunrise, .dhuhr, .asr, .maghrib, .isha], id: \.self) { Text($0.englishName) }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Brand.text3)
                    Divider()
                    ForEach(days) { d in
                        let isToday = d.dayKey == model.todayKey
                        GridRow {
                            Text("\(d.day)" + (d.isFriday ? " Fri" : ""))
                                .fontWeight(isToday ? .bold : .regular)
                                .gridColumnAlignment(.leading)
                            ForEach([Prayer.fajr, .sunrise, .dhuhr, .asr, .maghrib, .isha], id: \.self) { p in
                                Text(d.time(of: p).map { short($0.date, zone) } ?? "—")
                            }
                        }
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(isToday ? Brand.primary : Brand.text)
                        .accessibilityElement(children: .combine)
                    }
                }
                Text("Times for \(model.location.name), calculated on your iPhone with your chosen method — they work offline for any month.")
                    .font(.caption).foregroundStyle(Brand.text3)
            }
            .padding(Layout.gutter)
        }
        .background(Brand.background)
        .navigationTitle("Timetable")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func monthTitle(_ m: (year: Int, month: Int)) -> String {
        let d = Calendar(identifier: .gregorian).date(from: DateComponents(year: m.year, month: m.month, day: 15)) ?? Date()
        return d.formatted(.dateTime.month(.wide).year())
    }

    private func short(_ date: Date, _ zone: TimeZone) -> String {
        let f = DateFormatter()
        f.timeZone = zone
        f.setLocalizedDateFormatFromTemplate("jmm")
        // The columns are already in day order, so AM/PM only adds width.
        f.amSymbol = ""
        f.pmSymbol = ""
        return f.string(from: date).trimmingCharacters(in: .whitespaces)
    }
}

/// Prayer tracker: streaks and the last 30 days. Stored only on this iPhone.
struct TrackerView: View {
    @EnvironmentObject private var model: AppModel
    @State private var confirmClear = false

    var body: some View {
        let zone = model.location.timeZone
        let recent = model.log.recent(30, today: model.clock, timeZone: zone)
        List {
            Section {
                HStack(spacing: 0) {
                    stat("\(model.log.currentStreak(today: model.clock, timeZone: zone))", "Current streak", "days with all five")
                    Divider()
                    stat("\(model.log.bestStreak)", "Best streak", "days")
                    Divider()
                    stat("\(recent.suffix(7).reduce(0) { $0 + $1.count })/35", "This week", "prayers ticked")
                }
                .padding(.vertical, 6)
            }
            Section("Last 30 days") {
                ForEach(recent.reversed(), id: \.dayKey) { item in
                    NavigationLink {
                        TrackerDayView(dayKey: item.dayKey)
                    } label: {
                        HStack {
                            Text(DayKey.parse(item.dayKey, timeZone: zone)?.formatted(.dateTime.weekday(.abbreviated).day().month()) ?? item.dayKey)
                            Spacer()
                            HStack(spacing: 3) {
                                ForEach(Prayer.obligatory) { p in
                                    Circle()
                                        .fill(model.log.prayed(p, on: item.dayKey) ? Brand.primary : Brand.border)
                                        .frame(width: 9, height: 9)
                                }
                            }
                            .accessibilityHidden(true)
                            Text("\(item.count)/5").font(.footnote.monospacedDigit()).foregroundStyle(Brand.text3)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            Section {
                Button("Clear tracker history", role: .destructive) { confirmClear = true }
            } footer: {
                Text("Your tracker stays on this iPhone. SalaamStreet has no account on iOS yet, so it isn't synced.")
            }
        }
        .navigationTitle("Prayer Tracker")
        .confirmationDialog("Clear all tracker history?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear history", role: .destructive) { model.clearTracker() }
        }
    }

    private func stat(_ value: String, _ title: String, _ sub: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title2.weight(.bold).monospacedDigit()).foregroundStyle(Brand.primary)
            Text(title).font(.caption.weight(.semibold))
            Text(sub).font(.caption2).foregroundStyle(Brand.text3)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// Edit one past day (e.g. a prayer prayed but not ticked).
struct TrackerDayView: View {
    @EnvironmentObject private var model: AppModel
    let dayKey: String

    var body: some View {
        List {
            ForEach(Prayer.obligatory) { p in
                Toggle(isOn: Binding(get: { model.prayed(p, dayKey: dayKey) }, set: { _ in model.togglePrayed(p, dayKey: dayKey) })) {
                    VStack(alignment: .leading) {
                        Text(p.englishName)
                        Text(p.arabicName).font(.caption).foregroundStyle(Brand.text3)
                    }
                }
            }
        }
        .navigationTitle(DayKey.parse(dayKey, timeZone: model.location.timeZone)?.formatted(.dateTime.weekday(.wide).day().month()) ?? dayKey)
    }
}
