import Foundation

/// 楽天ブックスAPIの認証情報を `Resources/Secrets.plist` から読み込む。
///
/// `GoogleService-Info.plist` と同じパターンで、実ファイルは `.gitignore` によりコミット対象外。
/// テンプレートは `ios-native/RakutenSecrets.plist.sample` としてコミットされている。
/// 値が空/未設定の場合は楽天APIへのリクエストを行わず、AniListへのフォールバックのみで動作する。
enum RakutenSecrets {
    static let applicationId: String = value(forKey: "RakutenApplicationID")
    static let accessKey: String = value(forKey: "RakutenAccessKey")

    static var isConfigured: Bool {
        !applicationId.isEmpty && !accessKey.isEmpty
    }

    private static func value(forKey key: String) -> String {
        guard let path = Bundle.main.path(forResource: "Secrets", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path) as? [String: Any],
              let value = dict[key] as? String else {
            return ""
        }
        return value
    }
}
