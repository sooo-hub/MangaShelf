import SwiftUI

private enum ShelfTab: Hashable {
    case own
    case wish
}

private enum WishUserFilter: Hashable {
    case all
    case user(UserName)
}

/// メイン画面。Web版 `App.tsx` に相当。
struct MangaShelfView: View {
    @EnvironmentObject private var repository: MangaRepository
    @EnvironmentObject private var userDisplayNames: UserDisplayNames

    @State private var tab: ShelfTab = .own
    @State private var search = ""
    @State private var userFilter: WishUserFilter = .all
    @State private var showAdd = false
    @State private var showSettings = false
    @State private var detailManga: Manga?
    @State private var bulkUpdating = false
    @State private var bulkStatus = ""
    @State private var bulkResult: BulkUpdateResult?
    @State private var showStorageModeSwitch = false
    @State private var showPasscodePrompt = false
    @State private var passcodeInput = ""

    var body: some View {
        VStack(spacing: 0) {
            headerView
            contentView
        }
        .background(Palette.bg.ignoresSafeArea())
        .sheet(isPresented: $showAdd) {
            AddMangaView(existingTitles: repository.mangas.map { $0.title })
                .environmentObject(repository)
                .environmentObject(userDisplayNames)
        }
        .sheet(item: $detailManga) { manga in
            MangaDetailView(manga: manga)
                .environmentObject(repository)
                .environmentObject(userDisplayNames)
        }
        .sheet(item: $bulkResult) { result in
            BulkUpdateResultView(result: result) { bulkResult = nil }
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(repository)
                .environmentObject(userDisplayNames)
        }
        .alert("合言葉", isPresented: $showPasscodePrompt) {
            TextField("合言葉", text: $passcodeInput)
            Button("確認") {
                let code = passcodeInput
                passcodeInput = ""
                Task {
                    if await PasscodeGate.verifyStorageModeSwitchPasscode(code) {
                        PasscodeStore.save(code)
                        await userDisplayNames.load()
                        showStorageModeSwitch = true
                    }
                }
            }
            Button("キャンセル", role: .cancel) {
                passcodeInput = ""
            }
        }
        .confirmationDialog(
            repository.mode == .local ? "サーバー同期モードに切り替えますか？" : "端末内保存モードに戻しますか？",
            isPresented: $showStorageModeSwitch,
            titleVisibility: .visible
        ) {
            Button(
                repository.mode == .local ? "サーバー同期に切り替える" : "端末内保存に戻す",
                role: .destructive
            ) {
                repository.switchStorageMode(to: repository.mode == .local ? .server : .local)
            }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text(
                repository.mode == .local
                    ? "現在: 端末内保存\n切り替えるとサーバー上の共有本棚（端末内のデータとは別物）が表示されます。"
                    : "現在: サーバー同期\n切り替えると端末内保存のデータに戻ります。"
            )
        }
    }

    // MARK: - Derived data

    private var ownCount: Int { repository.mangas.filter { $0.type == .own }.count }
    private var wishCount: Int { repository.mangas.filter { $0.type == .wish }.count }

    private var filtered: [Manga] {
        repository.mangas
            .filter { m in
                if tab == .own && m.type != .own { return false }
                if tab == .wish && m.type != .wish { return false }
                if !search.isEmpty {
                    let inTitle = m.title.contains(search)
                    let inSeries = (m.seriesName ?? "").contains(search)
                    if !inTitle && !inSeries { return false }
                }
                if tab == .wish, case .user(let u) = userFilter {
                    if !m.wishUsers.contains(u) { return false }
                }
                return true
            }
            .sorted { a, b in
                let sa = (a.seriesName?.isEmpty == false) ? a.seriesName! : a.title
                let sb = (b.seriesName?.isEmpty == false) ? b.seriesName! : b.title
                let locale = Locale(identifier: "ja")
                if sa != sb {
                    return sa.compare(sb, options: [], range: nil, locale: locale) == .orderedAscending
                }
                return a.title.compare(b.title, options: [], range: nil, locale: locale) == .orderedAscending
            }
    }

    private var rows: [ShelfRow] {
        ShelfRowBuilder.buildRows(from: filtered)
    }

