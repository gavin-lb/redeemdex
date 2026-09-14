export const STORAGE_KEY = "ptcglCodes";
export const RUN_STATUS_KEY = "ptcglRunStatus";
export const THEME_KEY = "themePreference";

export const REDEMPTION_HOME_URL = "https://redeem.tcg.pokemon.com/";

export const CODE_CHARS = "24679BCDGHJKLMNPQRTVWXYZ";
export const CODE_RE = new RegExp(
  `^[${CODE_CHARS}]{3}-?[${CODE_CHARS}]{4}(?:-?[${CODE_CHARS}]{3}){2}$`,
);

export const INVALID_MESSAGES = new Set([
  "That code is not valid.",
  "That code has already been redeemed by someone else.",
  "You have already redeemed that code.",
]);

export const REDEEM_BATCH_SIZE = 10;
