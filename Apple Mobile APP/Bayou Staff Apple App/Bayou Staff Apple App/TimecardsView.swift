import SwiftUI

struct TimecardsView: View {
    @State private var openCard: Timecard?
    @State private var history: [Timecard] = []
    @State private var loading = true
    @State private var busy = false
    @State private var error: String?
    @State private var elapsed: TimeInterval = 0
    @State private var ticker: Timer?

    private var isClockedIn: Bool { openCard != nil }

    private var elapsedString: String {
        let h = Int(elapsed) / 3600
        let m = (Int(elapsed) % 3600) / 60
        let s = Int(elapsed) % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bayouBG.ignoresSafeArea()

                if loading {
                    ProgressView().tint(.bayouCyan)
                } else {
                    ScrollView {
                        VStack(spacing: 24) {

                            // Clock card
                            ClockCard(
                                isClockedIn: isClockedIn,
                                elapsed: elapsedString,
                                clockIn: openCard?.clockInDate,
                                busy: busy,
                                onToggle: { Task { await toggle() } }
                            )
                            .padding(.horizontal)

                            if let err = error {
                                Text(err)
                                    .font(.caption).foregroundColor(.red)
                                    .padding(.horizontal)
                            }

                            // History
                            if !history.isEmpty {
                                SectionHeader("Recent Timecards")
                                VStack(spacing: 6) {
                                    ForEach(history) { tc in
                                        TimecardRow(tc: tc)
                                    }
                                }
                                .padding(.horizontal)
                            }

                            Spacer(minLength: 32)
                        }
                        .padding(.top, 20)
                    }
                }
            }
            .navigationTitle("Timecards")
            .navigationBarTitleDisplayMode(.large)
        }
        .task { await load() }
        .onDisappear { stopTicker() }
    }

    // MARK: - Load

    private func load() async {
        loading = true; error = nil
        async let statusTask = APIClient.shared.clockStatus()
        async let historyTask = APIClient.shared.timecards()
        do {
            let (status, cards) = try await (statusTask, historyTask)
            openCard = status
            history = cards
            if isClockedIn { startTicker() }
        } catch {
            self.error = "Could not load timecard data."
        }
        loading = false
    }

    // MARK: - Toggle clock

    private func toggle() async {
        busy = true; error = nil
        do {
            if isClockedIn {
                let closed = try await APIClient.shared.clockOut()
                stopTicker()
                openCard = nil
                history.insert(closed, at: 0)
            } else {
                let card = try await APIClient.shared.clockIn()
                openCard = card
                startTicker()
            }
        } catch let err as ServerError {
            error = err.error
        } catch {
            self.error = "Action failed. Try again."
        }
        busy = false
    }

    // MARK: - Ticker

    private func startTicker() {
        if let clockIn = openCard?.clockInDate {
            elapsed = Date().timeIntervalSince(clockIn)
        }
        ticker?.invalidate()
        ticker = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if let clockIn = openCard?.clockInDate {
                elapsed = Date().timeIntervalSince(clockIn)
            }
        }
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
        elapsed = 0
    }
}

// MARK: - Clock card
private struct ClockCard: View {
    let isClockedIn: Bool
    let elapsed: String
    let clockIn: Date?
    let busy: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(spacing: 20) {

            // Pulse ring
            ZStack {
                if isClockedIn {
                    Circle()
                        .stroke(Color.bayouCyan.opacity(0.15), lineWidth: 16)
                        .frame(width: 140, height: 140)
                    Circle()
                        .stroke(Color.bayouCyan.opacity(0.35), lineWidth: 8)
                        .frame(width: 140, height: 140)
                }
                Circle()
                    .fill(isClockedIn ? Color.bayouCyan.opacity(0.12) : Color.bayouSurface)
                    .overlay(Circle().stroke(isClockedIn ? Color.bayouCyan : Color.bayouBorder, lineWidth: 2))
                    .frame(width: 120, height: 120)
                VStack(spacing: 2) {
                    Image(systemName: isClockedIn ? "stop.fill" : "play.fill")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(isClockedIn ? .bayouCyan : .white)
                    Text(isClockedIn ? "Clocked In" : "Clock In")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(isClockedIn ? .bayouCyan : .bayouMuted)
                }
            }

            // Elapsed / status
            if isClockedIn {
                VStack(spacing: 4) {
                    Text(elapsed)
                        .font(.system(size: 36, weight: .black, design: .monospaced))
                        .foregroundColor(.white)
                    if let ci = clockIn {
                        Text("Since \(DateFormatters.time.string(from: ci))")
                            .font(.caption)
                            .foregroundColor(.bayouMuted)
                    }
                }
            }

            // Button
            Button(action: onToggle) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(isClockedIn ? Color.red.opacity(0.15) : Color.bayouCyan)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(isClockedIn ? Color.red.opacity(0.4) : Color.clear)
                        )
                        .frame(height: 52)
                    if busy {
                        ProgressView().tint(isClockedIn ? .red : .black)
                    } else {
                        Text(isClockedIn ? "Clock Out" : "Clock In")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(isClockedIn ? .red : .black)
                    }
                }
            }
            .disabled(busy)
        }
        .padding(24)
        .background(Color.bayouSurface)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.bayouBorder))
    }
}

// MARK: - History row
private struct TimecardRow: View {
    let tc: Timecard

    private var statusColor: Color {
        switch tc.status {
        case "approved": return .green
        case "closed":   return .bayouMuted
        default:         return Color(hex: "#F59E0B")
        }
    }

    var body: some View {
        SurfaceCard {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    if let date = tc.date {
                        Text(date)
                            .font(.subheadline).fontWeight(.semibold)
                            .foregroundColor(.white)
                    }
                    Text(tc.displayTime)
                        .font(.caption)
                        .foregroundColor(.bayouMuted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    if let h = tc.hoursString {
                        Text(h)
                            .font(.subheadline).fontWeight(.bold)
                            .foregroundColor(.white)
                    }
                    if let status = tc.status {
                        Text(status.capitalized)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(statusColor)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(statusColor.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
        }
    }
}
