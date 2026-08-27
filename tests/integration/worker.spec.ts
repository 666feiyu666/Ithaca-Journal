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
import worker from "../../src/server";
import { normalizeTeamDomain, verifyAccessJwt } from "../../src/server/auth";
import {
  JOURNEY_STORY_ENDINGS,
  JOURNEY_STORY_START,
  JOURNEY_STORY_TRANSITIONS,
} from "../../src/server/generated/journey-story";
import { requireRecord, requireString } from "../../src/server/http";

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

function sealedPayload(fill = "A") {
  return {
    version: 1,
    iv: "AAECAwQFBgcICQoL",
    ciphertext: fill.repeat(32),
  };
}

function storyPathToEnding(): string[] {
  const queue: string[][] = [[JOURNEY_STORY_START]];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const path = queue.shift();
    const passage = path?.at(-1);
    if (!path || !passage || visited.has(passage)) continue;
    if (JOURNEY_STORY_ENDINGS.has(passage)) return path;
    visited.add(passage);
    for (const target of JOURNEY_STORY_TRANSITIONS[passage] ?? []) {
      queue.push([...path, target]);
    }
  }
  throw new Error("Generated Journey does not contain a path to an ending.");
}

async function setUpPrivacy(user: DevelopmentUser): Promise<void> {
  const response = await callWorker(
    "/api/privacy",
    {
      method: "POST",
      body: JSON.stringify({
        version: 1,
        kdf: "PBKDF2-SHA256",
        iterations: 600_000,
        salt: "AAAAAAAAAAAAAAAAAAAAAA",
        sealed_payload: sealedPayload("V"),
      }),
    },
    user,
  );
  expect(response.status).toBe(201);
}

async function createEncryptedEntry(
  user: DevelopmentUser,
  fill = "E",
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const response = await callWorker(
    "/api/entries",
    {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        sealed_payload: sealedPayload(fill),
        ...metadata,
      }),
    },
    user,
  );
  expect(response.status).toBe(201);
  return entryIdFromResponse(await response.json());
}

