import { browser } from "../platform/browser";
import { getState, setItems } from "../platform/storage";
import { canonicalCode } from "../shared/codes";
import { CODE_RE, RUN_STATUS_KEY, STORAGE_KEY } from "../shared/constants";
import type { CodeItem, ExtensionMessage, ImportResult } from "../shared/types";

let storageMutationQueue: Promise<unknown> = Promise.resolve();

function queueStorageMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = storageMutationQueue.then(operation);
  storageMutationQueue = next.catch(() => undefined);
  return next;
}

function normaliseImportedCodes(value: string): string[] {
  return value
    .split(/\s+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

async function storeCodes(text: string, verb: "Added" | "Imported"): Promise<ImportResult> {
  const inputCodes = normaliseImportedCodes(text);
  const data = await browser.storage.local.get(STORAGE_KEY);
  const old = (data[STORAGE_KEY] as { codes?: CodeItem[] } | undefined)?.codes ?? [];
  const existing = new Set(old.map((item) => canonicalCode(item.code)));
  const added: CodeItem[] = [];

  for (const code of inputCodes) {
    const key = canonicalCode(code);
    if (existing.has(key)) continue;

    existing.add(key);
    added.push(
      CODE_RE.test(code)
        ? { code, status: "Not tried", statusClass: "pending" }
        : { code, status: "Invalid format", statusClass: "invalid" },
    );
  }

  if (added.length) {
    await setItems([...old, ...added]);
  }

  const invalid = added.filter((item) => item.statusClass === "invalid").length;
  const message = invalid
    ? `${verb} ${added.length} code(s); ${invalid} invalid format.`
    : `${verb} ${added.length} code(s).`;

  await browser.storage.local.set({ [RUN_STATUS_KEY]: message });
  return { ok: true, message, added: added.length, invalid };
}

function importCodes(text: string): Promise<ImportResult> {
  return queueStorageMutation(() => storeCodes(text, "Imported"));
}

function addCodes(text: string): Promise<ImportResult> {
  return queueStorageMutation(() => storeCodes(text, "Added"));
}

function clearCodes(): Promise<void> {
  return queueStorageMutation(() => browser.storage.local.remove([STORAGE_KEY, RUN_STATUS_KEY]));
}

function queueCodeResult(
  message: Extract<ExtensionMessage, { type: "code-result" }>,
): Promise<void> {
  return queueStorageMutation(async () => {
    const { items } = await getState();
    const wanted = canonicalCode(message.code);
    const item = items.find((x) => canonicalCode(x.code) === wanted);

    if (item) {
      item.status = message.status;
      item.statusClass = message.statusClass;
      await setItems(items);
    }
  });
}

browser.runtime.onMessage.addListener((rawMessage: unknown) => {
  const message = rawMessage as ExtensionMessage;

  if (message.type === "import-codes") {
    return importCodes(String(message.text || "")).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  if (message.type === "add-codes") {
    return addCodes(String(message.text || "")).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  if (message.type === "clear-codes") {
    return clearCodes();
  }

  if (message.type === "code-result") {
    return queueCodeResult(message);
  }

  if (message.type === "progress") {
    return browser.storage.local.set({ [RUN_STATUS_KEY]: message.text });
  }

  if (message.type === "get-state") {
    return getState();
  }

  return undefined;
});

browser.runtime.onStartup.addListener(() => {
  return browser.storage.local.set({ [RUN_STATUS_KEY]: "Ready." });
});
