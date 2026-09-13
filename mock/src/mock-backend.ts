// Local, deterministic mock of the Pokémon redemption backend.
// No request leaves this machine.

const INVALID_RESPONSES = [
  "That code has already been redeemed by someone else.",
  "That code is not valid.",
  "You have already redeemed that code.",
] as const;

export interface MockRedeemResult {
  code: string;
  message: string;
}

export function canonicalCode(code: string): string {
  return String(code).replace(/[\s-]/g, "").toUpperCase();
}

export function mockRedeemCode(code: string): Promise<MockRedeemResult> {
  const canonical = canonicalCode(code);
  const message =
    Math.random() < 0.75
      ? "Valid"
      : INVALID_RESPONSES[Math.floor(Math.random() * INVALID_RESPONSES.length)];

  return new Promise((resolve) => {
    setTimeout(() => resolve({ code: canonical, message }), 300);
  });
}
