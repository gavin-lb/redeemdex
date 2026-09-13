import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Cancel from "@mui/icons-material/Cancel";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Close from "@mui/icons-material/Close";
import DarkMode from "@mui/icons-material/DarkMode";
import Delete from "@mui/icons-material/Delete";
import Description from "@mui/icons-material/Description";
import FileUpload from "@mui/icons-material/FileUpload";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import Help from "@mui/icons-material/Help";
import Info from "@mui/icons-material/Info";
import LightMode from "@mui/icons-material/LightMode";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Schedule from "@mui/icons-material/Schedule";
import Stop from "@mui/icons-material/Stop";
import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "../platform/browser";
import { canonicalCode, normaliseCode, normaliseCodes } from "../shared/codes";
import {
  REDEMPTION_HOME_URL,
  REDEMPTION_URLS,
  RUN_STATUS_KEY,
  STORAGE_KEY,
  THEME_KEY,
} from "../shared/constants";
import type { CodeItem, ThemePreference } from "../shared/types";
import "./popup.css";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function statusKind(text: string): "error" | "success" | "info" {
  if (/error|could not|failed|stopped/i.test(text)) return "error";
  if (/started|redeem|success|valid|ready/i.test(text)) return "success";
  return "info";
}

function isRetryable(item: CodeItem): boolean {
  return !item.status || item.status === "Not tried" || item.statusClass === "error";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRedemptionOrigin(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return REDEMPTION_URLS.some((pattern) => {
      const origin = pattern.replace(/\/\*$/, "");
      return new URL(url).origin === new URL(origin).origin;
    });
  } catch {
    return false;
  }
}

