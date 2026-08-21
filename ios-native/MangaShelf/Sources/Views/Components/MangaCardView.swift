import SwiftUI

/// 単独の漫画カード。Web版 `MangaCard.tsx` に相当。
struct MangaCardView: View {
    let manga: Manga
    let onTap: () -> Void

    private var owned: [Int] { manga.ownedVolumes }
    private var latest: Int { max(manga.latestVolume, 0) }
    private var isWish: Bool { manga.type == .wish }
    private var complete: Bool { latest > 0 && owned.count >= latest }
    private var pct: Double {
        guard latest > 0 else { return 0 }
        return min(1.0, Double(owned.count) / Double(latest))
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            if isWish {
                                badge(text: "🛒 ほしい", bg: Palette.yellow50, fg: Palette.yellow800)
                            } else {
                                badge(
                                    text: complete ? "✓ 全巻" : "📚 所持",
                                    bg: complete ? Palette.green100 : Palette.sky100,
                                    fg: complete ? Palette.green800 : Palette.sky700
                                )
                            }
                            if !manga.status.isEmpty {
                                Text(manga.status)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(manga.status == MangaStatusOption.finished ? Palette.green500 : Palette.amber400)
                            }
                            if !manga.genre.isEmpty {
                                Text(manga.genre)
                                    .font(.system(size: 10))
                                    .foregroundColor(Palette.slate400)
                            }
                        }
                        Text(manga.title)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(Palette.slate800)
                            .multilineTextAlignment(.leading)
                        if !manga.author.isEmpty {
                            Text(manga.author)
                                .font(.system(size: 11))
                                .foregroundColor(Palette.slate400)
                        }
                        if isWish {
                            UserBadgesView(users: manga.wishUsers)
                        }
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 2) {
                        if isWish {
                            Text("🛒").font(.system(size: 22))
                        } else {
                            HStack(alignment: .firstTextBaseline, spacing: 1) {
                                Text("\(owned.count)")
                                    .font(.system(size: 18, weight: .heavy))
                                    .foregroundColor(Palette.slate800)
                                Text("巻")
                                    .font(.system(size: 11))
                                    .foregroundColor(Palette.slate400)
                            }
                            if latest > 0 {
                                Text("/ \(latest)巻")
                                    .font(.system(size: 10))
                                    .foregroundColor(Palette.slate400)
                            }
                        }
                    }
                }
                if !isWish && latest > 0 {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.slate100)
                            Capsule()
                                .fill(complete ? Palette.green500 : Palette.amber400)
                                .frame(width: geo.size.width * pct)
                        }
                    }
                    .frame(height: 4)
                }
            }
            .padding(14)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isWish ? Color(hex: "fde68a") : Palette.slate100, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.07), radius: 4, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }

    private func badge(text: String, bg: Color, fg: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(fg)
            .padding(.horizontal, 8)
            .padding(.vertical, 1)
            .background(bg)
            .clipShape(Capsule())
    }
}
