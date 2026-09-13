import { canonicalCode, mockRedeemCode } from "./mock-backend.js";
import "./style.css";

const form = document.getElementById("verify-form") as HTMLFormElement;
const input = document.getElementById("code") as HTMLInputElement;
const table = document.querySelector("table") as HTMLTableElement;
const tbody = table.tBodies[0];
const empty = document.querySelector('[data-testid="no-reward-message"]') as HTMLElement;
const redeemButton = document.querySelector('[data-testid="button-redeem"]') as HTMLButtonElement;
const clearButton = document.querySelector(
  '[data-testid="button-clear-table"]',
) as HTMLButtonElement;
const errorMessage = document.querySelector('[data-testid="redemption-error"]') as HTMLElement;

const INVALID_MESSAGES = new Set([
  "That code is not valid.",
  "That code has already been redeemed by someone else.",
  "You have already redeemed that code.",
]);

function updateTableState(): void {
  const hasRows = tbody.rows.length > 0;
  empty.hidden = hasRows;
  const validCount = [...tbody.rows].filter((row) => {
    const message = row.cells[1]?.textContent?.trim() || "";
    return message && !INVALID_MESSAGES.has(message);
  }).length;
  redeemButton.disabled = validCount < 1;
}

function removeRow(code: string): void {
  const wanted = canonicalCode(code);
  for (const row of [...tbody.rows]) {
    if (canonicalCode(row.cells[0]?.textContent || "") === wanted) {
      row.remove();
      break;
    }
  }
  updateTableState();
}

// Deliberately expose the global function and use an onclick attribute on the
// delete <img>, matching the structure the Firefox extension is designed for.
(window as typeof window & { removeMockRow?: (code: string) => void }).removeMockRow = removeRow;

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function addRow(code: string, message: string): void {
  const row = tbody.insertRow();
  const codeCell = row.insertCell();
  const itemCell = row.insertCell();
  const redeemedCell = row.insertCell();
  const deleteCell = row.insertCell();

  codeCell.textContent = canonicalCode(code);
  itemCell.textContent = message;
  redeemedCell.textContent = "0";

  const img = document.createElement("img");
  img.className = "delete";
  img.alt = "Remove";
  img.src =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%23a00'/%3E%3Cpath d='M10 10l12 12M22 10L10 22' stroke='white' stroke-width='3'/%3E%3C/svg%3E";
  img.setAttribute("onclick", `removeMockRow('${escapeAttribute(codeCell.textContent)}')`);
  deleteCell.appendChild(img);
  updateTableState();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  const raw = input.value.trim();
  if (!raw) return;
  if (tbody.rows.length >= 10) {
    errorMessage.textContent = "You can submit a maximum of 10 codes.";
    return;
  }

  const code = canonicalCode(raw);
  input.disabled = true;
  const button = form.querySelector('[data-testid="verify-code-button"]') as HTMLButtonElement;
  button.disabled = true;

  try {
    const result = await mockRedeemCode(code);
    if (!document.body.contains(form)) return;
    addRow(result.code, result.message);
    input.value = "";
  } finally {
    input.disabled = false;
    button.disabled = false;
    input.focus();
  }
});

clearButton.addEventListener("click", () => {
  tbody.replaceChildren();
  errorMessage.textContent = "";
  updateTableState();
});

redeemButton.addEventListener("click", async () => {
  const validRows = [...tbody.rows].filter((row) => {
    const message = row.cells[1]?.textContent?.trim() || "";
    return message && !INVALID_MESSAGES.has(message);
  });
  if (!validRows.length) return;

  redeemButton.disabled = true;
  redeemButton.textContent = "Redeeming…";
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (const row of validRows) row.cells[2].textContent = "1";
  await new Promise((resolve) => setTimeout(resolve, 400));
  tbody.replaceChildren();
  redeemButton.textContent = "Redeem";
  updateTableState();
});

updateTableState();
