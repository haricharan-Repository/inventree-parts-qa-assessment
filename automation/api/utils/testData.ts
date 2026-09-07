/** Unique-ish suffix so repeated test runs don't collide on name/IPN uniqueness. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function randomPartName(prefix = 'QA Part'): string {
  return `${prefix} ${uniqueSuffix()}`;
}

export function randomIpn(prefix = 'QA-IPN'): string {
  return `${prefix}-${uniqueSuffix()}`;
}

export function randomCategoryName(prefix = 'QA Category'): string {
  return `${prefix} ${uniqueSuffix()}`;
}

export function stringOfLength(length: number, char = 'A'): string {
  return char.repeat(length);
}

/**
 * A string of exactly `length` characters that's unique per call, for boundary-length tests on
 * fields InvenTree enforces uniqueness on (e.g. Part.name is part of a (name, IPN, revision)
 * uniqueness set) — a fixed repeated-char string collides with itself across repeated test runs
 * otherwise. Starts with "QA" wherever it fits so `scripts/teardown.js` (which matches on that
 * prefix) can find and delete it — omitting this was itself a bug caught by running teardown
 * and finding leftover un-prefixed parts it couldn't identify as test data.
 */
export function uniqueStringOfLength(length: number, char = 'A'): string {
  const marked = `QA${uniqueSuffix()}`;
  if (marked.length >= length) return marked.slice(0, length);
  return marked + char.repeat(length - marked.length);
}
