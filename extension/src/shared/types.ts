export type StatusClass = "valid" | "redeemed" | "invalid" | "pending" | "error";

export interface CodeItem {
  code: string;
  status: string;
  statusClass: StatusClass;
}

export interface StoredCodes {
  codes: CodeItem[];
}

export type ThemePreference = "system" | "light" | "dark";

export type ExtensionMessage =
  | { type: "ping" }
  | { type: "redeem-codes"; codes: string[] }
  | { type: "stop" }
  | { type: "import-codes"; text: string }
  | { type: "add-codes"; text: string }
  | { type: "clear-codes" }
  | { type: "code-result"; code: string; status: string; statusClass: StatusClass }
  | { type: "progress"; text: string }
  | { type: "get-state" };

export interface ExtensionState {
  items: CodeItem[];
  runStatus: string;
}

export interface ImportResult {
  ok: boolean;
  message?: string;
  added?: number;
  invalid?: number;
  error?: string;
}
