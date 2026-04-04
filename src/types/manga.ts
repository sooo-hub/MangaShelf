export const USERS = ["爽", "杏"] as const;
export type UserName = (typeof USERS)[number];

export const GENRES = [
  "少年", "少女", "青年", "女性", "SF", "ファンタジー",
  "ラブコメ", "ホラー", "スポーツ", "ミステリー", "歴史", "日常", "その他",
] as const;
export type Genre = (typeof GENRES)[number] | "";

export type MangaStatus = "連載中" | "完結" | "";
export type MangaType = "own" | "wish";

export interface MangaPart {
  id: number;
  name: string;
  from: string;
  to: string;
}

export interface Manga {
  id: string;
  title: string;
  author: string;
  publisher: string;
  latestVolume: number;
  genre: Genre;
  status: MangaStatus;
  type: MangaType;
  ownedVolumes: number[];
  wishUsers: UserName[];
  seriesName?: string;
  parts?: MangaPart[];
  createdAt?: number;
  updatedAt?: number;
}

export interface MangaCandidate {
  title: string;
  author: string;
  publisher: string;
  latestVolume: number;
  genre: Genre;
  status: MangaStatus;
}

export interface VolumeInfo {
  latestVolume: number;
  status: MangaStatus;
}
