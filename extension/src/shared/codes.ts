import { CODE_CHARS, CODE_RE } from "./constants";

const CODE_MATCH_RE = new RegExp(
  `(?:^|[^A-Za-z0-9-])([${CODE_CHARS}]{3}-?[${CODE_CHARS}]{4}(?:-?[${CODE_CHARS}]{3}){2})(?![A-Za-z0-9-])`,
  "gi",
);

export function canonicalCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normaliseCodes(value: string): string[] {
  return Array.from(value.matchAll(CODE_MATCH_RE), ([, code]) => code);
}

export function isValidFormat(code: string): boolean {
  return CODE_RE.test(normaliseCode(code));
}
