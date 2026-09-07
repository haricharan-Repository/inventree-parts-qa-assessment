import { test as base, expect, request, APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';
const USERNAME = process.env.INVENTREE_USERNAME ?? 'admin';
const PASSWORD = process.env.INVENTREE_PASSWORD ?? 'inventree';

/**
 * Exchanges basic-auth credentials for an InvenTree API token via
 * GET /api/user/token/, per the InvenTree auth API.
 *
 * InvenTree's 401 response carries no `WWW-Authenticate` header, so Playwright's
 * `httpCredentials` (which only sends Basic auth *after* such a challenge, per RFC 7235)
 * never fires — every request goes out unauthenticated. Send the Basic auth header
 * preemptively instead, the way `curl -u` does.
 */
async function fetchToken(username: string, password: string): Promise<string> {
  const basicAuthContext = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
  });

  let response;
  try {
    response = await basicAuthContext.get('/api/user/token/');
  } catch (err) {
    await basicAuthContext.dispose();
    throw new Error(
      `Could not reach InvenTree at ${BASE_URL}. Is the instance running ` +
        `(docker compose up) and BASE_URL correct? Original error: ${(err as Error).message}`,
    );
  }

  if (!response.ok()) {
    await basicAuthContext.dispose();
    throw new Error(
      `Failed to obtain API token for user "${username}" (${response.status()}). ` +
        `Check INVENTREE_USERNAME/INVENTREE_PASSWORD in .env.`,
    );
  }

  const body = await response.json();
  await basicAuthContext.dispose();
  return body.token as string;
}

type ApiFixtures = {
  /** Authenticated as the primary (admin) user — used by most tests. */
  authedRequest: APIRequestContext;
};

type ApiWorkerFixtures = {
  adminToken: string;
};

export const test = base.extend<ApiFixtures, ApiWorkerFixtures>({
  // Fetched once per worker — the token is reused across all tests in that worker.
  adminToken: [
    async ({}, use) => {
      const token = await fetchToken(USERNAME, PASSWORD);
      await use(token);
    },
    { scope: 'worker' },
  ],

  authedRequest: async ({ adminToken }, use) => {
    const context = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Token ${adminToken}`,
        Accept: 'application/json',
      },
    });
    await use(context);
    await context.dispose();
  },
});

export { expect };
export const config = { BASE_URL, USERNAME, PASSWORD };
