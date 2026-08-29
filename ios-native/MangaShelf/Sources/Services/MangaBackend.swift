import Combine
import Foundation

/// 保存先(ローカル/サーバー)を問わず `MangaRepository` が要求する共通インターフェース。
/// `FirestoreMangaBackend`(サーバー同期) と `LocalMangaBackend`(端末内保存) の2実装を持つ。
@MainActor
protocol MangaBackend: AnyObject {
    var mangas: [Manga] { get }
    var errorMessage: String? { get }
    var isLoading: Bool { get }

    var mangasPublisher: AnyPublisher<[Manga], Never> { get }
    var errorMessagePublisher: AnyPublisher<String?, Never> { get }
    var isLoadingPublisher: AnyPublisher<Bool, Never> { get }

    func startListening()
    func stopListening()

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
    )
    func saveManga(_ manga: Manga)
    func deleteManga(_ id: String)
    func updateMangaVolume(id: String, latestVolume: Int, status: String)
}
