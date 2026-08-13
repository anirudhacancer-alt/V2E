import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSqlitePath } from "./env.js";

describe("resolveSqlitePath", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses DATABASE_URL with file: scheme", () => {
    vi.stubEnv("DATABASE_URL", "file:/tmp/demo-test.sqlite");
    expect(resolveSqlitePath()).toBe(path.resolve("/tmp/demo-test.sqlite"));
  });

  it("uses SQLITE_PATH when set", () => {
    vi.stubEnv("SQLITE_PATH", "/custom/db.sqlite");
    expect(resolveSqlitePath()).toBe("/custom/db.sqlite");
  });

  it("uses DATABASE_PATH when SQLITE_PATH is unset", () => {
    vi.stubEnv("DATABASE_PATH", "/other/x.sqlite");
    expect(resolveSqlitePath()).toBe("/other/x.sqlite");
  });

  it("prefers SQLITE_PATH over DATABASE_PATH", () => {
    vi.stubEnv("SQLITE_PATH", "/a.sqlite");
    vi.stubEnv("DATABASE_PATH", "/b.sqlite");
    expect(resolveSqlitePath()).toBe("/a.sqlite");
  });

  it("defaults to monorepo packages/database/data/demo.sqlite", () => {
    const resolved = resolveSqlitePath();
    expect(resolved).toMatch(/packages[/\\]database[/\\]data[/\\]demo\.sqlite$/);
  });
});
