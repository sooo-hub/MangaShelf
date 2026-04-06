import { useState } from "react";

export interface UpdatedItem {
  title: string;
  oldVolume: number;
  newVolume: number;
}

interface Props {
  items: UpdatedItem[];
  onClose: () => void;
}

const PAGE_SIZE = 5;

export function BulkUpdateResultModal({ items, onClose }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-app pb-10 px-5 pt-5"
        style={{ borderRadius: "20px 20px 0 0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-extrabold text-[17px] text-slate-800">🔄 一括更新完了</div>
            <div className="text-[12px] text-slate-400 mt-0.5">{items.length}件の巻数が更新されました</div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-[22px] cursor-pointer text-slate-400"
          >
            ×
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {pageItems.map((item, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between">
              <div className="font-semibold text-[14px] text-slate-800 flex-1 mr-3 truncate">
                {item.title}
              </div>
              <div className="text-[13px] whitespace-nowrap">
                <span className="text-slate-400">{item.oldVolume}巻</span>
                <span className="text-slate-400 mx-1.5">→</span>
                <span className="text-emerald-600 font-bold">{item.newVolume}巻</span>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-[13px] font-bold border-none cursor-pointer disabled:opacity-30"
              style={{ background: "#f1f5f9", color: "#475569" }}
            >
              ◀
            </button>
            <span className="text-[12px] text-slate-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-[13px] font-bold border-none cursor-pointer disabled:opacity-30"
              style={{ background: "#f1f5f9", color: "#475569" }}
            >
              ▶
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 text-white border-none rounded-xl py-3 text-[14px] font-bold cursor-pointer"
          style={{ background: "#1e293b" }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
