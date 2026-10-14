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
    expect(normaliseCodes("MXK-RXJL-2PD-TZ9\nWMX-2CZC-WPQ-KLM")).toEqual([
      "MXK-RXJL-2PD-TZ9",
      "WMX-2CZC-WPQ-KLM",
    ]);
  });

  it("extracts comma-separated codes", () => {
    expect(normaliseCodes("MXK-RXJL-2PD-TZ9, WMX-2CZC-WPQ-KLM, 4PC-NDCX-BXR-Z2C")).toEqual([
      "MXK-RXJL-2PD-TZ9",
      "WMX-2CZC-WPQ-KLM",
      "4PC-NDCX-BXR-Z2C",
    ]);
  });

  it("extracts codes and ignores other text", () => {
    expect(
      normaliseCodes(
        "[Scarlet & Violet - Shrouded Fable Booster Pack: 1-2]\nMXK-RXJL-2PD-TZ9\n\n[Another format: 3-4]\nWMX-2CZC-WPQ-KLM",
      ),
    ).toEqual(["MXK-RXJL-2PD-TZ9", "WMX-2CZC-WPQ-KLM"]);
  });

  it("does not extract partial matches from malformed tokens", () => {
    expect(normaliseCodes("!MXK-RXJL-2PD-TZ9X malformed-code")).toEqual([]);
  });
});
