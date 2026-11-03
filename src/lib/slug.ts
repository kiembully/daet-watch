import { randomBytes } from "node:crypto";

import type { Category } from "./rules";

/** URL-safe without look-alikes (no 0/o, 1/l/i) so a slug can be read out loud. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function shortId(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return out;
}

/**
 * Short, human-friendly, and stable: `water-k3m9xp`. The category prefix makes
 * a link scannable in Messenger; the random tail keeps it unguessable-ish and
 * collision-free without a counter collection.
 */
export function makeSlug(category: Category, length = 6): string {
  return `${category}-${shortId(length)}`;
}

export const SLUG_PATTERN = /^[a-z]{3,12}-[2-9a-hjkmnp-z]{4,10}$/;

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
