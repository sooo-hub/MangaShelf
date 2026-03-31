// vitest グローバルセットアップ
// 各テストの前に fetch をリセットする
import { vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.stubEnv("VITE_ANTHROPIC_API_KEY", "test-api-key-sk-ant");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
