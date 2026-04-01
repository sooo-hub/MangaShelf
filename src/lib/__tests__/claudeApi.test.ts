import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchManga, fetchLatestVolume, RateLimitError, API_URL } from "../claudeApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

function textBlock(text: string) {
  return { type: "text", text };
}

// ── searchManga ──────────────────────────────────────────

describe("searchManga", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  it("正しいAnthropicエンドポイントを呼ぶ", async () => {
    const candidates = [
      { title: "鬼滅の刃", author: "吾峠呼世晴", publisher: "集英社", latestVolume: 23, genre: "少年", status: "完結" },
    ];
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] }));

    await searchManga("鬼滅");
    expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({ method: "POST" }));
  });

  it("正常なレスポンスから漫画候補を返す", async () => {
    const candidates = [
      { title: "ワンピース", author: "尾田栄一郎", publisher: "集英社", latestVolume: 109, genre: "少年", status: "連載中" },
    ];
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] }));

    const result = await searchManga("ワンピース");
    expect(result[0].title).toBe("ワンピース");
    expect(result[0].latestVolume).toBe(109);
  });

  it("JSON が埋め込まれていても正しくパースできる", async () => {
    const json = '[{"title":"テスト漫画","author":"著者","publisher":"出版社","latestVolume":5,"genre":"少年","status":"連載中"}]';
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock(`結果: ${json}`)] }));

    const result = await searchManga("テスト");
    expect(result[0].title).toBe("テスト漫画");
  });

  it("titleのない候補はフィルタリングされる", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ content: [textBlock('[{"title":"正常"},{"author":"著者のみ"}]')] })
    );
    const result = await searchManga("テスト");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("正常");
  });

  it("429 でRateLimitError(RATE_LIMIT)をスローする", async () => {
    mockFetch.mockReturnValue(makeResponse({}, 429));
    let caught: unknown;
    try { await searchManga("テスト"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(429);
    expect((caught as RateLimitError).message).toBe("RATE_LIMIT");
  });

  it("529 でRateLimitError(SERVER_OVERLOAD)をスローする", async () => {
    mockFetch.mockReturnValue(makeResponse({}, 529));
    let caught: unknown;
    try { await searchManga("テスト"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(529);
    expect((caught as RateLimitError).message).toBe("SERVER_OVERLOAD");
  });

  it("RateLimitError の後に最大3回リトライする", async () => {
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch
      .mockReturnValueOnce(makeResponse({}, 429))
      .mockReturnValueOnce(makeResponse({}, 429))
      .mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] }));
    const result = await searchManga("テスト");
    expect(result[0].title).toBe("テスト");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("3回全て失敗した場合にエラーをスローする", async () => {
    mockFetch.mockReturnValue(makeResponse({}, 429));
    await expect(searchManga("テスト")).rejects.toBeInstanceOf(RateLimitError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("onStatus コールバックが呼ばれる", async () => {
    const onStatus = vi.fn();
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] }));
    await searchManga("テスト", onStatus);
    expect(onStatus).toHaveBeenCalledWith("🔍 検索中...");
  });

  it("正しいリクエストヘッダーを送信する", async () => {
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] }));
    await searchManga("テスト");
    expect(mockFetch).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "test-api-key-sk-ant",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        }),
      })
    );
  });

  it("web search ツールが含まれていない (searchManga は非web検索)", async () => {
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock(JSON.stringify(candidates))] }));
    await searchManga("テスト");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });
});

// ── fetchLatestVolume ──────────────────────────────────────────

describe("fetchLatestVolume", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("最新刊情報を正しく取得する", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock('{"latestVolume":35,"status":"連載中"}')] }));
    const result = await fetchLatestVolume("ナルト");
    expect(result.latestVolume).toBe(35);
    expect(result.status).toBe("連載中");
  });

  it("完結作品のステータスを取得する", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock('{"latestVolume":23,"status":"完結"}')] }));
    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
    expect(result.status).toBe("完結");
  });

  it("web search ベータヘッダーが含まれる", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock('{"latestVolume":1,"status":"連載中"}')] }));
    await fetchLatestVolume("テスト");
    expect(mockFetch).toHaveBeenCalledWith(
      API_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ "anthropic-beta": "web-search-2025-03-05" }),
      })
    );
  });

  it("web_search ツールがリクエストボディに含まれる", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock('{"latestVolume":1,"status":"連載中"}')] }));
    await fetchLatestVolume("テスト");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools[0].type).toBe("web_search_20250305");
  });

  it("429 でRateLimitErrorをスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 429));
    let caught: unknown;
    try { await fetchLatestVolume("テスト"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(429);
  });

  it("JSON が見つからない場合にエラーをスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ content: [textBlock("情報なし")] }));
    await expect(fetchLatestVolume("テスト")).rejects.toThrow("取得失敗");
  });
});

// ── RateLimitError ──────────────────────────────────────────

describe("RateLimitError", () => {
  it("429 は RATE_LIMIT メッセージを持つ", () => {
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
