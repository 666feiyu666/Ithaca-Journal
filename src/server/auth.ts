import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { ApiError } from "./http";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const remoteJwksByTeamDomain = new Map<string, JWTVerifyGetKey>();

interface UserRow {
  id: string;
  email: string;
  access_subject: string | null;
  created_at: string;
}

export interface AccessIdentity {
  subject: string;
  email: string;
  source: "development" | "cloudflare-access";
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  subject: string;
  source: AccessIdentity["source"];
}

export function normalizeTeamDomain(value: unknown): string {
  const configured = String(value ?? "").trim().replace(/\/+$/, "");
  if (!configured) {
    return "";
  }

  const candidate = configured.includes("://")
    ? configured
    : `https://${configured}`;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireAccessConfig(env: Env): {
  teamDomain: string;
  audience: string;
} {
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN);
  const audience = String(env.POLICY_AUD ?? "").trim();
  if (!teamDomain || !audience) {
    throw new ApiError(
      500,
      "access_not_configured",
      "Cloudflare Access 尚未完成配置。",
    );
  }
  return { teamDomain, audience };
}

function developmentIdentity(request: Request): AccessIdentity {
  const url = new URL(request.url);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new ApiError(
      500,
      "insecure_auth_mode",
      "开发身份只允许在本机地址使用。",
    );
  }

  const requestedSubject =
    request.headers.get("X-Ithaca-Dev-User")?.trim() || "local-developer";
  const requestedEmail = normalizeEmail(
    request.headers.get("X-Ithaca-Dev-Email") || "local@ithaca.invalid",
  );
  if (requestedSubject.length > 200 || !isValidEmail(requestedEmail)) {
    throw new ApiError(400, "invalid_development_identity", "本地开发身份无效。");
  }
  return {
    subject: `dev:${requestedSubject}`,
    email: requestedEmail,
    source: "development",
  };
}

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  const existing = remoteJwksByTeamDomain.get(teamDomain);
  if (existing) {
    return existing;
  }
  const created = createRemoteJWKSet(
    new URL(`${teamDomain}/cdn-cgi/access/certs`),
  );
  remoteJwksByTeamDomain.set(teamDomain, created);
  return created;
}

export async function verifyAccessJwt(
  token: string,
  config: { teamDomain: string; audience: string },
  keyResolver: JWTVerifyGetKey = remoteJwks(config.teamDomain),
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(token, keyResolver, {
    issuer: config.teamDomain,
    audience: config.audience,
  });
  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const email = normalizeEmail(payload.email);
  if (!subject || subject.length > 500 || !isValidEmail(email)) {
    throw new Error("Cloudflare Access JWT is missing a valid subject or email.");
  }
  return { subject, email, source: "cloudflare-access" };
}

export async function authenticateRequest(
  request: Request,
  env: Env,
): Promise<AccessIdentity> {
  if (env.AUTH_MODE === "development") {
    return developmentIdentity(request);
  }
  if (env.AUTH_MODE !== "access") {
    throw new ApiError(500, "auth_mode_invalid", "服务端身份验证模式无效。");
  }

  const config = requireAccessConfig(env);
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    throw new ApiError(401, "authentication_required", "请先通过访问验证登录。");
  }

  try {
    return await verifyAccessJwt(token, config);
  } catch (cause) {
    throw new ApiError(
      401,
      "authentication_invalid",
      "访问验证已经失效，请重新登录。",
      {},
      { cause },
    );
  }
}

async function userBySubject(env: Env, subject: string): Promise<UserRow | null> {
  return env.DB.prepare(
    `SELECT id, email, access_subject, created_at
     FROM users
     WHERE access_subject = ?1`,
  )
    .bind(subject)
    .first<UserRow>();
}

async function resolveUser(
  env: Env,
  identity: AccessIdentity,
): Promise<UserRow> {
  const existing = await userBySubject(env, identity.subject);
  if (existing) {
    if (existing.email !== identity.email) {
      await env.DB.prepare("UPDATE users SET email = ?1 WHERE id = ?2")
        .bind(identity.email, existing.id)
        .run();
      return { ...existing, email: identity.email };
    }
    return existing;
  }

  const legacy = await env.DB.prepare(
    `SELECT id, email, access_subject, created_at
     FROM users
     WHERE email = ?1`,
  )
    .bind(identity.email)
    .first<UserRow>();
  if (legacy) {
    if (legacy.access_subject) {
      throw new ApiError(
        409,
        "identity_conflict",
        "这个邮箱已经绑定到另一个访问身份，请联系管理员。",
      );
    }
    const linked = await env.DB.prepare(
      `UPDATE users
       SET access_subject = ?1
       WHERE id = ?2 AND access_subject IS NULL`,
    )
      .bind(identity.subject, legacy.id)
      .run();
    if (linked.meta.changes === 1) {
      return { ...legacy, access_subject: identity.subject };
    }
    const raced = await userBySubject(env, identity.subject);
    if (raced) {
      return raced;
    }
    throw new ApiError(409, "identity_conflict", "访问身份绑定发生冲突，请重试。");
  }

  const created: UserRow = {
    id: crypto.randomUUID(),
    email: identity.email,
    access_subject: identity.subject,
    created_at: new Date().toISOString(),
  };
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, access_subject, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
      .bind(created.id, created.email, created.access_subject, created.created_at)
      .run();
    return created;
  } catch (cause) {
    const raced = await userBySubject(env, identity.subject);
    if (raced) {
      return raced;
    }
    throw new ApiError(
      409,
      "identity_conflict",
      "无法建立访问身份，请联系管理员。",
      {},
      { cause },
    );
  }
}

export async function requireAuthenticatedUser(
  request: Request,
  env: Env,
): Promise<AuthenticatedUser> {
  const identity = await authenticateRequest(request, env);
  const user = await resolveUser(env, identity);
  return {
    id: user.id,
    email: user.email,
    subject: identity.subject,
    source: identity.source,
  };
}

export async function deleteUserData(env: Env, userId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM journal_entries WHERE user_id = ?1").bind(userId),
    env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(userId),
  ]);
}
