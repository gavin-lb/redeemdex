import { CODE_RE } from "./constants";

export function canonicalCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normaliseCodes(value: string): string[] {
  return value
    .split(/\s+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

export function isValidFormat(code: string): boolean {
  return CODE_RE.test(normaliseCode(code));
}
