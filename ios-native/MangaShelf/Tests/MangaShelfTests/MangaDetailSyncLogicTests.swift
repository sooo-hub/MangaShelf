import XCTest
@testable import MangaShelf

/// `MangaDetailView` のリアルタイム同期判定ロジック (`MangaDetailSyncLogic`) のテスト。
///
/// レビューで最も重視された「対象ドキュメント自体が更新された場合のみ画面Stateを
/// 上書きする」というupdatedAt比較ロジックを検証する。
final class MangaDetailSyncLogicTests: XCTestCase {

    private let baseDate = Date(timeIntervalSince1970: 1_000_000)

    private func makeManga(
        id: String = "manga-1",
        title: String = "ワンピース",
        updatedAt: Date
    ) -> Manga {
        Manga(id: id, title: title, updatedAt: updatedAt)
    }

    /// 対象ドキュメント自体が、画面が把握している時刻より新しく更新されている場合は
    /// 上書き対象として返す。
    func test_対象ドキュメントがリモートで新しく更新された場合は上書き対象を返す() {
        let known = baseDate
        let updated = makeManga(updatedAt: baseDate.addingTimeInterval(60))

        let result = MangaDetailSyncLogic.remoteUpdate(
            from: [updated],
            matching: "manga-1",
            knownUpdatedAt: known
        )

        XCTAssertEqual(result?.id, "manga-1")
        XCTAssertEqual(result?.updatedAt, updated.updatedAt)
    }

    /// 対象ドキュメントの updatedAt が既知の値と同じ(=自分が把握している最新版)の場合、
    /// 編集中の未保存入力を壊さないよう上書きしない。
    func test_updatedAtが既知の値と同じ場合は上書きしない() {
        let known = baseDate
        let same = makeManga(updatedAt: baseDate)

        let result = MangaDetailSyncLogic.remoteUpdate(
            from: [same],
            matching: "manga-1",
            knownUpdatedAt: known
        )

        XCTAssertNil(result)
    }

    /// 対象ドキュメントの updatedAt が既知の値より古い場合も上書きしない。
    func test_updatedAtが既知の値より古い場合は上書きしない() {
        let known = baseDate
        let older = makeManga(updatedAt: baseDate.addingTimeInterval(-60))

        let result = MangaDetailSyncLogic.remoteUpdate(
            from: [older],
            matching: "manga-1",
            knownUpdatedAt: known
        )

        XCTAssertNil(result)
    }

    /// 同じ本棚内の別ドキュメントが追加/編集/削除されただけで配列全体の参照が変わった
    /// ケースを想定: 対象ドキュメントIDに一致するデータが変化していなければ、
    /// 他のドキュメントが新しい updatedAt を持っていても上書きしない。
    func test_別ドキュメントのみが変化した場合は上書きしない() {
        let known = baseDate
        let targetUnchanged = makeManga(id: "manga-1", updatedAt: baseDate)
        let otherDocChangedLater = makeManga(id: "manga-2", updatedAt: baseDate.addingTimeInterval(120))

        let result = MangaDetailSyncLogic.remoteUpdate(
            from: [targetUnchanged, otherDocChangedLater],
            matching: "manga-1",
            knownUpdatedAt: known
        )

        XCTAssertNil(result)
    }

    /// 対象ドキュメントがリスナーの最新配列から消えている(削除された等)場合は上書きしない。
    func test_対象ドキュメントが配列に存在しない場合は上書きしない() {
        let known = baseDate
        let other = makeManga(id: "manga-2", updatedAt: baseDate.addingTimeInterval(120))

        let result = MangaDetailSyncLogic.remoteUpdate(
            from: [other],
            matching: "manga-1",
            knownUpdatedAt: known
        )

        XCTAssertNil(result)
    }

    /// 空配列の場合も上書きしない。
    func test_空配列の場合は上書きしない() {
        let result = MangaDetailSyncLogic.remoteUpdate(
            from: [],
            matching: "manga-1",
            knownUpdatedAt: baseDate
        )

        XCTAssertNil(result)
    }
}