export default function App() {
  const [items, setItems] = useState<CodeItem[]>([]);
  const [status, setStatus] = useState("RedeemDex is ready. Enter your codes and click Start!");
  const [input, setInput] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPinned, setHelpPinned] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearDialogRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previousFirstUntried = useRef<string | null>(null);
  const autoScrolling = useRef(false);
  const animationFrame = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const followPaused = useRef(false);

  const effectiveTheme = themePreference === "system" ? getSystemTheme() : themePreference;

  const closeClearDialog = useCallback(() => {
    setClearOpen(false);
    requestAnimationFrame(() => clearTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (themePreference === "system") {
        document.documentElement.dataset.theme = getSystemTheme();
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themePreference]);

  useEffect(() => {
    void (async () => {
      const data = await browser.storage.local.get([STORAGE_KEY, RUN_STATUS_KEY, THEME_KEY]);
      setItems((data[STORAGE_KEY] as { codes?: CodeItem[] } | undefined)?.codes ?? []);
      const savedStatus = String(data[RUN_STATUS_KEY] ?? "Ready.");
      setStatus(savedStatus === "Stopping..." ? "Ready." : savedStatus);
      const savedTheme = data[THEME_KEY];
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
        setThemePreference(savedTheme);
      }
    })().catch((error) => setStatus(`Could not load saved codes: ${errorMessage(error)}`));
  }, []);

  useEffect(() => {
    const listener = (changes: Record<string, browser.Storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEY]) {
        setItems(
          (changes[STORAGE_KEY].newValue as { codes?: CodeItem[] } | undefined)?.codes ?? [],
        );
        setInput("");
      }
      if (changes[RUN_STATUS_KEY]) setStatus(String(changes[RUN_STATUS_KEY].newValue ?? "Ready."));
      if (changes[THEME_KEY]) {
        const next = changes[THEME_KEY].newValue;
        if (next === "light" || next === "dark" || next === "system") setThemePreference(next);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(
    () => () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!clearOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeClearDialog();
        return;
      }
      if (event.key !== "Tab" || !clearDialogRef.current) return;
      const focusable = [
        ...clearDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"]) ',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    requestAnimationFrame(() => clearDialogRef.current?.focus());
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearOpen, closeClearDialog]);

  function setRunStatus(text: string): void {
    setStatus(text);
    void browser.storage.local.set({ [RUN_STATUS_KEY]: text });
  }

  async function addCodes(rawCodes: string[]): Promise<number> {
    const inputCodes = rawCodes.map(normaliseCode).filter(Boolean);
    if (!inputCodes.length) return 0;

    setInput("");
    const result = await browser.runtime.sendMessage({
      type: "add-codes",
      text: inputCodes.join("\n"),
    });
    if (!result?.ok)
      throw new Error(result?.error || "The background process could not add the codes.");
    return result.added ?? 0;
  }

  async function commitInput(): Promise<void> {
    if (input.trim()) await addCodes(normaliseCodes(input));
  }

  async function getExistingRedeemTab(): Promise<
    Awaited<ReturnType<typeof browser.tabs.query>>[number] | null
  > {
    const mockPatterns = ["http://127.0.0.1:8000/*", "http://localhost:8000/*"];
    const officialPatterns = ["https://redeem.tcg.pokemon.com/*"];

    const matchesRedemptionOrigin = (tab: { url?: string }): boolean => {
      if (!tab.url) return false;
      try {
        const tabOrigin = new URL(tab.url).origin;
        return REDEMPTION_URLS.some((pattern) => {
          const origin = pattern.replace(/\/\*$/, "");
          return tabOrigin === new URL(origin).origin;
        });
      } catch {
        return false;
      }
    };

    const activeTabs = await browser.tabs.query({ active: true });
    const activeMock = activeTabs.find((tab) =>
      mockPatterns.some((pattern) => {
        const origin = pattern.replace(/\/\*$/, "");
        return tab.url ? new URL(tab.url).origin === new URL(origin).origin : false;
      }),
    );
    if (activeMock) return activeMock;

    for (const pattern of mockPatterns) {
      const matchingTabs = await browser.tabs.query({ url: pattern });
      const match = matchingTabs.find(matchesRedemptionOrigin);
      if (match) return match;
    }

    const activeOfficial = activeTabs.find((tab) =>
      officialPatterns.some((pattern) => {
        const origin = pattern.replace(/\/\*$/, "");
        return tab.url ? new URL(tab.url).origin === new URL(origin).origin : false;
      }),
    );
    if (activeOfficial) return activeOfficial;

    for (const pattern of officialPatterns) {
      const matchingTabs = await browser.tabs.query({ url: pattern });
      const match = matchingTabs.find(matchesRedemptionOrigin);
      if (match) return match;
    }

    return null;
  }

  async function getRedeemTab(): Promise<Awaited<ReturnType<typeof browser.tabs.create>>> {
    const existing = await getExistingRedeemTab();
    if (existing) return existing;
    return browser.tabs.create({ url: REDEMPTION_HOME_URL });
  }

  async function waitForTabReady(tabId: number): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt++) {
      const tab = await browser.tabs.get(tabId);
      if (tab.status === "complete") return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Timed out waiting for the redemption page to load.");
  }

  async function ensureContentScript(tabId: number): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await browser.tabs.sendMessage(tabId, { type: "ping" });
        return;
      } catch (error) {
        lastError = error;
        try {
          if (browser.scripting?.executeScript) {
            try {
              await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
            } catch (scriptingError) {
              lastError = scriptingError;
              await browser.tabs.executeScript(tabId, { file: "content.js" });
            }
          } else {
            await browser.tabs.executeScript(tabId, { file: "content.js" });
          }
          await browser.tabs.sendMessage(tabId, { type: "ping" });
          return;
        } catch (injectionError) {
          lastError = injectionError;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw lastError ?? new Error("Could not connect to the redemption page.");
  }

  async function startRedemption(): Promise<void> {
    if (starting) return;
    setStarting(true);
    let tab: Awaited<ReturnType<typeof browser.tabs.create>> | undefined;
    try {
      await commitInput();
      const data = await browser.storage.local.get(STORAGE_KEY);
      const current = (data[STORAGE_KEY] as { codes?: CodeItem[] } | undefined)?.codes ?? [];
      const pending = current.filter((item) => isRetryable(item) && item.statusClass !== "invalid");
      if (!pending.length) {
        setRunStatus("No valid codes to try or retry.");
        return;
      }

      setRunStatus("Preparing redemption page...");
      tab = await getRedeemTab();
      if (tab.id == null) throw new Error("The redemption tab has no ID.");
      await waitForTabReady(tab.id);
      await ensureContentScript(tab.id);

      let lastError: unknown;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: "redeem-codes",
            codes: pending.map((item) => item.code),
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      if (lastError) throw lastError;
      setRunStatus(`Started ${pending.length} valid code(s).`);
    } catch (error) {
      const message = errorMessage(error);
      if (
        /missing host permission|host permission/i.test(message) &&
        isRedemptionOrigin(tab?.url)
      ) {
        setRunStatus(
          "Please finish signing in to Pokémon TCG Live in the opened tab, then click Start again.",
        );
      } else {
        setRunStatus(`Could not start: ${message}`);
      }
    } finally {
      setStarting(false);
    }
  }

  async function stopRedemption(): Promise<void> {
    try {
      const tab = await getExistingRedeemTab();
      if (tab?.id != null) {
        await browser.tabs.sendMessage(tab.id, { type: "stop" });
        setRunStatus("Stopped.");
      } else {
        setRunStatus("No redemption page is open.");
      }
    } catch (error) {
      setRunStatus(`Could not stop: ${errorMessage(error)}`);
    }
  }

  async function openImport(): Promise<void> {
    try {
      const browserWindow = await browser.windows.getCurrent();
      const width = 640;
      const height = 500;
      const margin = 20;
      const chromeOffset = 76;
      const left = Math.max(
        0,
        (browserWindow.left ?? 0) + (browserWindow.width ?? width) - width - margin,
      );
      const top = Math.max(browserWindow.top ?? 0, (browserWindow.top ?? 0) + chromeOffset);
      await browser.windows.create({
        url: browser.runtime.getURL("import/index.html"),
        type: "popup",
        width,
        height,
        left,
        top,
        focused: true,
      });
    } catch (error) {
      setRunStatus(`Could not open the import window: ${errorMessage(error)}`);
    }
  }

  async function clearAll(): Promise<void> {
    if (!items.length) {
      setClearOpen(false);
      return;
    }
    try {
      const tab = await getExistingRedeemTab();
      if (tab?.id != null) {
        await browser.tabs.sendMessage(tab.id, { type: "stop" });
      }
    } catch {
      // Clearing local state should still work if the redemption page is closed.
    }
    await browser.runtime.sendMessage({ type: "clear-codes" });
    setItems([]);
    setInput("");
    closeClearDialog();
    setStatus("Cleared.");
  }

  function handleResultsScroll(): void {
    if (autoScrolling.current || !resultsRef.current) return;
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    const el = resultsRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 8;
    if (atBottom) {
      followPaused.current = false;
      return;
    }
    followPaused.current = true;
    resumeTimer.current = window.setTimeout(() => {
      const first = previousFirstUntried.current;
      if (!first || !resultsRef.current) return;
      const row = [...resultsRef.current.children].find(
        (element) => element.querySelector(".code")?.textContent === first,
      ) as HTMLElement | undefined;
      if (row) {
        const r = resultsRef.current.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        if (rr.top < r.bottom && rr.bottom > r.top) followPaused.current = false;
      }
    }, 250);
  }

  const scrollToRow = useCallback((row: HTMLElement): void => {
    if (!resultsRef.current) return;
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    const container = resultsRef.current;
    const resultsRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const rowTop = container.scrollTop + rowRect.top - resultsRect.top;
    const target = Math.max(
      0,
      Math.min(
        container.scrollHeight - container.clientHeight,
        rowTop - (container.clientHeight - rowRect.height) / 2,
      ),
    );
    const start = container.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) < 1) return;
    const startedAt = performance.now();
    autoScrolling.current = true;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 350);
      const eased = 1 - (1 - progress) ** 3;
      container.scrollTop = start + distance * eased;
      if (progress < 1) animationFrame.current = requestAnimationFrame(step);
      else {
        animationFrame.current = null;
        autoScrolling.current = false;
      }
    };
    animationFrame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const first =
      items.find(
        (item) => !item.status || item.status === "Not tried" || item.statusClass === "pending",
      )?.code ?? null;
    const changed = first !== previousFirstUntried.current;
    previousFirstUntried.current = first;
    if (!changed || !first || followPaused.current || !resultsRef.current) return;
    const row = [...resultsRef.current.children].find(
      (element) => element.querySelector(".code")?.textContent === first,
    ) as HTMLElement | undefined;
    if (row) requestAnimationFrame(() => scrollToRow(row));
  }, [items, scrollToRow]);

  const totals = items.reduce(
    (acc, item) => {
      const kind = item.statusClass || "pending";
      if (kind === "valid") acc.valid++;
      else if (kind === "redeemed") acc.redeemed++;
      else if (kind === "invalid") acc.invalid++;
      else acc.pending++;
      return acc;
    },
    { valid: 0, redeemed: 0, invalid: 0, pending: 0 },
  );

  const currentKind = statusKind(status);
  const dark = effectiveTheme === "dark";
  const StatusIcon =
    currentKind === "error" ? Cancel : currentKind === "success" ? CheckCircle : Info;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-icon" src="../icons/icon-128.png" alt="" />
          <div className="brand-copy">
            <h1>
              Redeem<span>Dex</span>
            </h1>
            <p>Pokémon TCG Live code assistant</p>
          </div>
        </div>
        <fieldset
          className="header-actions"
          aria-label="Popup controls"
          onMouseLeave={() => !helpPinned && setHelpOpen(false)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setHelpOpen(false);
            }
          }}
        >
          <button
            className="theme-switch"
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label={
              dark ? "Dark mode on. Switch to light mode" : "Dark mode off. Switch to dark mode"
            }
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={async () => {
              const next = dark ? "light" : "dark";
              setThemePreference(next);
              await browser.storage.local.set({ [THEME_KEY]: next });
            }}
          >
            <span className="theme-switch-track">
              <LightMode
                className="theme-switch-icon theme-switch-sun icon"
                aria-hidden="true"
                focusable="false"
              />
              <span className="theme-switch-thumb">
                {dark ? (
                  <DarkMode
                    className="theme-switch-thumb-icon icon"
                    aria-hidden="true"
                    focusable="false"
                  />
                ) : (
                  <LightMode
                    className="theme-switch-thumb-icon icon"
                    aria-hidden="true"
                    focusable="false"
                  />
                )}
              </span>
              <DarkMode
                className="theme-switch-icon theme-switch-moon icon"
                aria-hidden="true"
                focusable="false"
              />
            </span>
          </button>
          <button
            className="help-toggle"
            type="button"
            aria-label="How it works"
            aria-expanded={helpOpen}
            onMouseEnter={() => setHelpOpen(true)}
            onFocus={() => setHelpOpen(true)}
            onClick={() => {
              setHelpPinned((value) => {
                const next = !value;
                setHelpOpen(next);
                return next;
              });
            }}
          >
            <Help aria-hidden="true" focusable="false" />
          </button>
          {helpOpen && (
            <div className="help-popover" role="dialog" aria-label="How it works">
              <div className="help-popover-title">
                <span className="help-popover-icon">
                  <Help aria-hidden="true" focusable="false" />
                </span>
                <strong>How it works</strong>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    setHelpPinned(false);
                    setHelpOpen(false);
                  }}
                >
                  <Close aria-hidden="true" focusable="false" />
                </button>
              </div>
              <ol>
                <li>
                  <b>1</b>
                  <span>Paste or import your codes.</span>
                </li>
                <li>
                  <b>2</b>
                  <span>RedeemDex validates the format and queues them automatically.</span>
                </li>
                <li>
                  <b>3</b>
                  <span>
                    Click <strong>Start</strong> to redeem valid codes in batches.
                  </span>
                </li>
              </ol>
              <div className="help-popover-foot">
                <Info aria-hidden="true" focusable="false" /> Works with{" "}
                <a href={REDEMPTION_HOME_URL}>Pokémon TCG Live Code Redemption</a>
              </div>
            </div>
          )}
        </fieldset>
      </header>

      <section className="workspace">
        <section className="input-card card">
          <div className="section-heading">
            <div className="heading-with-icon">
              <span className="heading-icon">
                <Description aria-hidden="true" focusable="false" />
              </span>
              <div>
                <h2>Code input</h2>
                <p>Paste or import codes</p>
              </div>
            </div>
            <span className="count-badge">
              {items.length} code{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="input-zone">
            <textarea
              spellCheck={false}
              autoComplete="off"
              value={input}
              placeholder={"Paste codes here…\n246-ABCD-246-BCD"}
              onChange={(event) => setInput(event.target.value)}
              onPaste={() => window.setTimeout(() => void commitInput(), 0)}
              onBlur={() => void commitInput()}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void commitInput();
                }
              }}
            />
          </div>
          <div className="controls">
            <button
              className="button primary"
              type="button"
              disabled={starting}
              onClick={() => void startRedemption()}
            >
              <PlayArrow className="button-icon icon" aria-hidden="true" focusable="false" />
              Start
            </button>
            <button className="button stop" type="button" onClick={() => void stopRedemption()}>
              <Stop className="button-icon icon" aria-hidden="true" focusable="false" />
              Stop
            </button>
            <button className="button clear-button" type="button" onClick={() => void openImport()}>
              <FileUpload className="button-icon icon" aria-hidden="true" focusable="false" />
              Import
            </button>
          </div>
        </section>

        <section className="results-section card">
          <div className="results-top">
            <div className="heading-with-icon">
              <span className="heading-icon list-icon">
                <FormatListBulleted aria-hidden="true" focusable="false" />
              </span>
              <div>
                <h2>Results</h2>
                <p>Live redemption status</p>
              </div>
            </div>
            <button
              ref={clearTriggerRef}
              className="link-button"
              type="button"
              onClick={() => setClearOpen(true)}
            >
              <Delete aria-hidden="true" focusable="false" />
              Clear all
            </button>
          </div>
          <div className="summary" aria-hidden="true">
            <span className="summary-pill valid">
              <CheckCircle className="pill-icon icon" aria-hidden="true" focusable="false" />{" "}
              <strong>{totals.valid}</strong> Valid
            </span>
            <span className="summary-pill redeemed">
              <AutoAwesome className="pill-icon icon" aria-hidden="true" focusable="false" />{" "}
              <strong>{totals.redeemed}</strong> Redeemed
            </span>
            <span className="summary-pill invalid">
              <Cancel className="pill-icon icon" aria-hidden="true" focusable="false" />{" "}
              <strong>{totals.invalid}</strong> Invalid
            </span>
            <span className="summary-pill pending">
              <Schedule className="pill-icon icon" aria-hidden="true" focusable="false" />{" "}
              <strong>{totals.pending}</strong> Not tried
            </span>
          </div>
          <div className="results-table">
            <div className="result-header">
              <span>Code</span>
              <span>Status</span>
            </div>
            <div ref={resultsRef} className="results" onScroll={handleResultsScroll}>
              {!items.length ? (
                <div className="empty-results" aria-hidden="true">
                  <img className="empty-results-image" src="../assets/empty-results.png" alt="" />
                  <strong>No codes yet</strong>
                  <span>Paste or import codes above to get started.</span>
                </div>
              ) : (
                items.map((item) => {
                  const kind = item.statusClass || "pending";
                  const ResultIcon =
                    kind === "valid"
                      ? CheckCircle
                      : kind === "redeemed"
                        ? AutoAwesome
                        : kind === "invalid"
                          ? Cancel
                          : kind === "pending"
                            ? Schedule
                            : Info;
                  return (
                    <div className="result" key={canonicalCode(item.code)}>
                      <span className="code">{item.code}</span>
                      <span className={`result-status ${kind}`}>
                        <ResultIcon aria-hidden="true" focusable="false" />
                        {item.status || "Not tried"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </section>

      <footer className="status" role="status" aria-live="polite">
        <span className={`status-icon ${currentKind}`}>
          <StatusIcon aria-hidden="true" focusable="false" />
        </span>
        <span className="status-text">{status}</span>
      </footer>

      {clearOpen && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Clear all codes"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeClearDialog();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeClearDialog();
          }}
        >
          <section
            ref={clearDialogRef}
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            tabIndex={-1}
            aria-labelledby="clear-dialog-title"
            aria-describedby="clear-dialog-message"
          >
            <div className="dialog-icon">
              <Delete aria-hidden="true" focusable="false" />
            </div>
            <div className="dialog-copy">
              <h2 id="clear-dialog-title">Clear all codes?</h2>
              <p id="clear-dialog-message">
                {items.length
                  ? `This will remove all ${items.length} saved code${items.length === 1 ? "" : "s"} and their results. This action cannot be undone.`
                  : "There are no saved codes or results to remove."}
              </p>
            </div>
            <div className="dialog-actions">
              <button className="button secondary" type="button" onClick={closeClearDialog}>
                Cancel
              </button>
              <button
                className="button danger"
                type="button"
                disabled={!items.length}
                onClick={() => void clearAll()}
              >
                <Delete className="button-icon icon" aria-hidden="true" focusable="false" />
                Clear all
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
