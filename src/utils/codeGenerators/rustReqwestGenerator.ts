import type { GeneratorParams } from "./types";

export function generateRustReqwest({ request, resolvedUrl, resolvedHeaders, options }: GeneratorParams): string {
  const opts = options.rust_reqwest;
  const method = (request.method || "GET").toLowerCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";
  const indentChar = opts.indentType === "tab" ? "\t" : " ".repeat(opts.indentCount || 4);

  const lines: string[] = [];
  lines.push("use reqwest::Client;");
  lines.push("use std::error::Error;");
  lines.push("");
  lines.push("#[tokio::main]");
  lines.push("async fn main() -> Result<(), Box<dyn Error>> {");

  // Client builder options
  lines.push(`${indentChar}let client = Client::builder()`);
  if (opts.timeout && opts.timeout > 0) {
    lines.push(`${indentChar}${indentChar}.timeout(std::time::Duration::from_millis(${opts.timeout}))`);
  }
  if (!opts.followRedirects) {
    lines.push(`${indentChar}${indentChar}.redirect(reqwest::redirect::Policy::none())`);
  }
  lines.push(`${indentChar}${indentChar}.build()?;`);
  lines.push("");

  // Request builder
  lines.push(`${indentChar}let res = client`);
  lines.push(`${indentChar}${indentChar}.${method}("${targetUrl}")`);

  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    lines.push(`${indentChar}${indentChar}.header("${k}", "${v}")`);
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
    const escapedBody = bodyStr.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    lines.push(`${indentChar}${indentChar}.body("${escapedBody}")`);
  }

  lines.push(`${indentChar}${indentChar}.send()`);
  lines.push(`${indentChar}${indentChar}.await?;`);
  lines.push("");
  lines.push(`${indentChar}let body = res.text().await?;`);
  lines.push(`${indentChar}println!("{}", body);`);
  lines.push(`${indentChar}Ok(())`);
  lines.push("}");

  return lines.join("\n");
}