    // MARK: - Header

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("MY MANGA SHELF")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1.5)
                            .foregroundColor(Palette.amber400)
                            .lineLimit(1)
                            .onLongPressGesture(minimumDuration: 2.0) {
                                passcodeInput = ""
                                showPasscodePrompt = true
                            }
                        if repository.mode == .server {
                            Text("サーバー同期中")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(Palette.green400)
                                .lineLimit(1)
                        }
                    }
                    HStack(spacing: 6) {
                        Image(systemName: "books.vertical.fill")
                        Text("本棚").lineLimit(1)
                    }
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundColor(.white)
                }
                Spacer(minLength: 8)
                HStack(spacing: 8) {
                    Button {
                        Task { await performBulkUpdate() }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.clockwise")
                            if !bulkUpdating { Text("一括更新").lineLimit(1) }
                        }
                        .fixedSize()
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(bulkUpdating ? Palette.slate500 : Palette.slate400)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(bulkUpdating ? Palette.slate700 : Color(hex: "0f172a"))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Palette.slate700, lineWidth: 1))
                    }
                    .disabled(bulkUpdating)

                    if repository.mode == .server {
                        Button {
                            showSettings = true
                        } label: {
                            Image(systemName: "gearshape.fill")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(Palette.slate400)
                                .padding(8)
                                .background(Color(hex: "0f172a"))
                                .clipShape(Circle())
                        }
                    }

                    Button {
                        showAdd = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                            Text("追加").lineLimit(1)
                        }
                        .fixedSize()
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.black)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Palette.amber400)
                        .clipShape(Capsule())
                    }
                }
                .fixedSize()
                .layoutPriority(1)
            }

            if !bulkStatus.isEmpty {
                Text(bulkStatus)
                    .font(.system(size: 11))
                    .foregroundColor(Palette.amber400)
            }

            ZStack(alignment: .leading) {
                if search.isEmpty {
                    HStack(spacing: 6) {
                        Image(systemName: "magnifyingglass")
                        Text("絞り込み...")
                    }
                    .foregroundColor(Palette.slate400)
                    .allowsHitTesting(false)
                }
                TextField("", text: $search)
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Palette.inputBg)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            tabBar

            if tab == .wish && repository.mode == .server {
                userFilterBar
                    .padding(.bottom, 4)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 18)
        .padding(.bottom, 4)
        .background(Palette.headerBg)
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabButton(.own, systemName: "books.vertical.fill", label: "所持 (\(ownCount))")
            tabButton(.wish, systemName: "cart.fill", label: "ほしい (\(wishCount))")
        }
    }

    private func tabButton(_ value: ShelfTab, systemName: String, label: String) -> some View {
        let selected = tab == value
        return Button {
            tab = value
        } label: {
            HStack(spacing: 4) {
                Image(systemName: systemName)
                Text(label)
            }
            .font(.system(size: 12, weight: selected ? .bold : .medium))
            .foregroundColor(selected ? Palette.amber400 : Palette.slate500)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .overlay(
                Rectangle()
                    .frame(height: 2)
                    .foregroundColor(selected ? Palette.amber400 : .clear),
                alignment: .bottom
            )
        }
        .buttonStyle(.plain)
    }

    private var userFilterBar: some View {
        HStack(spacing: 6) {
            filterChip(.all)
            ForEach(UserName.all) { filterChip(.user($0)) }
        }
    }

    private func filterChip(_ filter: WishUserFilter) -> some View {
        let selected = userFilter == filter
        let colors: (bg: Color, on: Color)
        if case .user(let u) = filter {
            colors = Palette.userColors(u)
        } else {
            colors = (Palette.slate200, Palette.slate800)
        }
        let label: String
        if case .user(let u) = filter {
            label = userDisplayNames.label(for: u)
        } else {
            label = "全員"
        }
        return Button {
            userFilter = filter
        } label: {
            Text(label)
                .font(.system(size: 12, weight: selected ? .bold : .medium))
                .foregroundColor(selected ? colors.on : Palette.slate400)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(selected ? colors.bg : Palette.inputBg)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Content

    @ViewBuilder
    private var contentView: some View {
        if repository.isLoading {
            VStack {
                Spacer()
                Text("読み込み中...")
                    .foregroundColor(Palette.slate400)
                Spacer()
            }
        } else if let error = repository.errorMessage, repository.mangas.isEmpty {
            VStack(spacing: 12) {
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(Palette.amber400)
                Text(error)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Palette.slate600)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Spacer()
            }
        } else if filtered.isEmpty {
            emptyStateView
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(rows) { row in
                        switch row.kind {
                        case .single(let manga):
                            MangaCardView(manga: manga) { detailManga = manga }
                        case .series(let name, let items):
                            SeriesGroupView(seriesName: name, items: items) { detailManga = $0 }
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 14)
                .padding(.bottom, 40)
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 8) {
            Spacer()
            Image(systemName: tab == .own ? "tray" : "cart.fill")
                .font(.system(size: 40))
                .foregroundColor(Palette.slate400)
            Text(search.isEmpty && userFilter == .all ? "まだ登録がありません" : "該当なし")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(Palette.slate400)
            if search.isEmpty && userFilter == .all {
                Text("「＋ 追加」から登録しましょう")
                    .font(.system(size: 12))
                    .foregroundColor(Palette.slate400)
            }
            Spacer()
        }
    }

    // MARK: - Bulk update

    private func performBulkUpdate() async {
        guard !bulkUpdating else { return }
        let targets = repository.mangas.filter { $0.status != MangaStatusOption.finished }
        guard !targets.isEmpty else {
            bulkStatus = "連載中の作品がありません"
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            bulkStatus = ""
            return
        }

        bulkUpdating = true
        var changed: [UpdatedItem] = []

        for (index, manga) in targets.enumerated() {
            bulkStatus = "(\(index + 1)/\(targets.count)) \(manga.title)..."
            let result = await RakutenBooksAPI.fetchLatestVolume(title: manga.title)
            let newVolume = result.latestVolume > 0 ? result.latestVolume : manga.latestVolume
            if result.latestVolume > 0 || !result.status.isEmpty {
                repository.updateMangaVolume(
                    id: manga.id,
                    latestVolume: newVolume,
                    status: result.status.isEmpty ? manga.status : result.status
                )
                if result.latestVolume > 0 && result.latestVolume != manga.latestVolume {
                    changed.append(UpdatedItem(title: manga.title, oldVolume: manga.latestVolume, newVolume: result.latestVolume))
                }
            }
            if index < targets.count - 1 {
                try? await Task.sleep(nanoseconds: 1_200_000_000)
            }
        }

        bulkUpdating = false
        bulkStatus = ""
        if !changed.isEmpty {
            bulkResult = BulkUpdateResult(items: changed)
        } else {
            bulkStatus = "更新なし（全て最新）"
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            bulkStatus = ""
        }
    }
}

#Preview {
    MangaShelfView().environmentObject(MangaRepository())
}
