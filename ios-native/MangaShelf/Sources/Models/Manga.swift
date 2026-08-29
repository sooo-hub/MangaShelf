import FirebaseFirestore
import Foundation

/// 固定ユーザー2名。保存用の識別子は実名を含まない(`userA`/`userB`)。
/// 画面に出す表示名は `UserDisplayNames` が管理し、実名はFirestoreの
/// 合言葉で保護された領域にのみ保存する(アプリ本体には埋め込まない)。
enum UserName: String, CaseIterable, Codable, Hashable, Identifiable {
    case userA
    case userB

    var id: String { rawValue }

    static let all: [UserName] = Array(UserName.allCases)
}

/// ジャンル。Web版は固定候補 + 空文字列の union 型だが、Firestore上には任意の文字列が
/// 入り得るため Swift 側では String をそのまま保持し、選択肢一覧のみ static に持つ。
enum GenreOption {
    static let all: [String] = [
        "少年", "少女", "青年", "女性", "SF", "ファンタジー",
        "ラブコメ", "ホラー", "スポーツ", "ミステリー", "歴史", "日常", "その他",
    ]
}

/// 連載状況。Web版は "連載中" | "完結" | "" の union 型。
enum MangaStatusOption {
    static let releasing = "連載中"
    static let finished = "完結"
    static let all: [String] = [releasing, finished]
}

enum MangaType: String, Codable, Hashable {
    case own
    case wish
}

/// 部・章の情報。Web版と同じく from/to は文字列のまま保持する（数値変換はUI側で行う）。
struct MangaPart: Identifiable, Hashable, Codable {
    var id: Int
    var name: String
    var from: String
    var to: String
}

/// 漫画1タイトル分のデータ。Firestore の `mangaShelf` フラットコレクションに対応する。
struct Manga: Identifiable, Hashable, Codable {
    var id: String
    var title: String
    var author: String
    var publisher: String
    var latestVolume: Int
    var genre: String
    var status: String
    var type: MangaType
    var ownedVolumes: [Int]
    var wishUsers: [UserName]
    var seriesName: String?
    var parts: [MangaPart]?
    /// epoch ミリ秒 (Web版の `Date.now()` と同じ単位)
    var createdAt: Int?
    /// epoch ミリ秒 (Web版の `Date.now()` と同じ単位)
    var updatedAt: Int?

    init(
        id: String,
        title: String,
        author: String = "",
        publisher: String = "",
        latestVolume: Int = 0,
        genre: String = "",
        status: String = "",
        type: MangaType = .own,
        ownedVolumes: [Int] = [],
        wishUsers: [UserName] = [],
        seriesName: String? = nil,
        parts: [MangaPart]? = nil,
        createdAt: Int? = nil,
        updatedAt: Int? = nil
    ) {
        self.id = id
        self.title = title
        self.author = author
        self.publisher = publisher
        self.latestVolume = latestVolume
        self.genre = genre
        self.status = status
        self.type = type
        self.ownedVolumes = ownedVolumes
        self.wishUsers = wishUsers
        self.seriesName = seriesName
        self.parts = parts
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Firestore ドキュメントから復元する。ドキュメントIDを常に `id` として採用する
    /// (Web版の `{...d.data(), id: d.id}` と同じ挙動。ドキュメント内の `id` フィールドは無視する)。
    init?(document: DocumentSnapshot) {
        guard let data = document.data(),
              let title = data["title"] as? String else {
            return nil
        }
        let author = data["author"] as? String ?? ""
        let publisher = data["publisher"] as? String ?? ""
        let latestVolume = (data["latestVolume"] as? Int) ?? Int(data["latestVolume"] as? Double ?? 0)
        let genre = data["genre"] as? String ?? ""
        let status = data["status"] as? String ?? ""
        let typeRaw = data["type"] as? String ?? MangaType.own.rawValue
        let type = MangaType(rawValue: typeRaw) ?? .own
        let ownedVolumes = (data["ownedVolumes"] as? [Int]) ?? (data["ownedVolumes"] as? [Any])?.compactMap { toInt($0) } ?? []
        let wishUsers = ((data["wishUsers"] as? [String]) ?? []).compactMap { UserName(rawValue: $0) }
        let seriesName = data["seriesName"] as? String
        let parts: [MangaPart]? = (data["parts"] as? [[String: Any]])?.compactMap { dict in
            guard let name = dict["name"] as? String else { return nil }
            let idValue = toInt(dict["id"]) ?? 0
            let from = dict["from"] as? String ?? ""
            let to = dict["to"] as? String ?? ""
            return MangaPart(id: idValue, name: name, from: from, to: to)
        }
        let createdAt = toInt(data["createdAt"])
        let updatedAt = toInt(data["updatedAt"])

        self.init(
            id: document.documentID,
            title: title,
            author: author,
            publisher: publisher,
            latestVolume: latestVolume,
            genre: genre,
            status: status,
            type: type,
            ownedVolumes: ownedVolumes,
            wishUsers: wishUsers,
            seriesName: (seriesName?.isEmpty ?? true) ? nil : seriesName,
            parts: (parts?.isEmpty ?? true) ? nil : parts,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    /// Firestore へ書き込むための辞書表現（`id` フィールドもWeb版同様に含める）。
    var asDictionary: [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "title": title,
            "author": author,
            "publisher": publisher,
            "latestVolume": latestVolume,
            "genre": genre,
            "status": status,
            "type": type.rawValue,
            "ownedVolumes": ownedVolumes,
            "wishUsers": wishUsers.map { $0.rawValue },
        ]
        dict["seriesName"] = seriesName ?? ""
        dict["parts"] = (parts ?? []).map { part -> [String: Any] in
            ["id": part.id, "name": part.name, "from": part.from, "to": part.to]
        }
        if let createdAt { dict["createdAt"] = createdAt }
        if let updatedAt { dict["updatedAt"] = updatedAt }
        return dict
    }
}

private func toInt(_ value: Any?) -> Int? {
    if let intValue = value as? Int { return intValue }
    if let doubleValue = value as? Double { return Int(doubleValue) }
    if let numberValue = value as? NSNumber { return numberValue.intValue }
    return nil
}

/// 検索結果の一時データ。Firestoreには保存しない。
struct MangaCandidate: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var author: String
    var publisher: String
    var latestVolume: Int
    var genre: String
    var status: String
}

/// 最新刊確認APIの戻り値。
struct VolumeInfo: Hashable {
    var latestVolume: Int
    var status: String
}
