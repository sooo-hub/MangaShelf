import XCTest
@testable import MangaShelf

/// `MangaRepository` の保存先切り替え(隠しオプション)ロジックのテスト。
/// 実際のFirestore通信は行わず、モードの既定値・切り替え・永続化のみを検証する。
@MainActor
final class MangaRepositoryStorageModeTests: XCTestCase {

    override func tearDown() {
        StorageModeStore.save(.local)
        super.tearDown()
    }

    func test_既定は端末内保存モードである() {
        StorageModeStore.save(.local)
        let repository = MangaRepository()
        XCTAssertEqual(repository.mode, .local)
    }

    func test_switchStorageModeでサーバー同期に切り替わり永続化される() {
        StorageModeStore.save(.local)
        let repository = MangaRepository()
        repository.switchStorageMode(to: .server)
        XCTAssertEqual(repository.mode, .server)
        XCTAssertEqual(StorageModeStore.load(), .server)
    }

    func test_同じモードへの切り替えは何も起きない() {
        StorageModeStore.save(.local)
        let repository = MangaRepository()
        repository.switchStorageMode(to: .local)
        XCTAssertEqual(repository.mode, .local)
    }

    func test_サーバーから端末内保存へ戻せる() {
        StorageModeStore.save(.local)
        let repository = MangaRepository()
        repository.switchStorageMode(to: .server)
        repository.switchStorageMode(to: .local)
        XCTAssertEqual(repository.mode, .local)
        XCTAssertEqual(StorageModeStore.load(), .local)
    }
}
