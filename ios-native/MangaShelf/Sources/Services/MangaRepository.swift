import FirebaseCore
import FirebaseFirestore
import Foundation

/// フラットな `mangaShelf` コレクションへの CRUD + リアルタイム同期(addSnapshotListener)を担当する。
/// Web版 `useMangaStore.ts` と同じデータ構造・書き込みロジックに合わせている。
@MainActor
final class MangaRepository: ObservableObject {
    static let collectionName = "mangaShelf"

    @Published private(set) var mangas: [Manga] = []
    @Published var errorMessage: String?
    @Published private(set) var isLoading = true

    private lazy var db: Firestore? = FirebaseApp.app() != nil ? Firestore.firestore() : nil
    private var listener: ListenerRegistration?

    deinit {
        listener?.remove()
    }

    private var mangaCollection: CollectionReference? {
        db?.collection(Self.collectionName)
    }

    func startListening() {
        guard let mangaCollection else {
            isLoading = false
            return
        }
        stopListening()
        listener = mangaCollection
            .order(by: "createdAt", descending: false)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    self.errorMessage = "データの読み込みに失敗しました: \(error.localizedDescription)"
                    self.isLoading = false
                    return
                }
                self.mangas = snapshot?.documents.compactMap { Manga(document: $0) } ?? []
                self.isLoading = false
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }

    /// Web版 `Date.now().toString(36) + Math.random().toString(36).slice(2)` 相当の
    /// ユニークなランダムID生成。
    static func generateId() -> String {
        UUID().uuidString
    }

    static func nowEpochMillis() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    /// 新規追加。`ownedVolumes` は常に空配列、`createdAt`/`updatedAt` は現在時刻で初期化する。
    func addManga(
        title: String,
        author: String,
        publisher: String,
        latestVolume: Int,
        genre: String,
        status: String,
        type: MangaType,
        wishUsers: [UserName],
        seriesName: String? = nil,
        parts: [MangaPart]? = nil
    ) {
        guard let mangaCollection else { return }
        let id = Self.generateId()
        let now = Self.nowEpochMillis()
        let manga = Manga(
            id: id,
            title: title,
            author: author,
            publisher: publisher,
            latestVolume: latestVolume,
            genre: genre,
            status: status,
            type: type,
            ownedVolumes: [],
            wishUsers: type == .wish ? wishUsers : [],
            seriesName: seriesName,
            parts: parts,
            createdAt: now,
            updatedAt: now
        )
        mangaCollection.document(id).setData(manga.asDictionary) { [weak self] error in
            guard let error else { return }
            Task { @MainActor in self?.errorMessage = error.localizedDescription }
        }
    }

    /// 詳細画面からの保存。ドキュメント全体を上書きする(Web版の `setDoc` と同じ)。
    func saveManga(_ manga: Manga) {
        guard let mangaCollection else { return }
        var updated = manga
        updated.updatedAt = Self.nowEpochMillis()
        mangaCollection.document(updated.id).setData(updated.asDictionary) { [weak self] error in
            guard let error else { return }
            Task { @MainActor in self?.errorMessage = error.localizedDescription }
        }
    }

    func deleteManga(_ id: String) {
        guard let mangaCollection else { return }
        mangaCollection.document(id).delete { [weak self] error in
            guard let error else { return }
            Task { @MainActor in self?.errorMessage = error.localizedDescription }
        }
    }

    /// 一括更新用。最新巻数・連載状況のみを merge 更新する。
    func updateMangaVolume(id: String, latestVolume: Int, status: String) {
        guard let mangaCollection else { return }
        let data: [String: Any] = [
            "latestVolume": latestVolume,
            "status": status,
            "updatedAt": Self.nowEpochMillis(),
        ]
        mangaCollection.document(id).setData(data, merge: true) { [weak self] error in
            guard let error else { return }
            Task { @MainActor in self?.errorMessage = error.localizedDescription }
        }
    }
}
