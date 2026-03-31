import { useState } from "react";
import { USERS } from "../types/manga";
import type { MangaCandidate, UserName, MangaType } from "../types/manga";

const USER_COLORS: Record<UserName, { bg: string; on: string }> = {
  爽: { bg: "#dbeafe", on: "#1d4ed8" },
  杏: { bg: "#fce7f3", on: "#be185d" },
};

interface Props {
  item: MangaCandidate;
  alreadyAdded: boolean;
  onAdd: (type: MangaType, wishUsers: UserName[]) => void;
}

export function CandidateRow({ item, alreadyAdded, onAdd }: Props) {
  const [type, setType] = useState<MangaType>("own");
  const [wishUsers, setWishUsers] = useState<UserName[]>([]);

  const toggleUser = (u: UserName) =>
    setWishUsers((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));

  const meta = [
    item.author,
    item.publisher,
    item.latestVolume > 0 ? `最新${item.latestVolume}巻` : null,
    item.status,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="bg-slate-50 rounded-2xl p-3.5 mb-3 border border-slate-200">
      <div className="font-bold text-[15px] text-slate-800 mb-0.5">{item.title}</div>
      <div className="text-[12px] text-slate-500 mb-3">{meta}</div>
      {alreadyAdded ? (
        <div className="text-[12px] text-slate-400">✓ 追加済み</div>
      ) : (
        <>
          <div
            className="flex rounded-lg p-0.5 gap-0.5 mb-0"
            style={{ background: "#e2e8f0", marginBottom: type === "wish" ? 10 : 0 }}
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
            <div className="mb-3">
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

          <button
            onClick={() => onAdd(type, wishUsers)}
            disabled={type === "wish" && wishUsers.length === 0}
            className="w-full rounded-xl py-3 text-[14px] font-bold cursor-pointer border-none mt-1"
            style={{
              background: type === "wish" && wishUsers.length === 0 ? "#e2e8f0" : "#f59e0b",
              color: type === "wish" && wishUsers.length === 0 ? "#94a3b8" : "#fff",
            }}
          >
            {type === "wish" && wishUsers.length === 0 ? "ユーザーを選んでください" : "追加"}
          </button>
        </>
      )}
    </div>
  );
}