describe("Ithaca Journal 0.4 Worker", () => {
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

  it("creates one encrypted account key and returns it after the same email signs in", async () => {
    const firstDevice = { subject: "multi-device", email: "reader@example.test" };
    const emptyStatus = await callWorker("/api/privacy", {}, firstDevice);
    expect(await emptyStatus.json()).toEqual({
      profile: null,
      migration_required: false,
      key_custody: "none",
    });

    const created = await callWorker(
      "/api/privacy/key",
      { method: "POST", body: JSON.stringify({}) },
      firstDevice,
    );
    expect(created.status).toBe(200);
    const createdData = requireRecord(await created.json());
    const accountSecret = requireString(createdData, "device_secret");
    expect(accountSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createdData).toMatchObject({ key_custody: "account", created: true });
    expect(created.headers.get("Cache-Control")).toBe("no-store");

    const stored = await env.DB.prepare(
      `SELECT account_vault_keys.iv, account_vault_keys.ciphertext
       FROM account_vault_keys
       JOIN users ON users.id = account_vault_keys.user_id
       WHERE users.email = ?1`,
    )
      .bind(firstDevice.email)
      .first<{ iv: string; ciphertext: string }>();
    expect(stored?.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(stored?.ciphertext).toMatch(/^[A-Za-z0-9_-]{79}$/);
    expect(JSON.stringify(stored)).not.toContain(accountSecret);

    const secondDevice = { subject: "multi-device", email: "reader@example.test" };
    const reopened = await callWorker(
      "/api/privacy/key",
      { method: "POST", body: JSON.stringify({}) },
      secondDevice,
    );
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toEqual({
      device_secret: accountSecret,
      key_custody: "account",
      created: false,
    });
    expect(await (await callWorker("/api/privacy", {}, secondDevice)).json()).toEqual({
      profile: null,
      migration_required: false,
      key_custody: "account",
    });
  });

  it("requires an old working browser to migrate a device-only account key once", async () => {
    const user = { subject: "legacy-key", email: "legacy-key@example.test" };
    await setUpPrivacy(user);
    expect(await (await callWorker("/api/privacy", {}, user)).json()).toMatchObject({
      profile: { version: 1 },
      key_custody: "device",
    });

    const missingLegacyKey = await callWorker(
      "/api/privacy/key",
      { method: "POST", body: JSON.stringify({}) },
      user,
    );
    expect(missingLegacyKey.status).toBe(409);
    expect(await missingLegacyKey.json()).toMatchObject({
      error: { code: "account_key_migration_required" },
    });

    const invalidLegacyKey = await callWorker(
      "/api/privacy/key",
      { method: "POST", body: JSON.stringify({ device_secret: "too-short" }) },
      user,
    );
    expect(invalidLegacyKey.status).toBe(422);

    const legacyKey = "L".repeat(43);
    const migrated = await callWorker(
      "/api/privacy/key",
      { method: "POST", body: JSON.stringify({ device_secret: legacyKey }) },
      user,
    );
    expect(migrated.status).toBe(200);
    expect(await migrated.json()).toEqual({
      device_secret: legacyKey,
      key_custody: "account",
      created: true,
    });
    expect(await (await callWorker("/api/privacy", {}, user)).json()).toMatchObject({
      profile: { version: 1 },
      key_custody: "account",
    });
  });

  it("stores only ciphertext while completing the entry lifecycle", async () => {
    const user = { subject: "writer", email: "writer@example.test" };
    const rejectedPlaintext = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ title: "第一夜", body: "抵达之前。" }),
      },
      user,
    );
    expect(rejectedPlaintext.status).toBe(409);
    expect(await rejectedPlaintext.json()).toMatchObject({
      error: { code: "privacy_profile_required" },
    });

    await setUpPrivacy(user);
    const entryId = crypto.randomUUID();
    const created = await callWorker(
      "/api/entries",
      {
        method: "POST",
        body: JSON.stringify({ id: entryId, sealed_payload: sealedPayload("C") }),
      },
      user,
    );
    expect(created.status).toBe(201);
    expect(entryIdFromResponse(await created.json())).toBe(entryId);

    const reopened = await callWorker(`/api/entries/${entryId}`, {}, user);
    expect(reopened.status).toBe(200);
    const reopenedText = await reopened.text();
    expect(reopenedText).toContain(sealedPayload("C").ciphertext);
    expect(reopenedText).not.toContain("第一夜");
    expect(reopenedText).not.toContain("抵达之前");

    const updated = await callWorker(
      `/api/entries/${entryId}`,
      {
        method: "PUT",
        body: JSON.stringify({ sealed_payload: sealedPayload("U") }),
      },
      user,
    );
    expect(updated.status).toBe(200);
    expect(await updated.text()).toContain(sealedPayload("U").ciphertext);

    const exported = await callWorker("/api/export", {}, user);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("Content-Disposition")).toBeNull();
    const exportText = await exported.text();
    expect(exportText).toContain(sealedPayload("U").ciphertext);
    expect(exportText).not.toContain("第一夜");
    expect(exportText).not.toContain("我已经抵达");

    const stored = await env.DB.prepare(
      "SELECT title, body, body_format, encryption_version FROM journal_entries WHERE id = ?1",
    )
      .bind(entryId)
      .first<{ title: string; body: string; body_format: string; encryption_version: number }>();
    expect(stored).toEqual({
      title: "端侧加密内容",
      body: JSON.stringify(sealedPayload("U")),
      body_format: "ciphertext",
      encryption_version: 1,
    });

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

  it("stores paper categories and source metadata without exposing encrypted labels", async () => {
    const user = { subject: "paper-taxonomy", email: "paper-taxonomy@example.test" };
    await setUpPrivacy(user);

    const fragmentId = await createEncryptedEntry(user, "F");
    expect(await (await callWorker(`/api/entries/${fragmentId}`, {}, user)).json()).toMatchObject({
      entry: {
        id: fragmentId,
        category: "fragment",
        source_topic_id: null,
        source_letter_day: null,
      },
    });

    const looseId = await createEncryptedEntry(user, "U", { category: null });
    expect(await (await callWorker("/api/entries", {}, user)).json()).toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ id: looseId, category: null }),
      ]),
    });

    const journalId = await createEncryptedEntry(user, "J", { category: "journal" });
    expect(await (await callWorker(`/api/entries/${journalId}`, {}, user)).json()).toMatchObject({
      entry: { id: journalId, category: "journal" },
    });
    expect(
      await env.DB.prepare(
        "SELECT category, writing_category FROM journal_entries WHERE id = ?1",
      ).bind(journalId).first(),
    ).toEqual({ category: "fragment", writing_category: "journal" });

    const invalidCategory = await callWorker(
      `/api/entries/${looseId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          category: "archive",
          sealed_payload: sealedPayload("I"),
        }),
      },
      user,
    );
    expect(invalidCategory.status).toBe(422);
    expect(await invalidCategory.json()).toMatchObject({
      error: { code: "invalid_entry_category" },
    });
  });

  it("persists idempotent account milestones and includes them in export", async () => {
    const user = { subject: "milestones", email: "milestones@example.test" };
    const first = await callWorker(
      "/api/achievements",
      { method: "POST", body: JSON.stringify({ key: "arrival" }) },
      user,
    );
    expect(first.status).toBe(201);
    const firstBody = requireRecord(await first.json());
    const firstRecord = requireRecord(firstBody.achievement);
    expect(firstBody.created).toBe(true);

    const repeated = await callWorker(
      "/api/achievements",
      { method: "POST", body: JSON.stringify({ key: "arrival" }) },
      user,
    );
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({
      achievement: { key: "arrival", unlocked_at: firstRecord.unlocked_at },
      created: false,
    });
    expect(await (await callWorker("/api/achievements", {}, user)).json()).toMatchObject({
      achievements: [{ key: "arrival" }],
    });
    expect(await (await callWorker("/api/export", {}, user)).json()).toMatchObject({
      version: 7,
      achievements: [{ key: "arrival" }],
    });

    const invalid = await callWorker(
      "/api/achievements",
      { method: "POST", body: JSON.stringify({ key: "cheat-code" }) },
      user,
    );
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ error: { code: "invalid_achievement" } });
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

  it("validates, completes, and restarts an independent visual-novel journey", async () => {
    const user = { subject: "story-developer", email: "story-developer@example.test" };

    const empty = await callWorker("/api/story-journey", {}, user);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ story_journey: null });

    const started = await callWorker(
      "/api/story-journey",
      { method: "POST" },
      user,
    );
    expect(started.status).toBe(201);
    const startedData = requireRecord(await started.json());
    expect(startedData.story_journey).toMatchObject({
      status: "active",
      current_passage: JOURNEY_STORY_START,
      started_at: expect.any(String),
      last_entered_at: expect.any(String),
      completed_at: null,
    });

    const rejected = await callWorker(
      "/api/story-journey",
      {
        method: "PUT",
        body: JSON.stringify({ passage: "CH04_END" }),
      },
      user,
    );
    expect(rejected.status).toBe(409);

    const endingPath = storyPathToEnding();
    const firstTarget = endingPath[1];
    if (!firstTarget) throw new Error("Journey ends before its first transition.");
    let currentPassage = requireString(
      requireRecord(
        requireRecord(await (
          await callWorker(
            "/api/story-journey",
            {
              method: "PUT",
              body: JSON.stringify({ passage: firstTarget }),
            },
            user,
          )
        ).json()).story_journey,
      ),
      "current_passage",
    );
    expect(currentPassage).toBe(firstTarget);

    const repeated = await callWorker(
      "/api/story-journey",
      { method: "POST" },
      user,
    );
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({
      story_journey: {
        status: "active",
        current_passage: firstTarget,
        started_at: requireRecord(startedData.story_journey).started_at,
      },
    });

    for (const target of endingPath.slice(2)) {
      const response = await callWorker(
        "/api/story-journey",
        {
          method: "PUT",
          body: JSON.stringify({ passage: target }),
        },
        user,
      );
      expect(response.status).toBe(200);
      currentPassage = requireString(
        requireRecord(requireRecord(await response.json()).story_journey),
        "current_passage",
      );
    }
    expect(JOURNEY_STORY_ENDINGS.has(currentPassage)).toBe(true);

    const completed = requireRecord(
      requireRecord(await (await callWorker("/api/story-journey", {}, user)).json()).story_journey,
    );
    expect(completed).toMatchObject({
      status: "completed",
      current_passage: currentPassage,
      completed_at: expect.any(String),
    });

    expect(await (await callWorker("/api/journey", {}, user)).json()).toEqual({
      journey: null,
    });
    expect(await (await callWorker("/api/export", {}, user)).json()).toMatchObject({
      version: 7,
      journey: null,
      story_journey: { status: "completed", current_passage: currentPassage },
    });

    const restarted = await callWorker(
      "/api/story-journey",
      { method: "POST" },
      user,
    );
    expect(restarted.status).toBe(200);
    expect(await restarted.json()).toMatchObject({
      story_journey: {
        status: "active",
        current_passage: JOURNEY_STORY_START,
        completed_at: null,
      },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM story_journeys").first(),
    ).toMatchObject({ count: 1 });
  });

  it("organizes fragments into a topic and compiles an immutable book snapshot", async () => {
    const user = { subject: "compiler", email: "compiler@example.test" };
    await setUpPrivacy(user);
    const firstId = await createEncryptedEntry(user, "F");
    const secondId = await createEncryptedEntry(user, "G");
    const topicId = crypto.randomUUID();

    const topicResponse = await callWorker(
      "/api/topics",
      {
        method: "POST",
        body: JSON.stringify({
          id: topicId,
          sealed_payload: sealedPayload("T"),
          fragment_ids: [firstId, secondId],
        }),
      },
      user,
    );
    expect(topicResponse.status).toBe(201);
    const topicRoot = requireRecord(await topicResponse.json());
    const topic = requireRecord(topicRoot.topic);
    expect(requireString(topic, "id")).toBe(topicId);
    expect(topic.fragments).toHaveLength(2);
    expect(await (await callWorker("/api/topics", {}, user)).json()).toMatchObject({
      topics: [{ id: topicId, fragment_count: 2 }],
    });

    const bookId = crypto.randomUUID();
    const bookResponse = await callWorker(
      "/api/books",
      {
        method: "POST",
        body: JSON.stringify({
          id: bookId,
          sealed_payload: sealedPayload("B"),
          source_topic_ids: [topicId],
        }),
      },
      user,
    );
    expect(bookResponse.status).toBe(201);
    const bookRoot = requireRecord(await bookResponse.json());
    const book = requireRecord(bookRoot.book);
    expect(requireString(book, "id")).toBe(bookId);
    expect(book.sealed_payload).toEqual(sealedPayload("B"));

    await callWorker(
      `/api/entries/${firstId}`,
      {
        method: "PUT",
        body: JSON.stringify({ sealed_payload: sealedPayload("X") }),
      },
      user,
    );
    const reopenedBook = await callWorker(`/api/books/${bookId}`, {}, user);
    const reopenedRoot = requireRecord(await reopenedBook.json());
    const reopened = requireRecord(reopenedRoot.book);
    expect(reopened.sealed_payload).toEqual(sealedPayload("B"));

    expect(
      (await callWorker(`/api/topics/${topicId}`, { method: "DELETE" }, user)).status,
    ).toBe(204);
    expect((await callWorker(`/api/books/${bookId}`, {}, user)).status).toBe(200);
  });

  it("binds a book draft without requiring a topic and preserves its snapshot", async () => {
    const user = { subject: "book-draft", email: "book-draft@example.test" };
    await setUpPrivacy(user);
    const draftId = await createEncryptedEntry(user, "D", { category: "book" });
    const bookId = crypto.randomUUID();

    const created = await callWorker(
      "/api/books",
      {
        method: "POST",
        body: JSON.stringify({
          id: bookId,
          source_entry_id: draftId,
          sealed_payload: sealedPayload("B"),
        }),
      },
      user,
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      book: {
        id: bookId,
        source_entry_id: draftId,
        source_topic_ids: [],
        sealed_payload: sealedPayload("B"),
      },
    });

    await callWorker(
      `/api/entries/${draftId}`,
      {
        method: "PUT",
        body: JSON.stringify({ category: "book", sealed_payload: sealedPayload("N") }),
      },
      user,
    );
    expect(await (await callWorker(`/api/books/${bookId}`, {}, user)).json()).toMatchObject({
      book: { sealed_payload: sealedPayload("B") },
    });

    const fragmentId = await createEncryptedEntry(user, "X", { category: "fragment" });
    const rejected = await callWorker(
      "/api/books",
      {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          source_entry_id: fragmentId,
          sealed_payload: sealedPayload("R"),
        }),
      },
      user,
    );
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({
      error: { code: "book_draft_not_found" },
    });
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

  it("keeps encrypted outgoing-letter records manageable after the symbolic send", async () => {
    const user = { subject: "correspondent", email: "correspondent@example.test" };
    await setUpPrivacy(user);
    const draftId = await createEncryptedEntry(user, "L", { category: "letter" });
    const sentId = crypto.randomUUID();

    const sent = await callWorker(
      "/api/sent-letters",
      {
        method: "POST",
        body: JSON.stringify({
          id: sentId,
          source_entry_id: draftId,
          sealed_payload: sealedPayload("S"),
        }),
      },
      user,
    );
    expect(sent.status).toBe(201);
    expect(await sent.json()).toMatchObject({
      letter: {
        id: sentId,
        source_entry_id: draftId,
        sealed_payload: sealedPayload("S"),
        sent_at: expect.any(String),
      },
    });
    expect(await (await callWorker("/api/sent-letters", {}, user)).json()).toMatchObject({
      letters: [{ id: sentId }],
    });
    expect(await (await callWorker("/api/export", {}, user)).json()).toMatchObject({
      version: 7,
      sent_letters: [{ id: sentId }],
    });

    const updated = await callWorker(
      `/api/sent-letters/${sentId}`,
      {
        method: "PUT",
        body: JSON.stringify({ sealed_payload: sealedPayload("U") }),
      },
      user,
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      letter: {
        id: sentId,
        source_entry_id: draftId,
        sealed_payload: sealedPayload("U"),
        sent_at: expect.any(String),
      },
    });

    const fragmentId = await createEncryptedEntry(user, "Q", { category: "fragment" });
    const rejected = await callWorker(
      "/api/sent-letters",
      {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          source_entry_id: fragmentId,
          sealed_payload: sealedPayload("R"),
        }),
      },
      user,
    );
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({
      error: { code: "letter_draft_not_found" },
    });

    expect(
      (await callWorker(`/api/sent-letters/${sentId}`, { method: "DELETE" }, user)).status,
    ).toBe(204);
    expect(await (await callWorker("/api/sent-letters", {}, user)).json()).toEqual({
      letters: [],
    });
    expect(
      (await callWorker(`/api/sent-letters/${sentId}`, { method: "DELETE" }, user)).status,
    ).toBe(404);
  });

  it("rejects topic sources owned by another Access subject", async () => {
    const owner = { subject: "fragment-owner", email: "fragment-owner@example.test" };
    const other = { subject: "topic-other", email: "topic-other@example.test" };
    await setUpPrivacy(owner);
    await setUpPrivacy(other);
    const entryId = await createEncryptedEntry(owner, "O");
    const response = await callWorker(
      "/api/topics",
      {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          sealed_payload: sealedPayload("N"),
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
    await setUpPrivacy(owner);
    const entryId = await createEncryptedEntry(owner, "P");

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
    await setUpPrivacy(user);
    await createEncryptedEntry(user, "D");
    await callWorker(
      "/api/achievements",
      { method: "POST", body: JSON.stringify({ key: "first_page" }) },
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
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM achievements").first(),
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
