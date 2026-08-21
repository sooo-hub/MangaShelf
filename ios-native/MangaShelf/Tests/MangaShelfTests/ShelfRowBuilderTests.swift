import XCTest
@testable import MangaShelf

/// `ShelfRowBuilder.buildRows` のテスト。
///
/// 本棚一覧(フィルタ・ソート済みの `[Manga]`)を、`seriesName` が同じもの同士をまとめた
/// 表示行(`ShelfRow`)へ変換するロジックを検証する。Web版 `App.tsx` の `buildRows` に相当。
final class ShelfRowBuilderTests: XCTestCase {

    private func manga(_ id: String, title: String, series: String? = nil) -> Manga {
        Manga(id: id, title: title, seriesName: series)
    }

    func test_seriesNameが無いmangaはそれぞれ単独行になる() {
        let items = [
            manga("1", title: "進撃の巨人"),
            manga("2", title: "呪術廻戦"),
        ]
        let rows = ShelfRowBuilder.buildRows(from: items)

        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].id, "1")
        XCTAssertEqual(rows[1].id, "2")
        guard case .single(let m0) = rows[0].kind, case .single(let m1) = rows[1].kind else {
            return XCTFail("single kind であるべき")
        }
        XCTAssertEqual(m0.title, "進撃の巨人")
        XCTAssertEqual(m1.title, "呪術廻戦")
    }

    func test_同じseriesNameを持つmangaは1つのseries行にまとめられる() {
        let items = [
            manga("1", title: "ジョジョの奇妙な冒険 第1部", series: "ジョジョの奇妙な冒険"),
            manga("2", title: "ジョジョの奇妙な冒険 第2部", series: "ジョジョの奇妙な冒険"),
        ]
        let rows = ShelfRowBuilder.buildRows(from: items)

        XCTAssertEqual(rows.count, 1)
        guard case .series(let name, let seriesItems) = rows[0].kind else {
            return XCTFail("series kind であるべき")
        }
        XCTAssertEqual(name, "ジョジョの奇妙な冒険")
        XCTAssertEqual(seriesItems.map { $0.id }, ["1", "2"])
        XCTAssertEqual(rows[0].id, "series-ジョジョの奇妙な冒険")
    }

    func test_series行は最初に出現した位置にまとめられ2回目以降は出現しない() {
        let items = [
            manga("1", title: "単独作品A"),
            manga("2", title: "part1", series: "シリーズX"),
            manga("3", title: "単独作品B"),
            manga("4", title: "part2", series: "シリーズX"),
        ]
        let rows = ShelfRowBuilder.buildRows(from: items)

        // 単独A, シリーズX(まとめ), 単独B の3行になる(シリーズXの2件目は独立行として出てこない)
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(rows[0].id, "1")
        XCTAssertEqual(rows[1].id, "series-シリーズX")
        XCTAssertEqual(rows[2].id, "3")

        guard case .series(_, let seriesItems) = rows[1].kind else {
            return XCTFail("series kind であるべき")
        }
        XCTAssertEqual(seriesItems.map { $0.id }, ["2", "4"])
    }

    func test_複数の異なるseriesNameはそれぞれ別のseries行になる() {
        let items = [
            manga("1", title: "A1", series: "シリーズA"),
            manga("2", title: "B1", series: "シリーズB"),
            manga("3", title: "A2", series: "シリーズA"),
        ]
        let rows = ShelfRowBuilder.buildRows(from: items)

        XCTAssertEqual(rows.count, 2)
        guard case .series(let nameA, let itemsA) = rows[0].kind,
              case .series(let nameB, let itemsB) = rows[1].kind else {
            return XCTFail("両方とも series kind であるべき")
        }
        XCTAssertEqual(nameA, "シリーズA")
        XCTAssertEqual(itemsA.map { $0.id }, ["1", "3"])
        XCTAssertEqual(nameB, "シリーズB")
        XCTAssertEqual(itemsB.map { $0.id }, ["2"])
    }

    func test_seriesNameが空文字の場合は単独行として扱われる() {
        let items = [manga("1", title: "タイトル", series: "")]
        let rows = ShelfRowBuilder.buildRows(from: items)

        XCTAssertEqual(rows.count, 1)
        guard case .single(let m) = rows[0].kind else {
            return XCTFail("空文字のseriesNameは single kind として扱われるべき")
        }
        XCTAssertEqual(m.id, "1")
    }

    func test_空配列の場合は空配列を返す() {
        let rows = ShelfRowBuilder.buildRows(from: [])
        XCTAssertTrue(rows.isEmpty)
    }
}
