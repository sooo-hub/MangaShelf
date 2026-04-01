import type { MangaCandidate, VolumeInfo, MangaStatus } from "../types/manga";

// Cloud Functions のベースURL
// 本番: Firebase Functions の URL (asia-northeast1)
// ローカル開発: Firebase Emulator
const FUNCTIONS_BASE =
  import.meta.env.VITE_FUNCTIONS_BASE_URL ??
  `https://asia-northeast1-manga-shelf-sou.cloudfunctions.net`;

export class RateLimitError extends Error {
  code: number;
  constructor(code: number) {
    super(code === 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT");
    this.code = code;
  }
}

// ── searchManga: Cloud Functions 経由で漫画情報を検索 ──────
export async function searchManga(
  title: string,
  onStatus?: (msg: string) => void
): Promise<MangaCandidate[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        const wait = attempt * 3000;
        onStatus?.(`⏳ サーバー混雑中... ${wait / 1000}秒後に再試行 (${attempt}/2)`);
        await new Promise((r) => setTimeout(r, wait));
      }
      onStatus?.("🔍 検索中...");

      const res = await fetch(`${FUNCTIONS_BASE}/searchManga`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (res.status === 429 || res.status === 529) throw new RateLimitError(res.status);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { candidates: MangaCandidate[] };
      return data.candidates;
    } catch (e) {
      if (e instanceof RateLimitError && attempt < 2) continue;
      throw e;
    }
  }
  throw new Error("検索に失敗しました");
}

// ── fetchLatestVolume: Cloud Functions 経由で最新刊を取得 ──
export async function fetchLatestVolume(title: string): Promise<VolumeInfo> {
  const res = await fetch(`${FUNCTIONS_BASE}/fetchLatestVolume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (res.status === 429 || res.status === 529) throw new RateLimitError(res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as { latestVolume: number; status: string };
  return {
    latestVolume: data.latestVolume ?? 0,
    status: (data.status as MangaStatus) ?? "",
  };
}

// テスト用エクスポート
export { FUNCTIONS_BASE };
