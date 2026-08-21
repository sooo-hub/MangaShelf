import SwiftUI

/// 選択した本棚に含まれる漫画タイトルの一覧画面。
struct MangaListView: View {
    let shelf: Shelf
    @StateObject private var repository: MangaRepository
    @State private var isPresentingAddManga = false

    init(shelf: Shelf) {
        self.shelf = shelf
        _repository = StateObject(wrappedValue: MangaRepository(shelfID: shelf.id))
    }

    var body: some View {
        List {
            ForEach(repository.mangas) { manga in
                NavigationLink(value: manga) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(manga.title)
                            .font(.headline)
                        Text(volumeSummary(for: manga))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .onDelete { indexSet in
                indexSet.map { repository.mangas[$0] }.forEach(repository.deleteManga)
            }
        }
        .navigationTitle(shelf.name)
        .navigationDestination(for: Manga.self) { manga in
            MangaDetailView(repository: repository, manga: manga)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isPresentingAddManga = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $isPresentingAddManga) {
            AddMangaView(repository: repository)
        }
        .overlay {
            if repository.mangas.isEmpty {
                ContentUnavailableView(
                    "漫画がありません",
                    systemImage: "book",
                    description: Text("右上の + から漫画を追加してください")
                )
            }
        }
        .alert("エラー", isPresented: errorAlertBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(repository.errorMessage ?? "")
        }
        .task {
            repository.startListening()
        }
        // 注: ここでは .onDisappear での stopListening() は行わない。
        // NavigationStack でこの画面から MangaDetailView へ遷移すると
        // 本画面にも onDisappear が発火するため、ここで止めてしまうと
        // 詳細画面表示中のFirestoreリアルタイム更新(MangaDetailView側の要件)が
        // 受け取れなくなってしまう。リスナーの解放は MangaRepository の
        // deinit（画面ツリーごと破棄されたタイミング）に委ねる。
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { repository.errorMessage != nil },
            set: { if !$0 { repository.errorMessage = nil } }
        )
    }

    private func volumeSummary(for manga: Manga) -> String {
        if let total = manga.totalVolumes {
            return "所有: \(manga.ownedVolumes.count)冊 / 全\(total)巻"
        }
        return "所有: \(manga.ownedVolumes.count)冊"
    }
}
