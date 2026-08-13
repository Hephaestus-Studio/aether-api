export interface WorkspaceSettings {
  defaultEnvironment: string | null;
  theme: "dark" | "light";
  sidebarWidth: number;
  splitRatio: number;
}

export interface WorkspaceInfo {
  path: string;
  name: string;
  createdAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceTreeNode {
  id: string;
  name: string;
  path: string;
  nodeType: "collection" | "folder" | "request" | "environment" | "config";
  seq?: string;
  method?: string;
  children: WorkspaceTreeNode[];
}

export interface WorkspaceTree {
  rootPath: string;
  name: string;
  children: WorkspaceTreeNode[];
}

export interface FsChangeEventPayload {
  eventPath: string;
  changeType: "create" | "modify" | "delete" | "rename";
  isDirectory: boolean;
  oldPath?: string;
}

export interface CollectionDetails {
  schema_version?: string;
  type?: string;
  name: string;
  description?: string;
  seq?: string;
  created_at?: string;
  updated_at?: string;
  auth?: import("./request").AuthConfig;
  settings?: import("./request").RequestSettings;
  headers?: import("./request").KeyValuePair[];
}

export interface FolderDetails {
  schema_version?: string;
  type?: string;
  name: string;
  description?: string;
  seq?: string;
  created_at?: string;
  updated_at?: string;
  auth?: import("./request").AuthConfig;
  headers?: import("./request").KeyValuePair[];
}
