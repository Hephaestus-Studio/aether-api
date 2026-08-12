import type { GeneratorParams } from "./types";

export function generateWget({
  request,
  resolvedUrl,
  resolvedHeaders,
  options,
}: GeneratorParams): string {
  const opts = options.wget;
  const method = (request.method || "GET").toUpperCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";
  const slash = "\\";

  const parts: string[] = ["wget"];
  parts.push(`--method=${method}`);

  if (opts.timeout && opts.timeout > 0) {
    parts.push(`--timeout=${opts.timeout}`);
  }

  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    parts.push(`--header='${k}: ${v}'`);
  });

  let bodyStr = "";
  if (request.body && request.body.type !== "none") {
    if ("content" in request.body && typeof request.body.content === "string") {
      bodyStr = request.body.content;
    }
  }

  if (opts.trimBody) {
    bodyStr = bodyStr.trim();
  }

  if (bodyStr) {
    parts.push(`--body-data='${bodyStr.replace(/'/g, "'\\''")}'`);
  }

  parts.push(`-O - '${targetUrl}'`);

  if (opts.multiline) {
    return parts.join(` ${slash}\n  `);
  }
  return parts.join(" ");
}
