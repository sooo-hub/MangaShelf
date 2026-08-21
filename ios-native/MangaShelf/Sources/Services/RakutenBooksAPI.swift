import Foundation

/// 楽天ブックスAPIによる最新刊取得。Web版 `src/lib/claudeApi.ts` の `fetchLatestVolume` を移植。
///
/// Web版は「0件の場合のみ」AniListにフォールバックするが、楽天の認証情報が未検証なため
/// Swift版はネットワークエラー・HTTPエラー・レート制限などあらゆる失敗ケースで
/// AniListへフォールバックする(必ず何らかの `VolumeInfo` を返し、呼び出し側でエラーハンドリング不要)。
enum RakutenBooksAPI {
    private static let searchURL = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404"

    static func fetchLatestVolume(title: String) async -> VolumeInfo {
        guard RakutenSecrets.isConfigured else {
            return await AniListService.fetchLatestVolumeFallback(title: title)
        }

        do {
            let items = try await searchItems(title: title)
            let nums = extractVolumeNumbers(items: items, title: title)
            if nums.isEmpty {
                return await AniListService.fetchLatestVolumeFallback(title: title)
            }
            return VolumeInfo(latestVolume: nums.max() ?? 0, status: "")
        } catch {
            return await AniListService.fetchLatestVolumeFallback(title: title)
        }
    }

    private static func searchItems(title: String) async throws -> [RakutenItem] {
        var components = URLComponents(string: searchURL)!
        components.queryItems = [
            URLQueryItem(name: "format", value: "json"),
            URLQueryItem(name: "title", value: title),
            URLQueryItem(name: "applicationId", value: RakutenSecrets.applicationId),
            URLQueryItem(name: "accessKey", value: RakutenSecrets.accessKey),
            URLQueryItem(name: "sort", value: "standard"),
            URLQueryItem(name: "hits", value: "30"),
        ]
        guard let url = components.url else {
            throw AniListService.RequestError(message: "不正なURLです")
        }

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse else {
            throw AniListService.RequestError(message: "不正なレスポンスです")
        }
        if http.statusCode == 429 {
            throw AniListService.RateLimitError(code: 429)
        }
        guard (200...299).contains(http.statusCode) else {
            throw AniListService.RequestError(message: "HTTP \(http.statusCode)")
        }

        let decoded = try JSONDecoder().decode(RakutenResponse.self, from: data)
        if let errorDescription = decoded.errorDescription ?? decoded.error {
            throw AniListService.RequestError(message: errorDescription)
        }
        // `Item` ラッパーがある形式・無い形式の両方に対応する(Web版の `i.Item ?? i` 相当)。
        return decoded.items ?? []
    }

    /// 「タイトル 巻数」形式のアイテムを抽出し、末尾の数字を巻数として取り出す。
    static func extractVolumeNumbers(items: [RakutenItem], title: String) -> [Int] {
        let titles = items.compactMap { $0.effectiveTitle }
        let matched = titles.filter { itemTitle in
            let startsWithHalfWidthSpace = itemTitle.hasPrefix(title + " ")
            let startsWithFullWidthSpace = itemTitle.hasPrefix(title + "\u{3000}")
            guard startsWithHalfWidthSpace || startsWithFullWidthSpace else { return false }
            return itemTitle.range(of: #"\d+$"#, options: .regularExpression) != nil
        }
        return matched.compactMap { itemTitle -> Int? in
            guard let range = itemTitle.range(of: #"\d+$"#, options: .regularExpression),
                  let number = Int(itemTitle[range]) else {
                return nil
            }
            return number
        }.filter { $0 > 0 && $0 < 10000 }
    }

    // MARK: - Decoding models

    struct RakutenItem: Decodable {
        let title: String?
        let salesDate: String?
        let item: RakutenItemBox?

        enum CodingKeys: String, CodingKey { case title, salesDate, Item }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            title = try c.decodeIfPresent(String.self, forKey: .title)
            salesDate = try c.decodeIfPresent(String.self, forKey: .salesDate)
            item = try c.decodeIfPresent(RakutenItemBox.self, forKey: .Item)
        }

        /// `Item` ラッパーがある場合はそちらの title を優先する(Web版の `i.Item ?? i` 相当)。
        var effectiveTitle: String? { item?.title ?? title }
    }

    struct RakutenItemBox: Decodable {
        let title: String?
        let salesDate: String?
    }

    private struct RakutenResponse: Decodable {
        let Items: [RakutenItem]?
        let error: String?
        let error_description: String?

        var items: [RakutenItem]? { Items }
        var errorDescription: String? { error_description }
    }
}
