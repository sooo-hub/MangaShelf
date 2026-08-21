import FirebaseCore
import FirebaseFirestore
import Foundation

/// `shelves` コレクションへのCRUD + リアルタイム同期(addSnapshotListener)を担当する。
@MainActor
final class ShelfRepository: ObservableObject {
    @Published private(set) var shelves: [Shelf] = []
    @Published var errorMessage: String?

    private lazy var db: Firestore? = FirebaseApp.app() != nil ? Firestore.firestore() : nil
    private var listener: ListenerRegistration?

    deinit {
        listener?.remove()
    }

    func startListening() {
        guard let db else { return }
        stopListening()
        listener = db.collection("shelves")
            .order(by: "createdAt", descending: false)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    self.errorMessage = error.localizedDescription
                    return
                }
                self.shelves = snapshot?.documents.compactMap { Shelf(document: $0) } ?? []
            }
    }

    func stopListening() {
        listener?.remove()
        listener = nil
    }

    func addShelf(name: String) {
        guard let db else { return }
        let data: [String: Any] = [
            "name": name,
            "createdAt": Timestamp(date: Date())
        ]
        db.collection("shelves").addDocument(data: data) { [weak self] error in
            if let error {
                self?.errorMessage = error.localizedDescription
            }
        }
    }

    func deleteShelf(_ shelf: Shelf) {
        guard let db else { return }
        db.collection("shelves").document(shelf.id).delete { [weak self] error in
            if let error {
                self?.errorMessage = error.localizedDescription
            }
        }
    }
}
