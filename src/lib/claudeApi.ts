/**
 * 漫画情報取得ライブラリ
 * Jikan API (MyAnimeList非公式・無料・認証不要) を使用
 * https://jikan.moe/
 */
import type { MangaCandidate, VolumeInfo, MangaStatus, Genre } from "../types/manga";

const JIKAN_BASE = "https://api.jikan.moe/v4";

export class RateLimitError extends Error {
  code: number;
  constructor(code: number) {
    super(code === 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT");
    this.code = code;
  }
}

// Jikan のジャンルを日本語にマッピング
const GENRE_MAP: Record<string, Genre> = {
  Action: "少年", Adventure: "少年", Fantasy: "ファンタジー",
  "Sci-Fi": "SF", Comedy: "ラブコメ", Romance: "ラブコメ",
  Horror: "ホラー", Sports: "スポーツ", Mystery: "ミステリー",
  Historical: "歴史", "Slice of Life": "日常",
  Shounen: "少年", Shoujo: "少女", Seinen: "青年", Josei: "女性",
};

function mapGenre(genres: Array<{ name: string }>): Genre {
  for (const g of genres) {
    const mapped = GENRE_MAP[g.name];
    if (mapped) return mapped;
  }
  return "その他";
}

function mapStatus(status: string): MangaStatus {
  if (status === "Publishing") return "連載中";
  if (status === "Finished") return "完結";
  return "";
}

interface JikanManga {
  mal_id: number;
  title: string;
  title_japanese?: string;
  volumes: number | null;
  status: string;
  genres: Array<{ name: string }>;
  themes: Array<{ name: string }>;
  demographics: Array<{ name: string }>;
  authors: Array<{ name: string }>;
  serializations: Array<{ name: string }>;
  score: number | null;
}

// ── searchManga: タイトルから漫画情報を検索 ──────────────
export async function searchManga(
  title: string,
  onStatus?: (msg: string) => void
): Promise<MangaCandidate[]> {
  onStatus?.("🔍 検索中...");

  const url = `${JIKAN_BASE}/manga?q=${encodeURIComponent(title)}&limit=5&order_by=popularity`;
  const res = await fetch(url);

  if (res.status === 429) throw new RateLimitError(429);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as { data: JikanManga[] };
  if (!data.data || data.data.length === 0) return [];

  return data.data.map((m) => {
    const allGenres = [...(m.genres ?? []), ...(m.themes ?? []), ...(m.demographics ?? [])];
    return {
      title: m.title_japanese ?? m.title,
      author: m.authors?.map((a) => a.name.replace(/,\s*/, " ")).join("、") ?? "",
      publisher: m.serializations?.[0]?.name ?? "",
      latestVolume: m.volumes ?? 0,
      genre: mapGenre(allGenres),
      status: mapStatus(m.status),
    };
  });
}

// ── fetchLatestVolume: 最新刊・連載状況を取得 ────────────
export async function fetchLatestVolume(title: string): Promise<VolumeInfo> {
  const url = `${JIKAN_BASE}/manga?q=${encodeURIComponent(title)}&limit=1&order_by=popularity`;
  const res = await fetch(url);

  if (res.status === 429) throw new RateLimitError(429);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as { data: JikanManga[] };
  if (!data.data || data.data.length === 0) {
    return { latestVolume: 0, status: "" };
  }

  const m = data.data[0];
  return {
    latestVolume: m.volumes ?? 0,
    status: mapStatus(m.status),
  };
}

export { JIKAN_BASE };
