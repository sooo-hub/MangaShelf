import FirebaseAuth
import FirebaseCore
import Foundation

/// メール/パスワード認証を扱う。
///
/// 2端末で同じデータを共有する要件があるため、端末ごとにUIDが変わる匿名認証ではなく
/// メール/パスワード認証を採用している（同じアカウントでログインすれば同じUIDになる）。
@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var currentUser: User?
    @Published var errorMessage: String?

    private var authStateHandle: AuthStateDidChangeListenerHandle?

    init() {
        // FirebaseApp.configure() が未実行（ダミーplist等）の場合でも安全に動作させる。
        guard FirebaseApp.app() != nil else { return }
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.currentUser = user
        }
    }

    deinit {
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    var isSignedIn: Bool { currentUser != nil }

    func signIn(email: String, password: String) async {
        errorMessage = nil
        do {
            try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async {
        errorMessage = nil
        do {
            try await Auth.auth().createUser(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
            currentUser = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
