import { randomToken, sha256Hex } from "./crypto";
import { ApiError, requireRecord, requireString } from "./http";

const SESSION_COOKIE_NAME = "ithaca_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

interface InviteRow {
  id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface RedeemedSession {
  user: SessionUser;
  cookie: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = segment.slice(0, separator).trim();
    if (key === name) {
      return segment.slice(separator + 1).trim();
    }
  }
  return null;
}

function createSessionCookie(env: Env, token: string, maxAge: number): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (env.COOKIE_SECURE === "true") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(env: Env): string {
  return createSessionCookie(env, "", 0);
}

export async function redeemInvite(
  env: Env,
  payload: unknown,
): Promise<RedeemedSession> {
  const record = requireRecord(payload);
  const email = normalizeEmail(requireString(record, "email"));
  const code = requireString(record, "code").trim();

  if (!isValidEmail(email) || code.length < 16 || code.length > 200) {
    throw new ApiError(401, "invalid_invite", "邮箱或邀请码无效。");
  }

  const now = new Date().toISOString();
  const codeHash = await sha256Hex(code);
  const invite = await env.DB.prepare(
    `SELECT id, email, expires_at, used_at
     FROM invites
     WHERE email = ?1 AND code_hash = ?2`,
  )
    .bind(email, codeHash)
    .first<InviteRow>();

  if (!invite || invite.used_at || invite.expires_at <= now) {
    throw new ApiError(401, "invalid_invite", "邮箱或邀请码无效。");
  }

  const proposedUserId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO users (id, email, created_at)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(email) DO NOTHING`,
  )
    .bind(proposedUserId, email, now)
    .run();

  const user = await env.DB.prepare(
    "SELECT id, email, created_at FROM users WHERE email = ?1",
  )
    .bind(email)
    .first<UserRow>();
  if (!user) {
    throw new ApiError(500, "account_creation_failed", "无法创建测试账户。");
  }

  const claim = await env.DB.prepare(
    `UPDATE invites
     SET used_at = ?1, used_by_user_id = ?2
     WHERE id = ?3 AND used_at IS NULL`,
  )
    .bind(now, user.id, invite.id)
    .run();
  if (claim.meta.changes !== 1) {
    throw new ApiError(409, "invite_already_used", "这个邀请码已经使用。");
  }

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_SECONDS * 1_000,
  ).toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
      .bind(tokenHash, user.id, expiresAt, now)
      .run();
  } catch (error) {
    await env.DB.prepare(
      `UPDATE invites
       SET used_at = NULL, used_by_user_id = NULL
       WHERE id = ?1 AND used_by_user_id = ?2`,
    )
      .bind(invite.id, user.id)
      .run();
    throw error;
  }

  return {
    user: { id: user.id, email: user.email },
    cookie: createSessionCookie(env, token, SESSION_DURATION_SECONDS),
  };
}

export async function getSessionUser(
  request: Request,
  env: Env,
): Promise<SessionUser | null> {
  const token = parseCookie(request, SESSION_COOKIE_NAME);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT users.id, users.email
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<SessionUser>();
  return row ?? null;
}

export async function requireSessionUser(
  request: Request,
  env: Env,
): Promise<SessionUser> {
  const user = await getSessionUser(request, env);
  if (!user) {
    throw new ApiError(401, "authentication_required", "请先使用邀请登录。");
  }
  return user;
}

export async function revokeCurrentSession(
  request: Request,
  env: Env,
): Promise<void> {
  const token = parseCookie(request, SESSION_COOKIE_NAME);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return;
  }
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1")
    .bind(await sha256Hex(token))
    .run();
}

export async function deleteUserData(
  env: Env,
  userId: string,
  email: string,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM invites WHERE used_by_user_id = ?1 OR email = ?2",
    ).bind(userId, email),
    env.DB.prepare("DELETE FROM journal_entries WHERE user_id = ?1").bind(userId),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId),
    env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(userId),
  ]);
}
