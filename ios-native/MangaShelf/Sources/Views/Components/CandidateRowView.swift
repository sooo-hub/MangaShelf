import SwiftUI

/// AniList検索結果1件分の行。Web版 `CandidateRow.tsx` に相当。
struct CandidateRowView: View {
    let item: MangaCandidate
    let alreadyAdded: Bool
    let onAdd: (MangaType, [UserName]) -> Void

    @State private var type: MangaType = .own
    @State private var wishUsers: [UserName] = []

    private var meta: String {
        [
            item.author,
            item.publisher,
            item.latestVolume > 0 ? "最新\(item.latestVolume)巻" : nil,
            item.status.isEmpty ? nil : item.status,
        ]
        .compactMap { $0 }
        .filter { !$0.isEmpty }
        .joined(separator: "  ・  ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.title)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Palette.slate800)
            if !meta.isEmpty {
                Text(meta)
                    .font(.system(size: 12))
                    .foregroundColor(Palette.slate500)
                    .padding(.bottom, 6)
            }

            if alreadyAdded {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark")
                    Text("追加済み")
                }
                .font(.system(size: 12))
                .foregroundColor(Palette.slate400)
            } else {
                TypeToggleView(type: $type)

                if type == .wish {
                    WishUserPickerView(selected: $wishUsers)
                        .padding(.top, 10)
                }

                let disabled = type == .wish && wishUsers.isEmpty
                Button {
                    onAdd(type, wishUsers)
                } label: {
                    Text(disabled ? "ユーザーを選んでください" : "追加")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(disabled ? Palette.slate400 : .white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(disabled ? Palette.slate200 : Palette.amber400)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .disabled(disabled)
                .padding(.top, type == .wish ? 4 : 10)
            }
        }
        .padding(14)
        .background(Palette.slate50)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Palette.slate200, lineWidth: 1)
        )
    }
}

/// 「持ってる / ほしい」切り替えセグメント。CandidateRow・ManualFormで共有する。
struct TypeToggleView: View {
    @Binding var type: MangaType

    var body: some View {
        HStack(spacing: 2) {
            segment(.own, systemName: "books.vertical.fill", label: "持ってる")
            segment(.wish, systemName: "cart.fill", label: "ほしい")
        }
        .padding(2)
        .background(Palette.slate200)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func segment(_ value: MangaType, systemName: String, label: String) -> some View {
        Button {
            type = value
        } label: {
            HStack(spacing: 4) {
                Image(systemName: systemName)
                Text(label)
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(type == value ? .white : Palette.slate600)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(type == value ? Palette.slate800 : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// 「誰が欲しい？」ユーザー選択(複数可)。CandidateRow・ManualForm・詳細画面で共有する。
struct WishUserPickerView: View {
    @Binding var selected: [UserName]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("誰が欲しい？")
                .font(.system(size: 11))
                .foregroundColor(Palette.slate500)
            HStack(spacing: 8) {
                ForEach(UserName.all) { user in
                    let sel = selected.contains(user)
                    let colors = Palette.userColors(user)
                    Button {
                        if sel {
                            selected.removeAll { $0 == user }
                        } else {
                            selected.append(user)
                        }
                    } label: {
                        Text(user.rawValue)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(sel ? colors.on : Palette.slate400)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(sel ? colors.bg : Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(sel ? colors.on : Palette.slate200, lineWidth: 2)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
