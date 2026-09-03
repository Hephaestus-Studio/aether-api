export interface GitFileInfo {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "conflicted" | "renamed";
  code: string;
}

export interface GitStatusInfo {
  branchName: string;
  upstreamBranch?: string | null;
  aheadCount: number;
  behindCount: number;
  stagedFiles: GitFileInfo[];
  unstagedFiles: GitFileInfo[];
  untrackedFiles: GitFileInfo[];
  conflictedFiles: GitFileInfo[];
  isClean: boolean;
  isMerging: boolean;
  isRebasing: boolean;
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface ConflictFileInfo {
  path: string;
  rawContent: string;
  oursContent: string;
  theirsContent: string;
  baseContent?: string | null;
  isRequestYaml: boolean;
}

export interface ParsedRequestConflict {
  name: { ours?: string; theirs?: string; isDiff: boolean };
  method: { ours?: string; theirs?: string; isDiff: boolean };
  url: { ours?: string; theirs?: string; isDiff: boolean };
  description: { ours?: string; theirs?: string; isDiff: boolean };
  headers: { ours?: any[]; theirs?: any[]; isDiff: boolean };
  params: { ours?: any[]; theirs?: any[]; isDiff: boolean };
  body: { ours?: any; theirs?: any; isDiff: boolean };
  auth: { ours?: any; theirs?: any; isDiff: boolean };
  scripts: { ours?: any; theirs?: any; isDiff: boolean };
}
