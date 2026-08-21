import FirebaseCore
import Foundation

/// アプリ起動時の Firebase 初期化をまとめたヘルパー。
///
/// 開発初期はダミーの `GoogleService-Info.plist` で起動確認することを想定しているため、
/// plist が見つからない/読み込めない場合でもアプリ全体をクラッシュさせず、
/// コンソールに警告を出すだけに留める（本物の plist に差し替えた後は通常どおり configure される）。
enum FirebaseBootstrap {
    static func configureIfNeeded() {
        guard FirebaseApp.app() == nil else { return }

        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            print("⚠️ GoogleService-Info.plist が見つかりません。Firebase機能は無効化されます。")
            return
        }

        FirebaseApp.configure()
    }
}
