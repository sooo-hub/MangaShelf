import SwiftUI

/// 漫画詳細/編集シート。Web版 `DetailModal.tsx` に相当。
struct MangaDetailView: View {
    @EnvironmentObject private var repository: MangaRepository
    @Environment(\.dismiss) private var dismiss

    private let originalId: String
    @State private var current: Manga
    /// 直近で画面が把握している対象ドキュメントの `updatedAt`。
    /// 「対象ドキュメント自体が更新された場合のみ上書きする」判定 (`MangaDetailSyncLogic`) に使う。
    @State private var knownUpdatedAt: Int

    @State private var owned: [Int]
    @State private var wishUsers: [UserName]
    @State private var latestVolume: Int
    @State private var status: String
    @State private var seriesName: String
    @State private var parts: [MangaPart]

    @State private var fetching = false
    @State private var fetchMsg = ""
    @State private var confirmDelete = false

    init(manga: Manga) {
        self.originalId = manga.id
        _current = State(initialValue: manga)
        _knownUpdatedAt = State(initialValue: manga.updatedAt ?? Int.min)
        _owned = State(initialValue: manga.ownedVolumes)
        _wishUsers = State(initialValue: manga.wishUsers)
        _latestVolume = State(initialValue: manga.latestVolume)
        _status = State(initialValue: manga.status)
        _seriesName = State(initialValue: manga.seriesName ?? "")
        _parts = State(initialValue: manga.parts ?? [])
    }

    private var isWish: Bool { current.type == .wish }

