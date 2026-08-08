import { useEffect } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useEnvStore } from "./stores/envStore";
import { useFsWatcher } from "./hooks/useFsWatcher";
import { invoke } from "@tauri-apps/api/core";
import AppShell from "./components/layout/AppShell";
import WelcomeScreen from "./components/WelcomeScreen";
import TitleBar from "./components/layout/TitleBar";
import ResizeBorders from "./components/layout/ResizeBorders";
import "@mantine/core/styles.css";
import "./styles/theme.css";
import "./styles/global.css";

const theme = createTheme({
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, Fira Code, monospace",
  primaryColor: "indigo",
  defaultRadius: "sm",
});

export default function App() {
  const { workspacePath, setTreeData, setGitStatus, reset } = useWorkspaceStore();
  const { setEnvironments } = useEnvStore();

  // Restore open workspace from backend on startup/reload
  useEffect(() => {
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
  }, []);

  // Handle desynchronization between Frontend and Backend on startup / reload
  useEffect(() => {
    if (workspacePath) {
      invoke("get_workspace_info")
        .then(() => {
          // Sync environments list
          invoke("list_environments")
            .then((envs: any) => setEnvironments(envs))
            .catch(console.error);

          // Sync git status
          invoke("get_git_status")
            .then((git: any) => setGitStatus(git))
            .catch(console.error);
        })
        .catch((err) => {
          console.warn("Backend workspace desync detected, resetting frontend state:", err);
          reset();
        });
    }
  }, [workspacePath, reset, setEnvironments, setGitStatus]);

  useFsWatcher(async (payload) => {
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

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
      >
        <TitleBar />
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {workspacePath ? <AppShell /> : <WelcomeScreen />}
        </div>
        <ResizeBorders />
      </div>
    </MantineProvider>
  );
}
