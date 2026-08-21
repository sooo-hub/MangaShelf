import Foundation

/// 本棚一覧の1行分。シリーズでまとめられた行、または単独の漫画の行のいずれか。
struct ShelfRow: Identifiable, Equatable {
    enum Kind: Equatable {
        case single(Manga)
        case series(name: String, items: [Manga])
    }
    let id: String
    let kind: Kind
}

/// フィルタ・ソート後の一覧をシリーズごとにグルーピングする純粋関数。
/// Web版 `App.tsx` の `buildRows` に相当。
enum ShelfRowBuilder {
    /// - Parameter items: 表示順に並んだ(フィルタ・ソート済みの) manga 一覧。
    ///   同じ `seriesName` を持つ要素は、その中で最初に出現した位置にまとめて1行として出力される。
    static func buildRows(from items: [Manga]) -> [ShelfRow] {
        var seriesMap: [String: [Manga]] = [:]
        for m in items {
            if let series = m.seriesName, !series.isEmpty {
                seriesMap[series, default: []].append(m)
            }
        }
        var seen = Set<String>()
        var result: [ShelfRow] = []
        for m in items {
            if let series = m.seriesName, !series.isEmpty {
                if !seen.contains(series) {
                    seen.insert(series)
                    result.append(ShelfRow(id: "series-\(series)", kind: .series(name: series, items: seriesMap[series] ?? [])))
                }
            } else {
                result.append(ShelfRow(id: m.id, kind: .single(m)))
            }
        }
        return result
    }
}
