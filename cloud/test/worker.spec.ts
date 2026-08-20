import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src";
import { sha256Hex } from "../src/crypto";
import { requireRecord, requireString } from "../src/http";

const ORIGIN = "http://example.test";
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

interface WorkerRequestInit {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
}

async function callWorker(
  path: string,
  init: WorkerRequestInit = {},
  cookie?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && init.method !== "GET" && !headers.has("Origin")) {
    headers.set("Origin", ORIGIN);
  }
  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const request = new IncomingRequest(`${ORIGIN}${path}`, {
    method: init.method,
    body: init.body,
    headers,
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function seedInvite(email: string, code: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86_400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO invites (id, email, code_hash, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(
      crypto.randomUUID(),
      email,
      await sha256Hex(code),
      expiresAt,
      now.toISOString(),
    )
    .run();
}

async function login(email: string, code: string): Promise<string> {
  await seedInvite(email, code);
  const response = await callWorker("/api/auth/invite", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  expect(response.status).toBe(201);
  const setCookie = response.headers.get("Set-Cookie");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  return setCookie?.split(";", 1)[0] ?? "";
}

function entryIdFromResponse(data: unknown): string {
  const root = requireRecord(data);
  const entry = requireRecord(root.entry);
  return requireString(entry, "id");
}

describe("Ithaca Journal C0 Worker", () => {
  it("rejects unauthenticated journal access", async () => {
    const response = await callWorker("/api/entries");
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("redeems an invite once and creates an HttpOnly session", async () => {
    const email = "first@example.test";
    const code = "first-invite-code-with-enough-entropy";
    await seedInvite(email, code);

    const first = await callWorker("/api/auth/invite", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    expect(first.status).toBe(201);
    expect(first.headers.get("Set-Cookie")).toContain("HttpOnly");

    const second = await callWorker("/api/auth/invite", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    expect(second.status).toBe(401);
  });

  it("completes the create, reopen, update, export, and delete path", async () => {
    const cookie = await login(
      "writer@example.test",
      "writer-invite-code-with-enough-entropy",
    );

    const created = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "第一夜", body: "抵达之前。" }),
      },
      cookie,
    );
    expect(created.status).toBe(201);
    const entryId = entryIdFromResponse(await created.json());

    const reopened = await callWorker(`/api/entries/${entryId}`, {}, cookie);
    expect(reopened.status).toBe(200);
    expect(await reopened.text()).toContain("抵达之前");

    const updated = await callWorker(
      `/api/entries/${entryId}`,
      {
        method: "PUT",
        body: JSON.stringify({ title: "第一夜（修订）", body: "我已经抵达。" }),
      },
      cookie,
    );
    expect(updated.status).toBe(200);
    expect(await updated.text()).toContain("我已经抵达");

    const exported = await callWorker("/api/export", {}, cookie);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("Content-Disposition")).toContain("attachment");
    expect(await exported.text()).toContain("第一夜（修订）");

    const removed = await callWorker(
      `/api/entries/${entryId}`,
      { method: "DELETE" },
      cookie,
    );
    expect(removed.status).toBe(204);

    const list = await callWorker("/api/entries", {}, cookie);
    expect(await list.json()).toEqual({ entries: [] });
  });

  it("never permits one user to read another user's entry", async () => {
    const firstCookie = await login(
      "owner@example.test",
      "owner-invite-code-with-enough-entropy",
    );
    const secondCookie = await login(
      "other@example.test",
      "other-invite-code-with-enough-entropy",
    );

    const created = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "私有手记", body: "只属于第一个人。" }),
      },
      firstCookie,
    );
    const entryId = entryIdFromResponse(await created.json());

    const crossUserRead = await callWorker(
      `/api/entries/${entryId}`,
      {},
      secondCookie,
    );
    expect(crossUserRead.status).toBe(404);
  });

  it("deletes the account, sessions, and journal data together", async () => {
    const cookie = await login(
      "leaving@example.test",
      "leaving-invite-code-with-enough-entropy",
    );
    await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "最后一页", body: "删除我。" }),
      },
      cookie,
    );

    const removed = await callWorker(
      "/api/account",
      {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      },
      cookie,
    );
    expect(removed.status).toBe(204);

    const session = await callWorker("/api/session", {}, cookie);
    expect(session.status).toBe(401);

    const counts = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM sessions").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM journal_entries").first<{ count: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM invites").first<{ count: number }>(),
    ]);
    for (const result of counts) {
      expect(result?.count).toBe(0);
    }
  });

  it("rejects cross-origin mutation requests", async () => {
    const response = await callWorker("/api/auth/invite", {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
      body: JSON.stringify({ email: "x@example.test", code: "not-a-real-code" }),
    });
    expect(response.status).toBe(403);
  });
});
