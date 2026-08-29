import SwiftUI

/// 設定画面。保存先の確認と、サーバー同期モード時のみ「誰が欲しい？」の表示名を編集できる。
struct SettingsView: View {
    @EnvironmentObject private var repository: MangaRepository
    @EnvironmentObject private var userDisplayNames: UserDisplayNames
    @Environment(\.dismiss) private var dismiss

    @State private var nameA = ""
    @State private var nameB = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("保存先") {
                    Text(repository.mode == .server ? "サーバー同期" : "端末内保存")
                        .foregroundColor(Palette.slate600)
                }

                if repository.mode == .server {
                    Section("「誰が欲しい？」の表示名") {
                        TextField(UserDisplayNames.defaultA, text: $nameA)
                        TextField(UserDisplayNames.defaultB, text: $nameB)
                    }
                }
            }
            .navigationTitle("設定")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("閉じる") {
                        if repository.mode == .server {
                            userDisplayNames.save(nameA: nameA, nameB: nameB)
                        }
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            nameA = userDisplayNames.nameA
            nameB = userDisplayNames.nameB
        }
    }
}
