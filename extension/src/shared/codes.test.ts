import { describe, expect, it } from "vitest";
import { canonicalCode, isValidFormat, normaliseCodes } from "./codes";

describe("code helpers", () => {
  it("canonicalises codes", () => {
    expect(canonicalCode("abc-123-def-456")).toBe("ABC123DEF456");
  });

  it("validates the supported code format", () => {
    expect(isValidFormat("246-BCDG-246-BCD")).toBe(true);
    expect(isValidFormat("hello-world")).toBe(false);
  });

  it("splits pasted codes on whitespace", () => {
    expect(normaliseCodes("ABC\nDEF  GHI")).toEqual(["ABC", "DEF", "GHI"]);
  });
});
