import SwiftUI

struct MainTabView: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)

            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }
                .tag(1)

            ShiftBoardView()
                .tabItem { Label("Open Shifts", systemImage: "briefcase.fill") }
                .tag(2)

            TimeOffView()
                .tabItem { Label("Time Off", systemImage: "calendar.badge.clock") }
                .tag(3)

            TimecardsView()
                .tabItem { Label("Clock", systemImage: "clock.fill") }
                .tag(4)
        }
        .tint(.bayouCyan)
        .preferredColorScheme(.dark)
    }
}
