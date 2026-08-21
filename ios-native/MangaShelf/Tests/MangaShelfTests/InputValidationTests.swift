import XCTest
@testable import MangaShelf

/// `InputValidation.isBlank` のテスト。
///
/// AddMangaView のタイトル入力・ShelfListView の本棚名入力で共通して使われる、
/// 「空白のみ入力」を弾くバリデーションロジックを検証する。
final class InputValidationTests: XCTestCase {

    func test_空文字はblankと判定される() {
        XCTAssertTrue(InputValidation.isBlank(""))
    }

    func test_半角スペースのみはblankと判定される() {
        XCTAssertTrue(InputValidation.isBlank("   "))
    }

    func test_全角スペースのみはblankと判定される() {
        XCTAssertTrue(InputValidation.isBlank("　　　"))
    }

    func test_改行やタブのみはblankと判定される() {
        XCTAssertTrue(InputValidation.isBlank("\n\t \n"))
    }

    func test_通常のタイトル文字列はblankではない() {
        XCTAssertFalse(InputValidation.isBlank("ワンピース"))
    }

    func test_前後に空白を含むが実質は文字がある場合はblankではない() {
        XCTAssertFalse(InputValidation.isBlank("  ワンピース  "))
    }

    func test_1文字だけでもblankではない() {
        XCTAssertFalse(InputValidation.isBlank("あ"))
    }
}
