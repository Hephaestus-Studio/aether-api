import type { GeneratorParams } from "./types";

export function generateGoNetHttp({
  request,
  resolvedUrl,
  resolvedHeaders,
  options,
}: GeneratorParams): string {
  const opts = options.go_nethttp;
  const method = (request.method || "GET").toUpperCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";
  const indentChar = opts.indentType === "tab" ? "\t" : " ".repeat(opts.indentCount || 4);

  let bodyStr = "";
  if (request.body && request.body.type !== "none") {
    if ("content" in request.body && typeof request.body.content === "string") {
      bodyStr = request.body.content;
    }
  }
  if (opts.trimBody) bodyStr = bodyStr.trim();

  const lines: string[] = [];
  lines.push("package main");
  lines.push("");
  lines.push("import (");
  lines.push(`${indentChar}"fmt"`);
  lines.push(`${indentChar}"io"`);
  lines.push(`${indentChar}"net/http"`);
  if (bodyStr) lines.push(`${indentChar}"strings"`);
  lines.push(")");
  lines.push("");
  lines.push("func main() {");
  lines.push(`${indentChar}url := "${targetUrl}"`);

  if (bodyStr) {
    const escapedBody = bodyStr.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    lines.push(`${indentChar}payload := strings.NewReader("${escapedBody}")`);
    lines.push(`${indentChar}req, err := http.NewRequest("${method}", url, payload)`);
  } else {
    lines.push(`${indentChar}req, err := http.NewRequest("${method}", url, nil)`);
  }

  lines.push(`${indentChar}if err != nil {`);
  lines.push(`${indentChar}${indentChar}fmt.Println(err)`);
  lines.push(`${indentChar}${indentChar}return`);
  lines.push(`${indentChar}}`);

  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    lines.push(`${indentChar}req.Header.Add("${k}", "${v}")`);
  });

  lines.push("");
  lines.push(`${indentChar}client := &http.Client{}`);
  lines.push(`${indentChar}res, err := client.Do(req)`);
  lines.push(`${indentChar}if err != nil {`);
  lines.push(`${indentChar}${indentChar}fmt.Println(err)`);
  lines.push(`${indentChar}${indentChar}return`);
  lines.push(`${indentChar}}`);
  lines.push(`${indentChar}defer res.Body.Close()`);
  lines.push("");
  lines.push(`${indentChar}body, err := io.ReadAll(res.Body)`);
  lines.push(`${indentChar}if err != nil {`);
  lines.push(`${indentChar}${indentChar}fmt.Println(err)`);
  lines.push(`${indentChar}${indentChar}return`);
  lines.push(`${indentChar}}`);
  lines.push(`${indentChar}fmt.Println(string(body))`);
  lines.push("}");

  return lines.join("\n");
}
