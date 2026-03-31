import { useState } from "react";
import type { Manga, MangaCandidate, MangaType, UserName } from "../types/manga";
import { searchManga } from "../lib/claudeApi";
import { CandidateRow } from "./CandidateRow";
import { ManualForm } from "./ManualForm";

type AddItem = Omit<Manga, "id" | "createdAt" | "updatedAt" | "ownedVolumes">;

interface Props {
  onClose: () => void;
  onAdd: (item: AddItem) => void;
  existingTitles: string[];
}

export function AddModal({ onClose, onAdd, existingTitles }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [candidates, setCandidates] = useState<MangaCandidate[]>([]);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setCandidates([]);
    setShowManual(false);
    try {
      const results = await searchManga(query.trim(), setStatusMsg);
      setCandidates(results);
      if (!results.length) setError("見つかりませんでした");
    } catch (e) {
      setError(e instanceof Error ? e.message : "検索エラー");
    }
    setSearching(false);
    setStatusMsg("");
  };

  const handleAdd = (type: MangaType, wishUsers: UserName[], candidate: MangaCandidate) => {
    onAdd({ ...candidate, type, wishUsers: type === "wish" ? wishUsers : [], parts: [] });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-app max-h-[88vh] overflow-y-auto pb-10 px-5 pt-5"
        style={{ borderRadius: "20px 20px 0 0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="font-extrabold text-[17px] text-slate-800">漫画を追加</div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-[22px] cursor-pointer text-slate-400"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 border border-slate-200 rounded-xl px-3 py-3 text-base outline-none text-slate-800"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="タイトルを入力..."
            autoFocus
          />
          <button
            onClick={doSearch}
            disabled={searching}
            className="rounded-xl px-4 py-3 text-[14px] font-bold cursor-pointer border-none text-white"
            style={{ background: searching ? "#94a3b8" : "#1e293b" }}
          >
            {searching ? "…" : "検索"}
          </button>
        </div>

        {searching && (
          <div className="flex items-center gap-2 text-slate-500 text-[12px] mb-3.5">
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-500"
              style={{ animation: "spin 0.8s linear infinite" }}
            />
            {statusMsg || "検索中..."}
          </div>
        )}

        {error && (
          <div className="mb-3">
            <div className="text-red-500 text-[13px] mb-2">{error}</div>
            {!showManual && (
              <button
                onClick={() => setShowManual(true)}
                className="bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer"
              >
                ✏️ 手動で入力する
              </button>
            )}
          </div>
        )}

        {showManual && (
          <ManualForm
            initialTitle={query}
            onCancel={() => setShowManual(false)}
            onAdd={(item) => {
              onAdd({ ...item, publisher: "", parts: [] });
              onClose();
            }}
          />
        )}

        {!showManual &&
          candidates.map((c, i) => (
            <CandidateRow
              key={i}
              item={c}
              alreadyAdded={existingTitles.includes(c.title)}
              onAdd={(type, wishUsers) => handleAdd(type, wishUsers, c)}
            />
          ))}

        {!showManual && !searching && !error && candidates.length === 0 && query && (
          <div className="text-center mt-2">
            <button
              onClick={() => setShowManual(true)}
              className="bg-transparent text-slate-400 border-none text-[13px] cursor-pointer"
            >
              ✏️ 手動で入力する
            </button>
          </div>
        )}

        {!showManual && !error && !searching && candidates.length === 0 && !query && (
          <div className="text-center mt-6">
            <button
              onClick={() => setShowManual(true)}
              className="bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-3.5 py-2 text-[13px] cursor-pointer"
            >
              ✏️ 検索せずに手動入力
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
