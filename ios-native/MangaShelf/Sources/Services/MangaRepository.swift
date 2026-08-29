import Combine
import Foundation

/// 保存先切り替えのコーディネーター。既定では `LocalMangaBackend`(端末内保存)のみで動作し、
/// ヘッダーの隠しジェスチャーから `FirestoreMangaBackend`(サーバー同期)へ切り替えられる。
/// Views 側はこれまで通りこのクラスの公開APIだけを見ればよく、バックエンドの違いを意識しない。
@MainActor
final class MangaRepository: ObservableObject {
    @Published private(set) var mangas: [Manga] = []
    @Published var errorMessage: String?
    @Published private(set) var isLoading = true
    @Published private(set) var mode: StorageMode

    private var backend: MangaBackend
    private var cancellables = Set<AnyCancellable>()

    init() {
        let initialMode = StorageModeStore.load()
        mode = initialMode
        backend = Self.makeBackend(for: initialMode)
        subscribe()
    }

    private func subscribe() {
        cancellables.removeAll()
        backend.mangasPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.mangas = $0 }
            .store(in: &cancellables)
        backend.errorMessagePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.errorMessage = $0 }
            .store(in: &cancellables)
        backend.isLoadingPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in self?.isLoading = $0 }
            .store(in: &cancellables)
    }

    func startListening() {
        backend.startListening()
    }

    func stopListening() {
        backend.stopListening()
    }

    /// 新規追加。`ownedVolumes` は常に空配列、`createdAt`/`updatedAt` は現在時刻で初期化する。
    func addManga(
        title: String,
        author: String,
        publisher: String,
        latestVolume: Int,
        genre: String,
        status: String,
        type: MangaType,
        wishUsers: [UserName],
        seriesName: String? = nil,
        parts: [MangaPart]? = nil
    ) {
        backend.addManga(
            title: title,
            author: author,
            publisher: publisher,
            latestVolume: latestVolume,
            genre: genre,
            status: status,
            type: type,
            wishUsers: wishUsers,
            seriesName: seriesName,
            parts: parts
        )
    }

    func saveManga(_ manga: Manga) {
        backend.saveManga(manga)
    }

    func deleteManga(_ id: String) {
        backend.deleteManga(id)
    }

    func updateMangaVolume(id: String, latestVolume: Int, status: String) {
        backend.updateMangaVolume(id: id, latestVolume: latestVolume, status: status)
    }

    /// デバッガー用の隠しジェスチャーから呼ばれる、保存先の切り替え。
    /// ローカル/サーバーのデータは互いに独立しており、切り替え時のマージは行わない。
    func switchStorageMode(to newMode: StorageMode) {
        guard newMode != mode else { return }
        backend.stopListening()
        mode = newMode
        StorageModeStore.save(newMode)
        backend = Self.makeBackend(for: newMode)
        subscribe()
        isLoading = true
        backend.startListening()
    }

    private static func makeBackend(for mode: StorageMode) -> MangaBackend {
        switch mode {
        case .local: return LocalMangaBackend()
        case .server: return FirestoreMangaBackend()
        }
    }

    /// Web版 `Date.now()` と同じ単位(epochミリ秒)。View側でのID採番などに使う汎用ヘルパー。
    static func nowEpochMillis() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }
}
