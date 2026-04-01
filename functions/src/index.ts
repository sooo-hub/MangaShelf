import * as functions from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── 共通: Anthropic API 呼び出し ──────────────────────
async function callAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  useWebSearch = false
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (useWebSearch) {
    headers["anthropic-beta"] = "web-search-2025-03-05";
  }
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ── searchManga: タイトルから漫画情報を検索 ──────────────
export const searchManga = functions.onRequest(
  { secrets: [anthropicApiKey], region: "asia-northeast1", cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(CORS_HEADERS).status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { title } = req.body as { title?: string };
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const body = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      system: `漫画タイトルを受け取り、JSONのみ返してください。余計な文字なし。
[{"title":"正式タイトル","author":"著者名","publisher":"出版社","latestVolume":最新巻の整数,"genre":"少年/少女/青年/女性/SF/ファンタジー/ラブコメ/ホラー/スポーツ/ミステリー/歴史/日常/その他","status":"連載中 or 完結"}]
最大3候補。latestVolumeが不明なら0。不明な文字列は空文字。`,
      messages: [{ role: "user", content: [{ type: "text", text: title }] }],
    };

    try {
      const upstream = await callAnthropic(anthropicApiKey.value(), body, false);
      const data = await upstream.json();

      if (!upstream.ok) {
        res.status(upstream.status).json(data);
        return;
      }

      const text = (
        (data.content as Array<{ type: string; text?: string }>) || []
      )
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");

      const match = text.match(/\[[\s\S]*?\]/);
      if (!match) {
        res.status(422).json({ error: "情報が取得できませんでした" });
        return;
      }

      const candidates = (
        JSON.parse(match[0]) as Array<Record<string, unknown>>
      ).filter((x) => x.title);
      res.json({ candidates });
    } catch (e) {
      console.error("searchManga error:", e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// ── fetchLatestVolume: Web検索で最新刊を取得 ────────────
export const fetchLatestVolume = functions.onRequest(
  { secrets: [anthropicApiKey], region: "asia-northeast1", cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set(CORS_HEADERS).status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { title } = req.body as { title?: string };
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const body = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `漫画の最新刊情報をweb検索して調べ、以下のJSONのみ返してください。余計な文字なし。
{"latestVolume":最新巻の整数,"status":"連載中 or 完結"}
不明な場合は{"latestVolume":0,"status":""}`,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `「${title}」の最新巻数と連載状況` }],
        },
      ],
    };

    try {
      const upstream = await callAnthropic(anthropicApiKey.value(), body, true);
      const data = await upstream.json();

      if (!upstream.ok) {
        res.status(upstream.status).json(data);
        return;
      }

      const text = (
        (data.content as Array<{ type: string; text?: string }>) || []
      )
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");

      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) {
        res.status(422).json({ error: "取得失敗" });
        return;
      }

      const result = JSON.parse(match[0]) as {
        latestVolume?: number;
        status?: string;
      };
      res.json({
        latestVolume: result.latestVolume ?? 0,
        status: result.status ?? "",
      });
    } catch (e) {
      console.error("fetchLatestVolume error:", e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
