import type { MangaCandidate, VolumeInfo, MangaStatus } from "../types/manga";

const API_URL = "https://api.anthropic.com/v1/messages";

function getApiKey(): string {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!key) throw new Error("VITE_ANTHROPIC_API_KEY が設定されていません");
  return key;
}

function getHeaders(useWebSearch = false): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": getApiKey(),
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (useWebSearch) {
    headers["anthropic-beta"] = "web-search-2025-03-05";
  }
  return headers;
}

export class RateLimitError extends Error {
  code: number;
  constructor(code: number) {
    super(code === 529 ? "SERVER_OVERLOAD" : "RATE_LIMIT");
    this.code = code;
  }
}

async function callClaude(title: string): Promise<MangaCandidate[]> {
  const body = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 600,
    system: `漫画タイトルを受け取り、JSONのみ返してください。余計な文字なし。
[{"title":"正式タイトル","author":"著者名","publisher":"出版社","latestVolume":最新巻の整数,"genre":"少年/少女/青年/女性/SF/ファンタジー/ラブコメ/ホラー/スポーツ/ミステリー/歴史/日常/その他","status":"連載中 or 完結"}]
最大3候補。latestVolumeが不明なら0。不明な文字列は空文字。`,
    messages: [{ role: "user", content: [{ type: "text", text: title }] }],
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: getHeaders(false),
    body: JSON.stringify(body),
  });

  if (res.status === 429 || res.status === 529) throw new RateLimitError(res.status);
  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = (data.content as Array<{ type: string; text?: string }> || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("情報が取得できませんでした");

  return (JSON.parse(match[0]) as MangaCandidate[]).filter((x) => x.title);
}

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
      return await callClaude(title);
    } catch (e) {
      if (e instanceof RateLimitError && attempt < 2) continue;
      throw e;
    }
  }
  throw new Error("検索に失敗しました");
}

export async function fetchLatestVolume(title: string): Promise<VolumeInfo> {
  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `漫画の最新刊情報をweb検索して調べ、以下のJSONのみ返してください。余計な文字なし。
{"latestVolume":最新巻の整数,"status":"連載中 or 完結"}
不明な場合は{"latestVolume":0,"status":""}`,
    messages: [
      { role: "user", content: [{ type: "text", text: `「${title}」の最新巻数と連載状況` }] },
    ],
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(body),
  });

  if (res.status === 429 || res.status === 529) throw new RateLimitError(res.status);
  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = (data.content as Array<{ type: string; text?: string }> || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("取得失敗");

  const parsed = JSON.parse(match[0]) as { latestVolume?: number; status?: string };
  return {
    latestVolume: parsed.latestVolume ?? 0,
    status: (parsed.status as MangaStatus) ?? "",
  };
}

export { API_URL };
