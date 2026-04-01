import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchManga, fetchLatestVolume, RateLimitError, FUNCTIONS_BASE } from "../claudeApi";

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

// ── searchManga ──────────────────────────────────────────

describe("searchManga", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // setTimeout を即時実行にモック
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  it("Cloud Functions の正しいエンドポイントを呼ぶ", async () => {
    const candidates = [
      { title: "鬼滅の刃", author: "吾峠呼世晴", publisher: "集英社", latestVolume: 23, genre: "少年", status: "完結" },
    ];
    mockFetch.mockReturnValueOnce(makeResponse({ candidates }));

    await searchManga("鬼滅");

    expect(mockFetch).toHaveBeenCalledWith(
      `${FUNCTIONS_BASE}/searchManga`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "鬼滅" }),
      })
    );
  });

  it("正常なレスポンスから漫画候補を返す", async () => {
    const candidates = [
      { title: "ワンピース", author: "尾田栄一郎", publisher: "集英社", latestVolume: 109, genre: "少年", status: "連載中" },
    ];
    mockFetch.mockReturnValueOnce(makeResponse({ candidates }));

    const result = await searchManga("ワンピース");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("ワンピース");
    expect(result[0].latestVolume).toBe(109);
  });

  it("複数候補を返す", async () => {
    const candidates = [
      { title: "ジョジョ 第1部", author: "荒木飛呂彦", publisher: "集英社", latestVolume: 5, genre: "少年", status: "完結" },
      { title: "ジョジョ 第2部", author: "荒木飛呂彦", publisher: "集英社", latestVolume: 4, genre: "少年", status: "完結" },
    ];
    mockFetch.mockReturnValueOnce(makeResponse({ candidates }));

    const result = await searchManga("ジョジョ");
    expect(result).toHaveLength(2);
  });

  it("429 レスポンスで RateLimitError (RATE_LIMIT) をスローする", async () => {
    // searchManga は3回リトライするので3回分モック
    mockFetch.mockReturnValue(makeResponse({}, 429));

    let caught: unknown;
    try {
      await searchManga("テスト");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(429);
    expect((caught as RateLimitError).message).toBe("RATE_LIMIT");
  });

  it("529 レスポンスで SERVER_OVERLOAD エラーをスローする", async () => {
    // searchManga は3回リトライするので常に529を返す
    mockFetch.mockReturnValue(makeResponse({}, 529));

    let caught: unknown;
    try {
      await searchManga("テスト");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(529);
    expect((caught as RateLimitError).message).toBe("SERVER_OVERLOAD");
  });

  it("RateLimitError の後に最大3回リトライする", async () => {
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch
      .mockReturnValueOnce(makeResponse({}, 429))
      .mockReturnValueOnce(makeResponse({}, 429))
      .mockReturnValueOnce(makeResponse({ candidates }));

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

  it("500 エラーでエラーメッセージを返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ error: "Internal Server Error" }, 500));

    await expect(searchManga("テスト")).rejects.toThrow("Internal Server Error");
  });

  it("onStatus コールバックが呼ばれる", async () => {
    const onStatus = vi.fn();
    const candidates = [{ title: "テスト", author: "", publisher: "", latestVolume: 1, genre: "少年", status: "連載中" as const }];
    mockFetch.mockReturnValueOnce(makeResponse({ candidates }));

    await searchManga("テスト", onStatus);
    expect(onStatus).toHaveBeenCalledWith("🔍 検索中...");
  });
});

// ── fetchLatestVolume ──────────────────────────────────────────

describe("fetchLatestVolume", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("Cloud Functions の正しいエンドポイントを呼ぶ", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ latestVolume: 35, status: "連載中" }));

    await fetchLatestVolume("ナルト");

    expect(mockFetch).toHaveBeenCalledWith(
      `${FUNCTIONS_BASE}/fetchLatestVolume`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "ナルト" }),
      })
    );
  });

  it("最新刊情報を正しく取得する", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ latestVolume: 35, status: "連載中" }));

    const result = await fetchLatestVolume("ナルト");
    expect(result.latestVolume).toBe(35);
    expect(result.status).toBe("連載中");
  });

  it("完結作品のステータスを取得する", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ latestVolume: 23, status: "完結" }));

    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
    expect(result.status).toBe("完結");
  });

  it("latestVolume が 0 の場合も正常に返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ latestVolume: 0, status: "" }));

    const result = await fetchLatestVolume("不明な漫画");
    expect(result.latestVolume).toBe(0);
    expect(result.status).toBe("");
  });

  it("429 でエラーをスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 429));

    let caught: unknown;
    try {
      await fetchLatestVolume("テスト");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(429);
  });

  it("422 エラー (取得失敗) を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ error: "取得失敗" }, 422));

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
