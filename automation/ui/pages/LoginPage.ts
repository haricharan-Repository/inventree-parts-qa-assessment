import { Page, expect } from '@playwright/test';

/**
 * Selectors target InvenTree's React "Platform UI" (mounted at /web/ on current stable
 * releases). Verified against the documented login flow; exact test-ids were not available
 * without a live instance during artefact generation — re-verify field labels here first if
 * this suite fails at login on your InvenTree version (see README "Corrections to agent
 * output" for the note on this).
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/web/login');
  }

  async login(username: string, password: string) {
    await this.goto();

    // `getByLabel(/password/i)` also matches the PasswordInput's "Toggle password visibility"
    // button (Mantine labels it via the same group) — confirmed against a live instance
    // ("strict mode violation: resolved to 2 elements"). Scope to role=textbox to exclude it.
    const usernameField = this.page.getByRole('textbox', { name: /username/i });
    const passwordField = this.page.getByRole('textbox', { name: /password/i });

    await expect(usernameField).toBeVisible({ timeout: 15_000 });
    await usernameField.fill(username);
    await passwordField.fill(password);

    await this.page.getByRole('button', { name: /log ?in|sign ?in/i }).click();

    // The very first request InvenTree's server handles after container startup — which is
    // exactly what this is, the first thing CI does after `docker compose up` — is
    // meaningfully slower than every request after it (Gunicorn/Django cold start: import
    // caching, URL resolver, first DB connections). Confirmed against a genuinely fresh
    // instance: the first login attempt after boot took 20s+ and never even redirected, while
    // four immediately-following attempts each redirected in ~1.5-1.8s. CI hit this because
    // `npm test` is the very first request the instance ever serves. A generous timeout on the
    // redirect — the earliest, most fundamental signal of a successful login — absorbs that
    // one-time cost instead of a short wait on a specific nav element, which was timing out
    // before the redirect had even happened.
    await this.page.waitForURL(/\/web\/(home|dashboard)/, { timeout: 60_000 });

    // Once redirected, the app shell's own render is fast even on a cold instance — a normal
    // timeout here is enough.
    await expect(this.page.getByRole('link', { name: /parts/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  }
}
