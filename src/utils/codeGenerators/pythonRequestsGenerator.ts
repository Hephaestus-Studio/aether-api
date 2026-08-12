import type { GeneratorParams } from "./types";

export function generatePythonRequests({
  request,
  resolvedUrl,
  resolvedHeaders,
  options,
}: GeneratorParams): string {
  const opts = options.python_requests;
  const method = (request.method || "GET").toLowerCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";

  const lines: string[] = [];
  lines.push("import requests");
  lines.push("");
  lines.push(`url = "${targetUrl}"`);

  if (Object.keys(resolvedHeaders).length > 0) {
    lines.push("headers = {");
    Object.entries(resolvedHeaders).forEach(([k, v]) => {
      lines.push(`    "${k}": "${v}",`);
    });
    lines.push("}");
  } else {
    lines.push("headers = {}");
  }

  let bodyStr = "";
  if (request.body && request.body.type !== "none") {
    if ("content" in request.body && typeof request.body.content === "string") {
      bodyStr = request.body.content;
    }
  }
  if (opts.trimBody) bodyStr = bodyStr.trim();

  if (bodyStr) {
    const escapedBody = bodyStr.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    lines.push(`payload = "${escapedBody}"`);
  } else {
    lines.push("payload = {}");
  }

  const kwargs: string[] = ["url=url", "headers=headers"];
  if (bodyStr) kwargs.push("data=payload");
  if (opts.timeout && opts.timeout > 0) kwargs.push(`timeout=${opts.timeout}`);
  if (!opts.verifySsl) kwargs.push("verify=False");

  lines.push("");
  lines.push(`response = requests.request("${method.toUpperCase()}", ${kwargs.join(", ")})`);
  lines.push("");
  lines.push("print(response.text)");

  return lines.join("\n");
}
