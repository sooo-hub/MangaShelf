import SwiftUI

/// アプリのルート。認証は無く、起動後すぐに本棚一覧 (`MangaShelfView`) を表示する。
struct RootView: View {
    @StateObject private var repository = MangaRepository()
    @StateObject private var userDisplayNames = UserDisplayNames()

    var body: some View {
        MangaShelfView()
            .environmentObject(repository)
            .environmentObject(userDisplayNames)
            .onAppear {
                repository.startListening()
                Task { await userDisplayNames.load() }
            }
    }
}

#Preview {
    RootView()
}
