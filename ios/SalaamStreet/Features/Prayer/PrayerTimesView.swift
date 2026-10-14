import SwiftUI
import SalaamStreetCore

/// Prayer times for any day, calculated on the device (works offline), with
/// the method and Asr choice one tap away.
struct PrayerTimesView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var liveActivity: LiveActivityController
    @State private var dayOffset = 0

    private var day: DaySchedule {
        let date = Calendar.current.date(byAdding: .day, value: dayOffset, to: model.clock) ?? model.clock
        return model.builder.schedule(for: date)
    }

    var body: some View {
        List {
            Section {
                NextPrayerCard()
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                    .listRowBackground(Color.clear)
            }

            Section {
                dayPicker
                ForEach(day.times) { t in
                    PrayerRow(time: t, zone: model.location.timeZone,
                              isNext: dayOffset == 0 && model.nextPrayer?.id == t.id,
                              prayed: t.prayer.isObligatory ? model.prayed(t.prayer, dayKey: day.dayKey) : nil,
                              canTick: t.date <= model.clock) {
                        model.togglePrayed(t.prayer, dayKey: day.dayKey)
                    }
                    .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 0, trailing: 4))
                }
            } footer: {
                Text("Calculated on your iPhone, so they work without internet. Tick a prayer once you've prayed it.")
            }

            Section("Calculation") {
                NavigationLink {
                    CalculationSettingsView()
                } label: {
                    LabeledContent("Method", value: methodName)
                }
                NavigationLink {
                    CalculationSettingsView()
                } label: {
                    LabeledContent("Asr", value: model.settings.prayer.school.title)
                }
                NavigationLink {
                    LocationPickerView()
                } label: {
                    LabeledContent("Location", value: model.location.name)
                }
            }

            Section {
                NavigationLink { TimetableView() } label: { Label("Monthly timetable", systemImage: "calendar") }
                NavigationLink { TrackerView() } label: { Label("Prayer tracker & history", systemImage: "checkmark.seal") }
                NavigationLink { ReminderSettingsView() } label: { Label("Reminders", systemImage: "bell") }
                NavigationLink { LiveActivitySettingsView() } label: {
                    HStack {
                        Label("Lock Screen & Dynamic Island", systemImage: "lock.iphone")
                        Spacer()
                        if liveActivity.isRunning { Pill(text: "On") }
                    }
                }
            }
        }
        .navigationTitle("Prayer Times")
        .scrollContentBackground(.hidden)
        .background(Brand.background)
    }

    private var methodName: String {
        ContentLibrary.shared.calculationMethods.first { $0.id == model.settings.prayer.method }?.englishName ?? "Muslim World League"
    }

    private var dayPicker: some View {
        HStack {
            Button { dayOffset -= 1 } label: { Image(systemName: "chevron.left").frame(width: Layout.minTouch, height: Layout.minTouch) }
                .accessibilityLabel("Previous day")
            Spacer()
            VStack(spacing: 2) {
                let date = DayKey.parse(day.dayKey, timeZone: model.location.timeZone) ?? model.clock
                Text(dayOffset == 0 ? "Today" : date.formatted(.dateTime.weekday(.wide).day().month()))
                    .font(.headline)
                Text(HijriDate(date: date, timeZone: model.location.timeZone).english)
                    .font(.caption).foregroundStyle(Brand.text3)
            }
            .onTapGesture { dayOffset = 0 }
            .accessibilityElement(children: .combine)
            .accessibilityHint(dayOffset == 0 ? "" : "Double-tap to go back to today")
            Spacer()
            Button { dayOffset += 1 } label: { Image(systemName: "chevron.right").frame(width: Layout.minTouch, height: Layout.minTouch) }
                .accessibilityLabel("Next day")
        }
        .buttonStyle(.borderless)
    }
}

/// Calculation method and Asr school — each a choice, with what it means.
struct CalculationSettingsView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Form {
            Section {
                Picker("Method", selection: $model.settings.prayer.method) {
                    ForEach(ContentLibrary.shared.calculationMethods) { m in Text(m.englishName).tag(m.id) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Calculation method")
            } footer: {
                Text("Methods differ in the angle of the sun used for Fajr and Isha. Choose the one your local mosque follows.")
            }
            Section {
                Picker("Asr", selection: $model.settings.prayer.school) {
                    ForEach(AsrSchool.allCases) { s in
                        VStack(alignment: .leading) {
                            Text(s.title)
                            Text(s.detail).font(.caption).foregroundStyle(Brand.text2)
                        }
                        .tag(s)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Asr time")
            } footer: {
                Text("Both are valid positions held by scholars; SalaamStreet never presents one as the only view.")
            }
        }
        .navigationTitle("Calculation")
    }
}
