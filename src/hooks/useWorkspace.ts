import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import type { WorkspaceTree } from "@/types/workspace";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";

export function useWorkspace() {
  const store = useWorkspaceStore();
  const tabStore = useTabStore();

  const open = useCallback(
    async (path: string) => {
      store.setLoading(true);
      try {
        const tree = await invoke<WorkspaceTree>("open_workspace", { directoryPath: path });

        const currentWindow = getCurrentWindow();
        if (currentWindow.label === "welcome") {
          // If called from welcome window, notify main window and show it, then hide ourselves
          const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          const mainWindow = await WebviewWindow.getByLabel("main");
          if (mainWindow) {
            await mainWindow.show();
            await mainWindow.setFocus();
          }
          await emit("workspace-changed", path);
          await currentWindow.hide();
        } else {
          // If called from main window itself (e.g. via File -> Open Folder)
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

          await emit("workspace-changed", path);
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

      const currentWindow = getCurrentWindow();
      if (currentWindow.label === "main") {
        // Show welcome window
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const welcomeWindow = await WebviewWindow.getByLabel("welcome");
        if (welcomeWindow) {
          await welcomeWindow.show();
          await welcomeWindow.setFocus();
        }
        await emit("workspace-changed", null);
        await currentWindow.hide();
      }
    } catch (err) {
      console.error(err);
    }
  }, [store, tabStore]);

  return { open, close };
}
