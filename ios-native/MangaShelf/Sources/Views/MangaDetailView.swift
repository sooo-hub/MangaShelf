import SwiftUI

/// 漫画タイトルの詳細/編集画面。
struct MangaDetailView: View {
    @ObservedObject var repository: MangaRepository
    @State var manga: Manga

    @State private var ownedVolumesText: String
    @State private var totalVolumesText: String
    /// 画面表示・編集開始時点で把握している対象ドキュメントの updatedAt。
    /// Firestoreから来た最新値がこれより新しい場合のみ、対象ドキュメント自体が
    /// リモートで更新されたとみなして画面Stateを上書きする。
    @State private var knownUpdatedAt: Date

    init(repository: MangaRepository, manga: Manga) {
        self.repository = repository
        _manga = State(initialValue: manga)
        _ownedVolumesText = State(initialValue: manga.ownedVolumes.map(String.init).joined(separator: ","))
        _totalVolumesText = State(initialValue: manga.totalVolumes.map(String.init) ?? "")
        _knownUpdatedAt = State(initialValue: manga.updatedAt)
    }

    var body: some View {
        Form {
            Section("タイトル") {
                TextField("タイトル", text: $manga.title)
            }
            Section("所有巻数") {
                TextField("例: 1,2,3", text: $ownedVolumesText)
                    .keyboardType(.numbersAndPunctuation)
                TextField("全巻数（任意）", text: $totalVolumesText)
                    .keyboardType(.numberPad)
            }
            Section("メモ") {
                TextField("メモ", text: $manga.memo, axis: .vertical)
            }
        }
        .navigationTitle(manga.title)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("保存") { save() }
            }
        }
        .alert("エラー", isPresented: errorAlertBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(repository.errorMessage ?? "")
        }
        // repository.mangas はFirestoreのリアルタイム更新(他端末での変更含む)を反映するため、
        // 表示中の manga.id に一致する最新データが来たら画面のStateも追従させる。
        // ただし、同じ本棚内の別ドキュメントが追加/編集/削除されただけでも配列全体の
        // 参照が変わり onChange が発火してしまう。対象ドキュメント自体が変化していないのに
        // 上書きすると編集中の未保存入力(タイトル/巻数/メモ)が消えてしまうため、
        // Firestoreから来た最新値の updatedAt が knownUpdatedAt より新しい場合、
        // つまり対象ドキュメント自体が実際にリモート更新された場合のみ上書きする
        // (シンプルなアプリのため「後勝ち(last-write-wins)」の方針とする)。
        .onChange(of: repository.mangas) { _, newMangas in
            guard let latest = MangaDetailSyncLogic.remoteUpdate(
                from: newMangas,
                matching: manga.id,
                knownUpdatedAt: knownUpdatedAt
            ) else { return }
            manga = latest
            ownedVolumesText = latest.ownedVolumes.map(String.init).joined(separator: ",")
            totalVolumesText = latest.totalVolumes.map(String.init) ?? ""
            knownUpdatedAt = latest.updatedAt
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { repository.errorMessage != nil },
            set: { if !$0 { repository.errorMessage = nil } }
        )
    }

    private func save() {
        manga.ownedVolumes = ownedVolumesText
            .split(separator: ",")
            .compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        manga.totalVolumes = Int(totalVolumesText)
        repository.updateManga(manga)
    }
}
