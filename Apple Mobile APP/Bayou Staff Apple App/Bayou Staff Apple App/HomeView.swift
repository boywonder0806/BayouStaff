import SwiftUI

struct HomeView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var home: HomeData?
    @State private var loading = true
    @State private var error: String?

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        if h < 12 { return "Good morning" }
        if h < 17 { return "Good afternoon" }
        return "Good evening"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bayouBG.ignoresSafeArea()

                if loading {
                    ProgressView().tint(.bayouCyan)
                } else if let err = error {
                    VStack(spacing: 12) {
                        Image(systemName: "wifi.slash").font(.largeTitle).foregroundColor(.bayouMuted)
                        Text(err).font(.subheadline).foregroundColor(.bayouMuted).multilineTextAlignment(.center)
                        Button("Retry") { Task { await load() } }.foregroundColor(.bayouCyan)
                    }.padding()
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 24) {

                            // Header
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(greeting),")
                                    .font(.subheadline).foregroundColor(.bayouMuted)
                                Text(auth.user?.firstName ?? "")
                                    .font(.system(size: 32, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                                Text(Date(), style: .date)
                                    .font(.footnote).foregroundColor(.bayouMuted)
                            }
                            .padding(.horizontal).padding(.top, 8)

                            // Next shift
                            if let shift = home?.nextShift {
                                NextShiftCard(shift: shift).padding(.horizontal)
                            } else {
                                SurfaceCard {
                                    HStack(spacing: 12) {
                                        Image(systemName: "calendar.badge.checkmark")
                                            .foregroundColor(.bayouMuted).font(.title3)
                                        Text("No upcoming shifts scheduled")
                                            .font(.subheadline).foregroundColor(.bayouMuted)
                                    }.padding(16)
                                }.padding(.horizontal)
                            }

                            // Upcoming shifts
                            if let upcoming = home?.upcomingShifts, !upcoming.isEmpty {
                                SectionHeader("Upcoming Shifts")
                                VStack(spacing: 8) {
                                    ForEach(upcoming) { ShiftRow(shift: $0) }
                                }.padding(.horizontal)
                            }

                            // Announcements
                            if let anns = home?.announcements, !anns.isEmpty {
                                SectionHeader("Announcements")
                                VStack(spacing: 8) {
                                    ForEach(anns) { AnnouncementRow(ann: $0) }
                                }.padding(.horizontal)
                            }

                            Spacer(minLength: 32)
                        }.padding(.top, 4)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 6) {
                        Image(systemName: "drop.fill").foregroundColor(.bayouCyan).font(.footnote)
                        Text("Bayou Staff")
                            .font(.system(size: 14, weight: .bold)).foregroundColor(.white).tracking(1)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { auth.logout() } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.bayouMuted).font(.footnote)
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true; error = nil
        do { home = try await APIClient.shared.homeData() }
        catch { self.error = "Could not load home data." }
        loading = false
    }
}

// MARK: - Next shift card
private struct NextShiftCard: View {
    let shift: Shift
    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Next Shift", systemImage: "clock.fill")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.bayouCyan)
                    Spacer()
                    DeptBadge(dept: shift.department)
                }
                Text(shift.fullDate)
                    .font(.system(size: 20, weight: .bold)).foregroundColor(.white)
                HStack(spacing: 16) {
                    Label(shift.timeRange, systemImage: "clock")
                        .font(.subheadline).foregroundColor(.white.opacity(0.8))
                    if let pos = shift.position, !pos.isEmpty {
                        Label(pos, systemImage: "person.fill")
                            .font(.subheadline).foregroundColor(.white.opacity(0.8))
                    }
                }
            }
            .padding(16)
            .background(
                LinearGradient(
                    colors: [shift.deptColor.opacity(0.25), Color.bayouSurface],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            )
        }
    }
}

private struct ShiftRow: View {
    let shift: Shift
    var body: some View {
        SurfaceCard {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 3).fill(shift.deptColor).frame(width: 3, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(shift.fullDate).font(.subheadline).fontWeight(.semibold).foregroundColor(.white)
                    Text(shift.timeRange).font(.caption).foregroundColor(.bayouMuted)
                }
                Spacer()
                if let pos = shift.position, !pos.isEmpty {
                    Text(pos).font(.caption).fontWeight(.medium)
                        .foregroundColor(shift.deptColor)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(shift.deptColor.opacity(0.12)).clipShape(Capsule())
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
        }
    }
}

private struct AnnouncementRow: View {
    let ann: Announcement
    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(ann.title).font(.subheadline).fontWeight(.bold).foregroundColor(.white)
                    Spacer()
                    if ann.priority == "urgent" {
                        Text("URGENT").font(.system(size: 9, weight: .black))
                            .foregroundColor(.red).padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.red.opacity(0.15)).clipShape(Capsule())
                    }
                }
                Text(ann.body).font(.caption).foregroundColor(.bayouMuted).lineLimit(3)
                if let author = ann.author {
                    Text("— \(author)").font(.caption2).foregroundColor(.bayouMuted.opacity(0.7))
                }
            }.padding(14)
        }
    }
}

// MARK: - Shared components (used across views)
struct SurfaceCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content
            .background(Color.bayouSurface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.bayouBorder, lineWidth: 1))
    }
}

struct DeptBadge: View {
    let dept: String
    var body: some View {
        Text(dept).font(.system(size: 10, weight: .bold))
            .foregroundColor(DeptTheme.color(for: dept))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(DeptTheme.color(for: dept).opacity(0.12)).clipShape(Capsule())
    }
}

struct SectionHeader: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(.bayouMuted).tracking(1.5).padding(.horizontal)
    }
}
