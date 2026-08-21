import SwiftUI

@main
struct MangaShelfApp: App {
    init() {
        FirebaseBootstrap.configureIfNeeded()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
