import { describe, it, expect, vi, beforeEach } from "vitest";
import { callClaude, searchManga, fetchLatestVolume, RateLimitError, API_URL } from "../claudeApi";

// fetch をモック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

// Claude API レスポンスのテキストブロックを生成するヘルパー
function textBlock(text: string) {
  return { type: "text", text };
}

// ── callClaude ──────────────────────────────────────────

describe("callClaude", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("正常なレスポンスから漫画候補を返す", async () => {
    const candidates = [
      { title: "鬼滅の刃", author: "吾峠呼世晴", publisher: "集英社", latestVolume: 23, genre: "少年", status: "完結" },
    ];
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock(JSON.stringify(candidates))] })
    );

    const result = await callClaude("鬼滅");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("鬼滅の刃");
    expect(result[0].latestVolume).toBe(23);
  });

  it("JSON が配列内に埋め込まれていても正しくパースできる", async () => {
    const json = '[{"title":"テスト漫画","author":"著者","publisher":"出版社","latestVolume":5,"genre":"少年","status":"連載中"}]';
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock(`結果: ${json} 以上です`)] })
    );

    const result = await callClaude("テスト");
    expect(result[0].title).toBe("テスト漫画");
  });

  it("titleのない候補はフィルタリングされる", async () => {
    const candidates = [
      { title: "正常", author: "著者A" },
      { author: "著者B" }, // title なし
    ];
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock(JSON.stringify(candidates))] })
    );

    const result = await callClaude("テスト");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("正常");
  });

  it("429 レスポンスで RateLimitError をスローする (code=429)", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 429));

    let caught: unknown;
    try {
      await callClaude("テスト");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(429);
    expect((caught as RateLimitError).message).toBe("RATE_LIMIT");
  });

  it("529 レスポンスで RateLimitError (SERVER_OVERLOAD) をスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 529));

    try {
      await callClaude("テスト");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).code).toBe(529);
      expect((e as RateLimitError).message).toBe("SERVER_OVERLOAD");
    }
  });

  it("500 エラーで通常の Error をスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 500));

    await expect(callClaude("テスト")).rejects.toThrow("HTTP 500");
  });

  it("JSON が見つからない場合にエラーをスローする", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock("JSONなしのレスポンス")] })
    );

    await expect(callClaude("テスト")).rejects.toThrow("情報が取得できませんでした");
  });

  it("正しいリクエストヘッダーを送信する", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('[{"title":"テスト","author":"著者","publisher":"出版社","latestVolume":1,"genre":"少年","status":"連載中"}]')] })
    );

    await callClaude("テスト");

    expect(mockFetch).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-api-key-sk-ant",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("web search ツールが含まれていないことを確認する (callClaude は非web検索)", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('[{"title":"テスト","author":"著者","publisher":"出版社","latestVolume":1,"genre":"少年","status":"連載中"}]')] })
    );

    await callClaude("テスト");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });
});

// ── searchManga ──────────────────────────────────────────

describe("searchManga", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // setTimeout を即時実行にモック (タイマー待機をスキップ)
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  it("成功時に候補を返す", async () => {
    const candidates = [
      { title: "ワンピース", author: "尾田栄一郎", publisher: "集英社", latestVolume: 109, genre: "少年", status: "連載中" },
    ];
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock(JSON.stringify(candidates))] })
    );

    const result = await searchManga("ワンピース");
    expect(result[0].title).toBe("ワンピース");
  });

  it("RateLimitError の後に最大3回リトライする", async () => {
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch
      .mockReturnValueOnce(makeResponse({}, 429))       // 1回目: 失敗
      .mockReturnValueOnce(makeResponse({}, 429))       // 2回目: 失敗
      .mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] })); // 3回目: 成功

    const result = await searchManga("テスト");
    expect(result[0].title).toBe("テスト");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("3回全て失敗した場合にエラーをスローする", async () => {
    mockFetch
      .mockReturnValueOnce(makeResponse({}, 429))
      .mockReturnValueOnce(makeResponse({}, 429))
      .mockReturnValueOnce(makeResponse({}, 429));

    await expect(searchManga("テスト")).rejects.toBeInstanceOf(RateLimitError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("onStatus コールバックが呼ばれる", async () => {
    const onStatus = vi.fn();
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock(JSON.stringify(candidates))] })
    );

    await searchManga("テスト", onStatus);
    expect(onStatus).toHaveBeenCalledWith("🔍 検索中...");
  });
});

// ── fetchLatestVolume ──────────────────────────────────────────

describe("fetchLatestVolume", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("最新刊情報を正しく取得する", async () => {
    const volumeInfo = { latestVolume: 35, status: "連載中" };
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock(JSON.stringify(volumeInfo))] })
    );

    const result = await fetchLatestVolume("ナルト");
    expect(result.latestVolume).toBe(35);
    expect(result.status).toBe("連載中");
  });

  it("完結作品のステータスを取得する", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('{"latestVolume":23,"status":"完結"}')] })
    );

    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
    expect(result.status).toBe("完結");
  });

  it("web search ベータヘッダーが含まれる", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('{"latestVolume":1,"status":"連載中"}')] })
    );

    await fetchLatestVolume("テスト漫画");

    expect(mockFetch).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          "anthropic-beta": "web-search-2025-03-05",
        }),
      })
    );
  });

  it("web_search ツールがリクエストボディに含まれる", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('{"latestVolume":1,"status":"連載中"}')] })
    );

    await fetchLatestVolume("テスト漫画");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeDefined();
    expect(body.tools[0].type).toBe("web_search_20250305");
  });

  it("JSON が埋め込まれていても取得できる", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('最新刊: {"latestVolume":10,"status":"連載中"} 以上')] })
    );

    const result = await fetchLatestVolume("テスト");
    expect(result.latestVolume).toBe(10);
  });

  it("429 でエラーをスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 429));

    await expect(fetchLatestVolume("テスト")).rejects.toThrow(RateLimitError);
  });

  it("取得失敗時にエラーをスローする", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock("情報なし")] })
    );

    await expect(fetchLatestVolume("テスト")).rejects.toThrow("取得失敗");
  });
});

// ── RateLimitError ──────────────────────────────────────────

describe("RateLimitError", () => {
  it("正しいプロパティを持つ", () => {
    const err = new RateLimitError(429);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.code).toBe(429);
    expect(err.message).toBe("RATE_LIMIT");
  });

  it("529 は SERVER_OVERLOAD メッセージを持つ", () => {
    const err = new RateLimitError(529);
    expect(err.message).toBe("SERVER_OVERLOAD");
    expect(err.code).toBe(529);
  });
});
