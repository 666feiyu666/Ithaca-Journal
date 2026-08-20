import {
  clearSessionCookie,
  deleteUserData,
  redeemInvite,
  requireSessionUser,
  revokeCurrentSession,
} from "./auth";
import {
  createEntry,
  deleteEntry,
  exportEntries,
  getEntry,
  listEntries,
  updateEntry,
} from "./entries";
import {
  ApiError,
  assertSameOrigin,
  emptyResponse,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  requireRecord,
  requireString,
} from "./http";

const ENTRY_PATH = /^\/api\/entries\/([0-9a-f-]{36})$/;

function routeLabel(pathname: string): string {
  return pathname.replace(ENTRY_PATH, "/api/entries/:id");
}

function entryIdFromPath(pathname: string): string | null {
  const match = ENTRY_PATH.exec(pathname);
  return match?.[1] ?? null;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      methodNotAllowed(["GET"]);
    }
    return jsonResponse({ status: "ok", environment: env.APP_ENV });
  }

  if (url.pathname === "/api/auth/invite") {
    if (request.method !== "POST") {
      methodNotAllowed(["POST"]);
    }
    const session = await redeemInvite(env, await readJsonBody(request));
    return jsonResponse(
      { user: session.user },
      201,
      { "Set-Cookie": session.cookie },
    );
  }

  if (url.pathname === "/api/session") {
    if (request.method === "GET") {
      return jsonResponse({ user: await requireSessionUser(request, env) });
    }
    if (request.method === "DELETE") {
      await revokeCurrentSession(request, env);
      return emptyResponse(204, { "Set-Cookie": clearSessionCookie(env) });
    }
    methodNotAllowed(["GET", "DELETE"]);
  }

  if (url.pathname === "/api/entries") {
    const user = await requireSessionUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ entries: await listEntries(env, user.id) });
    }
    if (request.method === "POST") {
      const entry = await createEntry(env, user.id, await readJsonBody(request));
      return jsonResponse({ entry }, 201);
    }
    methodNotAllowed(["GET", "POST"]);
  }

  const entryId = entryIdFromPath(url.pathname);
  if (entryId) {
    const user = await requireSessionUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ entry: await getEntry(env, user.id, entryId) });
    }
    if (request.method === "PUT") {
      const entry = await updateEntry(
        env,
        user.id,
        entryId,
        await readJsonBody(request),
      );
      return jsonResponse({ entry });
    }
    if (request.method === "DELETE") {
      await deleteEntry(env, user.id, entryId);
      return emptyResponse(204);
    }
    methodNotAllowed(["GET", "PUT", "DELETE"]);
  }

  if (url.pathname === "/api/export") {
    if (request.method !== "GET") {
      methodNotAllowed(["GET"]);
    }
    const user = await requireSessionUser(request, env);
    const entries = await exportEntries(env, user.id);
    const filename = `ithaca-journal-${new Date().toISOString().slice(0, 10)}.json`;
    return jsonResponse(
      {
        format: "ithaca-journal-export",
        version: 1,
        exported_at: new Date().toISOString(),
        user: { email: user.email },
        entries,
      },
      200,
      { "Content-Disposition": `attachment; filename="${filename}"` },
    );
  }

  if (url.pathname === "/api/account") {
    if (request.method !== "DELETE") {
      methodNotAllowed(["DELETE"]);
    }
    const user = await requireSessionUser(request, env);
    const payload = requireRecord(await readJsonBody(request));
    if (requireString(payload, "confirmation") !== "DELETE") {
      throw new ApiError(422, "confirmation_required", "请输入 DELETE 以确认删除。");
    }
    await deleteUserData(env, user.id, user.email);
    return emptyResponse(204, { "Set-Cookie": clearSessionCookie(env) });
  }

  throw new ApiError(404, "not_found", "没有找到这个接口。");
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      assertSameOrigin(request);
      return await handleApi(request, env);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500) {
        console.error(
          JSON.stringify({
            message: "api request failed",
            method: request.method,
            route: routeLabel(url.pathname),
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        );
      }
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;
