import { useState } from "react";
import { USERS } from "../types/manga";
import type { Manga, UserName, MangaStatus, MangaPart } from "../types/manga";
import { fetchLatestVolume } from "../lib/claudeApi";
import { VolumeGrid } from "./VolumeGrid";

const USER_COLORS: Record<UserName, { bg: string; on: string }> = {
  爽: { bg: "#dbeafe", on: "#1d4ed8" },
  杏: { bg: "#fce7f3", on: "#be185d" },
};

interface Props {
  manga: Manga;
  onClose: () => void;
  onSave: (manga: Manga) => void;
  onDelete: (id: string) => void;
}

export function DetailModal({ manga, onClose, onSave, onDelete }: Props) {
  const isWish = manga.type === "wish";
  const [owned, setOwned] = useState(manga.ownedVolumes ?? []);
  const [wishUsers, setWishUsers] = useState<UserName[]>(manga.wishUsers ?? []);
  const [latestVolume, setLatestVolume] = useState(manga.latestVolume ?? 0);
  const [status, setStatus] = useState<MangaStatus>(manga.status ?? "");
  const [seriesName, setSeriesName] = useState(manga.seriesName ?? "");
  const [parts, setParts] = useState<MangaPart[]>(manga.parts ?? []);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleUser = (u: UserName) =>
    setWishUsers((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));

  const handleFetchLatest = async () => {
    setFetching(true);
    setFetchMsg("🔍 検索中...");
    try {
      const r = await fetchLatestVolume(manga.title);
      if (r.latestVolume > 0) setLatestVolume(r.latestVolume);
      if (r.status) setStatus(r.status);
      setFetchMsg(r.latestVolume > 0 ? `✅ 最新${r.latestVolume}巻 / ${r.status}` : "⚠️ 取得できませんでした");
    } catch (e) {
      setFetchMsg("❌ " + (e instanceof Error ? e.message : "エラー"));
    }
    setFetching(false);
  };

  const handleMoveToOwned = () => {
    onSave({ ...manga, type: "own", wishUsers: [], ownedVolumes: [] });
  };

  const handleSave = () => {
    onSave({
      ...manga,
      latestVolume,
      status,
      seriesName: seriesName.trim(),
      parts,
      ownedVolumes: isWish ? [] : owned,
      wishUsers: isWish ? wishUsers : [],
    });
  };

  const meta = [manga.author, manga.publisher, latestVolume > 0 ? `最新${latestVolume}巻` : null, status]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-app max-h-[90vh] overflow-y-auto pb-10 px-5 pt-5"
        style={{ borderRadius: "20px 20px 0 0" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 pr-2.5">
            <div className="font-extrabold text-[17px] text-slate-800 mb-0.5">{manga.title}</div>
            <div className="text-[12px] text-slate-400 mb-1.5">{meta}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleFetchLatest}
                disabled={fetching}
                className="rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer border-none"
                style={{
                  background: fetching ? "#f1f5f9" : "#e0f2fe",
                  color: fetching ? "#94a3b8" : "#0369a1",
                }}
              >
                {fetching ? "🔍 取得中..." : "🔄 最新刊を確認"}
              </button>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">手動:</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={latestVolume || ""}
                  onChange={(e) => setLatestVolume(parseInt(e.target.value) || 0)}
                  className="w-20 border border-slate-200 rounded-lg px-2.5 py-1.5 text-base text-center outline-none text-slate-800"
                  placeholder="巻"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MangaStatus)}
                  className="border border-slate-200 rounded-lg px-1.5 py-1 text-[12px] outline-none text-slate-800"
                >
                  <option>連載中</option>
                  <option>完結</option>
                </select>
              </div>
            </div>
            {fetchMsg && <div className="text-[11px] text-slate-500 mt-1">{fetchMsg}</div>}
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-[22px] cursor-pointer text-slate-400"
          >
            ×
          </button>
        </div>

        {/* シリーズ名 */}
        <div className="mb-4">
          <div className="text-[12px] text-slate-500 mb-1">シリーズ名（任意）</div>
          <input
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base outline-none text-slate-800 bg-slate-50"
            placeholder="例: ジョジョの奇妙な冒険"
          />
        </div>

        {/* ほしい: ユーザー選択 + 移動 */}
        {isWish && (
          <>
            <div className="mb-5">
              <div className="text-[13px] font-bold text-slate-800 mb-2.5">誰が欲しい？</div>
              <div className="flex gap-2">
                {USERS.map((u) => {
                  const sel = wishUsers.includes(u);
                  return (
                    <button
                      key={u}
                      onClick={() => toggleUser(u)}
                      className="flex-1 py-3 rounded-xl font-bold text-base cursor-pointer"
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
            <button
              onClick={handleMoveToOwned}
              className="w-full border-2 rounded-xl py-3 text-[14px] font-bold cursor-pointer mb-3"
              style={{ background: "#f0fdf4", color: "#16a34a", borderColor: "#86efac" }}
            >
              📚 買った！持っているに移動
            </button>
          </>
        )}

        {/* 所持: 巻数グリッド */}
        {!isWish && (
          <div className="mb-5">
            <div className="text-[13px] font-bold text-slate-800 mb-3.5">所持している巻をタップ</div>
            <VolumeGrid latest={latestVolume} owned={owned} onChange={setOwned} parts={parts} />

            {/* 部設定 */}
            <div className="mt-5">
              <div className="flex justify-between items-center mb-2.5">
                <div className="text-[12px] font-bold text-slate-500">部・章の設定（任意）</div>
                <button
                  onClick={() =>
                    setParts((p) => [...p, { id: Date.now(), name: "", from: "", to: "" }])
                  }
                  className="text-[11px] bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1 cursor-pointer text-slate-600 font-semibold"
                >
                  ＋ 追加
                </button>
              </div>
              {parts.map((p, i) => (
                <div key={p.id} className="flex gap-1.5 items-center mb-2">
                  <input
                    value={p.name}
                    onChange={(e) =>
                      setParts((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    className="flex-[2] border border-slate-200 rounded-lg px-2 py-1.5 text-base outline-none text-slate-800"
                    placeholder="第1部"
                  />
                  <input
                    value={p.from}
                    onChange={(e) =>
                      setParts((ps) => ps.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))
                    }
                    type="number"
                    inputMode="numeric"
                    className="w-12 border border-slate-200 rounded-lg px-1.5 py-1.5 text-base text-center outline-none text-slate-800"
                    placeholder="1"
                  />
                  <span className="text-slate-400 text-[12px]">〜</span>
                  <input
                    value={p.to}
                    onChange={(e) =>
                      setParts((ps) => ps.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))
                    }
                    type="number"
                    inputMode="numeric"
                    className="w-12 border border-slate-200 rounded-lg px-1.5 py-1.5 text-base text-center outline-none text-slate-800"
                    placeholder="5"
                  />
                  <span className="text-slate-400 text-[11px]">巻</span>
                  <button
                    onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}
                    className="bg-transparent border-none text-red-500 text-lg cursor-pointer px-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 text-white border-none rounded-xl py-3 text-[14px] font-bold cursor-pointer"
            style={{ background: "#1e293b" }}
          >
            保存
          </button>
          {confirmDelete ? (
            <div className="flex gap-1.5 flex-1">
              <button
                onClick={() => onDelete(manga.id)}
                className="flex-1 bg-red-500 text-white border-none rounded-xl py-3 text-[13px] font-bold cursor-pointer"
              >
                本当に削除
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-slate-100 text-slate-500 border-none rounded-xl py-3 text-[13px] cursor-pointer"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="border-none rounded-xl px-4 py-3 text-[13px] cursor-pointer"
              style={{ background: "#fee2e2", color: "#ef4444" }}
            >
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
