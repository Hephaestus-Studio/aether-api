import type {
  SnippetLanguageId,
  SnippetLanguageMeta,
  SnippetOptions,
  GeneratorParams,
} from "./types";
import { generateCurl } from "./curlGenerator";
import { generateHttp } from "./httpGenerator";
import { generateRustReqwest } from "./rustReqwestGenerator";
import { generateWget } from "./wgetGenerator";
import { generateHttpie } from "./httpieGenerator";
import { generateJavaOkHttp } from "./javaOkHttpGenerator";
import { generatePythonRequests } from "./pythonRequestsGenerator";
import { generateJsFetch } from "./jsFetchGenerator";
import { generateGoNetHttp } from "./goNetHttpGenerator";

export * from "./types";

export const SUPPORTED_LANGUAGES: SnippetLanguageMeta[] = [
  { id: "curl", name: "cURL", category: "Shell", syntaxHighlight: "bash" },
  { id: "http", name: "HTTP", category: "HTTP", syntaxHighlight: "http" },
  { id: "rust_reqwest", name: "Rust - reqwest", category: "Code", syntaxHighlight: "rust" },
  { id: "wget", name: "Shell - Wget", category: "Shell", syntaxHighlight: "bash" },
  { id: "httpie", name: "Shell - HTTPie", category: "Shell", syntaxHighlight: "bash" },
  { id: "java_okhttp", name: "Java - OkHttp", category: "Code", syntaxHighlight: "java" },
  { id: "python_requests", name: "Python - requests", category: "Code", syntaxHighlight: "python" },
  { id: "js_fetch", name: "JavaScript - fetch", category: "Code", syntaxHighlight: "javascript" },
  { id: "go_nethttp", name: "Go - net/http", category: "Code", syntaxHighlight: "go" },
];

export const DEFAULT_SNIPPET_OPTIONS: SnippetOptions = {
  curl: {
    multiline: true,
    longForm: true,
    continuationChar: "\\",
    quoteType: "single",
    timeout: 0,
    followRedirects: true,
    followOriginalMethod: false,
    trimBody: false,
    silent: false,
  },
  http: {
    trimBody: false,
    httpVersion: "HTTP/1.1",
  },
  rust_reqwest: {
    indentCount: 4,
    indentType: "space",
    timeout: 0,
    followRedirects: true,
    trimBody: false,
  },
  wget: {
    multiline: true,
    timeout: 0,
    trimBody: false,
  },
  httpie: {
    multiline: true,
    printFlags: "all",
    trimBody: false,
  },
  java_okhttp: {
    indentCount: 4,
    indentType: "space",
    asyncCall: false,
    trimBody: false,
  },
  python_requests: {
    timeout: 0,
    verifySsl: true,
    trimBody: false,
  },
  js_fetch: {
    asyncAwait: true,
    includeCredentials: false,
    trimBody: false,
  },
  go_nethttp: {
    indentCount: 4,
    indentType: "space",
    timeout: 0,
    trimBody: false,
  },
};

export function generateSnippet(languageId: SnippetLanguageId, params: GeneratorParams): string {
  switch (languageId) {
    case "curl":
      return generateCurl(params);
    case "http":
      return generateHttp(params);
    case "rust_reqwest":
      return generateRustReqwest(params);
    case "wget":
      return generateWget(params);
    case "httpie":
      return generateHttpie(params);
    case "java_okhttp":
      return generateJavaOkHttp(params);
    case "python_requests":
      return generatePythonRequests(params);
    case "js_fetch":
      return generateJsFetch(params);
    case "go_nethttp":
      return generateGoNetHttp(params);
    default:
      return generateCurl(params);
  }
}
