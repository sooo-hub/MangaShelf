import SwiftUI

/// 手動入力フォーム。Web版 `ManualForm.tsx` に相当。
struct ManualFormItem {
    var title: String
    var author: String
    var seriesName: String
    var latestVolume: Int
    var genre: String
    var status: String
    var type: MangaType
    var wishUsers: [UserName]
}

struct ManualFormView: View {
    let initialTitle: String
    let onAdd: (ManualFormItem) -> Void
    let onCancel: () -> Void

    @State private var title: String
    @State private var author = ""
    @State private var seriesName = ""
    @State private var latestVolumeText = ""
    @State private var genre = ""
    @State private var status = MangaStatusOption.releasing
    @State private var type: MangaType = .own
    @State private var wishUsers: [UserName] = []

    init(initialTitle: String = "", onAdd: @escaping (ManualFormItem) -> Void, onCancel: @escaping () -> Void) {
        self.initialTitle = initialTitle
        self.onAdd = onAdd
        self.onCancel = onCancel
        _title = State(initialValue: initialTitle)
    }

    private var disabled: Bool {
        InputValidation.isBlank(title) || (type == .wish && wishUsers.isEmpty)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("手動で入力")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(Palette.slate800)

            VStack(spacing: 10) {
                textField("タイトル（例: ジョジョ 第1部）*", text: $title)
                textField("著者名", text: $author)
                textField("シリーズ名（例: ジョジョの奇妙な冒険）任意", text: $seriesName)

                HStack(spacing: 8) {
                    TextField("最新巻数", text: $latestVolumeText)
                        .keyboardType(.numberPad)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Palette.slate50)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                        )

                    Picker("連載状況", selection: $status) {
                        ForEach(MangaStatusOption.all, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Palette.slate50)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                    )
                }

                Picker("ジャンル", selection: $genre) {
                    Text("ジャンル（任意）").tag("")
                    ForEach(GenreOption.all, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Palette.slate50)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
                )
            }

            TypeToggleView(type: $type)

            if type == .wish {
                WishUserPickerView(selected: $wishUsers)
            }

            HStack(spacing: 8) {
                Button(action: onCancel) {
                    Text("キャンセル")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Palette.slate500)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Palette.slate100)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    onAdd(
                        ManualFormItem(
                            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                            author: author,
                            seriesName: seriesName.trimmingCharacters(in: .whitespacesAndNewlines),
                            latestVolume: Int(latestVolumeText) ?? 0,
                            genre: genre,
                            status: status,
                            type: type,
                            wishUsers: type == .wish ? wishUsers : []
                        )
                    )
                } label: {
                    Text("追加")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(disabled ? Palette.slate400 : .white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(disabled ? Palette.slate200 : Palette.slate800)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .frame(maxWidth: .infinity)
                .layoutPriority(1)
            }
        }
        .padding(16)
        .background(Palette.slate50)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
        )
    }

    private func textField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Palette.slate50)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Palette.slate200, lineWidth: 1)
            )
    }
}
