import SwiftUI

/// `wishUsers` を丸バッジで並べて表示する。Web版 `UserBadges.tsx` に相当。
struct UserBadgesView: View {
    @EnvironmentObject private var userDisplayNames: UserDisplayNames
    let users: [UserName]

    var body: some View {
        if !users.isEmpty {
            HStack(spacing: 4) {
                ForEach(users) { user in
                    let colors = Palette.userColors(user)
                    Text(userDisplayNames.label(for: user))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(colors.on)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 1)
                        .background(colors.bg)
                        .clipShape(Capsule())
                }
            }
        }
    }
}
