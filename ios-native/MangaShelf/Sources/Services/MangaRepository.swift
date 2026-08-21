import FirebaseCore
import FirebaseFirestore
import Foundation

/// 特定の本棚配下 `shelves/{shelfId}/mangas` サブコレクションへの
/// CRUD + リアルタイム同期(addSnapshotListener)を担当する。
@MainActor
final class MangaRepository: ObservableObject {
    @Published private(set) var mangas: [Manga] = []
    @Published var errorMessage: String?

    private let shelfID: String
    private lazy var db: Firestore? = FirebaseApp.app() != nil ? Firestore.firestore() : nil
    private var listener: ListenerRegistration?

    init(shelfID: String) {
        self.shelfID = shelfID
    }

    deinit {
        listener?.remove()
    }

    private var mangaCollection: CollectionReference? {
        db?.collection("shelves").document(shelfID).collection("mangas")
    }

    func startListening() {
        guard let mangaCollection else { return }
        stopListening()
        listener = mangaCollection
            .order(by: "updatedAt", descending: true)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    self.errorMessage = error.localizedDescription
                    return
                }
                self.mangas = snapshot?.documents.compactMap { Manga(document: $0) } ?? []
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }

    func addManga(title: String, ownedVolumes: [Int], totalVolumes: Int?, memo: String) {
        guard let mangaCollection else { return }
        var data: [String: Any] = [
            "title": title,
            "ownedVolumes": ownedVolumes,
            "memo": memo,
            "updatedAt": Timestamp(date: Date())
        ]
        if let totalVolumes {
            data["totalVolumes"] = totalVolumes
        }
        mangaCollection.addDocument(data: data) { [weak self] error in
            guard let error else { return }
            Task { @MainActor in
                self?.errorMessage = error.localizedDescription
            }
        }
    }

    func updateManga(_ manga: Manga) {
        guard let mangaCollection else { return }
        var data: [String: Any] = [
            "title": manga.title,
            "ownedVolumes": manga.ownedVolumes,
            "memo": manga.memo,
            "updatedAt": Timestamp(date: Date())
        ]
        data["totalVolumes"] = manga.totalVolumes ?? FieldValue.delete()
        mangaCollection.document(manga.id).setData(data, merge: true) { [weak self] error in
            guard let error else { return }
            Task { @MainActor in
                self?.errorMessage = error.localizedDescription
            }
        }
    }

    func deleteManga(_ manga: Manga) {
        guard let mangaCollection else { return }
        mangaCollection.document(manga.id).delete { [weak self] error in
            guard let error else { return }
            Task { @MainActor in
                self?.errorMessage = error.localizedDescription
            }
        }
    }
}
