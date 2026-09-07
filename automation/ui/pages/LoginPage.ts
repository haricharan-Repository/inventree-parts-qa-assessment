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

    // Successful login lands on the authenticated dashboard/home — wait for the app shell's
    // primary navigation rather than a fixed sleep.
    await expect(this.page.getByRole('link', { name: /parts/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  }
}
