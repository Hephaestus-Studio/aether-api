import { create } from "zustand";
import type { WorkspaceTreeNode, WorkspaceInfo } from "@/types/workspace";

interface GitStatus {
  branchName: string;
  modifiedFiles: { path: string; status: string }[];
}

interface WorkspaceState {
  workspacePath: string | null;
  workspaceInfo: WorkspaceInfo | null;
  treeData: WorkspaceTreeNode[] | null;
  gitStatus: GitStatus | null;
  isLoading: boolean;
  activeView: "explorer" | "environment" | "git" | "settings";

  setWorkspacePath: (path: string | null) => void;
  setTreeData: (tree: WorkspaceTreeNode[] | null) => void;
  setWorkspaceInfo: (info: WorkspaceInfo | null) => void;
  setGitStatus: (status: GitStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setActiveView: (view: "explorer" | "environment" | "git" | "settings") => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspacePath: null,
  workspaceInfo: null,
  treeData: null,
  gitStatus: null,
  isLoading: false,
  activeView: "explorer",
  setWorkspacePath: (path) => set({ workspacePath: path }),
  setTreeData: (tree) => set({ treeData: tree }),
  setWorkspaceInfo: (info) => set({ workspaceInfo: info }),
  setGitStatus: (status) => set({ gitStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setActiveView: (view) => set({ activeView: view }),
  reset: () =>
    set({
      workspacePath: null,
      workspaceInfo: null,
      treeData: null,
      gitStatus: null,
      activeView: "explorer",
    }),
}));
