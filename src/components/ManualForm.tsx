import { useState } from "react";
import { USERS, GENRES } from "../types/manga";
import type { UserName, MangaType, Genre, MangaStatus } from "../types/manga";

const USER_COLORS: Record<UserName, { bg: string; on: string }> = {
  爽: { bg: "#dbeafe", on: "#1d4ed8" },
  杏: { bg: "#fce7f3", on: "#be185d" },
};

interface ManualItem {
  title: string;
  author: string;
  seriesName: string;
  latestVolume: number;
  genre: Genre;
  status: MangaStatus;
  type: MangaType;
  wishUsers: UserName[];
}

interface Props {
  initialTitle?: string;
  onAdd: (item: ManualItem) => void;
  onCancel: () => void;
}

export function ManualForm({ initialTitle = "", onAdd, onCancel }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [latestVolume, setLatestVolume] = useState("");
  const [genre, setGenre] = useState<Genre>("");
  const [status, setStatus] = useState<MangaStatus>("連載中");
  const [type, setType] = useState<MangaType>("own");
  const [wishUsers, setWishUsers] = useState<UserName[]>([]);

  const toggleUser = (u: UserName) =>
    setWishUsers((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));

  const inputClass =
    "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base outline-none text-slate-800 bg-slate-50 box-border";

  const disabled = !title.trim() || (type === "wish" && wishUsers.length === 0);

  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mt-1">
      <div className="text-[13px] font-bold text-slate-800 mb-3.5">手動で入力</div>
      <div className="flex flex-col gap-2.5 mb-3.5">
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル（例: ジョジョ 第1部）*"
        />
        <input
          className={inputClass}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="著者名"
        />
        <input
          className={inputClass}
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          placeholder="シリーズ名（例: ジョジョの奇妙な冒険）任意"
        />
        <div className="flex gap-2">
          <input
            className={inputClass + " flex-1"}
            value={latestVolume}
            onChange={(e) => setLatestVolume(e.target.value)}
            placeholder="最新巻数"
            type="number"
            inputMode="numeric"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MangaStatus)}
            className={inputClass + " flex-1"}
          >
            <option>連載中</option>
            <option>完結</option>
          </select>
        </div>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value as Genre)}
          className={inputClass}
        >
          <option value="">ジャンル（任意）</option>
          {GENRES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>

      <div
        className="flex rounded-lg p-0.5 gap-0.5"
        style={{ background: "#e2e8f0", marginBottom: type === "wish" ? 10 : 14 }}
      >
        {(
          [
            { v: "own" as MangaType, label: "📚 持ってる" },
            { v: "wish" as MangaType, label: "🛒 ほしい" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            onClick={() => setType(opt.v)}
            className="flex-1 rounded-md py-2 text-[13px] font-semibold cursor-pointer border-none"
            style={{
              background: type === opt.v ? "#1e293b" : "transparent",
              color: type === opt.v ? "#fff" : "#64748b",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {type === "wish" && (
        <div className="mb-3.5">
          <div className="text-[11px] text-slate-500 mb-1.5">誰が欲しい？</div>
          <div className="flex gap-2">
            {USERS.map((u) => {
              const sel = wishUsers.includes(u);
              return (
                <button
                  key={u}
                  onClick={() => toggleUser(u)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[14px] cursor-pointer"
                  style={{
                    border: `2px solid ${sel ? USER_COLORS[u].on : "#e2e8f0"}`,
                    background: sel ? USER_COLORS[u].bg : "#fff",
                    color: sel ? USER_COLORS[u].on : "#94a3b8",
                  }}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-500 border-none rounded-xl py-3 text-[13px] font-semibold cursor-pointer"
        >
          キャンセル
        </button>
        <button
          disabled={disabled}
          onClick={() =>
            onAdd({
              title: title.trim(),
              author,
              seriesName: seriesName.trim(),
              latestVolume: parseInt(latestVolume) || 0,
              genre,
              status,
              type,
              wishUsers: type === "wish" ? wishUsers : [],
            })
          }
          className="flex-[2] rounded-xl py-3 text-[14px] font-bold cursor-pointer border-none"
          style={{
            background: disabled ? "#e2e8f0" : "#1e293b",
            color: disabled ? "#94a3b8" : "#fff",
          }}
        >
          追加
        </button>
      </div>
    </div>
  );
}
