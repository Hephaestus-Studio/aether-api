import type { KeyValuePair, AuthConfig, RequestBody } from "@/types/request";

export interface ParsedCurl {
  method: string;
  url: string;
  headers: KeyValuePair[];
  auth?: AuthConfig;
  body?: RequestBody;
}

export function isCurlCommand(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return (
    trimmed.startsWith("curl ") ||
    trimmed.startsWith("curl\n") ||
    trimmed.startsWith("curl\r\n") ||
    trimmed.startsWith("curl\t")
  );
}

/**
 * Robust argument tokenizer that respects quotes (single/double) and escaped characters.
 */
function tokenizeCommand(commandStr: string): string[] {
  // Normalize line continuation characters (\, ^, `)
  const cleaned = commandStr
    .replace(/[\\][\r\n]+/g, " ")
    .replace(/[\^][\r\n]+/g, " ")
    .replace(/[`][\r\n]+/g, " ");

  const tokens: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export function parseCurl(curlStr: string): ParsedCurl | null {
  if (!isCurlCommand(curlStr)) return null;

  const tokens = tokenizeCommand(curlStr.trim());
  if (tokens.length === 0 || tokens[0] !== "curl") return null;

  let method = "GET";
  let url = "";
  const rawHeaders: Record<string, string> = {};
  let bodyContent = "";
  let basicAuthUserPass = "";

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // Method flag: -X or --request
    if (token === "-X" || token === "--request") {
      if (i + 1 < tokens.length) {
        method = tokens[i + 1].toUpperCase();
        i++;
      }
      continue;
    }

    // Header flag: -H or --header
    if (token === "-H" || token === "--header") {
      if (i + 1 < tokens.length) {
        const headerStr = tokens[i + 1];
        i++;
        const colonIdx = headerStr.indexOf(":");
        if (colonIdx > 0) {
          const key = headerStr.substring(0, colonIdx).trim();
          const val = headerStr.substring(colonIdx + 1).trim();
          rawHeaders[key] = val;
        }
      }
      continue;
    }

    // Body flag: -d, --data, --data-raw, --data-binary, --data-urlencode
    if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary" ||
      token === "--data-urlencode"
    ) {
      if (i + 1 < tokens.length) {
        bodyContent = tokens[i + 1];
        i++;
        if (method === "GET") {
          method = "POST";
        }
      }
      continue;
    }

    // Basic User flag: -u or --user
    if (token === "-u" || token === "--user") {
      if (i + 1 < tokens.length) {
        basicAuthUserPass = tokens[i + 1];
        i++;
      }
      continue;
    }

    // User agent flag: -A or --user-agent
    if (token === "-A" || token === "--user-agent") {
      if (i + 1 < tokens.length) {
        rawHeaders["User-Agent"] = tokens[i + 1];
        i++;
      }
      continue;
    }

    // URL flag: --url
    if (token === "--url") {
      if (i + 1 < tokens.length) {
        url = tokens[i + 1];
        i++;
      }
      continue;
    }

    // Skip flags with values that we ignore (e.g. -m, --max-time, -L, --location, -s, --silent)
    if (token === "-m" || token === "--max-time" || token === "--connect-timeout") {
      i++;
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }

    // Positional argument -> URL (if not set yet)
    if (
      !url &&
      (token.startsWith("http://") || token.startsWith("https://") || token.includes("."))
    ) {
      url = token;
    }
  }

  // Format headers
  const headers: KeyValuePair[] = [];
  let auth: AuthConfig | undefined = undefined;

  Object.entries(rawHeaders).forEach(([k, v]) => {
    // Check if Header is Authorization: Bearer <token>
    if (k.toLowerCase() === "authorization") {
      if (v.toLowerCase().startsWith("bearer ")) {
        const tokenVal = v.substring(7).trim();
        auth = {
          type: "bearer",
          bearer: { token: tokenVal, prefix: "Bearer" },
        };
        return;
      } else if (v.toLowerCase().startsWith("basic ")) {
        try {
          const decoded = atob(v.substring(6).trim());
          const [u, p] = decoded.split(":");
          auth = {
            type: "basic",
            basic: { username: u || "", password: p || "" },
          };
          return;
        } catch {
          // Keep as raw header if decode fails
        }
      }
    }

    headers.push({
      key: k,
      value: v,
      enabled: true,
    });
  });

  if (basicAuthUserPass && !auth) {
    const [u, p] = basicAuthUserPass.split(":");
    auth = {
      type: "basic",
      basic: { username: u || "", password: p || "" },
    };
  }

  // Determine body content type
  let body: RequestBody | undefined = undefined;
  if (bodyContent) {
    const contentTypeHeader = Object.entries(rawHeaders).find(
      ([k]) => k.toLowerCase() === "content-type",
    )?.[1];

    if (contentTypeHeader && contentTypeHeader.includes("application/x-www-form-urlencoded")) {
      const items: KeyValuePair[] = bodyContent.split("&").map((pair) => {
        const [k, v] = pair.split("=");
        return {
          key: decodeURIComponent(k || ""),
          value: decodeURIComponent(v || ""),
          enabled: true,
        };
      });
      body = {
        type: "formUrlencoded",
        content: items,
      };
    } else {
      let isJson = false;
      try {
        JSON.parse(bodyContent);
        isJson = true;
      } catch {
        isJson = false;
      }

      body = {
        type: isJson ? "json" : "text",
        content: bodyContent,
      };
    }
  }

  return {
    method: method || "GET",
    url: url || "",
    headers,
    auth,
    body,
  };
}
