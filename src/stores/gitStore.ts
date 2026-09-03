import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { GitStatusInfo, GitBranchInfo, ConflictFileInfo } from "@/types/git";

interface GitState {
  status: GitStatusInfo | null;
  branches: GitBranchInfo[];
  isLoading: boolean;
  isSyncing: boolean;
  isCommitting: boolean;
  error: string | null;
  activeConflictFile: string | null;
  activeConflictData: ConflictFileInfo | null;
  isConflictModalOpen: boolean;
  isBranchModalOpen: boolean;

  // Actions
  refreshStatus: () => Promise<GitStatusInfo | null>;
  stagePaths: (paths: string[]) => Promise<void>;
  unstagePaths: (paths: string[]) => Promise<void>;
  discardChanges: (paths: string[]) => Promise<void>;
  commit: (message: string) => Promise<void>;
  smartSync: () => Promise<void>;
  fetchRemote: () => Promise<void>;
  pushRemote: () => Promise<void>;
  pullRebase: () => Promise<void>;
  loadBranches: () => Promise<GitBranchInfo[]>;
  checkoutBranch: (branch: string, create?: boolean) => Promise<void>;
  openConflictResolver: (path: string) => Promise<void>;
  closeConflictResolver: () => void;
  resolveConflict: (path: string, mergedContent: string) => Promise<void>;
  abortMerge: () => Promise<void>;
  setBranchModalOpen: (open: boolean) => void;
  clearError: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  branches: [],
  isLoading: false,
  isSyncing: false,
  isCommitting: false,
  error: null,
  activeConflictFile: null,
  activeConflictData: null,
  isConflictModalOpen: false,
  isBranchModalOpen: false,

  refreshStatus: async () => {
    try {
      set({ isLoading: true, error: null });
      const status = await invoke<GitStatusInfo>("git_get_status");
      set({ status, isLoading: false });

      // Automatically open conflict modal if new conflicts are detected and modal is not yet open
      if (status.conflictedFiles.length > 0 && !get().isConflictModalOpen) {
        get().openConflictResolver(status.conflictedFiles[0].path);
      }

      return status;
    } catch (err: any) {
      // If not a git repository or workspace not opened, silently set status to null
      const msg = err?.message || String(err);
      if (
        msg.includes("NOT_A_GIT_REPOSITORY") ||
        msg.includes("WORKSPACE_NOT_OPENED") ||
        msg.includes("GIT_NOT_FOUND")
      ) {
        set({ status: null, isLoading: false, error: null });
      } else {
        set({ isLoading: false, error: msg });
      }
      return null;
    }
  },

  stagePaths: async (paths: string[]) => {
    try {
      set({ error: null });
      await invoke("git_stage_paths", { paths });
      await get().refreshStatus();
    } catch (err: any) {
      set({ error: err?.message || String(err) });
      throw err;
    }
  },

  unstagePaths: async (paths: string[]) => {
    try {
      set({ error: null });
      await invoke("git_unstage_paths", { paths });
      await get().refreshStatus();
    } catch (err: any) {
      set({ error: err?.message || String(err) });
      throw err;
    }
  },

  discardChanges: async (paths: string[]) => {
    try {
      set({ error: null });
      await invoke("git_discard_changes", { paths });
      await get().refreshStatus();
    } catch (err: any) {
      set({ error: err?.message || String(err) });
      throw err;
    }
  },

  commit: async (message: string) => {
    try {
      set({ isCommitting: true, error: null });
      await invoke("git_commit", { message });
      await get().refreshStatus();
      set({ isCommitting: false });
    } catch (err: any) {
      set({ isCommitting: false, error: err?.message || String(err) });
      throw err;
    }
  },

  smartSync: async () => {
    try {
      set({ isSyncing: true, error: null });
      await invoke("git_smart_sync");
      await get().refreshStatus();
      set({ isSyncing: false });
    } catch (err: any) {
      set({ isSyncing: false, error: err?.message || String(err) });
      await get().refreshStatus();
      throw err;
    }
  },

  fetchRemote: async () => {
    try {
      set({ isLoading: true, error: null });
      await invoke("git_fetch");
      await get().refreshStatus();
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || String(err) });
      throw err;
    }
  },

  pushRemote: async () => {
    try {
      set({ isSyncing: true, error: null });
      await invoke("git_push");
      await get().refreshStatus();
      set({ isSyncing: false });
    } catch (err: any) {
      set({ isSyncing: false, error: err?.message || String(err) });
      throw err;
    }
  },

  pullRebase: async () => {
    try {
      set({ isSyncing: true, error: null });
      await invoke("git_pull_rebase");
      await get().refreshStatus();
      set({ isSyncing: false });
    } catch (err: any) {
      set({ isSyncing: false, error: err?.message || String(err) });
      await get().refreshStatus();
      throw err;
    }
  },

  loadBranches: async () => {
    try {
      const branches = await invoke<GitBranchInfo[]>("git_list_branches");
      set({ branches });
      return branches;
    } catch (err: any) {
      console.warn("Failed to load git branches:", err);
      return [];
    }
  },

  checkoutBranch: async (branch: string, create = false) => {
    try {
      set({ isLoading: true, error: null });
      await invoke("git_checkout_branch", { branch, create });
      await get().refreshStatus();
      await get().loadBranches();
      set({ isLoading: false, isBranchModalOpen: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || String(err) });
      throw err;
    }
  },

  openConflictResolver: async (path: string) => {
    try {
      set({ isLoading: true, error: null });
      const conflictData = await invoke<ConflictFileInfo>("git_get_conflict_details", { path });
      set({
        activeConflictFile: path,
        activeConflictData: conflictData,
        isConflictModalOpen: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || String(err) });
    }
  },

  closeConflictResolver: () => {
    set({
      activeConflictFile: null,
      activeConflictData: null,
      isConflictModalOpen: false,
    });
  },

  resolveConflict: async (path: string, mergedContent: string) => {
    try {
      set({ isLoading: true, error: null });
      await invoke("git_resolve_conflict", { path, mergedContent });
      const status = await get().refreshStatus();

      // Check if there are remaining conflicted files
      if (status && status.conflictedFiles.length > 0) {
        await get().openConflictResolver(status.conflictedFiles[0].path);
      } else {
        get().closeConflictResolver();
      }
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || String(err) });
      throw err;
    }
  },

  abortMerge: async () => {
    try {
      set({ isLoading: true, error: null });
      await invoke("git_abort_merge");
      await get().refreshStatus();
      get().closeConflictResolver();
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || String(err) });
      throw err;
    }
  },

  setBranchModalOpen: (open: boolean) => set({ isBranchModalOpen: open }),
  clearError: () => set({ error: null }),
}));
