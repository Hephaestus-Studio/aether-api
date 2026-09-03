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
  activeView: "explorer" | "environment" | "git";
  expandedNodeIds: Record<string, boolean>;
  activeDraggedId: string | null;

  setWorkspacePath: (path: string | null) => void;
  setTreeData: (tree: WorkspaceTreeNode[] | null) => void;
  setWorkspaceInfo: (info: WorkspaceInfo | null) => void;
  setGitStatus: (status: GitStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setActiveView: (view: "explorer" | "environment" | "git") => void;
  setActiveDraggedId: (id: string | null) => void;
  toggleNodeExpanded: (nodeId: string) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
  expandAllCollections: () => void;
  collapseAllCollections: () => void;
  reset: () => void;
}

function getAllFolderIds(nodes: WorkspaceTreeNode[] | null): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!nodes) return result;

  function traverse(items: WorkspaceTreeNode[]) {
    for (const item of items) {
      if (item.nodeType === "collection" || item.nodeType === "folder") {
        result[item.id] = true;
      }
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspacePath: null,
  workspaceInfo: null,
  treeData: null,
  gitStatus: null,
  isLoading: false,
  activeView: "explorer",
  expandedNodeIds: {},
  activeDraggedId: null,
  setWorkspacePath: (path) => set({ workspacePath: path }),
  setTreeData: (tree) => set({ treeData: tree }),
  setWorkspaceInfo: (info) => set({ workspaceInfo: info }),
  setGitStatus: (status) => set({ gitStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setActiveView: (view) => set({ activeView: view }),
  setActiveDraggedId: (id) => set({ activeDraggedId: id }),
  toggleNodeExpanded: (nodeId) =>
    set((state) => ({
      expandedNodeIds: {
        ...state.expandedNodeIds,
        [nodeId]: !state.expandedNodeIds[nodeId],
      },
    })),
  setNodeExpanded: (nodeId, expanded) =>
    set((state) => ({
      expandedNodeIds: {
        ...state.expandedNodeIds,
        [nodeId]: expanded,
      },
    })),
  expandAllCollections: () =>
    set((state) => ({
      expandedNodeIds: getAllFolderIds(state.treeData),
    })),
  collapseAllCollections: () => set({ expandedNodeIds: {} }),
  reset: () =>
    set({
      workspacePath: null,
      workspaceInfo: null,
      treeData: null,
      gitStatus: null,
      activeView: "explorer",
      expandedNodeIds: {},
      activeDraggedId: null,
    }),
}));
