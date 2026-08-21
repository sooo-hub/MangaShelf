import XCTest
@testable import MangaShelf

/// `AniListService.mapGenre` のテスト。
///
/// AniList から取得した genre / tag(Demographic category) 文字列を、
/// アプリ内で使う日本語ジャンル(`GenreOption.all`)へ変換するロジックを検証する。
/// 優先順位は「デモグラフィックタグ → ジャンル → その他」。
final class AniListGenreMappingTests: XCTestCase {

    func test_デモグラフィックタグが少年の場合は少年と判定される() {
        let result = AniListService.mapGenre(genres: ["Action"], demographicTagNames: ["Shounen"])
        XCTAssertEqual(result, "少年")
    }

    func test_デモグラフィックタグが少女の場合は少女と判定される() {
        let result = AniListService.mapGenre(genres: [], demographicTagNames: ["Shoujo"])
        XCTAssertEqual(result, "少女")
    }

    func test_デモグラフィックタグが青年の場合は青年と判定される() {
        let result = AniListService.mapGenre(genres: ["Fantasy"], demographicTagNames: ["Seinen"])
        XCTAssertEqual(result, "青年")
    }

    func test_デモグラフィックタグが女性の場合は女性と判定される() {
        let result = AniListService.mapGenre(genres: [], demographicTagNames: ["Josei"])
        XCTAssertEqual(result, "女性")
    }

    func test_デモグラフィックタグが無い場合はgenresから変換される() {
        let result = AniListService.mapGenre(genres: ["Sci-Fi"], demographicTagNames: [])
        XCTAssertEqual(result, "SF")
    }

    func test_デモグラフィックタグとジャンルが両方ある場合はデモグラフィックタグが優先される() {
        // Shounen(少年) を優先し、genres の Romance(ラブコメ) は無視される
        let result = AniListService.mapGenre(genres: ["Romance"], demographicTagNames: ["Shounen"])
        XCTAssertEqual(result, "少年")
    }

    func test_複数genresがある場合は最初にマッピングできたものが採用される() {
        let result = AniListService.mapGenre(genres: ["Unknown", "Horror", "Sports"], demographicTagNames: [])
        XCTAssertEqual(result, "ホラー")
    }

    func test_ComedyとRomanceはどちらもラブコメに変換される() {
        XCTAssertEqual(AniListService.mapGenre(genres: ["Comedy"], demographicTagNames: []), "ラブコメ")
        XCTAssertEqual(AniListService.mapGenre(genres: ["Romance"], demographicTagNames: []), "ラブコメ")
    }

    func test_SliceOfLifeは日常に変換される() {
        let result = AniListService.mapGenre(genres: ["Slice of Life"], demographicTagNames: [])
        XCTAssertEqual(result, "日常")
    }

    func test_マッピング対象外のgenreとdemographicタグの場合はその他になる() {
        let result = AniListService.mapGenre(genres: ["Music"], demographicTagNames: ["Unknown"])
        XCTAssertEqual(result, "その他")
    }

    func test_genresとdemographicタグが両方空の場合はその他になる() {
        let result = AniListService.mapGenre(genres: [], demographicTagNames: [])
        XCTAssertEqual(result, "その他")
    }
}
