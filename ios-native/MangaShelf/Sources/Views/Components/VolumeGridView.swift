import SwiftUI

/// 巻数選択グリッド。Web版 `VolumeGrid.tsx` に相当。
/// `parts` が設定されている場合はセクション分割して表示する。
struct VolumeGridView: View {
    let latest: Int
    @Binding var owned: [Int]
    let parts: [MangaPart]

    private struct Section: Identifiable {
        let id: String
        let label: String?
        let vols: [Int]
    }

    private var total: Int {
        max(max(latest, 0), owned.max() ?? 0)
    }

    private var vols: [Int] {
        total > 0 ? Array(1...total) : []
    }

    private var allOwned: Bool {
        !vols.isEmpty && vols.allSatisfy { owned.contains($0) }
    }

    private var sections: [Section] {
        guard !parts.isEmpty else {
            return [Section(id: "all", label: nil, vols: vols)]
        }
        var covered = Set<Int>()
        var result: [Section] = []
        let sorted = parts.sorted { (Int($0.from) ?? 1) < (Int($1.from) ?? 1) }
        for p in sorted {
            let from = Int(p.from) ?? 1
            let to = min(Int(p.to) ?? total, total)
            guard to >= from else { continue }
            let partVols = Array(from...to)
            result.append(Section(id: "part-\(p.id)", label: p.name, vols: partVols))
            partVols.forEach { covered.insert($0) }
        }
        let uncovered = vols.filter { !covered.contains($0) }
        if !uncovered.isEmpty {
            result.append(Section(id: "other", label: "その他", vols: uncovered))
        }
        return result
    }

    var body: some View {
        if total == 0 {
            Text("最新巻数が未登録です")
                .font(.system(size: 13))
                .foregroundColor(Palette.slate400)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("\(owned.count) / \(total)巻 所持")
                        .font(.system(size: 12))
                        .foregroundColor(Palette.slate500)
                    Spacer()
                    smallButton(allOwned ? "全解除" : "全選択") {
                        owned = allOwned ? [] : vols
                    }
                }

                ForEach(sections) { sec in
                    sectionView(sec)
                }
            }
        }
    }

    private func sectionView(_ sec: Section) -> some View {
        let secOwnedCount = sec.vols.filter { owned.contains($0) }.count
        let secAll = !sec.vols.isEmpty && sec.vols.allSatisfy { owned.contains($0) }

        return VStack(alignment: .leading, spacing: 8) {
            if let label = sec.label {
                HStack {
                    Text(label)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Palette.slate600)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 1)
                        .background(Palette.slate200)
                        .clipShape(Capsule())
                    Spacer()
                    Text("\(secOwnedCount)/\(sec.vols.count)")
                        .font(.system(size: 11))
                        .foregroundColor(Palette.slate400)
                    smallButton(secAll ? "解除" : "全選択") {
                        if secAll {
                            owned.removeAll { sec.vols.contains($0) }
                        } else {
                            var set = Set(owned)
                            sec.vols.forEach { set.insert($0) }
                            owned = set.sorted()
                        }
                    }
                }
            }
            volumeFlow(sec.vols)
        }
    }

    private func volumeFlow(_ volumeList: [Int]) -> some View {
        let columns = [GridItem(.adaptive(minimum: 42, maximum: 42), spacing: 8)]
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(volumeList, id: \.self) { v in
                let has = owned.contains(v)
                Button {
                    toggle(v)
                } label: {
                    Text("\(v)")
                        .font(.system(size: 13, weight: has ? .bold : .regular))
                        .foregroundColor(has ? .white : Palette.slate400)
                        .frame(width: 42, height: 42)
                        .background(has ? Palette.slate800 : Palette.slate100)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func toggle(_ v: Int) {
        if let idx = owned.firstIndex(of: v) {
            owned.remove(at: idx)
        } else {
            owned.append(v)
            owned.sort()
        }
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11))
                .foregroundColor(Palette.blue600)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.white)
                .overlay(
                    Capsule().stroke(Palette.blue200, lineWidth: 1)
                )
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
