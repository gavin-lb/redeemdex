import { RUN_STATUS_KEY, STORAGE_KEY } from "../shared/constants";
import type { CodeItem, ExtensionState } from "../shared/types";
import browser from "webextension-polyfill";

export async function getState(): Promise<ExtensionState> {
  const data = await browser.storage.local.get([STORAGE_KEY, RUN_STATUS_KEY]);
  return {
    items: (data[STORAGE_KEY] as { codes?: CodeItem[] } | undefined)?.codes ?? [],
    runStatus: String(data[RUN_STATUS_KEY] ?? "Ready."),
  };
}

export async function setItems(items: CodeItem[]): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEY]: { codes: items },
  });
}

export async function setRunStatus(text: string): Promise<void> {
  await browser.storage.local.set({ [RUN_STATUS_KEY]: text });
}
