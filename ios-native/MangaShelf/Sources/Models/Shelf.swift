import FirebaseFirestore
import Foundation

/// 本棚。Firestore の `shelves` コレクションに対応する。
/// 今後の機能拡張（並び替え、共有メンバー管理など）を見据え、
/// 最小限のフィールドのみを持つシンプルな構造にしている。
struct Shelf: Identifiable, Hashable {
    let id: String
    var name: String
    var createdAt: Date

    init(id: String, name: String, createdAt: Date = Date()) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }

    init?(document: DocumentSnapshot) {
        guard let data = document.data(),
              let name = data["name"] as? String else {
            return nil
        }
        let timestamp = data["createdAt"] as? Timestamp
        self.init(id: document.documentID, name: name, createdAt: timestamp?.dateValue() ?? Date())
    }
}
