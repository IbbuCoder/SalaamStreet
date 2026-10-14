import SwiftUI
import UIKit
import SalaamStreetCore

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var router: Router

    var body: some View {
        Form {
            Section("Prayer times") {
                NavigationLink { LocationPickerView() } label: { LabeledContent("Location", value: model.location.name) }
                NavigationLink { CalculationSettingsView() } label: {
                    LabeledContent("Method & Asr", value: model.settings.prayer.school == .hanafi ? "Hanafi Asr" : "Standard Asr")
                }
                NavigationLink { ReminderSettingsView() } label: {
                    LabeledContent("Reminders", value: model.settings.reminders.enabled ? "On" : "Off")
                }
                NavigationLink { LiveActivitySettingsView() } label: {
                    LabeledContent("Lock Screen & Dynamic Island", value: model.settings.liveActivity.enabled ? "On" : "Off")
                }
            }

            Section("Qur'an") {
                Picker("Translation", selection: $model.settings.translation) {
                    ForEach(ContentLibrary.shared.translations) { Text($0.label).tag($0.id) }
                }
                Picker("Reciter", selection: $model.settings.reciter) {
                    ForEach(ContentLibrary.shared.reciters) { Text($0.englishName).tag($0.id) }
                }
                Toggle("Show translation", isOn: $model.settings.showTranslation)
                Toggle("Show transliteration", isOn: $model.settings.showTransliteration)
                VStack(alignment: .leading) {
                    Text("Arabic text size")
                    Slider(value: $model.settings.arabicScale, in: 0.8...1.8, step: 0.1) { Text("Arabic text size") }
                    ArabicText(text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ", size: 26, scale: model.settings.arabicScale)
                        .accessibilityHidden(true)
                }
                Toggle("Continue into the next surah", isOn: $model.settings.continuousPlay)
            }

            Section("Appearance") {
                Picker("Theme", selection: $model.settings.appearance) {
                    ForEach(AppearancePreference.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
            }

            Section {
                Button { router.show(.offline) } label: { Label("Offline downloads", systemImage: "arrow.down.circle") }
                NavigationLink { AboutView() } label: { Label("About SalaamStreet", systemImage: "info.circle") }
            }
        }
        .navigationTitle("Settings")
    }
}

struct ReminderSettingsView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var notifications: NotificationService

    var body: some View {
        Form {
            Section {
                Toggle("Prayer reminders", isOn: Binding(get: { model.settings.reminders.enabled }, set: { on in
                    if on {
                        Task {
                            let ok = await notifications.requestPermission()
                            model.settings.reminders.enabled = ok
                        }
                    } else {
                        model.settings.reminders.enabled = false
                    }
                }))
                if model.settings.reminders.enabled {
                    Picker("When", selection: $model.settings.reminders.minutesBefore) {
                        Text("At the time").tag(0)
                        ForEach([5, 10, 15, 20, 30], id: \.self) { Text("\($0) minutes before").tag($0) }
                    }
                    ForEach(Prayer.obligatory) { p in
                        Toggle(p.englishName, isOn: Binding(
                            get: { model.settings.reminders.prayers.contains(p) },
                            set: { on in
                                if on { model.settings.reminders.prayers.insert(p) } else { model.settings.reminders.prayers.remove(p) }
                            }))
                    }
                    Toggle("Sound", isOn: $model.settings.reminders.sound)
                }
            } footer: {
                Text("Reminders are scheduled on your iPhone from your prayer times, so they arrive without internet. Each one has an \u{201C}I prayed\u{201D} button that ticks your tracker.")
            }

            Section {
                Toggle("Friday: read Surah Al-Kahf", isOn: Binding(get: { model.settings.reminders.kahfReminder }, set: { on in
                    if on {
                        Task {
                            let ok = await notifications.requestPermission()
                            model.settings.reminders.kahfReminder = ok
                        }
                    } else {
                        model.settings.reminders.kahfReminder = false
                    }
                }))
            } footer: {
                Text("A gentle reminder at 9 am on Fridays.")
            }

            if notifications.authorization == .denied {
                Section {
                    StatusBanner(kind: .warning, text: "Notifications are off for SalaamStreet. Turn them on in the Settings app to get reminders.",
                                 actionTitle: "Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
        }
        .navigationTitle("Reminders")
        .task { await notifications.refreshAuthorization() }
    }
}

struct LiveActivitySettingsView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var liveActivity: LiveActivityController

    var body: some View {
        Form {
            Section {
                LiveActivityPreview(state: PrayerActivityPlanner.state(builder: model.builder, now: model.clock),
                                    showArabic: model.settings.liveActivity.showArabicName)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Section {
                Toggle("Show the next prayer", isOn: $model.settings.liveActivity.enabled)
                if model.settings.liveActivity.enabled {
                    Toggle("Start when I open SalaamStreet", isOn: $model.settings.liveActivity.autoStart)
                    Toggle("Show the Arabic name", isOn: $model.settings.liveActivity.showArabicName)
                    Toggle("Show the prayer after it", isOn: $model.settings.liveActivity.showFollowingPrayer)
                    if !liveActivity.isRunning {
                        Button("Start now") { liveActivity.start(preferences: model.settings.liveActivity, builder: model.builder) }
                    } else {
                        Button("Stop for now", role: .destructive) { liveActivity.endAll() }
                    }
                }
            } footer: {
                Text("A countdown to the next prayer on your Lock Screen and in the Dynamic Island. iOS lets apps start it only while they're open; it then counts down on its own. It moves on to the following prayer when SalaamStreet is opened or refreshed in the background; if iOS hasn't allowed that yet, it says the time has passed and asks you to open the app.")
            }
            if !liveActivity.systemAllowsActivities {
                Section {
                    StatusBanner(kind: .warning, text: "Live Activities are turned off for SalaamStreet in the Settings app.", actionTitle: "Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            if let e = liveActivity.lastError {
                Section { Text(e).font(.footnote).foregroundStyle(Brand.danger) }
            }
        }
        .navigationTitle("Lock Screen")
    }
}

/// An in-app picture of what the Lock Screen shows (the real one is drawn by the widget extension).
struct LiveActivityPreview: View {
    let state: PrayerCountdownState?
    let showArabic: Bool

    var body: some View {
        HStack(spacing: 14) {
            LogoMark(size: 40)
            if let state {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next prayer").font(.caption).foregroundStyle(Brand.mint)
                    HStack(spacing: 6) {
                        Text(state.englishName).font(.title3.weight(.bold)).foregroundStyle(.white)
                        if showArabic { Text(state.arabicName).font(.subheadline).foregroundStyle(Brand.mint) }
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(timerInterval: Date()...max(Date(), state.prayerTime), countsDown: true)
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.trailing)
                    Text(state.prayerTime, style: .time).font(.caption).foregroundStyle(.white.opacity(0.8))
                }
            }
        }
        .padding(16)
        .background(Brand.deepGreen, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .padding(.vertical, 4)
        .accessibilityLabel("Preview of the Lock Screen countdown")
    }
}

/// First launch: location and what SalaamStreet does (and doesn't) do.
struct WelcomeView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var location: LocationService
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            LogoMark(size: 88)
            VStack(spacing: 8) {
                Text("As-salamu alaykum").font(.largeTitle.weight(.bold))
                Text("Prayer times, the Qibla, the Qur'an with recitation, duas and dhikr — free, private, and ready offline.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Brand.text2)
            }
            Spacer()
            if let error { StatusBanner(kind: .warning, text: error) }
            VStack(spacing: 12) {
                Button {
                    Task {
                        busy = true
                        do {
                            model.setLocation(try await location.devicePrayerLocation())
                            model.settings.hasCompletedWelcome = true
                        } catch { self.error = error.localizedDescription }
                        busy = false
                    }
                } label: {
                    HStack {
                        if busy { ProgressView().tint(Brand.onPrimary) }
                        Text("Use my location for prayer times")
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .disabled(busy)
                Button("Not now — I'll choose a city later") { model.settings.hasCompletedWelcome = true }
                    .frame(minHeight: 44)
            }
            Text("Your location stays on your iPhone, rounded to about 1 km. No account or ads.")
                .font(.footnote).foregroundStyle(Brand.text3).multilineTextAlignment(.center)
        }
        .padding(24)
        .background(Brand.background)
    }
}
