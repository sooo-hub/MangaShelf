/**
 * 漫画情報取得ライブラリ
 * AniList API (GraphQL・無料・認証不要・日本語対応)
 * https://anilist.gitbook.io/anilist-apiv2-docs/
 */
import type { MangaCandidate, VolumeInfo, MangaStatus, Genre } from "../types/manga";

const ANILIST_URL = "https://graphql.anilist.co";

export class RateLimitError extends Error {
  code: number;
  constructor(code: number) {
    super(code === 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT");
    this.code = code;
  }
}

// AniList ジャンルを日本語にマッピング
const GENRE_MAP: Record<string, Genre> = {
  Action: "少年", Adventure: "少年", Fantasy: "ファンタジー",
  "Sci-Fi": "SF", Comedy: "ラブコメ", Romance: "ラブコメ",
  Horror: "ホラー", Sports: "スポーツ", Mystery: "ミステリー",
  Historical: "歴史", "Slice of Life": "日常",
};

// AniList の demographic タグを日本語ジャンルにマッピング
const DEMOGRAPHIC_MAP: Record<string, Genre> = {
  Shounen: "少年", Shoujo: "少女", Seinen: "青年", Josei: "女性",
};

function mapGenre(genres: string[], tags: Array<{ name: string }>): Genre {
  // タグからデモグラフィック判定
  for (const tag of tags) {
    const mapped = DEMOGRAPHIC_MAP[tag.name];
    if (mapped) return mapped;
  }
  // ジャンルからマッピング
  for (const g of genres) {
    const mapped = GENRE_MAP[g];
    if (mapped) return mapped;
  }
  return "その他";
}

function mapStatus(status: string): MangaStatus {
  if (status === "RELEASING") return "連載中";
  if (status === "FINISHED") return "完結";
  return "";
}

// Story/Art の著者を取得
function getAuthor(staff: Array<{ role: string; node: { name: { native: string | null; full: string } } }>): string {
  const storyArt = staff.find((s) => s.role.includes("Story") || s.role.includes("Art"));
  if (storyArt) {
    return storyArt.node.name.native?.trim() || storyArt.node.name.full;
  }
  return "";
}

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 5) {
    media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
      title { native romaji }
      volumes
      status
      genres
      tags { name category }
      staff(perPage: 5) {
        edges {
          role
          node { name { full native } }
        }
      }
    }
  }
}`;

const VOLUME_QUERY = `
query ($search: String) {
  Page(perPage: 1) {
    media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
      volumes
      status
    }
  }
}`;

async function postAniList(query: string, variables: Record<string, string>) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) throw new RateLimitError(429);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── searchManga ──────────────────────────────────────────
export async function searchManga(
  title: string,
  onStatus?: (msg: string) => void
): Promise<MangaCandidate[]> {
  onStatus?.("🔍 検索中...");

  const data = await postAniList(SEARCH_QUERY, { search: title });
  const items = data?.data?.Page?.media ?? [];
  if (items.length === 0) return [];

  return items.map((m: {
    title: { native: string | null; romaji: string };
    volumes: number | null;
    status: string;
    genres: string[];
    tags: Array<{ name: string; category: string }>;
    staff: { edges: Array<{ role: string; node: { name: { full: string; native: string | null } } }> };
  }) => {
    const demographicTags = m.tags.filter((t) => t.category === "Demographic");
    return {
      title: m.title.native ?? m.title.romaji,
      author: getAuthor(m.staff.edges),
      publisher: "",
      latestVolume: m.volumes ?? 0,
      genre: mapGenre(m.genres, demographicTags),
      status: mapStatus(m.status),
    };
  });
}

// ── fetchLatestVolume ──────────────────────────────────────────
export async function fetchLatestVolume(title: string): Promise<VolumeInfo> {
  const data = await postAniList(VOLUME_QUERY, { search: title });
  const items = data?.data?.Page?.media ?? [];
  if (items.length === 0) return { latestVolume: 0, status: "" };

  const m = items[0];
  return {
    latestVolume: m.volumes ?? 0,
    status: mapStatus(m.status),
  };
}

export { ANILIST_URL };
