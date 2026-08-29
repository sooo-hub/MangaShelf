import SwiftUI

/// 漫画追加シート。Web版 `AddModal.tsx` に相当。
struct AddMangaView: View {
    @EnvironmentObject private var repository: MangaRepository
    @Environment(\.dismiss) private var dismiss

    let existingTitles: [String]

    @State private var query = ""
    @State private var searching = false
    @State private var statusMsg = ""
    @State private var candidates: [MangaCandidate] = []
    @State private var errorMessage = ""
    @State private var showManual = false
    @FocusState private var searchFieldFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    searchBar

                    if searching {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text(statusMsg.isEmpty ? "検索中..." : statusMsg)
                                .font(.system(size: 12))
                                .foregroundColor(Palette.slate500)
                        }
                    }

                    if !errorMessage.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(errorMessage)
                                .font(.system(size: 13))
                                .foregroundColor(Palette.red500)
                            if !showManual {
                                manualEntryButton(label: "手動で入力する", filled: true)
                            }
                        }
                    }

                    if showManual {
                        ManualFormView(
                            initialTitle: query,
                            onAdd: { item in
                                addManual(item)
                            },
                            onCancel: { showManual = false }
                        )
                    }

                    if !showManual {
                        ForEach(candidates) { candidate in
                            CandidateRowView(
                                item: candidate,
                                alreadyAdded: existingTitles.contains(candidate.title),
                                onAdd: { type, wishUsers in
                                    addCandidate(candidate, type: type, wishUsers: wishUsers)
                                }
                            )
                        }
                    }

                    if !showManual && !searching && errorMessage.isEmpty && candidates.isEmpty && !query.isEmpty {
                        HStack {
                            Spacer()
                            manualEntryButton(label: "手動で入力する", filled: false)
                            Spacer()
                        }
                    }

                    if !showManual && errorMessage.isEmpty && !searching && candidates.isEmpty && query.isEmpty {
                        HStack {
                            Spacer()
                            manualEntryButton(label: "検索せずに手動入力", filled: true)
                            Spacer()
                        }
                        .padding(.top, 8)
                    }
                }
                .padding(20)
            }
            .background(Color.white)
            .navigationTitle("漫画を追加")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundColor(Palette.slate400)
                    }
                }
            }
        }
        .task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            searchFieldFocused = true
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            TextField("タイトルを入力...", text: $query)
                .foregroundColor(Palette.slate800)
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                )
                .focused($searchFieldFocused)
                .onSubmit { Task { await doSearch() } }

            Button {
                Task { await doSearch() }
            } label: {
                Text(searching ? "…" : "検索")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(searching ? Palette.slate400 : Palette.slate800)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(searching)
        }
    }

    private func manualEntryButton(label: String, filled: Bool) -> some View {
        Button {
            showManual = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "pencil")
                Text(label)
            }
            .font(.system(size: 13, weight: filled ? .semibold : .regular))
            .foregroundColor(filled ? Palette.slate800 : Palette.slate400)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(filled ? Palette.slate50 : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                filled ? RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Palette.slate200, lineWidth: 1) : nil
            )
        }
        .buttonStyle(.plain)
    }

    private func doSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        searching = true
        errorMessage = ""
        candidates = []
        showManual = false
        statusMsg = "検索中..."
        do {
            let results = try await AniListService.searchManga(title: trimmed)
            candidates = results
            if results.isEmpty {
                errorMessage = "見つかりませんでした"
            }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "検索エラー"
        }
        searching = false
        statusMsg = ""
    }

    private func addCandidate(_ candidate: MangaCandidate, type: MangaType, wishUsers: [UserName]) {
        repository.addManga(
            title: candidate.title,
            author: candidate.author,
            publisher: candidate.publisher,
            latestVolume: candidate.latestVolume,
            genre: candidate.genre,
            status: candidate.status,
            type: type,
            wishUsers: wishUsers,
            seriesName: nil,
            parts: []
        )
        dismiss()
    }

    private func addManual(_ item: ManualFormItem) {
        repository.addManga(
            title: item.title,
            author: item.author,
            publisher: "",
            latestVolume: item.latestVolume,
            genre: item.genre,
            status: item.status,
            type: item.type,
            wishUsers: item.wishUsers,
            seriesName: item.seriesName.isEmpty ? nil : item.seriesName,
            parts: []
        )
        dismiss()
    }
}
