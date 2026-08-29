import FirebaseCore
import FirebaseFirestore
import Foundation

/// 保存先切り替え(隠しオプション)の合言葉を検証する。
///
/// 正解の文字列はアプリ本体には一切含めず、Firestoreのセキュリティルール側にのみ持たせる。
/// `unlock/{code}` への `get` をルールが許可するかどうかだけを見て判定するため、
/// バイナリを解析しても合言葉そのものは出てこない。
enum PasscodeGate {
    static func verifyStorageModeSwitchPasscode(_ code: String) async -> Bool {
        guard !code.isEmpty, FirebaseApp.app() != nil else { return false }
        do {
            _ = try await Firestore.firestore().collection("unlock").document(code).getDocument()
            return true
        } catch {
            return false
        }
    }
}
