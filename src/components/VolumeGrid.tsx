import type { MangaPart } from "../types/manga";

interface Section {
  label: string | null;
  vols: number[];
}

interface Props {
  latest: number;
  owned: number[];
  onChange: (vols: number[]) => void;
  parts?: MangaPart[];
}

export function VolumeGrid({ latest, owned, onChange, parts }: Props) {
  const total = Math.max(latest || 0, owned.length > 0 ? Math.max(...owned) : 0);

  if (total === 0) {
    return (
      <div className="text-slate-400 text-[13px] text-center py-4">最新巻数が未登録です</div>
    );
  }

  const vols = Array.from({ length: total }, (_, i) => i + 1);
  const toggle = (v: number) => {
    const next = owned.includes(v) ? owned.filter((x) => x !== v) : [...owned, v].sort((a, b) => a - b);
    onChange(next);
  };
  const allOwned = vols.every((v) => owned.includes(v));

  const sections: Section[] = (() => {
    if (!parts || parts.length === 0) return [{ label: null, vols }];
    const covered = new Set<number>();
    const result: Section[] = [];
    const sorted = [...parts].sort((a, b) => (parseInt(a.from) || 1) - (parseInt(b.from) || 1));
    sorted.forEach((p) => {
      const from = parseInt(p.from) || 1;
      const to = Math.min(parseInt(p.to) || total, total);
      result.push({ label: p.name, vols: Array.from({ length: to - from + 1 }, (_, i) => from + i) });
      for (let i = from; i <= to; i++) covered.add(i);
    });
    const uncovered = vols.filter((v) => !covered.has(v));
    if (uncovered.length > 0) result.push({ label: "その他", vols: uncovered });
    return result;
  })();

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-[12px] text-slate-500">
          {owned.length} / {total}巻 所持
        </div>
        <button
          onClick={() => onChange(allOwned ? [] : [...vols])}
          className="text-[11px] text-blue-600 bg-white border border-blue-200 rounded-md px-2.5 py-1 cursor-pointer"
        >
          {allOwned ? "全解除" : "全選択"}
        </button>
      </div>
      {sections.map((sec, si) => {
        const secOwned = sec.vols.filter((v) => owned.includes(v)).length;
        const secAll = sec.vols.every((v) => owned.includes(v));
        return (
          <div key={si} className={si < sections.length - 1 ? "mb-4" : ""}>
            {sec.label && (
              <div className="flex justify-between items-center mb-2">
                <div className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2.5 py-px rounded-full">
                  {sec.label}
                </div>
                <div className="flex gap-1.5 items-center">
                  <span className="text-[11px] text-slate-400">{secOwned}/{sec.vols.length}</span>
                  <button
                    onClick={() => {
                      const next = secAll
                        ? owned.filter((v) => !sec.vols.includes(v))
                        : [...new Set([...owned, ...sec.vols])].sort((a, b) => a - b);
                      onChange(next);
                    }}
                    className="text-[10px] text-blue-600 bg-white border border-blue-200 rounded-md px-2 py-px cursor-pointer"
                  >
                    {secAll ? "解除" : "全選択"}
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {sec.vols.map((v) => {
                const has = owned.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggle(v)}
                    className="w-[42px] h-[42px] rounded-lg border-none cursor-pointer text-[13px] transition-colors duration-100"
                    style={{
                      background: has ? "#1e293b" : "#f1f5f9",
                      color: has ? "#fff" : "#94a3b8",
                      fontWeight: has ? 700 : 400,
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
