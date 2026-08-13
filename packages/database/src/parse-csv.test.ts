import { describe, expect, it } from "vitest";

import { parseCsv } from "./parse-csv.js";

describe("parseCsv", () => {
  it("parses header and rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
  });

  it("handles quoted commas and escaped quotes", () => {
    const rows = parseCsv('a,b\n"hello,world","say ""hi"""');
    expect(rows[0]).toEqual({ a: "hello,world", b: 'say "hi"' });
  });

  it("skips empty trailing line", () => {
    expect(parseCsv("x,y\na,b\n")).toEqual([{ x: "a", y: "b" }]);
  });
});
