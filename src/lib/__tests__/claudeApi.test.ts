import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchManga, fetchLatestVolume, RateLimitError, JIKAN_BASE } from "../claudeApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const sampleManga = {
  mal_id: 13,
  title: "One Piece",
  title_japanese: "ワンピース",
  volumes: 109,
  status: "Publishing",
  genres: [{ name: "Action" }],
  themes: [],
  demographics: [{ name: "Shounen" }],
  authors: [{ name: "Oda, Eiichiro" }],
  serializations: [{ name: "Shounen Jump (Weekly)" }],
  score: 9.1,
};

const completedManga = {
  mal_id: 23,
  title: "Kimetsu no Yaiba",
  title_japanese: "鬼滅の刃",
  volumes: 23,
  status: "Finished",
  genres: [{ name: "Action" }],
  themes: [],
  demographics: [{ name: "Shounen" }],
  authors: [{ name: "Gotouge, Koyoharu" }],
  serializations: [{ name: "Shounen Jump (Weekly)" }],
  score: 8.8,
};

// ── searchManga ──────────────────────────────────────────

describe("searchManga", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("Jikan API の正しいエンドポイントを呼ぶ", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    await searchManga("ワンピース");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${JIKAN_BASE}/manga?q=`)
    );
  });

  it("タイトルが URL エンコードされる", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    await searchManga("ワンピース");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("ワンピース"));
  });

  it("日本語タイトルを優先して返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    const result = await searchManga("ワンピース");
    expect(result[0].title).toBe("ワンピース");
  });

  it("巻数・ステータスを正しくマッピングする (連載中)", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    const result = await searchManga("ワンピース");
    expect(result[0].latestVolume).toBe(109);
    expect(result[0].status).toBe("連載中");
  });

  it("ステータスを正しくマッピングする (完結)", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [completedManga] }));
    const result = await searchManga("鬼滅");
    expect(result[0].status).toBe("完結");
    expect(result[0].latestVolume).toBe(23);
  });

  it("Shounen デモグラフィックを少年ジャンルにマッピングする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    const result = await searchManga("ワンピース");
    expect(result[0].genre).toBe("少年");
  });

  it("複数候補を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga, completedManga] }));
    const result = await searchManga("テスト");
    expect(result).toHaveLength(2);
  });

  it("結果が空の場合は空配列を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [] }));
    const result = await searchManga("存在しない漫画XYZXYZ");
    expect(result).toHaveLength(0);
  });

  it("volumes が null の場合は 0 を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [{ ...sampleManga, volumes: null }] }));
    const result = await searchManga("テスト");
    expect(result[0].latestVolume).toBe(0);
  });

  it("onStatus コールバックが呼ばれる", async () => {
    const onStatus = vi.fn();
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    await searchManga("ワンピース", onStatus);
    expect(onStatus).toHaveBeenCalledWith("🔍 検索中...");
  });

  it("429 で RateLimitError をスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 429));
    let caught: unknown;
    try { await searchManga("テスト"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(429);
  });

  it("500 エラーで Error をスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 500));
    await expect(searchManga("テスト")).rejects.toThrow("HTTP 500");
  });
});

// ── fetchLatestVolume ──────────────────────────────────────────

describe("fetchLatestVolume", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("最新刊情報を正しく取得する (連載中)", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    const result = await fetchLatestVolume("ワンピース");
    expect(result.latestVolume).toBe(109);
    expect(result.status).toBe("連載中");
  });

  it("完結作品を正しく取得する", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [completedManga] }));
    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
    expect(result.status).toBe("完結");
  });

  it("結果が空の場合は 0 と空文字を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [] }));
    const result = await fetchLatestVolume("不明な漫画");
    expect(result.latestVolume).toBe(0);
    expect(result.status).toBe("");
  });

  it("limit=1 で呼ぶ", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: [sampleManga] }));
    await fetchLatestVolume("テスト");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=1");
  });

  it("429 で RateLimitError をスローする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 429));
    let caught: unknown;
    try { await fetchLatestVolume("テスト"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RateLimitError);
  });
});

// ── RateLimitError ──────────────────────────────────────────

describe("RateLimitError", () => {
  it("429 は RATE_LIMIT メッセージを持つ", () => {
    const err = new RateLimitError(429);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(429);
    expect(err.message).toBe("RATE_LIMIT");
  });

  it("529 は SERVER_OVERLOAD メッセージを持つ", () => {
    const err = new RateLimitError(529);
    expect(err.message).toBe("SERVER_OVERLOAD");
  });
});
