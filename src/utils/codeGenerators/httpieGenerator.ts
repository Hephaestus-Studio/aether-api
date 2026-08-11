import type { GeneratorParams } from "./types";

export function generateHttpie({ request, resolvedUrl, resolvedHeaders, options }: GeneratorParams): string {
  const opts = options.httpie;
  const method = (request.method || "GET").toUpperCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";
  const slash = "\\";

  const parts: string[] = ["http"];
  if (opts.printFlags === "hb") {
    parts.push("--print=hb");
  }

  parts.push(method);
  parts.push(`'${targetUrl}'`);

  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    parts.push(`'${k}:${v}'`);
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
    return `echo '${bodyStr.replace(/'/g, "'\\''")}' | ${parts.join(" ")}`;
  }

  if (opts.multiline) {
    return parts.join(` ${slash}\n  `);
  }
  return parts.join(" ");
}
