import SwiftUI

struct LoginView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var email    = ""
    @State private var password = ""
    @State private var loading  = false
    @FocusState private var focused: Field?

    enum Field { case email, password }

    var body: some View {
        ZStack {
            Color.bayouBG.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Color.bayouCyan.opacity(0.15))
                            .frame(width: 80, height: 80)
                        Image(systemName: "drop.fill")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundColor(.bayouCyan)
                    }
                    Text("BAYOU STAFF")
                        .font(.system(size: 26, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .tracking(4)
                    Text("Blue Bayou Waterpark")
                        .font(.subheadline)
                        .foregroundColor(.bayouMuted)
                }
                .padding(.bottom, 48)

                // Card
                VStack(spacing: 20) {
                    VStack(spacing: 14) {
                        InputField(
                            icon: "envelope",
                            placeholder: "Email address",
                            text: $email,
                            keyboard: .emailAddress,
                            submitLabel: .next
                        )
                        .focused($focused, equals: .email)
                        .onSubmit { focused = .password }

                        InputField(
                            icon: "lock",
                            placeholder: "Password",
                            text: $password,
                            isSecure: true,
                            submitLabel: .go
                        )
                        .focused($focused, equals: .password)
                        .onSubmit { Task { await submit() } }
                    }

                    if let err = auth.loginError {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.red).font(.footnote)
                            Text(err).font(.footnote).foregroundColor(.red)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button { Task { await submit() } } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 14)
                                .fill(Color.bayouCyan).frame(height: 52)
                            if loading {
                                ProgressView().tint(.black)
                            } else {
                                Text("Sign In")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.black)
                            }
                        }
                    }
                    .disabled(loading || email.isEmpty || password.isEmpty)
                    .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
                }
                .padding(24)
                .background(Color.bayouSurface)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.bayouBorder, lineWidth: 1))
                .padding(.horizontal, 24)

                Spacer()
                Spacer()
            }
        }
        .preferredColorScheme(.dark)
    }

    private func submit() async {
        focused = nil
        loading = true
        await auth.login(email: email.trimmingCharacters(in: .whitespaces),
                         password: password)
        loading = false
    }
}

private struct InputField: View {
    let icon: String
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var isSecure = false
    var submitLabel: SubmitLabel = .done

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundColor(.bayouMuted).frame(width: 20)
            if isSecure {
                SecureField(placeholder, text: $text)
                    .submitLabel(submitLabel).foregroundColor(.white).tint(.bayouCyan)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(submitLabel).foregroundColor(.white).tint(.bayouCyan)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(Color.bayouBG)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.bayouBorder, lineWidth: 1))
    }
}
