import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { describe, expect, it } from "vitest";
import worker from "../src";
import { normalizeTeamDomain, verifyAccessJwt } from "../src/auth";
import { requireRecord, requireString } from "../src/http";

const ORIGIN = "http://localhost";
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

interface WorkerRequestInit {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
  origin?: string;
}

interface DevelopmentUser {
  subject: string;
  email: string;
}

async function callWorker(
  path: string,
  init: WorkerRequestInit = {},
  user?: DevelopmentUser,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && init.method !== "GET" && !headers.has("Origin")) {
    headers.set("Origin", init.origin ?? ORIGIN);
    headers.set("Sec-Fetch-Site", "same-origin");
  }
  if (user) {
    headers.set("X-Ithaca-Dev-User", user.subject);
    headers.set("X-Ithaca-Dev-Email", user.email);
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

function entryIdFromResponse(data: unknown): string {
  const root = requireRecord(data);
  const entry = requireRecord(root.entry);
  return requireString(entry, "id");
}

describe("Ithaca Journal C0 Worker", () => {
  it("creates and reuses the localhost development identity", async () => {
    const first = await callWorker("/api/session");
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      user: { email: "local@ithaca.invalid", source: "development" },
      environment: "local",
    });

    expect((await callWorker("/api/session")).status).toBe(200);
    const user = await env.DB.prepare(
      "SELECT email, access_subject FROM users",
    ).first<{ email: string; access_subject: string }>();
    expect(user).toEqual({
      email: "local@ithaca.invalid",
      access_subject: "dev:local-developer",
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
    ).toMatchObject({ count: 1 });
  });

  it("refuses development authentication on a non-local hostname", async () => {
    const request = new IncomingRequest("https://preview.example/api/session");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "insecure_auth_mode" },
    });
  });

  it("normalizes the Access issuer and verifies issuer, audience, subject, and email", async () => {
    const teamDomain = "https://ithaca-test.cloudflareaccess.com";
    const audience = "ithaca-audience";
    expect(normalizeTeamDomain("ithaca-test.cloudflareaccess.com/")).toBe(
      teamDomain,
    );
    expect(normalizeTeamDomain("http://ithaca-test.cloudflareaccess.com")).toBe("");

    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "test-key";
    const keys = createLocalJWKSet({ keys: [publicJwk] });
    const token = await new SignJWT({ email: "Reader@Example.test" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(teamDomain)
      .setAudience(audience)
      .setSubject("access-user-123")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      verifyAccessJwt(token, { teamDomain, audience }, keys),
    ).resolves.toEqual({
      subject: "access-user-123",
      email: "reader@example.test",
      source: "cloudflare-access",
    });
    await expect(
      verifyAccessJwt(token, { teamDomain, audience: "wrong-audience" }, keys),
    ).rejects.toThrow();
  });

  it("completes the create, reopen, update, export, and delete path", async () => {
    const user = { subject: "writer", email: "writer@example.test" };
    const created = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "第一夜", body: "抵达之前。" }),
      },
      user,
    );
    expect(created.status).toBe(201);
    const entryId = entryIdFromResponse(await created.json());

    const reopened = await callWorker(`/api/entries/${entryId}`, {}, user);
    expect(reopened.status).toBe(200);
    expect(await reopened.text()).toContain("抵达之前");

    const updated = await callWorker(
      `/api/entries/${entryId}`,
      {
        method: "PUT",
        body: JSON.stringify({ title: "第一夜（修订）", body: "我已经抵达。" }),
      },
      user,
    );
    expect(updated.status).toBe(200);
    expect(await updated.text()).toContain("我已经抵达");

    const exported = await callWorker("/api/export", {}, user);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("Content-Disposition")).toContain("attachment");
    expect(await exported.text()).toContain("第一夜（修订）");

    const removed = await callWorker(
      `/api/entries/${entryId}`,
      { method: "DELETE" },
      user,
    );
    expect(removed.status).toBe(204);
    expect(await (await callWorker("/api/entries", {}, user)).json()).toEqual({
      entries: [],
    });
  });

  it("never permits one Access subject to read another user's entry", async () => {
    const owner = { subject: "owner", email: "owner@example.test" };
    const other = { subject: "other", email: "other@example.test" };
    const created = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "私有手记", body: "只属于第一个人。" }),
      },
      owner,
    );
    const entryId = entryIdFromResponse(await created.json());

    expect(
      (await callWorker(`/api/entries/${entryId}`, {}, other)).status,
    ).toBe(404);
  });

  it("links an existing invite-era user to the first matching Access identity", async () => {
    const legacyId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, created_at)
       VALUES (?1, ?2, ?3)`,
    )
      .bind(legacyId, "legacy@example.test", new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO journal_entries
         (id, user_id, title, body, body_format, encryption_version, created_at, updated_at)
       VALUES (?1, ?2, '旧手记', '仍然保留。', 'plain', 0, ?3, ?3)`,
    )
      .bind(crypto.randomUUID(), legacyId, new Date().toISOString())
      .run();

    const linked = { subject: "access-subject", email: "legacy@example.test" };
    expect((await callWorker("/api/session", {}, linked)).status).toBe(200);
    expect(await (await callWorker("/api/entries", {}, linked)).json()).toMatchObject({
      entries: [{ title: "旧手记" }],
    });
    expect(
      await env.DB.prepare(
        "SELECT id, access_subject FROM users WHERE email = ?1",
      )
        .bind(linked.email)
        .first(),
    ).toEqual({ id: legacyId, access_subject: "dev:access-subject" });
  });

  it("deletes the current application account and journal data", async () => {
    const user = { subject: "leaving", email: "leaving@example.test" };
    await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "最后一页", body: "删除我。" }),
      },
      user,
    );

    const removed = await callWorker(
      "/api/account",
      {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      },
      user,
    );
    expect(removed.status).toBe(204);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
    ).toMatchObject({ count: 0 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM journal_entries",
      ).first(),
    ).toMatchObject({ count: 0 });
  });

  it("rejects mutation requests with missing or cross-origin evidence", async () => {
    const user = { subject: "writer", email: "writer@example.test" };
    const missingOrigin = await callWorker(
      "/api/entries",
      {
        method: "POST",
        headers: { Origin: "" },
        body: JSON.stringify({ title: "x", body: "x" }),
      },
      user,
    );
    expect(missingOrigin.status).toBe(403);

    const crossOrigin = await callWorker(
      "/api/entries",
      {
        method: "POST",
        origin: "https://untrusted.example",
        body: JSON.stringify({ title: "x", body: "x" }),
      },
      user,
    );
    expect(crossOrigin.status).toBe(403);
  });
});
