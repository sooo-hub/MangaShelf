import XCTest
@testable import MangaShelf

/// `RakutenBooksAPI.extractVolumeNumbers` のテスト。
///
/// 楽天ブックスAPIの検索結果アイテム(タイトル文字列)から、検索対象タイトルに続く
/// 巻数を抽出するロジックを検証する。「タイトル + 半角/全角スペース + 数字」の形式のみを対象とし、
/// タイトルが前方一致しないものや末尾が数字でないものは除外される。
final class RakutenVolumeExtractionTests: XCTestCase {

    private func item(_ title: String) -> RakutenBooksAPI.RakutenItem {
        let json = #"{"title": "\#(title)"}"#
        return try! JSONDecoder().decode(RakutenBooksAPI.RakutenItem.self, from: json.data(using: .utf8)!)
    }

    func test_タイトルの後に半角スペースと巻数が続く場合は巻数として抽出される() {
        let items = [item("ONE PIECE 114")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertEqual(result, [114])
    }

    func test_タイトルの後に全角スペースと巻数が続く場合は巻数として抽出される() {
        let items = [item("ONE PIECE\u{3000}114")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertEqual(result, [114])
    }

    func test_複数アイテムから最大巻数が候補として含まれる() {
        let items = [item("ONE PIECE 1"), item("ONE PIECE 114"), item("ONE PIECE 50")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertEqual(Set(result), Set([1, 114, 50]))
        XCTAssertEqual(result.max(), 114)
    }

    func test_検索タイトルで始まらないアイテムは除外される() {
        let items = [item("違うタイトル 114")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_末尾が数字でないアイテムは除外される() {
        let items = [item("ONE PIECE 総集編")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_タイトルに続くスペースが無い場合は除外される() {
        // "ONE PIECE100" のようにスペース無しで数字が連結している場合はタイトル前方一致とみなさない
        let items = [item("ONE PIECE100")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_タイトルが部分一致するだけで前方一致しない場合は除外される() {
        let items = [item("新ONE PIECE 5")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_巻数が0の場合は範囲外として除外される() {
        let items = [item("ONE PIECE 0")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_巻数が10000以上の場合は範囲外として除外される() {
        let items = [item("ONE PIECE 10000")]
        let result = RakutenBooksAPI.extractVolumeNumbers(items: items, title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_アイテムが空配列の場合は空配列を返す() {
        let result = RakutenBooksAPI.extractVolumeNumbers(items: [], title: "ONE PIECE")
        XCTAssertTrue(result.isEmpty)
    }

    func test_Itemラッパー形式のタイトルも抽出対象になる() {
        let json = #"{"Item": {"title": "ONE PIECE 99"}}"#
        let wrapped = try! JSONDecoder().decode(RakutenBooksAPI.RakutenItem.self, from: json.data(using: .utf8)!)
        let result = RakutenBooksAPI.extractVolumeNumbers(items: [wrapped], title: "ONE PIECE")
        XCTAssertEqual(result, [99])
    }
}
