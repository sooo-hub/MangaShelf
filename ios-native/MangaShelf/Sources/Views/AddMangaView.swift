import SwiftUI

/// 漫画タイトルの追加画面。
struct AddMangaView: View {
    @ObservedObject var repository: MangaRepository
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var ownedVolumesText = ""
    @State private var totalVolumesText = ""
    @State private var memo = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("タイトル") {
                    TextField("例: ワンピース", text: $title)
                }
                Section("所有巻数") {
                    TextField("例: 1,2,3", text: $ownedVolumesText)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("全巻数（任意）", text: $totalVolumesText)
                        .keyboardType(.numberPad)
                }
                Section("メモ") {
                    TextField("メモ", text: $memo, axis: .vertical)
                }
            }
            .navigationTitle("漫画を追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(InputValidation.isBlank(title))
                }
            }
            .alert("エラー", isPresented: errorAlertBinding) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(repository.errorMessage ?? "")
            }
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { repository.errorMessage != nil },
            set: { if !$0 { repository.errorMessage = nil } }
        )
    }

    private func save() {
        guard !InputValidation.isBlank(title) else { return }
        let owned = ownedVolumesText
            .split(separator: ",")
            .compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        let total = Int(totalVolumesText)
        repository.addManga(title: title, ownedVolumes: owned, totalVolumes: total, memo: memo)
        dismiss()
    }
}
