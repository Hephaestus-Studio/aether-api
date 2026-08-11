import type { HttpRequestDetails } from "@/types/request";

export type SnippetLanguageId =
  | "curl"
  | "http"
  | "rust_reqwest"
  | "wget"
  | "httpie"
  | "java_okhttp"
  | "python_requests"
  | "js_fetch"
  | "go_nethttp";

export interface SnippetLanguageMeta {
  id: SnippetLanguageId;
  name: string;
  category: "Shell" | "HTTP" | "Code";
  syntaxHighlight: string; // e.g. 'bash', 'http', 'rust', 'java', 'python', 'javascript', 'go'
}

export interface CurlOptions {
  multiline: boolean;
  longForm: boolean;
  continuationChar: "\\" | "^" | "`";
  quoteType: "single" | "double";
  timeout: number;
  followRedirects: boolean;
  followOriginalMethod: boolean;
  trimBody: boolean;
  silent: boolean;
}

export interface HttpOptions {
  trimBody: boolean;
  httpVersion: "HTTP/1.1" | "HTTP/2";
}

export interface RustReqwestOptions {
  indentCount: number;
  indentType: "space" | "tab";
  timeout: number;
  followRedirects: boolean;
  trimBody: boolean;
}

export interface WgetOptions {
  multiline: boolean;
  timeout: number;
  trimBody: boolean;
}

export interface HttpieOptions {
  multiline: boolean;
  printFlags: "hb" | "all";
  trimBody: boolean;
}

export interface JavaOkHttpOptions {
  indentCount: number;
  indentType: "space" | "tab";
  asyncCall: boolean;
  trimBody: boolean;
}

export interface PythonRequestsOptions {
  timeout: number;
  verifySsl: boolean;
  trimBody: boolean;
}

export interface JsFetchOptions {
  asyncAwait: boolean;
  includeCredentials: boolean;
  trimBody: boolean;
}

export interface GoNetHttpOptions {
  indentCount: number;
  indentType: "space" | "tab";
  timeout: number;
  trimBody: boolean;
}

export interface SnippetOptions {
  curl: CurlOptions;
  http: HttpOptions;
  rust_reqwest: RustReqwestOptions;
  wget: WgetOptions;
  httpie: HttpieOptions;
  java_okhttp: JavaOkHttpOptions;
  python_requests: PythonRequestsOptions;
  js_fetch: JsFetchOptions;
  go_nethttp: GoNetHttpOptions;
}

export interface GeneratorParams {
  request: HttpRequestDetails;
  resolvedUrl: string;
  resolvedHeaders: Record<string, string>;
  options: SnippetOptions;
}
