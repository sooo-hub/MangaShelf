import Combine
import Foundation

/// 端末内の JSON ファイルにのみデータを保持するバックエンド。配信版の既定モード。
/// サーバーを一切使わないため、他ユーザーとの共有・リアルタイム同期は行わない。
@MainActor
final class LocalMangaBackend: MangaBackend, ObservableObject {
    @Published private(set) var mangas: [Manga] = []
    @Published var errorMessage: String?
    @Published private(set) var isLoading = true

    var mangasPublisher: AnyPublisher<[Manga], Never> { $mangas.eraseToAnyPublisher() }
    var errorMessagePublisher: AnyPublisher<String?, Never> { $errorMessage.eraseToAnyPublisher() }
    var isLoadingPublisher: AnyPublisher<Bool, Never> { $isLoading.eraseToAnyPublisher() }

    private let fileURL: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        fileURL = dir.appendingPathComponent("mangaShelf.json")
    }

    func startListening() {
        load()
        isLoading = false
    }

    func stopListening() {}

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode([Manga].self, from: data) else {
            mangas = []
            return
        }
        mangas = decoded.sorted { ($0.createdAt ?? 0) < ($1.createdAt ?? 0) }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(mangas) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    private static func generateId() -> String {
        UUID().uuidString
    }

    private static func nowEpochMillis() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    func addManga(
        title: String,
        author: String,
        publisher: String,
        latestVolume: Int,
        genre: String,
        status: String,
        type: MangaType,
        wishUsers: [UserName],
        seriesName: String?,
        parts: [MangaPart]?
    ) {
        let now = Self.nowEpochMillis()
        let manga = Manga(
            id: Self.generateId(),
            title: title,
            author: author,
            publisher: publisher,
            latestVolume: latestVolume,
            genre: genre,
            status: status,
            type: type,
            ownedVolumes: [],
            wishUsers: type == .wish ? wishUsers : [],
            seriesName: seriesName,
            parts: parts,
            createdAt: now,
            updatedAt: now
        )
        mangas.append(manga)
        persist()
    }

    func saveManga(_ manga: Manga) {
        guard let index = mangas.firstIndex(where: { $0.id == manga.id }) else { return }
        var updated = manga
        updated.updatedAt = Self.nowEpochMillis()
        mangas[index] = updated
        persist()
    }

    func deleteManga(_ id: String) {
        mangas.removeAll { $0.id == id }
        persist()
    }

    func updateMangaVolume(id: String, latestVolume: Int, status: String) {
        guard let index = mangas.firstIndex(where: { $0.id == id }) else { return }
        mangas[index].latestVolume = latestVolume
        mangas[index].status = status
        mangas[index].updatedAt = Self.nowEpochMillis()
        persist()
    }
}
