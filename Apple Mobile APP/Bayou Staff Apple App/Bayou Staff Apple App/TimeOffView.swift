import SwiftUI

struct TimeOffView: View {
    @State private var requests: [TimeOffRequest] = []
    @State private var loading = true
    @State private var error: String?
    @State private var showForm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bayouBG.ignoresSafeArea()

                if loading {
                    ProgressView().tint(.bayouCyan)
                } else {
                    ScrollView {
                        VStack(spacing: 16) {

                            // Stats
                            HStack(spacing: 12) {
                                StatPill(
                                    label: "Pending",
                                    value: "\(requests.filter { $0.status == "pending" }.count)",
                                    color: Color(hex: "#F59E0B")
                                )
                                StatPill(
                                    label: "Approved",
                                    value: "\(requests.filter { $0.status == "approved" }.count)",
                                    color: .green
                                )
                                StatPill(
                                    label: "Total",
                                    value: "\(requests.count)",
                                    color: .bayouMuted
                                )
                            }
                            .padding(.horizontal)

                            if let err = error {
                                Text(err).font(.caption).foregroundColor(.red).padding(.horizontal)
                            }

                            if requests.isEmpty {
                                VStack(spacing: 12) {
                                    Image(systemName: "calendar.badge.clock")
                                        .font(.system(size: 48))
                                        .foregroundColor(.bayouMuted)
                                    Text("No time off requests")
                                        .font(.headline).foregroundColor(.bayouMuted)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 48)
                            } else {
                                VStack(spacing: 8) {
                                    ForEach(requests) { req in
                                        TimeOffRow(req: req, onCancel: {
                                            Task { await cancel(req) }
                                        })
                                    }
                                }
                                .padding(.horizontal)
                            }

                            Spacer(minLength: 32)
                        }
                        .padding(.top, 16)
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Time Off")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showForm = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.bayouCyan)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showForm) {
                TimeOffFormSheet { startDate, endDate, reason in
                    await submit(startDate: startDate, endDate: endDate, reason: reason)
                    showForm = false
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true; error = nil
        do { requests = try await APIClient.shared.timeOffRequests() }
        catch { self.error = "Could not load requests." }
        loading = false
    }

    private func submit(startDate: String, endDate: String, reason: String) async {
        do {
            let req = try await APIClient.shared.submitTimeOff(startDate: startDate, endDate: endDate, reason: reason)
            requests.insert(req, at: 0)
        } catch let err as ServerError {
            error = err.error
        } catch {
            self.error = "Could not submit request."
        }
    }

    private func cancel(_ req: TimeOffRequest) async {
        do {
            try await APIClient.shared.cancelTimeOff(id: req.id)
            requests.removeAll { $0.id == req.id }
        } catch {
            self.error = "Could not cancel request."
        }
    }
}

// MARK: - Row
private struct TimeOffRow: View {
    let req: TimeOffRequest
    let onCancel: () -> Void

    var body: some View {
        SurfaceCard {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(req.statusColor)
                    .frame(width: 4, height: 50)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(req.dateRange)
                            .font(.subheadline).fontWeight(.semibold)
                            .foregroundColor(.white)
                        Spacer()
                        StatusBadge(label: req.statusLabel, color: req.statusColor)
                    }
                    if let reason = req.reason, !reason.isEmpty {
                        Text(reason)
                            .font(.caption)
                            .foregroundColor(.bayouMuted)
                            .lineLimit(2)
                    }
                    if let notes = req.reviewNotes, !notes.isEmpty {
                        Text("Note: \(notes)")
                            .font(.caption)
                            .foregroundColor(.bayouMuted.opacity(0.8))
                            .italic()
                    }
                }
                .padding(.vertical, 12)
                .padding(.trailing, 8)

                if req.status == "pending" {
                    Button(action: onCancel) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.bayouMuted)
                            .font(.title3)
                    }
                    .padding(.trailing, 12)
                }
            }
        }
    }
}

// MARK: - Form sheet
private struct TimeOffFormSheet: View {
    let onSubmit: (String, String, String) async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var startDate = Date()
    @State private var endDate   = Date()
    @State private var reason    = ""
    @State private var submitting = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bayouBG.ignoresSafeArea()
                VStack(spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Start Date", systemImage: "calendar")
                            .font(.caption).fontWeight(.bold)
                            .foregroundColor(.bayouMuted).textCase(.uppercase).tracking(0.8)
                        DatePicker("", selection: $startDate, displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .tint(.bayouCyan)
                            .onChange(of: startDate) { _, v in if endDate < v { endDate = v } }

                        Label("End Date", systemImage: "calendar")
                            .font(.caption).fontWeight(.bold)
                            .foregroundColor(.bayouMuted).textCase(.uppercase).tracking(0.8)
                            .padding(.top, 4)
                        DatePicker("", selection: $endDate, in: startDate..., displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .tint(.bayouCyan)

                        Label("Reason (optional)", systemImage: "text.alignleft")
                            .font(.caption).fontWeight(.bold)
                            .foregroundColor(.bayouMuted).textCase(.uppercase).tracking(0.8)
                            .padding(.top, 4)
                        TextEditor(text: $reason)
                            .frame(height: 80)
                            .padding(10)
                            .background(Color.bayouSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.bayouBorder))
                            .foregroundColor(.white)
                            .tint(.bayouCyan)
                    }

                    if let err = error {
                        Text(err).font(.caption).foregroundColor(.red)
                    }

                    Button {
                        Task {
                            submitting = true
                            error = nil
                            let fmt = DateFormatters.apiDate
                            await onSubmit(fmt.string(from: startDate), fmt.string(from: endDate), reason)
                            submitting = false
                        }
                    } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 14).fill(Color.bayouCyan).frame(height: 52)
                            if submitting {
                                ProgressView().tint(.black)
                            } else {
                                Text("Submit Request")
                                    .font(.system(size: 16, weight: .bold)).foregroundColor(.black)
                            }
                        }
                    }
                    .disabled(submitting)

                    Spacer()
                }
                .padding(24)
            }
            .navigationTitle("Request Time Off")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundColor(.bayouMuted)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Helpers
private struct StatPill: View {
    let label: String
    let value: String
    let color: Color
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.title3).fontWeight(.black).foregroundColor(color)
            Text(label).font(.caption2).foregroundColor(.bayouMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.2)))
    }
}

private struct StatusBadge: View {
    let label: String
    let color: Color
    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(color)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}
