import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM journey_letters"),
    env.DB.prepare("DELETE FROM topic_fragments"),
    env.DB.prepare("DELETE FROM books"),
    env.DB.prepare("DELETE FROM topics"),
    env.DB.prepare("DELETE FROM journeys"),
    env.DB.prepare("DELETE FROM journal_entries"),
    env.DB.prepare("DELETE FROM users"),
  ]);
});
