// Server-only Re:amaze API client.
//
// SECURITY: this module reads REAMAZE_API_TOKEN, a secret that must never
// reach the browser. Only import it from server code (route handlers, server
// actions, `next start`). Never import it from a "use client" component, and
// never expose the token through a NEXT_PUBLIC_* variable.
//
// Auth follows the Re:amaze docs: HTTP Basic, username = your login email,
// password = the API token, against https://{brand}.reamaze.io/api/v1.
// See https://www.reamaze.com/api.

export type ReamazeConfig = {
  /** Re:amaze brand slug, i.e. the {brand} in {brand}.reamaze.io */
  brand: string;
  /** Login email of the Re:amaze account the token belongs to */
  email: string;
  /** API token (secret) */
  token: string;
};

/** Reads config from the environment, or null when not fully configured. */
export function reamazeConfig(): ReamazeConfig | null {
  const brand = process.env.REAMAZE_BRAND?.trim();
  const email = process.env.REAMAZE_LOGIN_EMAIL?.trim();
  const token = process.env.REAMAZE_API_TOKEN?.trim();
  if (!brand || !email || !token) return null;
  return { brand, email, token };
}

export function reamazeConfigured(): boolean {
  return reamazeConfig() !== null;
}

function baseUrl(brand: string): string {
  return `https://${brand}.reamaze.io/api/v1`;
}

function authHeader(c: ReamazeConfig): string {
  return "Basic " + Buffer.from(`${c.email}:${c.token}`).toString("base64");
}

/** Low-level request. Throws if Re:amaze is not configured. */
export async function reamazeFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const c = reamazeConfig();
  if (!c) {
    throw new Error(
      "Re:amaze is not configured — set REAMAZE_BRAND, REAMAZE_LOGIN_EMAIL and REAMAZE_API_TOKEN."
    );
  }
  const url = `${baseUrl(c.brand)}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(c),
      ...(init.headers ?? {}),
    },
    // Support data is always live; never serve it from a cache.
    cache: "no-store",
  });
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Re:amaze API ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * Verify the token works by hitting a lightweight authenticated endpoint.
 * Returns `{ ok: true }` on 2xx, otherwise `{ ok: false, error }`.
 */
export async function reamazePing(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await reamazeFetch("/conversations?page=1");
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** List conversations. See the Re:amaze API for filter/sort options. */
export async function listConversations(params?: {
  page?: number;
  filter?: string;
  sort?: string;
}): Promise<unknown> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.filter) q.set("filter", params.filter);
  if (params?.sort) q.set("sort", params.sort);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return parse(await reamazeFetch(`/conversations${suffix}`));
}

/**
 * Create a conversation (i.e. open a support ticket) on behalf of a contact.
 * Mirrors POST /conversations in the Re:amaze API.
 */
export async function createConversation(input: {
  subject: string;
  message: string;
  contact: { name: string; email: string };
  category?: string;
}): Promise<unknown> {
  const body = {
    conversation: {
      subject: input.subject,
      category: input.category,
      message: { body: input.message },
      contact: input.contact,
    },
  };
  return parse(
    await reamazeFetch("/conversations", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}
