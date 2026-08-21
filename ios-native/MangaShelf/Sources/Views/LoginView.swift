import SwiftUI

/// メール/パスワードでのログイン・新規登録画面。
struct LoginView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUpMode = false
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("漫画棚")
                    .font(.largeTitle.bold())

                TextField("メールアドレス", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                SecureField("パスワード", text: $password)
                    .textContentType(isSignUpMode ? .newPassword : .password)
                    .textFieldStyle(.roundedBorder)

                if let errorMessage = authService.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await submit() }
                } label: {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text(isSignUpMode ? "新規登録" : "ログイン")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(email.isEmpty || password.isEmpty || isLoading)

                Button(isSignUpMode ? "ログインはこちら" : "アカウントを新規作成") {
                    isSignUpMode.toggle()
                }
                .font(.footnote)
            }
            .padding()
            .navigationTitle("ログイン")
        }
    }

    private func submit() async {
        isLoading = true
        defer { isLoading = false }
        if isSignUpMode {
            await authService.signUp(email: email, password: password)
        } else {
            await authService.signIn(email: email, password: password)
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService())
}
