import SwiftUI

@Observable
final class AuthViewModel {
    var user: User?
    var isLoading = true
    var loginError: String?

    var isLoggedIn: Bool { user != nil }

    init() {
        Task { await checkSession() }
    }

    private func checkSession() async {
        guard APIClient.shared.token != nil else { isLoading = false; return }
        do {
            user = try await APIClient.shared.me()
        } catch {
            APIClient.shared.logout()
        }
        isLoading = false
    }

    func login(email: String, password: String) async {
        loginError = nil
        do {
            user = try await APIClient.shared.login(email: email, password: password)
        } catch let err as ServerError {
            loginError = err.error
        } catch {
            loginError = "Could not connect to server."
        }
    }

    func logout() {
        APIClient.shared.logout()
        user = nil
    }
}
