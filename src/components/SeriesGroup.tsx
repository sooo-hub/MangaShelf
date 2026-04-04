import { useState } from "react";
import type { Manga } from "../types/manga";

interface Props {
  seriesName: string;
  items: Manga[];
  onTap: (manga: Manga) => void;
}

export function SeriesGroup({ seriesName, items, onTap }: Props) {
  const [open, setOpen] = useState(false);
  const totalOwned = items.reduce((s, m) => s + (m.ownedVolumes ?? []).length, 0);
  const totalLatest = items.reduce((s, m) => s + (parseInt(String(m.latestVolume)) || 0), 0);
  const allComplete = items.every((m) => {
    const l = parseInt(String(m.latestVolume)) || 0;
    return l > 0 && (m.ownedVolumes ?? []).length >= l;
  });

  return (
    <div className="mb-2.5">
      <div
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer flex justify-between items-center px-3.5 py-3"
        style={{
          background: "#1e293b",
          borderRadius: open ? "14px 14px 0 0" : 14,
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex gap-1.5 items-center mb-0.5">
            <span className="text-[10px] bg-slate-700 text-slate-400 rounded-full px-2 py-px font-bold">
              シリーズ
            </span>
            {allComplete && (
              <span className="text-[10px] text-green-400 font-bold">✓ 全部揃い</span>
            )}
          </div>
          <div className="font-extrabold text-[15px] text-white">{seriesName}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{items.length}作品</div>
        </div>
        <div className="text-right flex-shrink-0 ml-2.5">
          {totalLatest > 0 && (
            <>
              <div className="text-[18px] font-extrabold text-white">
                {totalOwned}
                <span className="text-[11px] text-slate-500 font-normal">巻</span>
              </div>
              <div className="text-[10px] text-slate-500">/ {totalLatest}巻</div>
            </>
          )}
          <div className="text-[14px] text-slate-400 mt-0.5">{open ? "▲" : "▼"}</div>
        </div>
      </div>

      {open && (
        <div
          className="bg-slate-50 border border-slate-200 border-t-0 p-2"
          style={{ borderRadius: "0 0 14px 14px" }}
        >
          {items.map((m) => (
            <div
              key={m.id}
              onClick={() => onTap(m)}
              className="bg-white rounded-xl mb-1.5 last:mb-0 px-3 py-2.5 cursor-pointer border border-slate-50 flex justify-between items-center"
            >
              <div className="flex-1 min-w-0">
                <div className="flex gap-1 items-center mb-0.5 flex-wrap">
                  {m.status && (
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: m.status === "完結" ? "#22c55e" : "#f59e0b" }}
                    >
                      {m.status}
                    </span>
                  )}
                  {m.genre && <span className="text-[10px] text-slate-400">{m.genre}</span>}
                </div>
                <div className="font-bold text-[14px] text-slate-800">{m.title}</div>
                {parseInt(String(m.latestVolume)) > 0 && (
                  <div className="bg-slate-200 rounded h-0.5 mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width:
                          Math.min(
                            100,
                            Math.round(((m.ownedVolumes ?? []).length / m.latestVolume) * 100)
                          ) + "%",
                        background:
                          (m.ownedVolumes ?? []).length >= m.latestVolume ? "#22c55e" : "#f59e0b",
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-2.5">
                <div className="text-[16px] font-extrabold text-slate-800">
                  {(m.ownedVolumes ?? []).length}
                  <span className="text-[10px] text-slate-400">巻</span>
                </div>
                {parseInt(String(m.latestVolume)) > 0 && (
                  <div className="text-[10px] text-slate-400">/ {m.latestVolume}巻</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
