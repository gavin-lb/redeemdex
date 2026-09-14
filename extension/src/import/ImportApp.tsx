import Description from "@mui/icons-material/Description";
import FileUpload from "@mui/icons-material/FileUpload";
import { useEffect, useRef, useState } from "react";
import browser from "webextension-polyfill";

type MessageKind = "" | "error" | "success";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTextFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".txt") || file.type === "text/plain";
}

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ImportApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("");

  useEffect(() => {
    let active = true;

    async function loadTheme(): Promise<void> {
      const data = await browser.storage.local.get("themePreference");
      const preference = data.themePreference;
      const theme = preference === "dark" || preference === "light" ? preference : getSystemTheme();
      if (active) {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      }
    }

    void loadTheme().catch((error) => console.error("Could not load theme:", error));
    return () => {
      active = false;
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const listener = (changes: Record<string, browser.Storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes.themePreference) return;
      const preference = changes.themePreference.newValue;
      const theme = preference === "dark" || preference === "light" ? preference : getSystemTheme();
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  async function closeWindow(): Promise<void> {
    const currentWindow = await browser.windows.getCurrent();
    if (currentWindow.id != null) await browser.windows.remove(currentWindow.id);
  }

  function showMessage(text: string, kind: MessageKind = ""): void {
    setMessage(text);
    setMessageKind(kind);
  }

  async function importFile(file: File | undefined): Promise<void> {
    if (!file) return;
    if (!isTextFile(file)) {
      showMessage("Only .txt files can be imported.", "error");
      return;
    }

    setImporting(true);
    showMessage("Importing codes…");
    try {
      const result = await browser.runtime.sendMessage({
        type: "import-codes",
        text: await file.text(),
      });
      if (!result?.ok)
        throw new Error(result?.error || "The background process could not import the file.");
      showMessage(result.message ?? "Codes imported.", "success");
      closeTimerRef.current = window.setTimeout(() => void closeWindow(), 500);
    } catch (error) {
      console.error(error);
      showMessage(`Could not import file: ${errorMessage(error)}`, "error");
      setImporting(false);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setDragOver(false);
    const file = Array.from(event.dataTransfer.files).find(isTextFile);
    if (!file) {
      showMessage("Please drop a .txt file.", "error");
      return;
    }
    void importFile(file);
  }

  return (
    <main>
      <section className="panel">
        <div className="title-row">
          <div className="title-copy">
            <div className="title-icon" aria-hidden="true">
              <Description aria-hidden="true" focusable="false" />
            </div>
            <div>
              <h2>Import codes</h2>
              <p className="subtitle">Choose a .txt file or drag it into this window.</p>
            </div>
          </div>
        </div>

        <input
          ref={inputRef}
          id="file-input"
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={(event) => void importFile(event.target.files?.[0])}
        />

        <button
          type="button"
          className={`drop-zone${dragOver ? " drag-over" : ""}`}
          disabled={importing}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="drop-icon" aria-hidden="true">
            <FileUpload aria-hidden="true" focusable="false" />
          </div>
          <div className="drop-title">Drop your .txt file here</div>
          <p className="drop-copy">or choose a file from your computer</p>
          <div className="drop-format">One or more codes per line</div>
          <span id="choose">
            <FileUpload aria-hidden="true" focusable="false" />
            Choose .txt file
          </span>
        </button>

        <div
          className={`message${messageKind ? ` ${messageKind}` : ""}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
        <div className="hint">
          Codes are validated and deduplicated before being added to RedeemDex.
        </div>
      </section>
    </main>
  );
}
