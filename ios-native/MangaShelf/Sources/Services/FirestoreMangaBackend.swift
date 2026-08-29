import Combine
import FirebaseCore
import FirebaseFirestore
import Foundation

/// `shelves/{合言葉}/mangaShelf` への CRUD + リアルタイム同期(addSnapshotListener)を担当する。
/// 隠しオプションから切り替えられる「サーバー同期モード」の実体。
/// 合言葉をパスに含めることで、Firestoreのセキュリティルール側だけで
/// 読み書きの両方を保護する(合言葉を知らない第三者は一切アクセスできない)。
@MainActor
final class FirestoreMangaBackend: MangaBackend, ObservableObject {
    static let collectionName = "mangaShelf"

    @Published private(set) var mangas: [Manga] = []
    @Published var errorMessage: String?
    @Published private(set) var isLoading = true

    var mangasPublisher: AnyPublisher<[Manga], Never> { $mangas.eraseToAnyPublisher() }
    var errorMessagePublisher: AnyPublisher<String?, Never> { $errorMessage.eraseToAnyPublisher() }
    var isLoadingPublisher: AnyPublisher<Bool, Never> { $isLoading.eraseToAnyPublisher() }

    private lazy var db: Firestore? = FirebaseApp.app() != nil ? Firestore.firestore() : nil
    private var listener: ListenerRegistration?

    deinit {
        listener?.remove()
    }

    private var mangaCollection: CollectionReference? {
        guard let db, let token = PasscodeStore.load() else { return nil }
        return db.collection("shelves").document(token).collection(Self.collectionName)
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

    private static func generateId() -> String {
        UUID().uuidString
    }

    private static func nowEpochMillis() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    func addManga(
        title: String,
        author: String,
        publisher: String,
        latestVolume: Int,
        genre: String,
        status: String,
        type: MangaType,
        wishUsers: [UserName],
        seriesName: String?,
        parts: [MangaPart]?
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
