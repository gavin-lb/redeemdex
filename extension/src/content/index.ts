import { browser } from "../platform/browser";
import { INVALID_MESSAGES, REDEEM_BATCH_SIZE as redeemBatchSize } from "../shared/constants";
import type { ExtensionMessage, StatusClass } from "../shared/types";

(() => {
  const TABLE_SELECTOR =
    "body > div:first-child > div > section > section > article > section:nth-child(2) > article > div > div:nth-child(2) > div > table";

  let stopped = false;
  let running = false;
  let internalRedeemClick = false;
  let manualRedemptionRunning = false;

  function send(type: ExtensionMessage["type"], payload: Record<string, unknown> = {}) {
    return browser.runtime
      .sendMessage({ type, ...payload } as ExtensionMessage)
      .catch(() => undefined);
  }

  function status(text: string): void {
    console.log(`[PTCGL Code Redeemer] ${text}`);
    send("progress", { text });
  }

  async function codeResult(code: string, result: string, statusClass: StatusClass) {
    await send("code-result", {
      code,
      status: result,
      statusClass,
    });
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normaliseMessage(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  // The input accepts codes with hyphens, while the table displays the
  // submitted code without hyphens. Compare the canonical form.
  function normaliseCode(code: string): string {
    return code.replace(/[\s-]/g, "").toUpperCase();
  }

  function getTable(): HTMLTableElement | null {
    return (
      document
        .querySelector('[data-testid="button-redeem"]')
        ?.closest("article")
        ?.querySelector("table") ||
      document.querySelector(TABLE_SELECTOR) ||
      document.querySelector("table")
    );
  }

  function getRows(): HTMLTableRowElement[] {
    return [...(getTable()?.tBodies[0]?.rows || [])];
  }

  function getRowForCode(code: string): HTMLTableRowElement | undefined {
    const wanted = normaliseCode(code);

    return getRows().find((row) => {
      const cell = row.cells[0];
      return cell !== undefined && normaliseCode(cell.textContent ?? "") === wanted;
    });
  }

  function getRowMessage(row: HTMLTableRowElement): string {
    return normaliseMessage(row.cells[1]?.textContent || "");
  }

  function getValidRows(): HTMLTableRowElement[] {
    return getRows().filter((row) => {
      const message = getRowMessage(row);
      return message && !INVALID_MESSAGES.has(message);
    });
  }

  async function waitForElement<T extends Element = HTMLElement>(
    selector: string,
    timeout = 15000,
  ): Promise<T> {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      if (stopped) {
        throw new Error("Stopped.");
      }

      const element = document.querySelector<T>(selector);
      if (element) {
        return element;
      }

      await sleep(100);
    }

    throw new Error(`Timed out waiting for ${selector}`);
  }

  async function waitForEnabled(
    selector: string,
    timeout = 30000,
  ): Promise<HTMLButtonElement | HTMLInputElement> {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      if (stopped) {
        throw new Error("Stopped.");
      }

      const element = document.querySelector<HTMLButtonElement | HTMLInputElement>(selector);
      if (element && !element.disabled) {
        return element;
      }

      await sleep(100);
    }

    throw new Error(`Timed out waiting for ${selector} to become enabled`);
  }

  async function waitForRow(code: string, timeout = 30000): Promise<HTMLTableRowElement> {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      if (stopped) {
        throw new Error("Stopped.");
      }

      const row = getRowForCode(code);
      if (row) {
        return row;
      }

      await sleep(100);
    }

    throw new Error(`Timed out waiting for code ${code} to appear in the table`);
  }

  function setReactInputValue(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) {
      throw new Error("Could not access the input value setter.");
    }
    setter.call(input, value);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: value,
      }),
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function enterCode(code: string): Promise<void> {
    const input = await waitForElement<HTMLInputElement>("#code");
    await waitForElement('[data-testid="verify-code-button"]');

    input.focus();
    setReactInputValue(input, code);

    // The page can take a moment to enable Submit after React receives the
    // input value. Waiting here avoids treating that transient state as a
    // failed code; if the button never becomes enabled, the code is recorded
    // as an error and can be retried from the popup.
    const submit = await waitForEnabled('[data-testid="verify-code-button"]');
    submit.click();
  }

  async function removeRow(row: HTMLTableRowElement): Promise<void> {
    const code = row.cells[0]?.textContent?.trim() ?? "";
    const deleteImage = row.cells[row.cells.length - 1]?.querySelector("img");

    if (!deleteImage) {
      throw new Error(`Could not find delete image for ${code}.`);
    }

    deleteImage.click();

    const end = Date.now() + 5000;
    while (Date.now() < end) {
      if (!getRowForCode(code)) {
        return;
      }
      await sleep(50);
    }

    throw new Error(`Timed out waiting for invalid code ${code} to be removed.`);
  }

  async function waitForRedemption(codesToRedeem: string[], timeout = 30000): Promise<void> {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      if (stopped) {
        throw new Error("Stopped.");
      }

      // The redemption page normally removes successfully redeemed rows.
      // A few versions instead leave the row in place and update a Redeemed
      // column, so accept either representation.
      const remainingTargetRows = codesToRedeem.filter((code) => {
        const row = getRowForCode(code);
        if (!row) {
          return false;
        }

        const redeemed = normaliseMessage(row.cells[2]?.textContent || "");
        return !(redeemed === "1" || redeemed.toLowerCase() === "yes");
      });

      if (!remainingTargetRows.length) {
        return;
      }

      await sleep(100);
    }

    const remaining = codesToRedeem.filter((code) => getRowForCode(code));
    throw new Error(`Timed out waiting for redemption of ${remaining.length} code(s).`);
  }

  async function recordRedeemed(codesToRedeem: string[]): Promise<void> {
    for (const code of codesToRedeem) {
      await codeResult(code, "Redeemed", "redeemed");
    }
  }

  async function redeemBatch(finalBatch = false): Promise<void> {
    // Capture the actual valid rows in the page. This is more reliable than
    // batchCodes because the table may already contain valid codes from an
    // earlier run.
    const codesToRedeem = getValidRows()
      .map((row) => row.cells[0]?.textContent?.trim() ?? "")
      .filter((code) => code.length > 0);

    if (!codesToRedeem.length) {
      return;
    }

    // The page updates the Redeem button asynchronously after the batch size
    // row is added. Do not treat the transient disabled state as an error.
    const button = await waitForEnabled('[data-testid="button-redeem"]');

    if (!finalBatch && getValidRows().length < redeemBatchSize) {
      throw new Error("Valid-code count changed before redemption.");
    }

    status(
      finalBatch
        ? `Finished input list; redeeming ${codesToRedeem.length} remaining valid code(s).`
        : `${redeemBatchSize} valid code(s) reached; clicking Redeem.`,
    );
    internalRedeemClick = true;
    try {
      button.click();
    } finally {
      // The flag only needs to cover the synchronous click event.
      internalRedeemClick = false;
    }

    await waitForRedemption(codesToRedeem);
    await recordRedeemed(codesToRedeem);
    await sleep(500);
  }

  async function handleManualRedeem(): Promise<void> {
    if (manualRedemptionRunning || running || stopped) {
      return;
    }

    const codesToRedeem = getValidRows()
      .map((row) => row.cells[0]?.textContent?.trim() ?? "")
      .filter((code) => code.length > 0);

    if (!codesToRedeem.length) {
      return;
    }

    manualRedemptionRunning = true;
    try {
      status(`Redeeming ${codesToRedeem.length} code(s) from the page.`);
      await waitForRedemption(codesToRedeem);
      await recordRedeemed(codesToRedeem);
      status(`Redeemed ${codesToRedeem.length} code(s).`);
    } catch (error) {
      // Do not mark codes as redeemed unless the page actually confirmed the
      // redemption. A timeout/error remains retryable in the popup.
      console.error("[PTCGL Code Redeemer] Manual redemption:", error);
      status(`Redemption check failed: ${errorMessage(error)}`);
    } finally {
      manualRedemptionRunning = false;
    }
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async function processCodes(codes: string[]): Promise<void> {
    if (running) {
      status("A redemption run is already in progress.");
      return;
    }

    running = true;
    stopped = false;

    try {
      await waitForElement("#code");
      await waitForElement('[data-testid="verify-code-button"]');

      let processed = 0;

      for (const rawCode of codes) {
        if (stopped) {
          status(`Stopped after ${processed}/${codes.length} code(s).`);
          return;
        }

        const code = rawCode.trim();
        if (!code) {
          continue;
        }

        // The site displays the code without hyphens, so use canonical
        // comparison when checking whether it is already in the table.
        const existingRow = getRowForCode(code);
        if (existingRow) {
          const existingMessage = getRowMessage(existingRow);
          if (INVALID_MESSAGES.has(existingMessage)) {
            status(`${code}: ${existingMessage} Removing.`);
            await codeResult(code, existingMessage, "invalid");
            await removeRow(existingRow);
          } else {
            status(`${code}: already present and valid; updating status.`);
            await codeResult(code, "Valid", "valid");
          }

          processed++;

          if (getValidRows().length >= redeemBatchSize) {
            await redeemBatch();
          }

          continue;
        }

        if (getValidRows().length >= redeemBatchSize) {
          await redeemBatch();
        }

        status(`Submitting ${processed + 1}/${codes.length}: ${code}`);
        await codeResult(code, "Submitting…", "pending");

        try {
          await enterCode(code);

          // The table is updated asynchronously. waitForRow now matches
          // both "ABC-1234..." and the site's "ABC1234..." representation.
          const row = await waitForRow(code);
          const message = getRowMessage(row);

          if (INVALID_MESSAGES.has(message)) {
            status(`${code}: ${message} Removing.`);
            await codeResult(code, message, "invalid");
            await removeRow(row);
          } else {
            status(`${code}: valid.`);
            await codeResult(code, "Valid", "valid");
          }
        } catch (error) {
          await codeResult(code, `Error: ${errorMessage(error)}`, "error");
          throw error;
        }

        processed++;

        if (getValidRows().length >= redeemBatchSize) {
          await redeemBatch();
        }

        await sleep(300);
      }

      const remainingValid = getValidRows().length;

      if (remainingValid > 0) {
        await redeemBatch(true);
      }

      const finalRemainingValid = getValidRows().length;
      if (finalRemainingValid > 0) {
        status(`Finished input list. ${finalRemainingValid} valid code(s) remain in the table.`);
      } else {
        status(`Finished ${processed} code(s).`);
      }
    } catch (error) {
      console.error("[PTCGL Code Redeemer]", error);
      status(`Stopped: ${errorMessage(error)}`);
    } finally {
      running = false;
    }
  }

  function watchManualRedeemButton(): void {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="button-redeem"]');
    if (!button || button.dataset.redeemDexObserved === "true") {
      return;
    }

    button.dataset.redeemDexObserved = "true";
    button.addEventListener("click", () => {
      // Ignore clicks made by redeemBatch(); those already wait for and record
      // their own batch. User clicks are otherwise invisible to the extension,
      // so monitor the resulting table and update storage when they complete.
      if (!internalRedeemClick) {
        void handleManualRedeem();
      }
    });
  }

  const buttonObserver = new MutationObserver(watchManualRedeemButton);
  buttonObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  watchManualRedeemButton();

  browser.runtime.onMessage.addListener((rawMessage) => {
    const message = rawMessage as ExtensionMessage;
    if (message.type === "ping") {
      return Promise.resolve({ ready: true });
    }

    if (message.type === "redeem-codes") {
      void processCodes(message.codes);
    } else if (message.type === "stop") {
      stopped = true;
      status("Stopping...");
    }
  });
})();
