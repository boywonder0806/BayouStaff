import SwiftUI

struct ShiftBoardView: View {
    @State private var shifts: [OpenShift] = []
    @State private var loading = true
    @State private var error: String?
    @State private var claiming: Int? = nil
    @State private var claimedIds: Set<Int> = []
    @State private var toast: String?

    private var grouped: [(String, [OpenShift])] {
        var dict: [String: [OpenShift]] = [:]
        for s in shifts where !claimedIds.contains(s.id) {
            dict[s.date, default: []].append(s)
        }
        return dict.keys.sorted().map { ($0, dict[$0]!) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bayouBG.ignoresSafeArea()

                if loading {
                    ProgressView().tint(.bayouCyan)
                } else if let err = error {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle").foregroundColor(.bayouMuted).font(.title2)
                        Text(err).font(.subheadline).foregroundColor(.bayouMuted)
                        Button("Retry") { Task { await load() } }.foregroundColor(.bayouCyan)
                    }
                } else if grouped.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 52))
                            .foregroundColor(.bayouCyan.opacity(0.4))
                        Text("No open shifts")
                            .font(.headline).foregroundColor(.bayouMuted)
                        Text("Check back later for available shifts.")
                            .font(.subheadline).foregroundColor(.bayouMuted.opacity(0.7))
                            .multilineTextAlignment(.center)
                    }.padding()
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            ForEach(grouped, id: \.0) { date, dayShifts in
                                VStack(alignment: .leading, spacing: 8) {
                                    if let d = DateFormatters.apiDate.date(from: date) {
                                        Text(DateFormatters.fullDate.string(from: d).uppercased())
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundColor(.bayouMuted)
                                            .tracking(1)
                                            .padding(.horizontal)
                                    }
                                    ForEach(dayShifts) { shift in
                                        OpenShiftCard(
                                            shift: shift,
                                            claiming: claiming == shift.id,
                                            onClaim: { Task { await claim(shift) } }
                                        )
                                        .padding(.horizontal)
                                    }
                                }
                            }
                            Spacer(minLength: 32)
                        }
                        .padding(.top, 16)
                    }
                    .refreshable { await load() }
                }

                // Toast
                if let toast {
                    VStack {
                        Spacer()
                        Text(toast)
                            .font(.subheadline).fontWeight(.semibold)
                            .foregroundColor(.black)
                            .padding(.horizontal, 20).padding(.vertical, 12)
                            .background(Color.bayouCyan)
                            .clipShape(Capsule())
                            .shadow(radius: 8)
                            .padding(.bottom, 100)
                    }
                    .animation(.spring, value: toast)
                }
            }
            .navigationTitle("Open Shifts")
            .navigationBarTitleDisplayMode(.large)
        }
        .task { await load() }
    }

    private func load() async {
        loading = true; error = nil
        do { shifts = try await APIClient.shared.openShifts() }
        catch { self.error = "Could not load open shifts." }
        loading = false
    }

    private func claim(_ shift: OpenShift) async {
        claiming = shift.id
        do {
            try await APIClient.shared.claimShift(id: shift.id)
            claimedIds.insert(shift.id)
            showToast("Shift claimed!")
        } catch let err as ServerError {
            showToast(err.error)
        } catch {
            showToast("Could not claim shift.")
        }
        claiming = nil
    }

    private func showToast(_ msg: String) {
        toast = msg
        Task {
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            toast = nil
        }
    }
}

private struct OpenShiftCard: View {
    let shift: OpenShift
    let claiming: Bool
    let onClaim: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2)
                .fill(shift.deptColor)
                .frame(width: 4)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(shift.timeRange)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                        HStack(spacing: 6) {
                            DeptBadge(dept: shift.department)
                            if let pos = shift.position, !pos.isEmpty {
                                Text(pos)
                                    .font(.caption)
                                    .foregroundColor(.bayouMuted)
                            }
                        }
                    }
                    Spacer()
                    Button(action: onClaim) {
                        if claiming {
                            ProgressView().tint(.black).scaleEffect(0.8)
                                .frame(width: 72, height: 32)
                                .background(Color.bayouCyan)
                                .clipShape(Capsule())
                        } else {
                            Text("Claim")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.black)
                                .frame(width: 72, height: 32)
                                .background(Color.bayouCyan)
                                .clipShape(Capsule())
                        }
                    }
                    .disabled(claiming)
                }
                if let notes = shift.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.bayouMuted)
                        .lineLimit(2)
                }
            }
            .padding(.leading, 12)
            .padding(.vertical, 14)
            .padding(.trailing, 14)
        }
        .background(Color.bayouSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.bayouBorder, lineWidth: 1))
    }
}
