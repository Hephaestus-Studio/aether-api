import { useEffect } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useEnvStore } from "./stores/envStore";
import { useFsWatcher } from "./hooks/useFsWatcher";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import AppShell from "./components/layout/AppShell";
import WelcomeScreen from "./components/WelcomeScreen";
import TitleBar from "./components/layout/TitleBar";
import ResizeBorders from "./components/layout/ResizeBorders";
import { Notifications } from "@mantine/notifications";
import { useConfigStore } from "./stores/configStore";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/theme.css";
import "./styles/global.css";

const theme = createTheme({
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  fontFamilyMonospace:
    "'JetBrains Mono', 'Fira Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace",
  primaryColor: "blue",
  defaultRadius: "sm",
});

export default function App() {
  const { workspacePath, setTreeData, setGitStatus, reset } = useWorkspaceStore();
  const { setEnvironments } = useEnvStore();
  const { config, loadConfig } = useConfigStore();
  const windowLabel = getCurrentWindow().label;

  // Load global configuration on startup
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Sync editor font size to CSS variable on document root
  useEffect(() => {
    if (config.fontSize) {
      document.documentElement.style.setProperty(
        "--aether-editor-font-size",
        `${config.fontSize}px`,
      );
    }
  }, [config.fontSize]);

  // Sync UI font size to CSS variable on document root
  useEffect(() => {
    if (config.uiFontSize) {
      document.documentElement.style.setProperty(
        "--aether-font-size-base",
        `${config.uiFontSize}px`,
      );
    }
  }, [config.uiFontSize]);

  // Restore open workspace from backend on startup/reload (for main window only)
  useEffect(() => {
    if (windowLabel !== "main") return;
    let isMounted = true;

    invoke<any>("get_workspace_info")
      .then(async (info) => {
        if (isMounted && info && info.path) {
          console.log("Restoring active backend workspace:", info.path);
          try {
            const tree = await invoke<any>("open_workspace", { directoryPath: info.path });
            if (!isMounted) return;

            useWorkspaceStore.getState().setWorkspacePath(info.path);
            useWorkspaceStore.getState().setTreeData(tree.children);
            useWorkspaceStore.getState().setWorkspaceInfo(info);
          } catch (err) {
            console.error("Failed to restore workspace session:", err);
          }
        }
      })
      .catch((err) => {
        console.log("No active workspace in backend on startup:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [windowLabel]);

  // Synchronize workspace changes between windows
  useEffect(() => {
    if (windowLabel !== "main") return;

    const syncWorkspace = async (path: string | null) => {
      if (path) {
        try {
          const tree = await invoke<any>("open_workspace", { directoryPath: path });
          useWorkspaceStore.getState().setWorkspacePath(path);
          useWorkspaceStore.getState().setTreeData(tree.children);

          const info = await invoke<any>("get_workspace_info");
          useWorkspaceStore.getState().setWorkspaceInfo(info);

          const envs = await invoke<any>("list_environments");
          setEnvironments(envs);

          const git = await invoke<any>("get_git_status");
          setGitStatus(git);
        } catch (err) {
          console.error("Failed to sync workspace in main window:", err);
        }
      } else {
        reset();
      }
    };

    let unlisten: () => void;
    import("@tauri-apps/api/event").then((mod) => {
      mod
        .listen<string | null>("workspace-changed", (event) => {
          console.log("Workspace changed event received in main window:", event.payload);
          syncWorkspace(event.payload);
        })
        .then((fn) => {
          unlisten = fn;
        });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [windowLabel, reset, setEnvironments, setGitStatus]);

  // Handle desynchronization on startup / reload (for main window only)
  useEffect(() => {
    if (windowLabel !== "main" || !workspacePath) return;

    invoke("get_workspace_info")
      .then(() => {
        invoke("list_environments")
          .then((envs: any) => setEnvironments(envs))
          .catch(console.error);

        invoke("get_git_status")
          .then((git: any) => setGitStatus(git))
          .catch(console.error);
      })
      .catch((err) => {
        console.warn("Backend workspace desync detected, resetting frontend state:", err);
        reset();
      });
  }, [windowLabel, workspacePath, reset, setEnvironments, setGitStatus]);

  // File watcher for hot reloading workspace changes
  useFsWatcher(async (payload) => {
    if (windowLabel !== "main" || !workspacePath) return;
    console.log("FS Changed:", payload);
    try {
      const tree: any = await invoke("open_workspace", { directoryPath: workspacePath });
      setTreeData(tree.children);

      try {
        const git: any = await invoke("get_git_status");
        setGitStatus(git);
      } catch (err) {
        console.error("Failed to update git status:", err);
      }

      if (payload.eventPath.includes("environments")) {
        const envs: any = await invoke("list_environments");
        setEnvironments(envs);
      }
    } catch (err) {
      console.error("Failed to hot-reload workspace tree:", err);
    }
  });

  if (windowLabel === "welcome") {
    return (
      <MantineProvider theme={theme} forceColorScheme="dark">
        <Notifications position="top-right" zIndex={1000} />
        <div style={{ height: "100vh", position: "relative", overflow: "hidden" }}>
          <WelcomeScreen />
          <ResizeBorders />
        </div>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <Notifications position="top-right" zIndex={1000} />
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
      >
        <TitleBar />
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <AppShell />
        </div>
        <ResizeBorders />
      </div>
    </MantineProvider>
  );
}
