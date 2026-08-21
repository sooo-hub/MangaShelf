import Foundation

/// 漫画検索・最新刊確認のフォールバック元となる AniList GraphQL API へのアクセス。
/// Web版 `src/lib/claudeApi.ts` の AniList 関連ロジックを移植したもの。
enum AniListService {
    static let url = URL(string: "https://graphql.anilist.co")!

    /// レート制限・サーバー過負荷を表すエラー。
    struct RateLimitError: Error {
        let code: Int
        var message: String { code == 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT" }
    }

    struct RequestError: Error, LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    // AniList ジャンルを日本語にマッピング
    private static let genreMap: [String: String] = [
        "Action": "少年", "Adventure": "少年", "Fantasy": "ファンタジー",
        "Sci-Fi": "SF", "Comedy": "ラブコメ", "Romance": "ラブコメ",
        "Horror": "ホラー", "Sports": "スポーツ", "Mystery": "ミステリー",
        "Historical": "歴史", "Slice of Life": "日常",
    ]

    // AniList の demographic タグを日本語ジャンルにマッピング
    private static let demographicMap: [String: String] = [
        "Shounen": "少年", "Shoujo": "少女", "Seinen": "青年", "Josei": "女性",
    ]

    /// AniList のジャンル・デモグラフィックタグから日本語ジャンルへの変換。単体テストのため internal 公開。
    static func mapGenre(genres: [String], demographicTagNames: [String]) -> String {
        for tagName in demographicTagNames {
            if let mapped = demographicMap[tagName] { return mapped }
        }
        for genre in genres {
            if let mapped = genreMap[genre] { return mapped }
        }
        return "その他"
    }

    static func mapStatus(_ status: String) -> String {
        if status == "RELEASING" { return "連載中" }
        if status == "FINISHED" { return "完結" }
        return ""
    }

    private static func getAuthor(staffEdges: [StaffEdge]) -> String {
        guard let storyArt = staffEdges.first(where: { $0.role.contains("Story") || $0.role.contains("Art") }) else {
            return ""
        }
        let native = storyArt.node.name.native?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let native, !native.isEmpty { return native }
        return storyArt.node.name.full
    }

    private static let searchQuery = """
    query ($search: String) {
      Page(perPage: 5) {
        media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
          title { native romaji }
          volumes
          status
          genres
          tags { name category }
          staff(perPage: 5) {
            edges {
              role
              node { name { full native } }
            }
          }
        }
      }
    }
    """

    private static let volumeQuery = """
    query ($search: String) {
      Page(perPage: 1) {
        media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
          volumes
          status
        }
      }
    }
    """

