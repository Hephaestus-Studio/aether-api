import React from "react";
import type { SnippetLanguageId } from "./types";

interface Token {
  text: string;
  type:
    | "keyword"
    | "flag"
    | "method"
    | "string"
    | "number"
    | "headerKey"
    | "comment"
    | "continuation"
    | "plain";
}

const KEYWORDS = new Set([
  "curl",
  "wget",
  "http",
  "echo",
  "use",
  "fn",
  "async",
  "let",
  "mut",
  "pub",
  "struct",
  "enum",
  "impl",
  "mod",
  "match",
  "Result",
  "Ok",
  "Err",
  "import",
  "from",
  "def",
  "return",
  "class",
  "public",
  "static",
  "void",
  "new",
  "throws",
  "package",
  "func",
  "type",
  "var",
  "nil",
  "defer",
  "const",
  "function",
  "await",
  "try",
  "catch",
  "if",
  "else",
  "true",
  "false",
  "null",
  "undefined",
  "requests",
  "Headers",
  "fetch",
  "Response",
  "Request",
  "OkHttpClient",
  "MediaType",
  "RequestBody",
]);

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function highlightSnippet(code: string, languageId: SnippetLanguageId): React.ReactNode[] {
  const lines = code.split("\n");

  return lines.map((line, lineIdx) => {
    const lineElements = highlightLine(line, languageId);
    return (
      <span key={lineIdx}>
        {lineElements}
        {lineIdx < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function highlightLine(line: string, languageId: SnippetLanguageId): React.ReactNode[] {
  if (!line) return [""];

  // Handle comments
  if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
    return [
      <span key="comment" style={{ color: "#71717a", fontStyle: "italic" }}>
        {line}
      </span>,
    ];
  }

  // Handle Raw HTTP Request lines
  if (languageId === "http") {
    const httpReqMatch = line.match(
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)\s+(HTTP\/\d\.\d)$/i,
    );
    if (httpReqMatch) {
      return [
        <span key="m" style={{ color: "#38bdf8", fontWeight: "bold" }}>
          {httpReqMatch[1]}{" "}
        </span>,
        <span key="p" style={{ color: "#facc15" }}>
          {httpReqMatch[2]}{" "}
        </span>,
        <span key="v" style={{ color: "#c084fc" }}>
          {httpReqMatch[3]}
        </span>,
      ];
    }

    const headerMatch = line.match(/^([\w-]+):\s*(.*)$/);
    if (headerMatch) {
      return [
        <span key="hk" style={{ color: "#38bdf8", fontWeight: 600 }}>
          {headerMatch[1]}:{" "}
        </span>,
        <span key="hv" style={{ color: "#4ade80" }}>
          {headerMatch[2]}
        </span>,
      ];
    }
  }

  // General Tokenizer
  const tokens: Token[] = [];
  let index = 0;

  while (index < line.length) {
    const char = line[index];

    // Strings (Single or Double quotes)
    if (char === "'" || char === '"') {
      const quote = char;
      let str = quote;
      index++;
      while (index < line.length) {
        const nextChar = line[index];
        if (nextChar === "\\") {
          str += line.slice(index, index + 2);
          index += 2;
        } else if (nextChar === quote) {
          str += quote;
          index++;
          break;
        } else {
          str += nextChar;
          index++;
        }
      }
      tokens.push({ text: str, type: "string" });
      continue;
    }

    // Flags (--header, -H, --request, etc.)
    if (char === "-" && (index === 0 || /\s/.test(line[index - 1]))) {
      let flag = "";
      while (index < line.length && !/\s/.test(line[index]) && line[index] !== "=") {
        flag += line[index];
        index++;
      }
      tokens.push({ text: flag, type: "flag" });
      continue;
    }

    // Identifiers & Words
    if (/[a-zA-Z_]/.test(char)) {
      let word = "";
      while (index < line.length && /[a-zA-Z0-9_\-\:]/.test(line[index])) {
        word += line[index];
        index++;
      }

      if (HTTP_METHODS.has(word)) {
        tokens.push({ text: word, type: "method" });
      } else if (KEYWORDS.has(word)) {
        tokens.push({ text: word, type: "keyword" });
      } else {
        tokens.push({ text: word, type: "plain" });
      }
      continue;
    }

    // Numbers
    if (/[0-9]/.test(char) && (index === 0 || /[\s\(\,\[]/.test(line[index - 1]))) {
      let num = "";
      while (index < line.length && /[0-9\.]/.test(line[index])) {
        num += line[index];
        index++;
      }
      tokens.push({ text: num, type: "number" });
      continue;
    }

    // Line Continuation (\ or ^ or ` at end of line)
    if ((char === "\\" || char === "^" || char === "`") && index === line.length - 1) {
      tokens.push({ text: char, type: "continuation" });
      index++;
      continue;
    }

    // Plain Characters
    tokens.push({ text: char, type: "plain" });
    index++;
  }

  return tokens.map((token, i) => {
    switch (token.type) {
      case "keyword":
        return (
          <span key={i} style={{ color: "#c084fc", fontWeight: 600 }}>
            {token.text}
          </span>
        );
      case "flag":
        return (
          <span key={i} style={{ color: "#facc15" }}>
            {token.text}
          </span>
        );
      case "method":
        return (
          <span key={i} style={{ color: "#38bdf8", fontWeight: "bold" }}>
            {token.text}
          </span>
        );
      case "string":
        return (
          <span key={i} style={{ color: "#4ade80" }}>
            {token.text}
          </span>
        );
      case "number":
        return (
          <span key={i} style={{ color: "#ff9f1c" }}>
            {token.text}
          </span>
        );
      case "continuation":
        return (
          <span key={i} style={{ color: "#f472b6", fontWeight: "bold" }}>
            {token.text}
          </span>
        );
      default:
        return <span key={i}>{token.text}</span>;
    }
  });
}
