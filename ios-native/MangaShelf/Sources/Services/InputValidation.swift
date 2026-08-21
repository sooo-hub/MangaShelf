import Foundation

/// タイトル・本棚名などのテキスト入力に対する共通バリデーション。
///
/// 空白/改行のみの入力を「未入力」とみなすため、複数画面(AddMangaView, ShelfListView 等)で
/// 判定ロジックが重複しないよう純粋関数として切り出している。
enum InputValidation {
    /// 空文字、または空白・改行のみで構成された文字列かどうかを判定する。
    static func isBlank(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