    private static func post(query: String, variables: [String: String]) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let body: [String: Any] = ["query": query, "variables": variables]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw RequestError(message: "不正なレスポンスです")
        }
        if http.statusCode == 429 {
            throw RateLimitError(code: 429)
        }
        guard (200...299).contains(http.statusCode) else {
            throw RequestError(message: "HTTP \(http.statusCode)")
        }
        return data
    }

    /// タイトル検索。Web版 `searchManga` に相当。
    static func searchManga(title: String) async throws -> [MangaCandidate] {
        let data = try await post(query: searchQuery, variables: ["search": title])
        let decoded = try JSONDecoder().decode(SearchResponse.self, from: data)
        let items = decoded.data?.page.media ?? []
        return items.map { media in
            let demographicTagNames = media.tags.filter { $0.category == "Demographic" }.map { $0.name }
            let staffEdges = media.staff.edges
            return MangaCandidate(
                title: media.title.native?.isEmpty == false ? media.title.native! : media.title.romaji,
                author: getAuthor(staffEdges: staffEdges),
                publisher: "",
                latestVolume: media.volumes ?? 0,
                genre: mapGenre(genres: media.genres, demographicTagNames: demographicTagNames),
                status: mapStatus(media.status)
            )
        }
    }

    /// 楽天ブックスAPIで見つからない場合のフォールバック。あらゆる失敗を握りつぶし
    /// `VolumeInfo(latestVolume: 0, status: "")` を返す(呼び出し側は常に安全に扱える)。
    static func fetchLatestVolumeFallback(title: String) async -> VolumeInfo {
        do {
            let data = try await post(query: volumeQuery, variables: ["search": title])
            let decoded = try JSONDecoder().decode(VolumeResponse.self, from: data)
            guard let media = decoded.data?.page.media.first else {
                return VolumeInfo(latestVolume: 0, status: "")
            }
            return VolumeInfo(latestVolume: media.volumes ?? 0, status: mapStatus(media.status))
        } catch {
            return VolumeInfo(latestVolume: 0, status: "")
        }
    }

    // MARK: - Decoding models

    private struct SearchResponse: Decodable {
        struct DataBox: Decodable { let page: PageBox }
        struct PageBox: Decodable {
            let media: [MediaBox]
            enum CodingKeys: String, CodingKey { case media }
        }
        let data: DataBox?
        enum CodingKeys: String, CodingKey { case data = "data" }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let dataContainer = try container.nestedContainer(keyedBy: PageDataKeys.self, forKey: .data)
            let pageBox = try dataContainer.decode(PageBox.self, forKey: .Page)
            self.data = DataBox(page: pageBox)
        }

        private enum PageDataKeys: String, CodingKey { case Page }
    }

    private struct VolumeResponse: Decodable {
        struct DataBox: Decodable { let page: PageBox }
        struct PageBox: Decodable { let media: [MediaVolumeBox] }
        let data: DataBox?

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let dataContainer = try container.nestedContainer(keyedBy: PageDataKeys.self, forKey: .data)
            let pageBox = try dataContainer.decode(PageBox.self, forKey: .Page)
            self.data = DataBox(page: pageBox)
        }

        private enum CodingKeys: String, CodingKey { case data }
        private enum PageDataKeys: String, CodingKey { case Page }
    }

    private struct MediaVolumeBox: Decodable {
        let volumes: Int?
        let status: String

        enum CodingKeys: String, CodingKey { case volumes, status }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            volumes = try c.decodeIfPresent(Int.self, forKey: .volumes)
            status = (try c.decodeIfPresent(String.self, forKey: .status)) ?? ""
        }
    }

    private struct MediaBox: Decodable {
        let title: TitleBox
        let volumes: Int?
        let status: String
        let genres: [String]
        let tags: [TagBox]
        let staff: StaffBox

        enum CodingKeys: String, CodingKey { case title, volumes, status, genres, tags, staff }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            title = try c.decode(TitleBox.self, forKey: .title)
            volumes = try c.decodeIfPresent(Int.self, forKey: .volumes)
            status = (try c.decodeIfPresent(String.self, forKey: .status)) ?? ""
            genres = (try c.decodeIfPresent([String].self, forKey: .genres)) ?? []
            tags = (try c.decodeIfPresent([TagBox].self, forKey: .tags)) ?? []
            staff = (try c.decodeIfPresent(StaffBox.self, forKey: .staff)) ?? StaffBox(edges: [])
        }
    }

    private struct TitleBox: Decodable {
        let native: String?
        let romaji: String
    }

    private struct TagBox: Decodable {
        let name: String
        let category: String?
    }

    private struct StaffBox: Decodable {
        let edges: [StaffEdge]

        enum CodingKeys: String, CodingKey { case edges }

        init(edges: [StaffEdge]) {
            self.edges = edges
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            edges = (try c.decodeIfPresent([StaffEdge].self, forKey: .edges)) ?? []
        }
    }

    private struct StaffEdge: Decodable {
        let role: String
        let node: StaffNode
    }

    private struct StaffNode: Decodable {
        let name: StaffName
    }

    private struct StaffName: Decodable {
        let full: String
        let native: String?
    }
}
