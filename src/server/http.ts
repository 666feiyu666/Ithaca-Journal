const MAX_JSON_BYTES = 160_000;

type ErrorHeaders = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: ErrorHeaders;

  constructor(
    status: number,
    code: string,
    message: string,
    headers: ErrorHeaders = {},
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

function apiHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set("Cache-Control", "no-store");
  result.set("Content-Type", "application/json; charset=utf-8");
  result.set("X-Content-Type-Options", "nosniff");
  return result;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: apiHeaders(headers),
  });
}

export function emptyResponse(status: number, headers?: HeadersInit): Response {
  const resultHeaders = new Headers(headers);
  resultHeaders.set("Cache-Control", "no-store");
  resultHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(null, { status, headers: resultHeaders });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
      error.headers,
    );
  }

  return jsonResponse(
    { error: { code: "internal_error", message: "服务暂时不可用，请稍后重试。" } },
    500,
  );
}

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") {
    return;
  }

  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new ApiError(403, "invalid_origin", "请求来源无效。");
  }
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError(403, "invalid_origin", "请求来源无效。");
  }
}

export function methodNotAllowed(allowedMethods: string[]): never {
  throw new ApiError(405, "method_not_allowed", "不支持这个请求方法。", {
    Allow: allowedMethods.join(", "),
  });
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(422, "invalid_payload", "请求内容格式无效。");
  }
  return value as Record<string, unknown>;
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new ApiError(422, "invalid_payload", `${key} 必须是文本。`);
  }
  return value;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "请求必须使用 JSON 格式。");
  }

  if (!request.body) {
    throw new ApiError(400, "empty_body", "请求内容不能为空。");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "payload_too_large", "手记内容超过当前版本的大小限制。");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError(400, "invalid_json", "JSON 内容无法解析。");
  }
}
