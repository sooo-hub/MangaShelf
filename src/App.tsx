import { useState } from "react";
import { USERS } from "./types/manga";
import type { Manga, UserName } from "./types/manga";
import { useMangaStore } from "./hooks/useMangaStore";
import { fetchLatestVolume, RateLimitError } from "./lib/claudeApi";
import { MangaCard } from "./components/MangaCard";
import { SeriesGroup } from "./components/SeriesGroup";
import { AddModal } from "./components/AddModal";
import { DetailModal } from "./components/DetailModal";
import { BulkUpdateResultModal } from "./components/BulkUpdateResultModal";
import type { UpdatedItem } from "./components/BulkUpdateResultModal";

type Tab = "own" | "wish";

interface Row {
  type: "single" | "series";
  manga?: Manga;
  seriesName?: string;
  items?: Manga[];
}

function buildRows(items: Manga[]): Row[] {
  const seriesMap: Record<string, Manga[]> = {};
  items.forEach((m) => {
    if (m.seriesName) {
      if (!seriesMap[m.seriesName]) seriesMap[m.seriesName] = [];
      seriesMap[m.seriesName].push(m);
    }
  });
  const seen = new Set<string>();
  return items.reduce<Row[]>((result, m) => {
    if (m.seriesName) {
      if (!seen.has(m.seriesName)) {
        seen.add(m.seriesName);
        result.push({ type: "series", seriesName: m.seriesName, items: seriesMap[m.seriesName] });
      }
    } else {
      result.push({ type: "single", manga: m });
    }
    return result;
  }, []);
}

