import type { GeneratorParams } from "./types";

export function generateHttp({ request, resolvedUrl, resolvedHeaders, options }: GeneratorParams): string {
  const opts = options.http;
  const method = (request.method || "GET").toUpperCase();
  const rawUrl = resolvedUrl || request.url || "https://example.com";

  let host = "";
  let path = "/";
  try {
    const parsed = new URL(rawUrl);
    host = parsed.host;
    path = parsed.pathname + parsed.search;
  } catch {
    const parts = rawUrl.replace(/^https?:\/\//, "").split("/");
    host = parts[0] || "example.com";
    path = "/" + parts.slice(1).join("/");
  }

  const lines: string[] = [];
  lines.push(`${method} ${path} ${opts.httpVersion || "HTTP/1.1"}`);
  lines.push(`Host: ${host}`);

  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    lines.push(`${k}: ${v}`);
  });

  let bodyStr = "";
  if (request.body && request.body.type !== "none") {
    if ("content" in request.body && typeof request.body.content === "string") {
      bodyStr = request.body.content;
    } else if (request.body.type === "formUrlencoded" && Array.isArray(request.body.content)) {
      bodyStr = request.body.content
        .filter((item) => item.enabled && item.key)
        .map((item) => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`)
        .join("&");
    }
  }

  if (opts.trimBody) {
    bodyStr = bodyStr.trim();
  }

  if (bodyStr) {
    lines.push(""); // Empty line before body
    lines.push(bodyStr);
  }

  return lines.join("\n");
}
