export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type AuthConfig =
  | { type: "none" }
  | { type: "inherit" }
  | { type: "bearer"; bearer: { token: string; prefix?: string } }
  | { type: "basic"; basic: { username: string; password: string } }
  | { type: "apikey"; apikey: { key: string; value: string; addTo: "header" | "query" } };

export type RequestBody =
  | { type: "none"; content?: string }
  | { type: "json"; content: string }
  | { type: "xml"; content: string }
  | { type: "text"; content: string }
  | { type: "yaml"; content: string }
  | { type: "formUrlencoded"; content: KeyValuePair[] }
  | { type: "multipartForm"; content: MultipartField[] }
  | { type: "binary"; filePath: string };

export interface MultipartField {
  key: string;
  value: string;
  fieldType: "text" | "file";
  enabled: boolean;
}

export interface RequestSettings {
  timeoutMs: number;
  followRedirects: boolean;
  maxRedirects: number;
  verifySsl: boolean;
}

export interface HttpRequestDetails {
  id: string;
  name: string;
  method: string;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  settings: RequestSettings;
  seq?: string;
}

export interface TabItem {
  id: string;
  name: string;
  method: string;
  isDirty: boolean;
}
