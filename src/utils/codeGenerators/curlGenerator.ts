import type { GeneratorParams } from "./types";

export function generateCurl({
  request,
  resolvedUrl,
  resolvedHeaders,
  options,
}: GeneratorParams): string {
  const opts = options.curl;
  const method = (request.method || "GET").toUpperCase();
  const q = opts.quoteType === "single" ? "'" : '"';
  const slash = opts.continuationChar;

  const escapeQuote = (str: string): string => {
    if (opts.quoteType === "single") {
      return str.replace(/'/g, "'\\''");
    }
    return str.replace(/"/g, '\\"').replace(/\$/g, "\\$");
  };

  const wrapQuote = (str: string): string => {
    return `${q}${escapeQuote(str)}${q}`;
  };

  const parts: string[] = ["curl"];

  // Method flag
  if (opts.longForm) {
    parts.push(`--request ${method}`);
  } else if (method !== "GET") {
    parts.push(`-X ${method}`);
  }

  // URL
  const targetUrl = resolvedUrl || request.url || "https://example.com";
  parts.push(wrapQuote(targetUrl));

  // Redirects
  if (opts.followRedirects) {
    parts.push(opts.longForm ? "--location" : "-L");
  }

  if (opts.followOriginalMethod) {
    parts.push(opts.longForm ? "--post301 --post302" : "-P");
  }

  // Timeout
  if (opts.timeout && opts.timeout > 0) {
    parts.push(opts.longForm ? `--max-time ${opts.timeout}` : `-m ${opts.timeout}`);
  }

  // Silent
  if (opts.silent) {
    parts.push(opts.longForm ? "--silent" : "-s");
  }

  // Headers
  const headerFlag = opts.longForm ? "--header" : "-H";
  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    parts.push(`${headerFlag} ${wrapQuote(`${k}: ${v}`)}`);
  });

  // Body payload
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

  if (bodyStr || method === "POST" || method === "PUT" || method === "PATCH") {
    const dataFlag = opts.longForm ? "--data-raw" : "--data";
    parts.push(`${dataFlag} ${wrapQuote(bodyStr)}`);
  }

  if (opts.multiline) {
    return parts.join(` ${slash}\n  `);
  }

  return parts.join(" ");
}
