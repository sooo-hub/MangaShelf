import SwiftUI

extension Color {
    /// `"1e293b"` や `"#1e293b"` のような16進数文字列からColorを生成する。
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        var rgbValue: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255
        let b = Double(rgbValue & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Web版のTailwind色をそのままSwiftUIへ移植したパレット。
enum Palette {
    static let bg = Color(hex: "f1f5f9")            // slate-100 (画面背景)
    static let headerBg = Color(hex: "1e293b")       // slate-800 (ヘッダー/シリーズグループ)
    static let inputBg = Color(hex: "334155")        // slate-700 (ヘッダー内の検索欄など)

    static let slate50 = Color(hex: "f8fafc")
    static let slate100 = Color(hex: "f1f5f9")
    static let slate200 = Color(hex: "e2e8f0")
    static let slate300 = Color(hex: "cbd5e1")
    static let slate400 = Color(hex: "94a3b8")
    static let slate500 = Color(hex: "64748b")
    static let slate600 = Color(hex: "475569")
    static let slate700 = Color(hex: "334155")
    static let slate800 = Color(hex: "1e293b")

    static let amber400 = Color(hex: "f59e0b")

    static let yellow50 = Color(hex: "fefce8")
    static let yellow800 = Color(hex: "854d0e")

    static let green400 = Color(hex: "4ade80")
    static let green500 = Color(hex: "22c55e")
    static let green600 = Color(hex: "16a34a")
    static let green300 = Color(hex: "86efac")
    static let emerald600 = Color(hex: "059669")
    static let green100 = Color(hex: "dcfce7")
    static let green50 = Color(hex: "f0fdf4")
    static let green800 = Color(hex: "166534")

    static let sky700 = Color(hex: "0369a1")
    static let sky100 = Color(hex: "e0f2fe")

    static let blue100 = Color(hex: "dbeafe")
    static let blue700 = Color(hex: "1d4ed8")
    static let blue600 = Color(hex: "2563eb")
    static let blue200 = Color(hex: "bfdbfe")

    static let pink100 = Color(hex: "fce7f3")
    static let pink700 = Color(hex: "be185d")

    static let red500 = Color(hex: "ef4444")
    static let red100 = Color(hex: "fee2e2")

    /// ユーザーごとの配色 (爽=青系, 杏=ピンク系)。
    static func userColors(_ user: UserName) -> (bg: Color, on: Color) {
        switch user {
        case .sou: return (blue100, blue700)
        case .an: return (pink100, pink700)
        }
    }
}
