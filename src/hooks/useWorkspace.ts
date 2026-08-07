import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import type { WorkspaceTree } from "@/types/workspace";

export function useWorkspace() {
  const store = useWorkspaceStore();
  const tabStore = useTabStore();

  const open = useCallback(
    async (path: string) => {
      store.setLoading(true);
      try {
        const tree = await invoke<WorkspaceTree>("open_workspace", { directoryPath: path });
        store.setWorkspacePath(path);
        store.setTreeData(tree.children);

        const info = await invoke<any>("get_workspace_info");
        store.setWorkspaceInfo(info);

        try {
          const git = await invoke<any>("get_git_status");
          store.setGitStatus(git);
        } catch (gitErr) {
          console.error("Failed to load initial git status:", gitErr);
        }

        return tree;
      } catch (err) {
        console.error(err);
        throw err;
      } finally {
        store.setLoading(false);
      }
    },
    [store],
  );

  const close = useCallback(async () => {
    try {
      await invoke("close_workspace");
      store.reset();
      tabStore.closeAllTabs();
    } catch (err) {
      console.error(err);
    }
  }, [store, tabStore]);

  return { open, close };
}