    private var meta: String {
        [
            current.author,
            current.publisher,
            latestVolume > 0 ? "最新\(latestVolume)巻" : nil,
            status.isEmpty ? nil : status,
        ]
        .compactMap { $0 }
        .filter { !$0.isEmpty }
        .joined(separator: "  ・  ")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerSection

                    seriesSection

                    if isWish {
                        wishSection
                    } else {
                        ownedSection
                    }

                    actionButtons
                }
                .padding(20)
            }
            .background(Color.white)
            .navigationTitle(current.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").foregroundColor(Palette.slate400)
                    }
                }
            }
        }
        .onChange(of: repository.mangas) { _, newValue in
            applyRemoteUpdateIfNeeded(newValue)
        }
    }

    private func applyRemoteUpdateIfNeeded(_ mangas: [Manga]) {
        guard let updated = MangaDetailSyncLogic.remoteUpdate(
            from: mangas,
            matching: originalId,
            knownUpdatedAt: knownUpdatedAt
        ) else { return }

        current = updated
        knownUpdatedAt = updated.updatedAt ?? knownUpdatedAt
        owned = updated.ownedVolumes
        wishUsers = updated.wishUsers
        latestVolume = updated.latestVolume
        status = updated.status
        seriesName = updated.seriesName ?? ""
        parts = updated.parts ?? []
    }

    // MARK: - Sections

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !meta.isEmpty {
                Text(meta)
                    .font(.system(size: 12))
                    .foregroundColor(Palette.slate400)
            }

            HStack(spacing: 8) {
                Button {
                    Task { await handleFetchLatest() }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: fetching ? "magnifyingglass" : "arrow.clockwise")
                        Text(fetching ? "取得中..." : "最新刊を確認")
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(fetching ? Palette.slate400 : Palette.sky700)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(fetching ? Palette.slate100 : Palette.sky100)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .disabled(fetching)

                Text("手動:")
                    .font(.system(size: 11))
                    .foregroundColor(Palette.slate400)

                TextField("巻", value: $latestVolume, format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                    .foregroundColor(Palette.slate800)
                    .frame(width: 60)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                    )

                Picker("状況", selection: $status) {
                    ForEach(MangaStatusOption.all, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
            }

            if !fetchMsg.isEmpty {
                Text(fetchMsg)
                    .font(.system(size: 11))
                    .foregroundColor(Palette.slate500)
            }
        }
    }

    private var seriesSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("シリーズ名（任意）")
                .font(.system(size: 12))
                .foregroundColor(Palette.slate500)
            TextField("例: ジョジョの奇妙な冒険", text: $seriesName)
                .foregroundColor(Palette.slate800)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Palette.slate50)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                )
        }
    }

    private var wishSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if repository.mode == .server {
                WishUserPickerView(selected: $wishUsers)
            }

            Button {
                handleMoveToOwned()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "books.vertical.fill")
                    Text("買った！持っているに移動")
                }
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(Palette.green600)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(hex: "f0fdf4"))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.green300, lineWidth: 2)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var ownedSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("所持している巻をタップ")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(Palette.slate800)

            VolumeGridView(latest: latestVolume, owned: $owned, parts: parts)

            partsEditor
        }
    }

    private var partsEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("部・章の設定（任意）")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(Palette.slate500)
                Spacer()
                Button {
                    parts.append(MangaPart(id: MangaRepository.nowEpochMillis(), name: "", from: "", to: ""))
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "plus")
                        Text("追加")
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Palette.slate600)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Palette.slate100)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }

            ForEach($parts) { $part in
                HStack(spacing: 6) {
                    TextField("第1部", text: $part.name)
                        .foregroundColor(Palette.slate800)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 8)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Palette.slate200, lineWidth: 1))

                    TextField("1", text: $part.from)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .foregroundColor(Palette.slate800)
                        .frame(width: 44)
                        .padding(.vertical, 8)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Palette.slate200, lineWidth: 1))

                    Text("〜").font(.system(size: 12)).foregroundColor(Palette.slate400)

                    TextField("5", text: $part.to)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .foregroundColor(Palette.slate800)
                        .frame(width: 44)
                        .padding(.vertical, 8)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Palette.slate200, lineWidth: 1))

                    Text("巻").font(.system(size: 11)).foregroundColor(Palette.slate400)

                    Button {
                        parts.removeAll { $0.id == part.id }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Palette.red500)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 8) {
            Button {
                handleSave()
            } label: {
                Text("保存")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Palette.slate800)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)

            if confirmDelete {
                Button {
                    repository.deleteManga(current.id)
                    dismiss()
                } label: {
                    Text("本当に削除")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Palette.red500)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    confirmDelete = false
                } label: {
                    Text("キャンセル")
                        .font(.system(size: 13))
                        .foregroundColor(Palette.slate500)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Palette.slate100)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                Button {
                    confirmDelete = true
                } label: {
                    Text("削除")
                        .font(.system(size: 13))
                        .foregroundColor(Palette.red500)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .background(Palette.red100)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Actions

    private func handleFetchLatest() async {
        fetching = true
        fetchMsg = "検索中..."
        let result = await RakutenBooksAPI.fetchLatestVolume(title: current.title)
        if result.latestVolume > 0 { latestVolume = result.latestVolume }
        if !result.status.isEmpty { status = result.status }
        if result.latestVolume > 0 {
            fetchMsg = "最新\(result.latestVolume)巻 / \(result.status)"
        } else if !result.status.isEmpty {
            fetchMsg = "\(result.status)（巻数はAniListに未登録 - 手動で入力してください）"
        } else {
            fetchMsg = "取得できませんでした"
        }
        fetching = false
    }

    private func handleMoveToOwned() {
        var updated = current
        updated.type = .own
        updated.wishUsers = []
        updated.ownedVolumes = []
        repository.saveManga(updated)
        dismiss()
    }

    private func handleSave() {
        var updated = current
        updated.latestVolume = latestVolume
        updated.status = status
        let trimmedSeries = seriesName.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.seriesName = trimmedSeries.isEmpty ? nil : trimmedSeries
        updated.parts = parts.isEmpty ? nil : parts
        updated.ownedVolumes = isWish ? [] : owned
        updated.wishUsers = isWish ? wishUsers : []
        repository.saveManga(updated)
        dismiss()
    }
}
