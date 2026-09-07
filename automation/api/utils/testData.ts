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
 * otherwise. Falls back to plain `stringOfLength` if the suffix wouldn't fit.
 */
export function uniqueStringOfLength(length: number, char = 'A'): string {
  const suffix = uniqueSuffix();
  if (suffix.length >= length) return suffix.slice(0, length);
  return suffix + char.repeat(length - suffix.length);
}
