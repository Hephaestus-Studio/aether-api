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

export type ProtocolType = "http" | "websocket" | "socketio" | "graphql" | "grpc" | "mqtt";

export interface WebSocketSavedMessage {
  id: string;
  name: string;
  format: "json" | "text" | "binary";
  payload: string;
}

export interface WebSocketSettings {
  heartbeatIntervalSecs?: number;
  autoPong?: boolean;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface WebSocketMessageLog {
  id: string;
  tabId: string;
  direction: "in" | "out";
  format: "json" | "text" | "binary" | "ping" | "pong" | "status";
  payload: string;
  size: number;
  timestamp: number;
}

export type WebSocketStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WsMetrics {
  sentCount: number;
  receivedCount: number;
  sentBytes: number;
  receivedBytes: number;
  connectedSince?: number;
}

export interface HttpRequestDetails {
  id: string;
  name: string;
  protocol?: ProtocolType | string;
  method: string;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  settings: RequestSettings;
  savedMessages?: WebSocketSavedMessage[];
  wsSettings?: WebSocketSettings;
  seq?: string;
}

export interface TabItem {
  id: string;
  name: string;
  method?: string;
  protocol?: string;
  isDirty: boolean;
  nodeType?: "request" | "folder" | "collection";
}
