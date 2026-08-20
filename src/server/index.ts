import {
  deleteUserData,
  requireAuthenticatedUser,
} from "./auth";
import { compileBook, deleteBook, exportBooks, getBook, listBooks } from "./books";
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
import { completeIntro, enterJourney, getJourney } from "./journey";
import { listAvailableLetters, openLetter } from "./letters";
import {
  createTopic,
  deleteTopic,
  getTopic,
  listTopics,
  updateTopic,
} from "./topics";

const ENTRY_PATH = /^\/api\/entries\/([0-9a-f-]{36})$/;
const TOPIC_PATH = /^\/api\/topics\/([0-9a-f-]{36})$/;
const BOOK_PATH = /^\/api\/books\/([0-9a-f-]{36})$/;
const LETTER_OPEN_PATH = /^\/api\/letters\/(\d{1,2})\/open$/;

function routeLabel(pathname: string): string {
  return pathname
    .replace(ENTRY_PATH, "/api/entries/:id")
    .replace(TOPIC_PATH, "/api/topics/:id")
    .replace(BOOK_PATH, "/api/books/:id")
    .replace(LETTER_OPEN_PATH, "/api/letters/:day/open");
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

  if (url.pathname === "/api/session") {
    if (request.method !== "GET") {
      methodNotAllowed(["GET"]);
    }
    const user = await requireAuthenticatedUser(request, env);
    return jsonResponse({
      user: { email: user.email, source: user.source },
      environment: env.APP_ENV,
    });
  }

  if (url.pathname === "/api/journey") {
    const user = await requireAuthenticatedUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ journey: await getJourney(env, user.id) });
    }
    if (request.method === "POST") {
      const result = await enterJourney(env, user.id, await readJsonBody(request));
      return jsonResponse({ journey: result.journey }, result.created ? 201 : 200);
    }
    methodNotAllowed(["GET", "POST"]);
  }

  if (url.pathname === "/api/journey/intro") {
    if (request.method !== "PUT") {
      methodNotAllowed(["PUT"]);
    }
    const user = await requireAuthenticatedUser(request, env);
    return jsonResponse({ journey: await completeIntro(env, user.id) });
  }

  if (url.pathname === "/api/entries") {
    const user = await requireAuthenticatedUser(request, env);
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
    const user = await requireAuthenticatedUser(request, env);
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

  if (url.pathname === "/api/topics") {
    const user = await requireAuthenticatedUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ topics: await listTopics(env, user.id) });
    }
    if (request.method === "POST") {
      const topic = await createTopic(env, user.id, await readJsonBody(request));
      return jsonResponse({ topic }, 201);
    }
    methodNotAllowed(["GET", "POST"]);
  }

  const topicId = TOPIC_PATH.exec(url.pathname)?.[1];
  if (topicId) {
    const user = await requireAuthenticatedUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ topic: await getTopic(env, user.id, topicId) });
    }
    if (request.method === "PUT") {
      const topic = await updateTopic(
        env,
        user.id,
        topicId,
        await readJsonBody(request),
      );
      return jsonResponse({ topic });
    }
    if (request.method === "DELETE") {
      await deleteTopic(env, user.id, topicId);
      return emptyResponse(204);
    }
    methodNotAllowed(["GET", "PUT", "DELETE"]);
  }

  if (url.pathname === "/api/books") {
    const user = await requireAuthenticatedUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ books: await listBooks(env, user.id) });
    }
    if (request.method === "POST") {
      const book = await compileBook(env, user.id, await readJsonBody(request));
      return jsonResponse({ book }, 201);
    }
    methodNotAllowed(["GET", "POST"]);
  }

  const bookId = BOOK_PATH.exec(url.pathname)?.[1];
  if (bookId) {
    const user = await requireAuthenticatedUser(request, env);
    if (request.method === "GET") {
      return jsonResponse({ book: await getBook(env, user.id, bookId) });
    }
    if (request.method === "DELETE") {
      await deleteBook(env, user.id, bookId);
      return emptyResponse(204);
    }
    methodNotAllowed(["GET", "DELETE"]);
  }

  if (url.pathname === "/api/letters") {
    if (request.method !== "GET") {
      methodNotAllowed(["GET"]);
    }
    const user = await requireAuthenticatedUser(request, env);
    return jsonResponse({ letters: await listAvailableLetters(env, user.id) });
  }

  const letterDay = LETTER_OPEN_PATH.exec(url.pathname)?.[1];
  if (letterDay) {
    if (request.method !== "PUT") {
      methodNotAllowed(["PUT"]);
    }
    const user = await requireAuthenticatedUser(request, env);
    return jsonResponse({ letter: await openLetter(env, user.id, Number(letterDay)) });
  }

  if (url.pathname === "/api/export") {
    if (request.method !== "GET") {
      methodNotAllowed(["GET"]);
    }
    const user = await requireAuthenticatedUser(request, env);
    const [entries, topicSummaries, books, journey] = await Promise.all([
      exportEntries(env, user.id),
      listTopics(env, user.id),
      exportBooks(env, user.id),
      getJourney(env, user.id),
    ]);
    const topics = await Promise.all(
      topicSummaries.map((topic) => getTopic(env, user.id, topic.id)),
    );
    const letters = journey?.intro_completed_at
      ? await listAvailableLetters(env, user.id)
      : [];
    const filename = `ithaca-journal-${new Date().toISOString().slice(0, 10)}.json`;
    return jsonResponse(
      {
        format: "ithaca-journal-export",
        version: 2,
        exported_at: new Date().toISOString(),
        user: { email: user.email },
        entries,
        topics,
        books,
        journey,
        letters,
      },
      200,
      { "Content-Disposition": `attachment; filename="${filename}"` },
    );
  }

  if (url.pathname === "/api/account") {
    if (request.method !== "DELETE") {
      methodNotAllowed(["DELETE"]);
    }
    const user = await requireAuthenticatedUser(request, env);
    const payload = requireRecord(await readJsonBody(request));
    if (requireString(payload, "confirmation") !== "DELETE") {
      throw new ApiError(422, "confirmation_required", "请输入 DELETE 以确认删除。");
    }
    await deleteUserData(env, user.id);
    return emptyResponse(204);
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
