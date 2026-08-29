import Foundation

/// 合言葉解錠に成功した際、その値を端末内にだけ保持する。
///
/// サーバー同期モードの表示名(`UserDisplayNames`)はFirestore上の
/// `settings/{合言葉}/userNames/main` に保存するため、アプリ再起動後も
/// パスを再構築できるようにこの値をローカルに残しておく。
/// アプリ本体には合言葉そのものは埋め込まれておらず、実際に解錠に
/// 成功した端末のローカルストレージにのみ書き込まれる。
enum PasscodeStore {
    private static let key = "mangaShelf.unlockedPasscode"

    static func save(_ code: String) {
        UserDefaults.standard.set(code, forKey: key)
    }

    static func load() -> String? {
        UserDefaults.standard.string(forKey: key)
    }
}
