/**
 * 漫画情報取得ライブラリ
 * - 検索: AniList API (GraphQL・無料・認証不要・日本語対応)
 * - 最新刊: 楽天ブックスAPI (実際の発売巻数を取得)
 */
import type { MangaCandidate, VolumeInfo, MangaStatus, Genre } from "../types/manga";

export const ANILIST_URL = "https://graphql.anilist.co";
const RAKUTEN_URL = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";
const RAKUTEN_APP_ID = import.meta.env.VITE_RAKUTEN_APP_ID as string;
const RAKUTEN_ACCESS_KEY = import.meta.env.VITE_RAKUTEN_ACCESS_KEY as string;

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
  for (const tag of tags) {
    const mapped = DEMOGRAPHIC_MAP[tag.name];
    if (mapped) return mapped;
  }
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

// ── searchManga (AniList) ──────────────────────────────────────────
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

// ── fetchLatestVolume (楽天ブックスAPI) ──────────────────────────────
export async function fetchLatestVolume(title: string): Promise<VolumeInfo> {
  const params = new URLSearchParams({
    format: "json",
    title,
    applicationId: RAKUTEN_APP_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    sort: "standard",
    hits: "30",
  });

  const res = await fetch(`${RAKUTEN_URL}?${params.toString()}`);
  if (res.status === 429) throw new RateLimitError(429);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  const items: Array<{ title: string; salesDate: string }> = (data.Items ?? []).map(
    (i: { Item?: { title: string; salesDate: string }; title?: string; salesDate?: string }) =>
      i.Item ?? i
  );

  // 「タイトル 巻数」形式のアイテムを抽出（例: "ONE PIECE 114", "キングダム 79"）
  const volItems = items.filter((b) => {
    const t = b.title;
    return (
      (t.startsWith(title + " ") || t.startsWith(title + "　")) &&
      /\d+$/.test(t)
    );
  });

  const nums = volItems
    .map((b) => {
      const m = b.title.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0 && n < 10000);

  if (nums.length === 0) {
    // 単巻作品やフォールバック: AniListで確認
    return fetchLatestVolumeFromAniList(title);
  }

  const latestVolume = Math.max(...nums);
  return { latestVolume, status: "" };
}

// 楽天で見つからない場合のフォールバック (AniList)
async function fetchLatestVolumeFromAniList(title: string): Promise<VolumeInfo> {
  const VOLUME_QUERY = `
  query ($search: String) {
    Page(perPage: 1) {
      media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
        volumes
        status
      }
    }
  }`;
  try {
    const data = await postAniList(VOLUME_QUERY, { search: title });
    const items = data?.data?.Page?.media ?? [];
    if (items.length === 0) return { latestVolume: 0, status: "" };
    const m = items[0];
    return { latestVolume: m.volumes ?? 0, status: mapStatus(m.status) };
  } catch {
    return { latestVolume: 0, status: "" };
  }
}
