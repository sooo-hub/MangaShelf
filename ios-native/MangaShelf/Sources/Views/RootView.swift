import SwiftUI

/// ログイン状態に応じてログイン画面 / 本棚一覧画面を出し分けるルート。
struct RootView: View {
    @StateObject private var authService = AuthService()

    var body: some View {
        Group {
            if authService.isSignedIn {
                ShelfListView()
                    .environmentObject(authService)
            } else {
                LoginView()
                    .environmentObject(authService)
            }
        }
    }
}

#Preview {
    RootView()
}
