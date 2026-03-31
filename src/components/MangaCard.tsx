import type { Manga } from "../types/manga";
import { UserBadges } from "./UserBadges";

interface Props {
  manga: Manga;
  onTap: (manga: Manga) => void;
}

export function MangaCard({ manga, onTap }: Props) {
  const owned = manga.ownedVolumes ?? [];
  const latest = parseInt(String(manga.latestVolume)) || 0;
  const isWish = manga.type === "wish";
  const pct = latest > 0 ? Math.min(100, Math.round((owned.length / latest) * 100)) : 0;
  const complete = latest > 0 && owned.length >= latest;

  return (
    <div
      onClick={() => onTap(manga)}
      className="bg-white rounded-2xl mb-2.5 cursor-pointer"
      style={{
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        border: isWish ? "1px solid #fde68a" : "1px solid #f1f5f9",
        padding: "12px 14px",
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex gap-1.5 items-center mb-1 flex-wrap">
            {isWish ? (
              <span className="text-[10px] bg-yellow-50 text-yellow-800 rounded-full px-2 py-px font-bold">
                🛒 ほしい
              </span>
            ) : (
              <span
                className="text-[10px] rounded-full px-2 py-px font-bold"
                style={{
                  background: complete ? "#dcfce7" : "#e0f2fe",
                  color: complete ? "#166534" : "#0369a1",
                }}
              >
                {complete ? "✓ 全巻" : "📚 所持"}
              </span>
            )}
            {manga.status && (
              <span
                className="text-[10px] font-semibold"
                style={{ color: manga.status === "完結" ? "#22c55e" : "#f59e0b" }}
              >
                {manga.status}
              </span>
            )}
            {manga.genre && <span className="text-[10px] text-slate-400">{manga.genre}</span>}
          </div>
          <div className="font-bold text-[15px] text-slate-800 mb-0.5">{manga.title}</div>
          {manga.author && (
            <div className={`text-[11px] text-slate-400 ${isWish ? "mb-1.5" : ""}`}>
              {manga.author}
            </div>
          )}
          {isWish && <UserBadges users={manga.wishUsers} />}
        </div>
        <div className="text-right flex-shrink-0 ml-2.5">
          {isWish ? (
            <div className="text-[22px]">🛒</div>
          ) : (
            <>
              <div className="text-[18px] font-extrabold text-slate-800">
                {owned.length}
                <span className="text-[11px] text-slate-400 font-normal">巻</span>
              </div>
              {latest > 0 && <div className="text-[10px] text-slate-400">/ {latest}巻</div>}
            </>
          )}
        </div>
      </div>
      {!isWish && latest > 0 && (
        <div className="bg-slate-100 rounded mt-2 h-1 overflow-hidden">
          <div
            className="h-full rounded transition-all duration-300"
            style={{ width: pct + "%", background: complete ? "#22c55e" : "#f59e0b" }}
          />
        </div>
      )}
    </div>
  );
}
