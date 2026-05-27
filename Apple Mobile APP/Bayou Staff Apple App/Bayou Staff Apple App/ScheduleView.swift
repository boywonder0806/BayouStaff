import SwiftUI

struct ScheduleView: View {
    @State private var weekStart = Self.currentMonday()
    @State private var shifts: [Shift] = []
    @State private var loading = true
    @State private var error: String?

    private static func currentMonday() -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.firstWeekday = 2
        let today = Date()
        let weekday = cal.component(.weekday, from: today)
        let daysBack = weekday == 1 ? 6 : weekday - 2
        let monday = cal.date(byAdding: .day, value: -daysBack, to: today)!
        return DateFormatters.apiDate.string(from: monday)
    }

    private var weekEnd: String {
        guard let d = DateFormatters.apiDate.date(from: weekStart) else { return weekStart }
        let end = Calendar.current.date(byAdding: .day, value: 6, to: d)!
        return DateFormatters.apiDate.string(from: end)
    }

    private var weekLabel: String {
        guard let s = DateFormatters.apiDate.date(from: weekStart),
              let e = DateFormatters.apiDate.date(from: weekEnd) else { return "" }
        return "\(DateFormatters.shortDate.string(from: s)) – \(DateFormatters.shortDate.string(from: e))"
    }

    private var groupedShifts: [(String, [Shift])] {
        var dict: [String: [Shift]] = [:]
        for s in shifts { dict[s.date, default: []].append(s) }
        return dict.keys.sorted().map { ($0, dict[$0]!) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bayouBG.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Week navigation
                    HStack {
                        Button { shiftWeek(by: -7) } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 36, height: 36)
                                .background(Color.bayouShell)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bayouBorder))
                        }
                        Spacer()
                        Text(weekLabel)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                        Button { shiftWeek(by: 7) } label: {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 36, height: 36)
                                .background(Color.bayouShell)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bayouBorder))
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.bayouBG)

                    Divider().background(Color.bayouBorder)

                    if loading {
                        Spacer()
                        ProgressView().tint(.bayouCyan)
                        Spacer()
                    } else if let err = error {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle").foregroundColor(.bayouMuted).font(.title2)
                            Text(err).font(.subheadline).foregroundColor(.bayouMuted)
                            Button("Retry") { Task { await load() } }.foregroundColor(.bayouCyan)
                        }
                        Spacer()
                    } else if shifts.isEmpty {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "calendar.badge.exclamationmark")
                                .font(.system(size: 48))
                                .foregroundColor(.bayouMuted)
                            Text("No shifts this week")
                                .font(.headline)
                                .foregroundColor(.bayouMuted)
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            VStack(spacing: 20) {
                                ForEach(groupedShifts, id: \.0) { date, dayShifts in
                                    DaySection(date: date, shifts: dayShifts)
                                }
                                Spacer(minLength: 32)
                            }
                            .padding(.horizontal)
                            .padding(.top, 16)
                        }
                    }
                }
            }
            .navigationTitle("My Schedule")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task { await load() }
        .onChange(of: weekStart) { _, _ in Task { await load() } }
    }

    private func shiftWeek(by days: Int) {
        guard let d = DateFormatters.apiDate.date(from: weekStart),
              let next = Calendar.current.date(byAdding: .day, value: days, to: d) else { return }
        weekStart = DateFormatters.apiDate.string(from: next)
    }

    private func load() async {
        loading = true; error = nil
        do { shifts = try await APIClient.shared.weekShifts(weekStart: weekStart) }
        catch { self.error = "Could not load schedule." }
        loading = false
    }
}

private struct DaySection: View {
    let date: String
    let shifts: [Shift]

    private var isToday: Bool {
        date == DateFormatters.apiDate.string(from: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                if isToday {
                    Circle().fill(Color.bayouCyan).frame(width: 6, height: 6)
                }
                Text(shifts[0].fullDate)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(isToday ? .bayouCyan : .bayouMuted)
                    .textCase(.uppercase)
                    .tracking(0.8)
            }

            ForEach(shifts) { shift in
                ShiftCard(shift: shift)
            }
        }
    }
}

private struct ShiftCard: View {
    let shift: Shift
    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2)
                .fill(shift.deptColor)
                .frame(width: 4)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(shift.timeRange)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                    DeptBadge(dept: shift.department)
                }
                if let pos = shift.position, !pos.isEmpty {
                    Label(pos, systemImage: "person.badge.key.fill")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.75))
                }
                if let loc = shift.location, !loc.isEmpty {
                    Label(loc, systemImage: "mappin.circle")
                        .font(.caption)
                        .foregroundColor(.bayouMuted)
                }
                if let notes = shift.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption2)
                        .foregroundColor(.bayouMuted)
                        .lineLimit(2)
                }
            }
            .padding(.leading, 12)
            .padding(.vertical, 12)
            .padding(.trailing, 14)
        }
        .background(Color.bayouSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.bayouBorder, lineWidth: 1))
    }
}
