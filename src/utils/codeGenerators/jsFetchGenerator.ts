import type { GeneratorParams } from "./types";

export function generateJsFetch({
  request,
  resolvedUrl,
  resolvedHeaders,
  options,
}: GeneratorParams): string {
  const opts = options.js_fetch;
  const method = (request.method || "GET").toUpperCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";

  let bodyStr = "";
  if (request.body && request.body.type !== "none") {
    if ("content" in request.body && typeof request.body.content === "string") {
      bodyStr = request.body.content;
    }
  }
  if (opts.trimBody) bodyStr = bodyStr.trim();

  const lines: string[] = [];
  lines.push("const myHeaders = new Headers();");
  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    lines.push(`myHeaders.append("${k}", "${v}");`);
  });

  lines.push("");
  lines.push("const requestOptions = {");
  lines.push(`  method: "${method}",`);
  lines.push("  headers: myHeaders,");
  if (bodyStr) {
    const escapedBody = bodyStr.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    lines.push(`  body: "${escapedBody}",`);
  }
  if (opts.includeCredentials) {
    lines.push('  credentials: "include",');
  }
  lines.push('  redirect: "follow"');
  lines.push("};");

  lines.push("");
  if (opts.asyncAwait) {
    lines.push("async function executeRequest() {");
    lines.push(`  try {`);
    lines.push(`    const response = await fetch("${targetUrl}", requestOptions);`);
    lines.push(`    const result = await response.text();`);
    lines.push(`    console.log(result);`);
    lines.push(`  } catch (error) {`);
    lines.push(`    console.error(error);`);
    lines.push(`  }`);
    lines.push("}");
    lines.push("executeRequest();");
  } else {
    lines.push(`fetch("${targetUrl}", requestOptions)`);
    lines.push("  .then((response) => response.text())");
    lines.push("  .then((result) => console.log(result))");
    lines.push("  .catch((error) => console.error(error));");
  }

  return lines.join("\n");
}
