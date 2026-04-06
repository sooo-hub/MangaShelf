import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchManga, fetchLatestVolume, RateLimitError, ANILIST_URL } from "../claudeApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// 環境変数のモック
vi.stubGlobal("import.meta", {
  env: {
    VITE_RAKUTEN_APP_ID: "test-app-id",
    VITE_RAKUTEN_ACCESS_KEY: "test-access-key",
  },
});

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

// 楽天APIのレスポンス形式
function makeRakutenResponse(titles: string[], status = 200) {
  return makeResponse(
    {
      Items: titles.map((title) => ({ Item: { title, salesDate: "2024年01月01日" } })),
    },
    status
  );
}

const sampleMedia = {
  title: { native: "鬼滅の刃", romaji: "Kimetsu no Yaiba" },
  volumes: 23,
  status: "FINISHED",
  genres: ["Action", "Adventure", "Drama"],
  tags: [{ name: "Shounen", category: "Demographic" }],
  staff: {
    edges: [
      { role: "Story & Art", node: { name: { full: "Koyoharu Gotouge", native: "吾峠呼世晴" } } },
    ],
  },
};

const releasingMedia = {
  title: { native: "ワンピース", romaji: "One Piece" },
  volumes: null,
  status: "RELEASING",
  genres: ["Action", "Adventure", "Comedy"],
  tags: [{ name: "Shounen", category: "Demographic" }],
  staff: {
    edges: [
      { role: "Story & Art", node: { name: { full: "Eiichiro Oda", native: "尾田栄一郎" } } },
    ],
  },
};

// ── searchManga ──────────────────────────────────────────

describe("searchManga", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("AniList GraphQL エンドポイントを呼ぶ", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    await searchManga("鬼滅の刃");
    expect(mockFetch).toHaveBeenCalledWith(ANILIST_URL, expect.objectContaining({ method: "POST" }));
  });

  it("検索キーワードが variables に含まれる", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    await searchManga("鬼滅の刃");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables.search).toBe("鬼滅の刃");
  });

  it("日本語タイトルを返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    const result = await searchManga("鬼滅の刃");
    expect(result[0].title).toBe("鬼滅の刃");
  });

  it("著者名(native)を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    const result = await searchManga("鬼滅の刃");
    expect(result[0].author).toBe("吾峠呼世晴");
  });

  it("巻数・完結ステータスを正しくマッピングする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    const result = await searchManga("鬼滅の刃");
    expect(result[0].latestVolume).toBe(23);
    expect(result[0].status).toBe("完結");
  });

  it("RELEASING を連載中にマッピングする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [releasingMedia] } } }));
    const result = await searchManga("ワンピース");
    expect(result[0].status).toBe("連載中");
  });

  it("Shounen タグを少年ジャンルにマッピングする", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    const result = await searchManga("鬼滅の刃");
    expect(result[0].genre).toBe("少年");
  });

  it("volumes が null の場合は 0 を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [releasingMedia] } } }));
    const result = await searchManga("ワンピース");
    expect(result[0].latestVolume).toBe(0);
  });

  it("結果が空の場合は空配列を返す", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [] } } }));
    const result = await searchManga("存在しない漫画");
    expect(result).toHaveLength(0);
  });

  it("複数候補を返す", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ data: { Page: { media: [sampleMedia, releasingMedia] } } })
    );
    const result = await searchManga("テスト");
    expect(result).toHaveLength(2);
  });

  it("onStatus コールバックが呼ばれる", async () => {
    const onStatus = vi.fn();
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [sampleMedia] } } }));
    await searchManga("鬼滅の刃", onStatus);
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

// ── fetchLatestVolume (楽天API) ──────────────────────────────────────────

describe("fetchLatestVolume", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("楽天APIから最新巻数を取得する", async () => {
    mockFetch.mockReturnValueOnce(
      makeRakutenResponse(["鬼滅の刃 23", "鬼滅の刃 22", "鬼滅の刃 21"])
    );
    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
  });

  it("最大巻数を正しく返す", async () => {
    mockFetch.mockReturnValueOnce(
      makeRakutenResponse(["ONE PIECE 114", "ONE PIECE 113", "ONE PIECE 112"])
    );
    const result = await fetchLatestVolume("ONE PIECE");
    expect(result.latestVolume).toBe(114);
  });

  it("タイトルに一致しない結果を除外する", async () => {
    mockFetch.mockReturnValueOnce(
      makeRakutenResponse(["鬼滅の刃 23", "鬼滅の刃はドグラ・マグラ 1", "鬼滅の刃 22"])
    );
    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
  });

  it("楽天で見つからない場合はAniListにフォールバック", async () => {
    // 楽天: 一致なし
    mockFetch.mockReturnValueOnce(makeRakutenResponse([]));
    // AniList フォールバック
    mockFetch.mockReturnValueOnce(
      makeResponse({ data: { Page: { media: [{ volumes: 23, status: "FINISHED" }] } } })
    );
    const result = await fetchLatestVolume("鬼滅の刃");
    expect(result.latestVolume).toBe(23);
    expect(result.status).toBe("完結");
  });

  it("AniListフォールバックで連載中を返す", async () => {
    mockFetch.mockReturnValueOnce(makeRakutenResponse([]));
    mockFetch.mockReturnValueOnce(
      makeResponse({ data: { Page: { media: [{ volumes: null, status: "RELEASING" }] } } })
    );
    const result = await fetchLatestVolume("ワンピース");
    expect(result.status).toBe("連載中");
    expect(result.latestVolume).toBe(0);
  });

  it("楽天・AniList両方で見つからない場合は 0 と空文字を返す", async () => {
    mockFetch.mockReturnValueOnce(makeRakutenResponse([]));
    mockFetch.mockReturnValueOnce(makeResponse({ data: { Page: { media: [] } } }));
    const result = await fetchLatestVolume("不明な漫画");
    expect(result.latestVolume).toBe(0);
    expect(result.status).toBe("");
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
