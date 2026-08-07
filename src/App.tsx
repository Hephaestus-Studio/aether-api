import { useEffect } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useEnvStore } from "./stores/envStore";
import { useFsWatcher } from "./hooks/useFsWatcher";
import { invoke } from "@tauri-apps/api/core";
import AppShell from "./components/layout/AppShell";
import WelcomeScreen from "./components/WelcomeScreen";
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
      {workspacePath ? <AppShell /> : <WelcomeScreen />}
    </MantineProvider>
  );
}
