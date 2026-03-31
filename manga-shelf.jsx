import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "manga-shelf-v2";
const USERS = ["爽", "杏"];

function useSharedStorage(key, fallback) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(key, true);
        if (r?.value) setData(JSON.parse(r.value));
      } catch {}
      setLoading(false);
    })();
  }, [key]);
  const save = useCallback(async (val) => {
    const next = typeof val === "function" ? val(data) : val;
    setData(next);
    try { await window.storage.set(key, JSON.stringify(next), true); } catch {}
  }, [key, data]);
  return [data, save, loading];
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

async function callClaude(useWebSearch, title) {
  const body = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 600,
    system: `漫画タイトルを受け取り、JSONのみ返してください。余計な文字なし。
[{"title":"正式タイトル","author":"著者名","publisher":"出版社","latestVolume":最新巻の整数,"genre":"少年/少女/青年/女性/SF/ファンタジー/ラブコメ/ホラー/スポーツ/ミステリー/歴史/日常/その他","status":"連載中 or 完結"}]
最大3候補。latestVolumeが不明なら0。不明な文字列は空文字。`,
    messages: [{ role: "user", content: [{ type: "text", text: title }] }]
  };
  if (useWebSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (res.status === 429 || res.status === 529) { const e = new Error(res.status === 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT"); e.code = res.status; throw e; }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("情報が取得できませんでした");
  return JSON.parse(match[0]).filter(x => x.title);
}

async function searchManga(title, onStatus) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        const wait = attempt * 3000;
        onStatus && onStatus(`⏳ サーバー混雑中... ${wait/1000}秒後に再試行 (${attempt}/2)`);
        await new Promise(r => setTimeout(r, wait));
      }
      onStatus && onStatus("🔍 検索中...");
      return await callClaude(false, title);
    } catch (e) {
      if ((e.code === 529 || e.code === 429) && attempt < 2) continue;
      throw e;
    }
  }
}

