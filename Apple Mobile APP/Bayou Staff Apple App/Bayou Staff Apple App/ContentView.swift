import SwiftUI

struct ContentView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        Group {
            if auth.isLoading {
                ZStack {
                    Color.bayouBG.ignoresSafeArea()
                    VStack(spacing: 16) {
                        Image(systemName: "drop.fill")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.bayouCyan)
                        Text("BAYOU STAFF")
                            .font(.system(size: 20, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                            .tracking(4)
                        ProgressView().tint(.bayouCyan).padding(.top, 8)
                    }
                }
            } else if auth.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .preferredColorScheme(.dark)
    }
}
