import { useState } from "react";
import { AppShell as MantineAppShell, Box } from "@mantine/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import ActivityBar from "./ActivityBar";
import Sidebar from "./Sidebar";
import EditorTabs from "./EditorTabs";
import StatusBar from "./StatusBar";
import SplitPane from "./SplitPane";
import RequestEditor from "@/components/editor/RequestEditor";
import ResponseViewer from "@/components/response/ResponseViewer";
import QuickOpen from "@/components/tools/QuickOpen";
import CommandPalette from "@/components/tools/CommandPalette";
import classes from "./AppShell.module.css";

export default function AppShell() {
  const { workspaceInfo, activeView } = useWorkspaceStore();
  const [sidebarOpened, setSidebarOpened] = useState(true);
  const [quickOpenOpened, setQuickOpenOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);

  const activeTabId = useTabStore((s) => s.activeTabId);

  return (
    <MantineAppShell
      header={{ height: 0 }}
      navbar={{
        width: sidebarOpened ? (workspaceInfo?.settings?.sidebarWidth || 280) + 48 : 48,
        breakpoint: "sm",
      }}
      footer={{ height: 22 }}
      padding={0}
      styles={{
        navbar: { borderRight: "1px solid var(--border-color)", overflow: "hidden" },
        footer: { borderTop: "1px solid var(--border-color)", padding: 0 },
      }}
    >
      <MantineAppShell.Navbar className={classes.navbar}>
        <ActivityBar
          activeView={activeView}
          sidebarOpened={sidebarOpened}
          setSidebarOpened={setSidebarOpened}
        />
        {sidebarOpened && (
          <Box className={classes.sidebarContainer}>
            <Sidebar />
          </Box>
        )}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className={classes.main}>
        <EditorTabs />
        <Box className={classes.editorWrapper}>
          {activeTabId ? (
            <SplitPane
              topPanel={<RequestEditor tabId={activeTabId} />}
              bottomPanel={<ResponseViewer tabId={activeTabId} />}
            />
          ) : (
            <Box className={classes.emptyState}>
              Select a request from explorer or press Ctrl+P to search
            </Box>
          )}
        </Box>
      </MantineAppShell.Main>

      <MantineAppShell.Footer>
        <StatusBar />
      </MantineAppShell.Footer>

      {/* Power tools shortcuts modals */}
      <QuickOpen opened={quickOpenOpened} onClose={() => setQuickOpenOpened(false)} />
      <CommandPalette
        opened={commandPaletteOpened}
        onClose={() => setCommandPaletteOpened(false)}
      />
    </MantineAppShell>
  );
}
