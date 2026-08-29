import XCTest
@testable import MangaShelf

/// `LocalMangaBackend`(端末内JSON保存)のCRUDと永続化のテスト。
/// 同じインスタンス内でのメモリ更新だけでなく、ファイルへの書き込み・再読み込みまで検証する。
@MainActor
final class LocalMangaBackendTests: XCTestCase {

    func test_追加したデータはファイル再読み込み後も残る() async throws {
        let backend = LocalMangaBackend()
        backend.startListening()
        let before = backend.mangas.count

        backend.addManga(
            title: "テストタイトル", author: "著者", publisher: "",
            latestVolume: 3, genre: "少年", status: "連載中",
            type: .own, wishUsers: [], seriesName: nil, parts: nil
        )
        XCTAssertEqual(backend.mangas.count, before + 1)

        let reloaded = LocalMangaBackend()
        reloaded.startListening()
        XCTAssertEqual(reloaded.mangas.count, before + 1)
        XCTAssertTrue(reloaded.mangas.contains { $0.title == "テストタイトル" })

        // 後始末
        if let added = reloaded.mangas.first(where: { $0.title == "テストタイトル" }) {
            reloaded.deleteManga(added.id)
        }
    }

    func test_updateMangaVolumeで巻数と状態が更新される() {
        let backend = LocalMangaBackend()
        backend.startListening()
        backend.addManga(
            title: "巻数更新テスト", author: "", publisher: "",
            latestVolume: 1, genre: "", status: "連載中",
            type: .own, wishUsers: [], seriesName: nil, parts: nil
        )
        guard let target = backend.mangas.first(where: { $0.title == "巻数更新テスト" }) else {
            XCTFail("追加したデータが見つからない")
            return
        }
        backend.updateMangaVolume(id: target.id, latestVolume: 9, status: "完結")
        let updated = backend.mangas.first { $0.id == target.id }
        XCTAssertEqual(updated?.latestVolume, 9)
        XCTAssertEqual(updated?.status, "完結")

        backend.deleteManga(target.id)
    }

    func test_deleteMangaで削除される() {
        let backend = LocalMangaBackend()
        backend.startListening()
        backend.addManga(
            title: "削除テスト", author: "", publisher: "",
            latestVolume: 0, genre: "", status: "",
            type: .own, wishUsers: [], seriesName: nil, parts: nil
        )
        guard let target = backend.mangas.first(where: { $0.title == "削除テスト" }) else {
            XCTFail("追加したデータが見つからない")
            return
        }
        backend.deleteManga(target.id)
        XCTAssertFalse(backend.mangas.contains { $0.id == target.id })
    }
}
