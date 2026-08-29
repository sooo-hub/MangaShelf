import FirebaseCore
import FirebaseFirestore
import Foundation

/// 「誰が欲しい？」で表示する2人分の表示名。
///
/// 実名はアプリ本体には一切埋め込まず、Firestoreの `settings/{合言葉}/userNames/main`
/// にのみ保存する。このパスは合言葉(`PasscodeStore`)を知っている場合のみ
/// 読み書きできるようセキュリティルールで保護されている。
@MainActor
final class UserDisplayNames: ObservableObject {
    static let defaultA = "ユーザー1"
    static let defaultB = "ユーザー2"

    @Published private(set) var nameA: String = UserDisplayNames.defaultA
    @Published private(set) var nameB: String = UserDisplayNames.defaultB

    private var docRef: DocumentReference? {
        guard let token = PasscodeStore.load(), FirebaseApp.app() != nil else { return nil }
        return Firestore.firestore()
            .collection("settings").document(token)
            .collection("userNames").document("main")
    }

    func load() async {
        guard let docRef else { return }
        guard let snapshot = try? await docRef.getDocument(), let data = snapshot.data() else { return }
        nameA = (data["userA"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? Self.defaultA
        nameB = (data["userB"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? Self.defaultB
    }

    func save(nameA: String, nameB: String) {
        let trimmedA = nameA.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedB = nameB.trimmingCharacters(in: .whitespacesAndNewlines)
        self.nameA = trimmedA.isEmpty ? Self.defaultA : trimmedA
        self.nameB = trimmedB.isEmpty ? Self.defaultB : trimmedB
        docRef?.setData(["userA": self.nameA, "userB": self.nameB], merge: true)
    }

    func label(for user: UserName) -> String {
        user == .userA ? nameA : nameB
    }
}
