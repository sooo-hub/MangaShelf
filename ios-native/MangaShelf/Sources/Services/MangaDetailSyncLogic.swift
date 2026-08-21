import Foundation

/// `MangaDetailView` のリアルタイム同期判定ロジック。
///
/// Firestore の `mangas` 配列に変更が来た際、表示中のドキュメント自体が
/// 実際にリモートで更新された場合のみ画面Stateを上書きすべきかどうかを判定する。
/// 同じ本棚内の別ドキュメントが追加/編集/削除されただけでも配列全体の参照が
/// 変わって通知が来てしまうため、対象ドキュメントの `updatedAt` が
/// 画面側が把握している値より新しい場合のみ上書き対象とみなす
/// (シンプルなアプリのため「後勝ち(last-write-wins)」の方針)。
///
/// SwiftUI から独立した純粋関数として切り出すことでユニットテスト可能にしている。
enum MangaDetailSyncLogic {
    /// - Parameters:
    ///   - mangas: リスナーから届いた最新の一覧
    ///   - id: 表示中のドキュメントID
    ///   - knownUpdatedAt: 画面が把握している対象ドキュメントの最新 `updatedAt`
    /// - Returns: 画面Stateを上書きすべき場合はその `Manga`、そうでなければ `nil`
    static func remoteUpdate(from mangas: [Manga], matching id: String, knownUpdatedAt: Date) -> Manga? {
        guard let latest = mangas.first(where: { $0.id == id }) else { return nil }
        guard latest.updatedAt > knownUpdatedAt else { return nil }
        return latest
    }
}
