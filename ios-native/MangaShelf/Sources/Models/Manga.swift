import FirebaseFirestore
import Foundation

/// 漫画タイトル。Firestore の `shelves/{shelfId}/mangas` サブコレクションに対応する。
/// 巻数の所有状況は「所有している巻番号の配列」というシンプルな形で持ち、
/// 既刊数などの詳細な管理は将来の拡張に委ねる。
struct Manga: Identifiable, Hashable {
    let id: String
    var title: String
    var ownedVolumes: [Int]
    /// 既知の総巻数（不明な場合は nil）
    var totalVolumes: Int?
    var memo: String
    var updatedAt: Date

    init(
        id: String,
        title: String,
        ownedVolumes: [Int] = [],
        totalVolumes: Int? = nil,
        memo: String = "",
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.ownedVolumes = ownedVolumes
        self.totalVolumes = totalVolumes
        self.memo = memo
        self.updatedAt = updatedAt
    }

    init?(document: DocumentSnapshot) {
        guard let data = document.data(),
              let title = data["title"] as? String else {
            return nil
        }
        let ownedVolumes = data["ownedVolumes"] as? [Int] ?? []
        let totalVolumes = data["totalVolumes"] as? Int
        let memo = data["memo"] as? String ?? ""
        let timestamp = data["updatedAt"] as? Timestamp
        self.init(
            id: document.documentID,
            title: title,
            ownedVolumes: ownedVolumes,
            totalVolumes: totalVolumes,
            memo: memo,
            updatedAt: timestamp?.dateValue() ?? Date()
        )
    }
}
