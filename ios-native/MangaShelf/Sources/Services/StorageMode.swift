import Foundation

/// データの保存先。既定は端末内保存(`local`)で、隠しジェスチャーから `server` に切り替えられる。
enum StorageMode: String {
    case local
    case server
}

enum StorageModeStore {
    private static let key = "mangaShelf.storageMode"

    static func load() -> StorageMode {
        StorageMode(rawValue: UserDefaults.standard.string(forKey: key) ?? "") ?? .local
    }

    static func save(_ mode: StorageMode) {
        UserDefaults.standard.set(mode.rawValue, forKey: key)
    }
}
