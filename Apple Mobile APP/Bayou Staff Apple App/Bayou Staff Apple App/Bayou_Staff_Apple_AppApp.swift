import SwiftUI

@main
struct Bayou_Staff_Apple_AppApp: App {
    @State private var auth = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(auth)
        }
    }
}