export default function App() {
  const { list, loading, error, addManga, saveManga, deleteManga, updateMangaVolume } = useMangaStore();
  const [tab, setTab] = useState<Tab>("own");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"全員" | UserName>("全員");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<Manga | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkResult, setBulkResult] = useState<UpdatedItem[] | null>(null);

  const handleBulkUpdate = async () => {
    const targets = list.filter((m) => m.status !== "完結");
    if (!targets.length) {
      setBulkStatus("連載中の作品がありません");
      setTimeout(() => setBulkStatus(""), 2000);
      return;
    }
    setBulkUpdating(true);
    const changedItems: UpdatedItem[] = [];
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      setBulkStatus(`(${i + 1}/${targets.length}) ${m.title}...`);
      try {
        const r = await fetchLatestVolume(m.title);
        const newVolume = r.latestVolume > 0 ? r.latestVolume : m.latestVolume;
        if (r.latestVolume > 0 || r.status) {
          await updateMangaVolume(m.id, newVolume, r.status || m.status);
          if (r.latestVolume > 0 && r.latestVolume !== m.latestVolume) {
            changedItems.push({ title: m.title, oldVolume: m.latestVolume, newVolume: r.latestVolume });
          }
        }
        if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 1200));
      } catch (e) {
        if (e instanceof RateLimitError) {
          setBulkStatus("⚠️ レート制限。しばらく待ってから再試行してください。");
          break;
        }
      }
    }
    setBulkUpdating(false);
    setBulkStatus("");
    if (changedItems.length > 0) {
      setBulkResult(changedItems);
    } else {
      setBulkStatus("✅ 更新なし（全て最新）");
      setTimeout(() => setBulkStatus(""), 3000);
    }
  };

  const handleSave = async (updated: Manga) => {
    await saveManga(updated);
    setDetail(null);
  };

  const handleDelete = async (id: string) => {
    await deleteManga(id);
    setDetail(null);
  };

  const ownCount = list.filter((m) => m.type === "own").length;
  const wishCount = list.filter((m) => m.type === "wish").length;

  const filtered = list
    .filter((m) => {
      if (tab === "own" && m.type !== "own") return false;
      if (tab === "wish" && m.type !== "wish") return false;
      if (search && !m.title.includes(search) && !(m.seriesName ?? "").includes(search)) return false;
      if (tab === "wish" && userFilter !== "全員") {
        if (!m.wishUsers?.includes(userFilter as UserName)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const sa = a.seriesName ?? a.title;
      const sb = b.seriesName ?? b.title;
      const c = sa.localeCompare(sb, "ja");
      return c !== 0 ? c : a.title.localeCompare(b.title, "ja");
    });

  const rows = buildRows(filtered);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-center p-8">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-slate-600 font-semibold">{error}</div>
          <div className="text-[12px] text-slate-400 mt-2">.env ファイルを確認してください</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="font-sans bg-slate-100 min-h-screen max-w-app mx-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* ヘッダー (sticky) */}
      <div
        className="sticky top-0 z-[100] px-4 pb-0"
        style={{
          background: "#1e293b",
          paddingTop: "max(18px, env(safe-area-inset-top))",
        }}
      >
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-amber-400 text-[10px] font-bold tracking-widest">MY MANGA SHELF</div>
            <div className="text-white text-xl font-extrabold">📚 本棚</div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleBulkUpdate}
              disabled={bulkUpdating}
              className="rounded-full px-3.5 py-2 text-[12px] font-bold cursor-pointer border border-slate-700"
              style={{
                background: bulkUpdating ? "#334155" : "#0f172a",
                color: bulkUpdating ? "#64748b" : "#94a3b8",
              }}
            >
              {bulkUpdating ? "🔄..." : "🔄 一括更新"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-amber-400 text-black border-none rounded-full px-5 py-2 text-[14px] font-bold cursor-pointer"
            >
              ＋ 追加
            </button>
          </div>
        </div>

        {bulkStatus && <div className="text-[11px] text-amber-400 mb-1.5">{bulkStatus}</div>}

        <input
          className="w-full border-none rounded-lg px-3 py-2 text-base outline-none text-white mb-2.5 box-border"
          style={{ background: "#334155" }}
          placeholder="🔍 絞り込み..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* タブ */}
        <div className="flex">
          {(
            [
              { key: "own" as Tab, label: `📚 所持 (${ownCount})` },
              { key: "wish" as Tab, label: `🛒 ほしい (${wishCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 bg-transparent border-none cursor-pointer py-2 text-[12px]"
              style={{
                color: tab === t.key ? "#f59e0b" : "#64748b",
                fontWeight: tab === t.key ? 700 : 500,
                borderBottom: tab === t.key ? "2px solid #f59e0b" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ほしいタブ: ユーザーフィルター */}
        {tab === "wish" && (
          <div className="flex gap-1.5 py-2.5 pb-3">
            {(["全員", ...USERS] as const).map((u) => {
              const sel = userFilter === u;
              const colors: Record<string, { bg: string; on: string }> = {
                爽: { bg: "#dbeafe", on: "#1d4ed8" },
                杏: { bg: "#fce7f3", on: "#be185d" },
              };
              const c = colors[u];
              return (
                <button
                  key={u}
                  onClick={() => setUserFilter(u as typeof userFilter)}
                  className="px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[12px]"
                  style={{
                    background: sel ? (c ? c.bg : "#e2e8f0") : "#334155",
                    color: sel ? (c ? c.on : "#1e293b") : "#94a3b8",
                    fontWeight: sel ? 700 : 500,
                  }}
                >
                  {u}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div className="px-3.5 pt-3.5 pb-20">
        {loading ? (
          <div className="text-center py-10 text-slate-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">{tab === "own" ? "📭" : "🛒"}</div>
            <div className="font-semibold">
              {search || userFilter !== "全員" ? "該当なし" : "まだ登録がありません"}
            </div>
            {!search && userFilter === "全員" && (
              <div className="text-[12px] mt-1">「＋ 追加」から登録しましょう</div>
            )}
          </div>
        ) : (
          rows.map((row, i) =>
            row.type === "series" ? (
              <SeriesGroup
                key={row.seriesName ?? i}
                seriesName={row.seriesName!}
                items={row.items!}
                onTap={setDetail}
              />
            ) : (
              <MangaCard key={row.manga!.id} manga={row.manga!} onTap={setDetail} />
            )
          )
        )}
      </div>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onAdd={addManga}
          existingTitles={list.map((m) => m.title)}
        />
      )}
      {detail && (
        <DetailModal
          manga={detail}
          onClose={() => setDetail(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
      {bulkResult && (
        <BulkUpdateResultModal
          items={bulkResult}
          onClose={() => setBulkResult(null)}
        />
      )}
    </div>
  );
}
