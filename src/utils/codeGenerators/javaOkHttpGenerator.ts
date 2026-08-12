import type { GeneratorParams } from "./types";

export function generateJavaOkHttp({
  request,
  resolvedUrl,
  resolvedHeaders,
  options,
}: GeneratorParams): string {
  const opts = options.java_okhttp;
  const method = (request.method || "GET").toUpperCase();
  const targetUrl = resolvedUrl || request.url || "https://example.com";
  const indentChar = opts.indentType === "tab" ? "\t" : " ".repeat(opts.indentCount || 4);

  const lines: string[] = [];
  lines.push("import okhttp3.*;");
  lines.push("import java.io.IOException;");
  lines.push("");
  lines.push("public class ApiClient {");
  lines.push(`${indentChar}public static void main(String[] args) throws IOException {`);
  lines.push(
    `${indentChar}${indentChar}OkHttpClient client = new OkHttpClient().newBuilder().build();`,
  );

  let bodyStr = "";
  if (request.body && request.body.type !== "none") {
    if ("content" in request.body && typeof request.body.content === "string") {
      bodyStr = request.body.content;
    }
  }
  if (opts.trimBody) bodyStr = bodyStr.trim();

  if (bodyStr || method === "POST" || method === "PUT" || method === "PATCH") {
    const contentType =
      resolvedHeaders["Content-Type"] || resolvedHeaders["content-type"] || "text/plain";
    lines.push(
      `${indentChar}${indentChar}MediaType mediaType = MediaType.parse("${contentType}");`,
    );
    const escapedBody = bodyStr.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    lines.push(
      `${indentChar}${indentChar}RequestBody body = RequestBody.create(mediaType, "${escapedBody}");`,
    );
  }

  lines.push(`${indentChar}${indentChar}Request request = new Request.Builder()`);
  lines.push(`${indentChar}${indentChar}${indentChar}.url("${targetUrl}")`);
  lines.push(
    `${indentChar}${indentChar}${indentChar}.method("${method}", ${bodyStr ? "body" : "null"})`,
  );

  Object.entries(resolvedHeaders).forEach(([k, v]) => {
    lines.push(`${indentChar}${indentChar}${indentChar}.addHeader("${k}", "${v}")`);
  });

  lines.push(`${indentChar}${indentChar}${indentChar}.build();`);
  lines.push("");
  lines.push(`${indentChar}${indentChar}Response response = client.newCall(request).execute();`);
  lines.push(`${indentChar}${indentChar}System.out.println(response.body().string());`);
  lines.push(`${indentChar}}`);
  lines.push("}");

  return lines.join("\n");
}
