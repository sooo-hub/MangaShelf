import SwiftUI

/// `seriesName` が同じ漫画をまとめる折り畳み可能なグループ。Web版 `SeriesGroup.tsx` に相当。
struct SeriesGroupView: View {
    let seriesName: String
    let items: [Manga]
    let onTap: (Manga) -> Void

    @State private var open = false

    private var totalOwned: Int { items.reduce(0) { $0 + $1.ownedVolumes.count } }
    private var totalLatest: Int { items.reduce(0) { $0 + max($1.latestVolume, 0) } }
    private var allComplete: Bool {
        items.allSatisfy { m in
            let l = max(m.latestVolume, 0)
            return l > 0 && m.ownedVolumes.count >= l
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            headerView
            if open {
                expandedView
            }
        }
        .padding(.bottom, 10)
    }

    private var headerView: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) { open.toggle() }
        } label: {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text("シリーズ")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Palette.slate400)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 1)
                            .background(Palette.slate700)
                            .clipShape(Capsule())
                        if allComplete {
                            Text("✓ 全部揃い")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(Palette.green400)
                        }
                    }
                    Text(seriesName)
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundColor(.white)
                    Text("\(items.count)作品")
                        .font(.system(size: 11))
                        .foregroundColor(Palette.slate500)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    if totalLatest > 0 {
                        HStack(alignment: .firstTextBaseline, spacing: 1) {
                            Text("\(totalOwned)")
                                .font(.system(size: 18, weight: .heavy))
                                .foregroundColor(.white)
                            Text("巻")
                                .font(.system(size: 11))
                                .foregroundColor(Palette.slate500)
                        }
                        Text("/ \(totalLatest)巻")
                            .font(.system(size: 10))
                            .foregroundColor(Palette.slate500)
                    }
                    Text(open ? "▲" : "▼")
                        .font(.system(size: 14))
                        .foregroundColor(Palette.slate400)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Palette.headerBg)
            .clipShape(
                .rect(
                    topLeadingRadius: 14,
                    bottomLeadingRadius: open ? 0 : 14,
                    bottomTrailingRadius: open ? 0 : 14,
                    topTrailingRadius: 14
                )
            )
        }
        .buttonStyle(.plain)
    }

    private var expandedView: some View {
        VStack(spacing: 6) {
            ForEach(items) { m in
                seriesItemRow(m)
            }
        }
        .padding(8)
        .background(Palette.slate50)
        .overlay(
            RoundedRectangle(cornerRadius: 0)
                .stroke(Palette.slate200, lineWidth: 1)
        )
        .clipShape(.rect(bottomLeadingRadius: 14, bottomTrailingRadius: 14))
    }

    private func seriesItemRow(_ m: Manga) -> some View {
        let latest = max(m.latestVolume, 0)
        let owned = m.ownedVolumes.count
        let pct = latest > 0 ? min(1.0, Double(owned) / Double(latest)) : 0
        let complete = latest > 0 && owned >= latest

        return Button {
            onTap(m)
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        if !m.status.isEmpty {
                            Text(m.status)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(m.status == MangaStatusOption.finished ? Palette.green500 : Palette.amber400)
                        }
                        if !m.genre.isEmpty {
                            Text(m.genre)
                                .font(.system(size: 10))
                                .foregroundColor(Palette.slate400)
                        }
                    }
                    Text(m.title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Palette.slate800)
                        .multilineTextAlignment(.leading)
                    if latest > 0 {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Palette.slate200)
                                Capsule()
                                    .fill(complete ? Palette.green500 : Palette.amber400)
                                    .frame(width: geo.size.width * pct)
                            }
                        }
                        .frame(height: 2)
                    }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 1) {
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text("\(owned)")
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundColor(Palette.slate800)
                        Text("巻")
                            .font(.system(size: 10))
                            .foregroundColor(Palette.slate400)
                    }
                    if latest > 0 {
                        Text("/ \(latest)巻")
                            .font(.system(size: 10))
                            .foregroundColor(Palette.slate400)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Palette.slate50, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
