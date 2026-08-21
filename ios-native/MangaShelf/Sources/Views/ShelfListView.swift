import SwiftUI

/// 本棚一覧画面。
struct ShelfListView: View {
    @EnvironmentObject private var authService: AuthService
    @StateObject private var repository = ShelfRepository()
    @State private var isPresentingAddShelf = false
    @State private var newShelfName = ""

    var body: some View {
        NavigationStack {
            List {
                ForEach(repository.shelves) { shelf in
                    NavigationLink(value: shelf) {
                        Text(shelf.name)
                    }
                }
                .onDelete { indexSet in
                    indexSet.map { repository.shelves[$0] }.forEach(repository.deleteShelf)
                }
            }
            .navigationTitle("本棚")
            .navigationDestination(for: Shelf.self) { shelf in
                MangaListView(shelf: shelf)
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isPresentingAddShelf = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("ログアウト") {
                        authService.signOut()
                    }
                }
            }
            .alert("本棚を追加", isPresented: $isPresentingAddShelf) {
                TextField("本棚の名前", text: $newShelfName)
                Button("追加") {
                    guard !InputValidation.isBlank(newShelfName) else { return }
                    repository.addShelf(name: newShelfName)
                    newShelfName = ""
                }
                Button("キャンセル", role: .cancel) {}
            }
            .overlay {
                if repository.shelves.isEmpty {
                    ContentUnavailableView(
                        "本棚がありません",
                        systemImage: "books.vertical",
                        description: Text("右上の + から本棚を追加してください")
                    )
                }
            }
            .alert("エラー", isPresented: errorAlertBinding) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(repository.errorMessage ?? "")
            }
            .task {
                repository.startListening()
            }
            .onDisappear {
                repository.stopListening()
            }
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { repository.errorMessage != nil },
            set: { if !$0 { repository.errorMessage = nil } }
        )
    }
}

#Preview {
    ShelfListView()
        .environmentObject(AuthService())
}
