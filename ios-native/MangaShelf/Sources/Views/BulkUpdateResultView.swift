import SwiftUI

/// 一括更新で変更があった1件分。
struct UpdatedItem: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let oldVolume: Int
    let newVolume: Int
}

/// `.sheet(item:)` 用のラッパー。
struct BulkUpdateResult: Identifiable {
    let id = UUID()
    let items: [UpdatedItem]
}

/// 一括更新の結果一覧。Web版 `BulkUpdateResultModal.tsx` に相当。
struct BulkUpdateResultView: View {
    let result: BulkUpdateResult
    let onClose: () -> Void

    private let pageSize = 5
    @State private var page = 0

    private var totalPages: Int { max(1, Int(ceil(Double(result.items.count) / Double(pageSize)))) }
    private var pageItems: [UpdatedItem] {
        let start = page * pageSize
        let end = min(start + pageSize, result.items.count)
        guard start < end else { return [] }
        return Array(result.items[start..<end])
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("🔄 一括更新完了")
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundColor(Palette.slate800)
                    Text("\(result.items.count)件の巻数が更新されました")
                        .font(.system(size: 12))
                        .foregroundColor(Palette.slate400)
                }
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .foregroundColor(Palette.slate400)
                }
            }

            VStack(spacing: 0) {
                ForEach(pageItems) { item in
                    HStack {
                        Text(item.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Palette.slate800)
                            .lineLimit(1)
                        Spacer(minLength: 12)
                        HStack(spacing: 4) {
                            Text("\(item.oldVolume)巻").foregroundColor(Palette.slate400)
                            Text("→").foregroundColor(Palette.slate400)
                            Text("\(item.newVolume)巻").fontWeight(.bold).foregroundColor(Palette.emerald600)
                        }
                        .font(.system(size: 13))
                    }
                    .padding(.vertical, 10)
                    Divider()
                }
            }

            if totalPages > 1 {
                HStack(spacing: 12) {
                    Spacer()
                    Button("◀") { page -= 1 }
                        .disabled(page == 0)
                    Text("\(page + 1) / \(totalPages)")
                        .font(.system(size: 12))
                        .foregroundColor(Palette.slate500)
                    Button("▶") { page += 1 }
                        .disabled(page == totalPages - 1)
                    Spacer()
                }
            }

            Button(action: onClose) {
                Text("閉じる")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Palette.slate800)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
    }
}
