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
import worker from "../src/server";
import { normalizeTeamDomain, verifyAccessJwt } from "../src/server/auth";
import { requireRecord, requireString } from "../src/server/http";

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

  it("starts one journey, completes the intro once, and advances at most one day per date", async () => {
    const user = { subject: "traveler", email: "traveler@example.test" };
    const empty = await callWorker("/api/journey", {}, user);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ journey: null });

    const started = await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-20" }),
      },
      user,
    );
    expect(started.status).toBe(201);
    expect(await started.json()).toMatchObject({
      journey: { current_day: 1, status: "active", intro_completed_at: null },
    });

    const repeated = await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-20" }),
      },
      user,
    );
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ journey: { current_day: 1 } });

    const intro = await callWorker(
      "/api/journey/intro",
      { method: "PUT", body: JSON.stringify({}) },
      user,
    );
    expect(intro.status).toBe(200);
    const introData = requireRecord(await intro.json());
    expect(requireRecord(introData.journey).intro_completed_at).toEqual(
      expect.any(String),
    );

    const nextDay = await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-25" }),
      },
      user,
    );
    expect(await nextDay.json()).toMatchObject({ journey: { current_day: 2 } });

    const sameLaterDate = await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-25" }),
      },
      user,
    );
    expect(await sameLaterDate.json()).toMatchObject({ journey: { current_day: 2 } });
    await env.DB.prepare(
      "UPDATE journeys SET current_day = 20 WHERE user_id = (SELECT id FROM users WHERE access_subject = ?1)",
    )
      .bind("dev:traveler")
      .run();
    const finalDay = await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-26" }),
      },
      user,
    );
    expect(await finalDay.json()).toMatchObject({
      journey: { current_day: 21, status: "completed", completed_at: expect.any(String) },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM journeys").first(),
    ).toMatchObject({ count: 1 });
  });

  it("organizes fragments into a topic and compiles an immutable book snapshot", async () => {
    const user = { subject: "compiler", email: "compiler@example.test" };
    const first = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "车站", body: "我在雨里等车。" }),
      },
      user,
    );
    const second = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "钥匙", body: "旧钥匙还在口袋里。" }),
      },
      user,
    );
    const firstId = entryIdFromResponse(await first.json());
    const secondId = entryIdFromResponse(await second.json());

    const topicResponse = await callWorker(
      "/api/topics",
      {
        method: "POST",
        body: JSON.stringify({
          title: "抵达与离开",
          body: "有些抵达仍然携带着离开的痕迹。",
          fragment_ids: [firstId, secondId],
        }),
      },
      user,
    );
    expect(topicResponse.status).toBe(201);
    const topicRoot = requireRecord(await topicResponse.json());
    const topic = requireRecord(topicRoot.topic);
    const topicId = requireString(topic, "id");
    expect(topic.fragments).toHaveLength(2);
    expect(await (await callWorker("/api/topics", {}, user)).json()).toMatchObject({
      topics: [{ id: topicId, fragment_count: 2 }],
    });

    const bookResponse = await callWorker(
      "/api/books",
      {
        method: "POST",
        body: JSON.stringify({
          title: "雨夜手记",
          preface: "把散落的东西收拢起来。",
          topic_ids: [topicId],
        }),
      },
      user,
    );
    expect(bookResponse.status).toBe(201);
    const bookRoot = requireRecord(await bookResponse.json());
    const book = requireRecord(bookRoot.book);
    const bookId = requireString(book, "id");
    expect(requireString(book, "content_snapshot")).toContain("我在雨里等车");

    await callWorker(
      `/api/entries/${firstId}`,
      {
        method: "PUT",
        body: JSON.stringify({ title: "车站（改）", body: "这次没有下雨。" }),
      },
      user,
    );
    const reopenedBook = await callWorker(`/api/books/${bookId}`, {}, user);
    const reopenedRoot = requireRecord(await reopenedBook.json());
    const reopened = requireRecord(reopenedRoot.book);
    expect(requireString(reopened, "content_snapshot")).toContain("我在雨里等车");
    expect(requireString(reopened, "content_snapshot")).not.toContain("这次没有下雨");

    expect(
      (await callWorker(`/api/topics/${topicId}`, { method: "DELETE" }, user)).status,
    ).toBe(204);
    expect((await callWorker(`/api/books/${bookId}`, {}, user)).status).toBe(200);
  });

  it("delivers only unlocked letters and remembers the first open time", async () => {
    const user = { subject: "reader", email: "reader@example.test" };
    await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-20" }),
      },
      user,
    );
    await callWorker(
      "/api/journey/intro",
      { method: "PUT", body: JSON.stringify({}) },
      user,
    );

    expect(await (await callWorker("/api/letters", {}, user)).json()).toMatchObject({
      letters: [{ day: 1, title: "半年了", opened_at: null, current: true }],
    });
    const opened = await callWorker(
      "/api/letters/1/open",
      { method: "PUT", body: JSON.stringify({}) },
      user,
    );
    expect(opened.status).toBe(200);
    const openedRoot = requireRecord(await opened.json());
    const openedAt = requireString(requireRecord(openedRoot.letter), "opened_at");
    const reopened = await callWorker(
      "/api/letters/1/open",
      { method: "PUT", body: JSON.stringify({}) },
      user,
    );
    expect(await reopened.json()).toMatchObject({ letter: { opened_at: openedAt } });
    expect(
      (await callWorker(
        "/api/letters/2/open",
        { method: "PUT", body: JSON.stringify({}) },
        user,
      )).status,
    ).toBe(403);
  });

  it("rejects topic sources owned by another Access subject", async () => {
    const owner = { subject: "fragment-owner", email: "fragment-owner@example.test" };
    const other = { subject: "topic-other", email: "topic-other@example.test" };
    const created = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "私有碎片", body: "只属于一个人。" }),
      },
      owner,
    );
    const entryId = entryIdFromResponse(await created.json());
    const response = await callWorker(
      "/api/topics",
      {
        method: "POST",
        body: JSON.stringify({
          title: "越界主题",
          body: "不应建立。",
          fragment_ids: [entryId],
        }),
      },
      other,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "fragment_not_found" } });
  });

  it("keeps journey state private to its Access subject", async () => {
    const owner = { subject: "journey-owner", email: "owner@example.test" };
    const other = { subject: "journey-other", email: "other@example.test" };
    await callWorker(
      "/api/journey",
      {
        method: "POST",
        body: JSON.stringify({ local_date: "2026-08-20" }),
      },
      owner,
    );

    expect(await (await callWorker("/api/journey", {}, other)).json()).toEqual({
      journey: null,
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