async function fetchLatestVolume(title) {
  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `漫画の最新刊情報をweb検索して調べ、以下のJSONのみ返してください。余計な文字なし。
{"latestVolume":最新巻の整数,"status":"連載中 or 完結"}
不明な場合は{"latestVolume":0,"status":""}`,
    messages: [{ role: "user", content: [{ type: "text", text: `「${title}」の最新巻数と連載状況` }] }]
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (res.status === 429 || res.status === 529) { const e = new Error(res.status === 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT"); e.code = res.status; throw e; }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("取得失敗");
  return JSON.parse(match[0]);
}

// ── ユーザーバッジ ─────────────────────────
function UserBadges({ users }) {
  if (!users || users.length === 0) return null;
  const colors = { "爽": { bg: "#dbeafe", color: "#1d4ed8" }, "杏": { bg: "#fce7f3", color: "#be185d" } };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {users.map(u => (
        <span key={u} style={{ fontSize: 10, background: colors[u]?.bg || "#f1f5f9", color: colors[u]?.color || "#64748b", padding: "1px 8px", borderRadius: 99, fontWeight: 700 }}>{u}</span>
      ))}
    </div>
  );
}

// ── 巻数グリッド ─────────────────────────
function VolumeGrid({ latest, owned, onChange, parts }) {
  const total = Math.max(parseInt(latest) || 0, owned.length > 0 ? Math.max(...owned) : 0);
  if (total === 0) return (
    <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
      最新巻数が未登録です
    </div>
  );
  const vols = Array.from({ length: total }, (_, i) => i + 1);
  const toggle = (v) => {
    const next = owned.includes(v) ? owned.filter(x => x !== v) : [...owned, v].sort((a, b) => a - b);
    onChange(next);
  };
  const allOwned = vols.every(v => owned.includes(v));

  // partsがある場合はセクション分けして表示
  const sections = (() => {
    if (!parts || parts.length === 0) return [{ label: null, vols }];
    const result = [];
    const covered = new Set();
    const sorted = [...parts].sort((a, b) => (a.from || 1) - (b.from || 1));
    sorted.forEach(p => {
      const from = parseInt(p.from) || 1;
      const to = Math.min(parseInt(p.to) || total, total);
      result.push({ label: p.name, vols: Array.from({ length: to - from + 1 }, (_, i) => from + i) });
      for (let i = from; i <= to; i++) covered.add(i);
    });
    const uncovered = vols.filter(v => !covered.has(v));
    if (uncovered.length > 0) result.push({ label: "その他", vols: uncovered });
    return result;
  })();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>{owned.length} / {total}巻 所持</div>
        <button onClick={() => onChange(allOwned ? [] : [...vols])} style={{
          fontSize: 11, color: "#2563eb", background: "none",
          border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 10px", cursor: "pointer"
        }}>{allOwned ? "全解除" : "全選択"}</button>
      </div>
      {sections.map((sec, si) => {
        const secOwned = sec.vols.filter(v => owned.includes(v)).length;
        const secAll = sec.vols.every(v => owned.includes(v));
        return (
          <div key={si} style={{ marginBottom: si < sections.length - 1 ? 16 : 0 }}>
            {sec.label && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", background: "#e2e8f0", padding: "2px 10px", borderRadius: 99 }}>{sec.label}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{secOwned}/{sec.vols.length}</span>
                  <button onClick={() => {
                    const next = secAll
                      ? owned.filter(v => !sec.vols.includes(v))
                      : [...new Set([...owned, ...sec.vols])].sort((a,b)=>a-b);
                    onChange(next);
                  }} style={{ fontSize: 10, color: "#2563eb", background: "none", border: "1px solid #bfdbfe", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                    {secAll ? "解除" : "全選択"}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sec.vols.map(v => {
                const has = owned.includes(v);
                return (
                  <button key={v} onClick={() => toggle(v)} style={{
                    width: 42, height: 42, borderRadius: 8, border: "none", cursor: "pointer",
                    background: has ? "#1e293b" : "#f1f5f9",
                    color: has ? "#fff" : "#94a3b8",
                    fontWeight: has ? 700 : 400, fontSize: 13,
                    transition: "background 0.12s, color 0.12s"
                  }}>{v}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── シリーズグループ ─────────────────────
function SeriesGroup({ seriesName, items, onTap }) {
  const [open, setOpen] = useState(false);
  const totalOwned = items.reduce((s, m) => s + (m.ownedVolumes || []).length, 0);
  const totalLatest = items.reduce((s, m) => s + (parseInt(m.latestVolume) || 0), 0);
  const allComplete = items.every(m => {
    const l = parseInt(m.latestVolume) || 0;
    return l > 0 && (m.ownedVolumes || []).length >= l;
  });

  return (
    <div style={{ marginBottom: 10 }}>
      {/* 親ヘッダー */}
      <div onClick={() => setOpen(o => !o)} style={{
        background: "#1e293b", borderRadius: open ? "14px 14px 0 0" : 14,
        padding: "12px 14px", cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 10, background: "#334155", color: "#94a3b8", borderRadius: 99, padding: "1px 8px", fontWeight: 700 }}>シリーズ</span>
            {allComplete && <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>✓ 全部揃い</span>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{seriesName}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{items.length}作品</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
          {totalLatest > 0 && (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{totalOwned}<span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>巻</span></div>
              <div style={{ fontSize: 10, color: "#64748b" }}>/ {totalLatest}巻</div>
            </>
          )}
          <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{open ? "▲" : "▼"}</div>
        </div>
      </div>

      {/* 子カード */}
      {open && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "8px 8px 8px" }}>
          {items.map(m => (
            <div key={m.id} onClick={() => onTap(m)} style={{
              background: "#fff", borderRadius: 10, marginBottom: 6, padding: "10px 12px",
              cursor: "pointer", border: "1px solid #f1f5f9",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                  {m.status && <span style={{ fontSize: 10, color: m.status === "完結" ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{m.status}</span>}
                  {m.genre && <span style={{ fontSize: 10, color: "#94a3b8" }}>{m.genre}</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{m.title}</div>
                {parseInt(m.latestVolume) > 0 && (
                  <div style={{ background: "#e2e8f0", borderRadius: 3, height: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: Math.min(100, Math.round(((m.ownedVolumes||[]).length / m.latestVolume) * 100)) + "%", height: "100%", background: (m.ownedVolumes||[]).length >= m.latestVolume ? "#22c55e" : "#f59e0b", borderRadius: 3 }} />
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>{(m.ownedVolumes||[]).length}<span style={{ fontSize: 10, color: "#94a3b8" }}>巻</span></div>
                {parseInt(m.latestVolume) > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>/ {m.latestVolume}巻</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── カード ─────────────────────────────────
function MangaCard({ manga, onTap }) {
  const owned = manga.ownedVolumes || [];
  const latest = parseInt(manga.latestVolume) || 0;
  const isWish = manga.type === "wish";
  const pct = latest > 0 ? Math.min(100, Math.round((owned.length / latest) * 100)) : 0;
  const complete = latest > 0 && owned.length >= latest;

  return (
    <div onClick={() => onTap(manga)} style={{
      background: "#fff", borderRadius: 14, marginBottom: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      border: isWish ? "1px solid #fde68a" : "1px solid #f1f5f9",
      padding: "12px 14px", cursor: "pointer"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
            {isWish
              ? <span style={{ fontSize: 10, background: "#fef9c3", color: "#854d0e", borderRadius: 99, padding: "1px 8px", fontWeight: 700 }}>🛒 ほしい</span>
              : <span style={{ fontSize: 10, background: complete ? "#dcfce7" : "#e0f2fe", color: complete ? "#166534" : "#0369a1", borderRadius: 99, padding: "1px 8px", fontWeight: 700 }}>{complete ? "✓ 全巻" : "📚 所持"}</span>
            }
            {manga.status && <span style={{ fontSize: 10, color: manga.status === "完結" ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{manga.status}</span>}
            {manga.genre && <span style={{ fontSize: 10, color: "#94a3b8" }}>{manga.genre}</span>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 2 }}>{manga.title}</div>
          {manga.author && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: isWish ? 6 : 0 }}>{manga.author}</div>}
          {isWish && <UserBadges users={manga.wishUsers} />}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
          {isWish ? (
            <div style={{ fontSize: 22 }}>🛒</div>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>
                {owned.length}<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>巻</span>
              </div>
              {latest > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>/ {latest}巻</div>}
            </>
          )}
        </div>
      </div>
      {!isWish && latest > 0 && (
        <div style={{ background: "#f1f5f9", borderRadius: 4, height: 4, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: complete ? "#22c55e" : "#f59e0b", borderRadius: 4, transition: "width 0.4s" }} />
        </div>
      )}
    </div>
  );
}

// ── 追加モーダル候補行 ─────────────────────
function CandidateRow({ item, alreadyAdded, onAdd }) {
  const [type, setType] = useState("own");
  const [wishUsers, setWishUsers] = useState([]);

  const toggleUser = (u) => setWishUsers(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);

  return (
    <div style={{ background: "#f8fafc", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #e2e8f0" }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 3 }}>{item.title}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        {[item.author, item.publisher, item.latestVolume > 0 ? `最新${item.latestVolume}巻` : null, item.status].filter(Boolean).join("  ·  ")}
      </div>
      {alreadyAdded ? (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>✓ 追加済み</div>
      ) : (
        <>
          {/* 持ってる / ほしい */}
          <div style={{ display: "flex", background: "#e2e8f0", borderRadius: 8, padding: 3, gap: 2, marginBottom: type === "wish" ? 10 : 0 }}>
            {[{ v: "own", label: "📚 持ってる" }, { v: "wish", label: "🛒 ほしい" }].map(opt => (
              <button key={opt.v} onClick={() => setType(opt.v)} style={{
                flex: 1, background: type === opt.v ? "#1e293b" : "transparent",
                color: type === opt.v ? "#fff" : "#64748b",
                border: "none", borderRadius: 6, padding: "8px 0",
                fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>{opt.label}</button>
            ))}
          </div>

          {/* ほしいの場合: ユーザー選択 */}
          {type === "wish" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>誰が欲しい？</div>
              <div style={{ display: "flex", gap: 8 }}>
                {USERS.map(u => {
                  const sel = wishUsers.includes(u);
                  const colors = { "爽": { bg: "#dbeafe", on: "#1d4ed8" }, "杏": { bg: "#fce7f3", on: "#be185d" } };
                  return (
                    <button key={u} onClick={() => toggleUser(u)} style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, border: "2px solid",
                      borderColor: sel ? colors[u].on : "#e2e8f0",
                      background: sel ? colors[u].bg : "#fff",
                      color: sel ? colors[u].on : "#94a3b8",
                      fontWeight: 700, fontSize: 14, cursor: "pointer"
                    }}>{u}</button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => onAdd(type, wishUsers)}
            disabled={type === "wish" && wishUsers.length === 0}
            style={{
              width: "100%", background: (type === "wish" && wishUsers.length === 0) ? "#e2e8f0" : "#f59e0b",
              color: (type === "wish" && wishUsers.length === 0) ? "#94a3b8" : "#fff",
              border: "none", borderRadius: 10, padding: "11px 0",
              fontSize: 14, fontWeight: 700, cursor: (type === "wish" && wishUsers.length === 0) ? "default" : "pointer",
              marginTop: 4
            }}>
            {type === "wish" && wishUsers.length === 0 ? "ユーザーを選んでください" : "追加"}
          </button>
        </>
      )}
    </div>
  );
}

// ── 追加モーダル ─────────────────────────
function ManualForm({ initialTitle, onAdd, onCancel }) {
  const [title, setTitle] = useState(initialTitle || "");
  const [author, setAuthor] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [latestVolume, setLatestVolume] = useState("");
  const [genre, setGenre] = useState("");
  const [status, setStatus] = useState("連載中");
  const [type, setType] = useState("own");
  const [wishUsers, setWishUsers] = useState([]);
  const toggleUser = (u) => setWishUsers(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);

  const inp = { width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 16, outline: "none", color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" };

  return (
    <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0", marginTop: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>手動で入力</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル（例: ジョジョ 第1部）*" />
        <input style={inp} value={author} onChange={e => setAuthor(e.target.value)} placeholder="著者名" />
        <input style={inp} value={seriesName} onChange={e => setSeriesName(e.target.value)} placeholder="シリーズ名（例: ジョジョの奇妙な冒険）任意" />
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} value={latestVolume} onChange={e => setLatestVolume(e.target.value)} placeholder="最新巻数" type="number" inputMode="numeric" />
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, flex: 1 }}>
            <option>連載中</option><option>完結</option>
          </select>
        </div>
        <select value={genre} onChange={e => setGenre(e.target.value)} style={inp}>
          <option value="">ジャンル（任意）</option>
          {["少年","少女","青年","女性","SF","ファンタジー","ラブコメ","ホラー","スポーツ","ミステリー","歴史","日常","その他"].map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", background: "#e2e8f0", borderRadius: 8, padding: 3, gap: 2, marginBottom: type === "wish" ? 10 : 14 }}>
        {[{ v: "own", label: "📚 持ってる" }, { v: "wish", label: "🛒 ほしい" }].map(opt => (
          <button key={opt.v} onClick={() => setType(opt.v)} style={{
            flex: 1, background: type === opt.v ? "#1e293b" : "transparent",
            color: type === opt.v ? "#fff" : "#64748b",
            border: "none", borderRadius: 6, padding: "8px 0",
            fontSize: 13, fontWeight: 600, cursor: "pointer"
          }}>{opt.label}</button>
        ))}
      </div>

      {type === "wish" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>誰が欲しい？</div>
          <div style={{ display: "flex", gap: 8 }}>
            {USERS.map(u => {
              const sel = wishUsers.includes(u);
              const colors = { "爽": { bg: "#dbeafe", on: "#1d4ed8" }, "杏": { bg: "#fce7f3", on: "#be185d" } };
              return (
                <button key={u} onClick={() => toggleUser(u)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: "2px solid",
                  borderColor: sel ? colors[u].on : "#e2e8f0",
                  background: sel ? colors[u].bg : "#fff",
                  color: sel ? colors[u].on : "#94a3b8",
                  fontWeight: 700, fontSize: 14, cursor: "pointer"
                }}>{u}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
        <button
          disabled={!title.trim() || (type === "wish" && wishUsers.length === 0)}
          onClick={() => onAdd({ title: title.trim(), author, seriesName: seriesName.trim(), latestVolume: parseInt(latestVolume) || 0, genre, status, type, wishUsers: type === "wish" ? wishUsers : [] })}
          style={{
            flex: 2, background: (!title.trim() || (type === "wish" && wishUsers.length === 0)) ? "#e2e8f0" : "#1e293b",
            color: (!title.trim() || (type === "wish" && wishUsers.length === 0)) ? "#94a3b8" : "#fff",
            border: "none", borderRadius: 10, padding: 11, fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>追加</button>
      </div>
    </div>
  );
}

function AddModal({ onClose, onAdd, existingTitles }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setError(""); setCandidates([]); setShowManual(false);
    try {
      const results = await searchManga(query.trim(), setStatusMsg);
      setCandidates(results);
      if (!results.length) setError("見つかりませんでした");
    } catch (e) { setError(e.message); }
    setSearching(false); setStatusMsg("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", padding: "20px 20px 40px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#1e293b" }}>漫画を追加</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 12px", fontSize: 16, outline: "none", color: "#1e293b" }}
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="タイトルを入力..." autoFocus
          />
          <button onClick={doSearch} disabled={searching} style={{
            background: searching ? "#94a3b8" : "#1e293b", color: "#fff", border: "none",
            borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: searching ? "default" : "pointer"
          }}>{searching ? "…" : "検索"}</button>
        </div>
        {searching && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12, marginBottom: 14 }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ width: 13, height: 13, border: "2px solid #cbd5e1", borderTop: "2px solid #475569", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            {statusMsg || "検索中..."}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 8 }}>{error}</div>
            {!showManual && (
              <button onClick={() => setShowManual(true)} style={{
                background: "#f8fafc", color: "#1e293b", border: "1px solid #e2e8f0",
                borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>✏️ 手動で入力する</button>
            )}
          </div>
        )}
        {showManual && (
          <ManualForm initialTitle={query} onCancel={() => setShowManual(false)}
            onAdd={(item) => { onAdd(item); onClose(); }} />
        )}
        {!showManual && candidates.map((c, i) => (
          <CandidateRow key={i} item={c} alreadyAdded={existingTitles.includes(c.title)}
            onAdd={(type, wishUsers) => { onAdd({ ...c, type, wishUsers: type === "wish" ? wishUsers : [] }); onClose(); }} />
        ))}
        {!showManual && !searching && !error && candidates.length === 0 && query && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button onClick={() => setShowManual(true)} style={{
              background: "none", color: "#94a3b8", border: "none", fontSize: 13, cursor: "pointer"
            }}>✏️ 手動で入力する</button>
          </div>
        )}
        {!showManual && !error && !searching && candidates.length === 0 && !query && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={() => setShowManual(true)} style={{
              background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer"
            }}>✏️ 検索せずに手動入力</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 詳細モーダル ─────────────────────────
function DetailModal({ manga, onClose, onSave, onDelete }) {
  const isWish = manga.type === "wish";
  const [owned, setOwned] = useState(manga.ownedVolumes || []);
  const [wishUsers, setWishUsers] = useState(manga.wishUsers || []);
  const [latestVolume, setLatestVolume] = useState(manga.latestVolume || 0);
  const [status, setStatus] = useState(manga.status || "");
  const [seriesName, setSeriesName] = useState(manga.seriesName || "");
  const [parts, setParts] = useState(manga.parts || []);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleUser = (u) => setWishUsers(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);

  const handleFetchLatest = async () => {
    setFetching(true); setFetchMsg("🔍 検索中...");
    try {
      const r = await fetchLatestVolume(manga.title);
      if (r.latestVolume > 0) setLatestVolume(r.latestVolume);
      if (r.status) setStatus(r.status);
      setFetchMsg(r.latestVolume > 0 ? `✅ 最新${r.latestVolume}巻 / ${r.status}` : "⚠️ 取得できませんでした");
    } catch (e) { setFetchMsg("❌ " + e.message); }
    setFetching(false);
  };

  const handleMoveToOwned = () => {
    onSave({ ...manga, type: "own", wishUsers: [], ownedVolumes: [] });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "20px 20px 40px" }} onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: 1, paddingRight: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#1e293b", marginBottom: 3 }}>{manga.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
              {[manga.author, manga.publisher, latestVolume > 0 ? `最新${latestVolume}巻` : null, status].filter(Boolean).join("  ·  ")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleFetchLatest} disabled={fetching} style={{
                background: fetching ? "#f1f5f9" : "#e0f2fe", color: fetching ? "#94a3b8" : "#0369a1",
                border: "none", borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 700, cursor: fetching ? "default" : "pointer"
              }}>
                {fetching ? "🔍 取得中..." : "🔄 最新刊を確認"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>手動:</span>
                <input
                  type="number" inputMode="numeric"
                  value={latestVolume || ""}
                  onChange={e => setLatestVolume(parseInt(e.target.value) || 0)}
                  style={{ width: 80, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 16, textAlign: "center", outline: "none", color: "#1e293b" }}
                  placeholder="巻"
                />
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 6px", fontSize: 12, outline: "none", color: "#1e293b" }}>
                  <option>連載中</option><option>完結</option>
                </select>
              </div>
            </div>
            {fetchMsg && <div style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>{fetchMsg}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>×</button>
        </div>

        {/* ほしい → ユーザー選択 + 持っているに移動 */}
        {isWish && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>誰が欲しい？</div>
              <div style={{ display: "flex", gap: 8 }}>
                {USERS.map(u => {
                  const sel = wishUsers.includes(u);
                  const colors = { "爽": { bg: "#dbeafe", on: "#1d4ed8" }, "杏": { bg: "#fce7f3", on: "#be185d" } };
                  return (
                    <button key={u} onClick={() => toggleUser(u)} style={{
                      flex: 1, padding: "12px 0", borderRadius: 12, border: "2px solid",
                      borderColor: sel ? colors[u].on : "#e2e8f0",
                      background: sel ? colors[u].bg : "#fff",
                      color: sel ? colors[u].on : "#94a3b8",
                      fontWeight: 700, fontSize: 16, cursor: "pointer"
                    }}>{u}</button>
                  );
                })}
              </div>
            </div>

            {/* 持っているに移動 */}
            <button onClick={handleMoveToOwned} style={{
              width: "100%", background: "#f0fdf4", color: "#16a34a",
              border: "2px solid #86efac", borderRadius: 12, padding: 13,
              fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12
            }}>
              📚 買った！持っているに移動
            </button>
          </>
        )}

        {/* 所持 → 巻数グリッド */}
        {!isWish && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>所持している巻をタップ</div>
            <VolumeGrid latest={latestVolume} owned={owned} onChange={setOwned} parts={parts} />
            {/* 部設定 */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>部・章の設定（任意）</div>
                <button onClick={() => setParts(p => [...p, { id: Date.now(), name: "", from: "", to: "" }])} style={{
                  fontSize: 11, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6,
                  padding: "3px 10px", cursor: "pointer", color: "#475569", fontWeight: 600
                }}>＋ 追加</button>
              </div>
              {parts.map((p, i) => (
                <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <input value={p.name} onChange={e => setParts(ps => ps.map((x,j)=>j===i?{...x,name:e.target.value}:x))}
                    style={{ flex: 2, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", fontSize: 16, outline: "none", color: "#1e293b" }}
                    placeholder="第1部" />
                  <input value={p.from} onChange={e => setParts(ps => ps.map((x,j)=>j===i?{...x,from:e.target.value}:x))}
                    type="number" inputMode="numeric"
                    style={{ width: 48, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 6px", fontSize: 16, textAlign: "center", outline: "none", color: "#1e293b" }}
                    placeholder="1" />
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>〜</span>
                  <input value={p.to} onChange={e => setParts(ps => ps.map((x,j)=>j===i?{...x,to:e.target.value}:x))}
                    type="number" inputMode="numeric"
                    style={{ width: 48, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 6px", fontSize: 16, textAlign: "center", outline: "none", color: "#1e293b" }}
                    placeholder="5" />
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>巻</span>
                  <button onClick={() => setParts(ps => ps.filter((_,j)=>j!==i))} style={{
                    background: "none", border: "none", color: "#ef4444", fontSize: 18, cursor: "pointer", padding: "0 2px"
                  }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSave({ ...manga, latestVolume, status, seriesName: seriesName.trim(), parts, ownedVolumes: isWish ? [] : owned, wishUsers: isWish ? wishUsers : [] })} style={{
            flex: 1, background: "#1e293b", color: "#fff", border: "none",
            borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>保存</button>
          {confirmDelete ? (
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <button onClick={() => onDelete(manga.id)} style={{
                flex: 1, background: "#ef4444", color: "#fff", border: "none",
                borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>本当に削除</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                flex: 1, background: "#f1f5f9", color: "#64748b", border: "none",
                borderRadius: 12, padding: 13, fontSize: 13, cursor: "pointer"
              }}>キャンセル</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              background: "#fee2e2", color: "#ef4444", border: "none",
              borderRadius: 12, padding: "13px 16px", fontSize: 13, cursor: "pointer"
            }}>削除</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── メインアプリ ─────────────────────────
export default function App() {
  useEffect(() => {
    const meta = document.querySelector("meta[name=viewport]");
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
  }, []);

  const [list, setList, loading] = useSharedStorage(STORAGE_KEY, []);
  const [tab, setTab] = useState("own");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("全員");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");

  const handleBulkUpdate = async () => {
    const targets = list.filter(m => m.status !== "完結");
    if (!targets.length) { setBulkStatus("連載中の作品がありません"); return; }
    setBulkUpdating(true);
    let updated = 0;
    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      setBulkStatus(`(${i + 1}/${targets.length}) ${m.title}...`);
      try {
        const r = await fetchLatestVolume(m.title);
        if (r.latestVolume > 0 || r.status) {
          setList(l => l.map(x => x.id === m.id ? {
            ...x,
            latestVolume: r.latestVolume > 0 ? r.latestVolume : x.latestVolume,
            status: r.status || x.status
          } : x));
          updated++;
        }
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 1200));
      } catch (e) {
        if (e.code === 429) { setBulkStatus("⚠️ レート制限。しばらく待ってから再試行してください。"); break; }
      }
    }
    setBulkStatus(`✅ ${updated}件を更新しました`);
    setBulkUpdating(false);
    setTimeout(() => setBulkStatus(""), 3000);
  };

  const addManga = (item) => {
    setList(l => [...l, {
      id: genId(),
      title: item.title, author: item.author || "",
      publisher: item.publisher || "",
      latestVolume: item.latestVolume || 0,
      genre: item.genre || "", status: item.status || "",
      type: item.type || "own",
      ownedVolumes: [],
      wishUsers: item.wishUsers || [],
    }]);
  };

  const saveManga = (updated) => { setList(l => l.map(m => m.id === updated.id ? updated : m)); setDetail(null); };
  const deleteManga = (id) => { setList(l => l.filter(m => m.id !== id)); setDetail(null); };

  const ownCount = list.filter(m => m.type === "own").length;
  const wishCount = list.filter(m => m.type === "wish").length;

  const filtered = list
    .filter(m => {
      if (tab === "own" && m.type !== "own") return false;
      if (tab === "wish" && m.type !== "wish") return false;
      if (search && !m.title.includes(search) && !(m.seriesName || "").includes(search)) return false;
      if (tab === "wish" && userFilter !== "全員") {
        if (!m.wishUsers || !m.wishUsers.includes(userFilter)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const sa = a.seriesName || a.title;
      const sb = b.seriesName || b.title;
      const c = sa.localeCompare(sb, "ja");
      if (c !== 0) return c;
      return a.title.localeCompare(b.title, "ja");
    });

  // シリーズグループ化
  const buildRows = (items) => {
    const rows = [];
    const seriesMap = {};
    items.forEach(m => {
      if (m.seriesName) {
        if (!seriesMap[m.seriesName]) { seriesMap[m.seriesName] = []; }
        seriesMap[m.seriesName].push(m);
      } else {
        rows.push({ type: "single", manga: m });
      }
    });
    // seriesMapのエントリをrows内の最初の出現位置に挿入
    const seen = new Set();
    const result = [];
    items.forEach(m => {
      if (m.seriesName) {
        if (!seen.has(m.seriesName)) {
          seen.add(m.seriesName);
          result.push({ type: "series", seriesName: m.seriesName, items: seriesMap[m.seriesName] });
        }
      } else {
        result.push({ type: "single", manga: m });
      }
    });
    return result;
  };
  const rows = buildRows(filtered);

  return (
    <div style={{ fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif", background: "#f1f5f9", minHeight: "100vh", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ background: "#1e293b", padding: "18px 16px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>MY MANGA SHELF</div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>📚 本棚</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleBulkUpdate} disabled={bulkUpdating} style={{
              background: bulkUpdating ? "#334155" : "#0f172a", color: bulkUpdating ? "#64748b" : "#94a3b8",
              border: "1px solid #334155", borderRadius: 20, padding: "8px 14px",
              fontSize: 12, fontWeight: 700, cursor: bulkUpdating ? "default" : "pointer"
            }}>{bulkUpdating ? "🔄..." : "🔄 一括更新"}</button>
            <button onClick={() => setShowAdd(true)} style={{
              background: "#f59e0b", color: "#000", border: "none",
              borderRadius: 20, padding: "8px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer"
            }}>＋ 追加</button>
          </div>
        </div>

        {bulkStatus && <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6 }}>{bulkStatus}</div>}

        <input
          style={{ width: "100%", background: "#334155", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
          placeholder="🔍 絞り込み..." value={search} onChange={e => setSearch(e.target.value)}
        />

        {/* タブ */}
        <div style={{ display: "flex" }}>
          {[
            { key: "own", label: `📚 所持 (${ownCount})` },
            { key: "wish", label: `🛒 ほしい (${wishCount})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              color: tab === t.key ? "#f59e0b" : "#64748b",
              fontWeight: tab === t.key ? 700 : 500, fontSize: 12,
              padding: "8px 0", borderBottom: tab === t.key ? "2px solid #f59e0b" : "2px solid transparent"
            }}>{t.label}</button>
          ))}
        </div>

        {/* ほしいタブ: ユーザーフィルター */}
        {tab === "wish" && (
          <div style={{ display: "flex", gap: 6, padding: "10px 0 12px" }}>
            {["全員", ...USERS].map(u => {
              const sel = userFilter === u;
              const colors = { "爽": { bg: "#dbeafe", on: "#1d4ed8" }, "杏": { bg: "#fce7f3", on: "#be185d" } };
              const c = colors[u];
              return (
                <button key={u} onClick={() => setUserFilter(u)} style={{
                  padding: "5px 14px", borderRadius: 99, border: "none", cursor: "pointer",
                  background: sel ? (c ? c.bg : "#e2e8f0") : "#334155",
                  color: sel ? (c ? c.on : "#1e293b") : "#94a3b8",
                  fontWeight: sel ? 700 : 500, fontSize: 12
                }}>{u}</button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 14px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === "own" ? "📭" : "🛒"}</div>
            <div style={{ fontWeight: 600 }}>{search || userFilter !== "全員" ? "該当なし" : "まだ登録がありません"}</div>
            {!search && userFilter === "全員" && <div style={{ fontSize: 12, marginTop: 4 }}>「＋ 追加」から登録しましょう</div>}
          </div>
        ) : rows.map((row, i) =>
            row.type === "series"
              ? <SeriesGroup key={row.seriesName} seriesName={row.seriesName} items={row.items} onTap={setDetail} />
              : <MangaCard key={row.manga.id} manga={row.manga} onTap={setDetail} />
          )}
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addManga} existingTitles={list.map(m => m.title)} />}
      {detail && <DetailModal manga={detail} onClose={() => setDetail(null)} onSave={saveManga} onDelete={deleteManga} />}
    </div>
  );
}
