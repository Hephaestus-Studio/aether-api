import { useState, useRef, useEffect } from "react";
import { AppShell as MantineAppShell, Box } from "@mantine/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import ActivityBar from "./ActivityBar";
import Sidebar from "./Sidebar";
import EditorTabs from "./EditorTabs";
import StatusBar from "./StatusBar";
import SplitPane from "./SplitPane";
import TerminalPanel from "./TerminalPanel";
import RequestEditor from "@/components/editor/RequestEditor";
import ResponseViewer from "@/components/response/ResponseViewer";
import QuickOpen from "@/components/tools/QuickOpen";
import CommandPalette from "@/components/tools/CommandPalette";
import classes from "./AppShell.module.css";

export default function AppShell() {
  const { workspaceInfo, activeView, setWorkspaceInfo } = useWorkspaceStore();
  const [sidebarOpened, setSidebarOpened] = useState(true);
  const [quickOpenOpened, setQuickOpenOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const terminalOpened = useTabStore((s) => s.terminalOpened);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return workspaceInfo?.settings?.sidebarWidth || 280;
  });

  const sidebarWidthRef = useRef(sidebarWidth);
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;

      if (newWidth < 150) {
        setSidebarOpened(false);
      } else if (newWidth > 600) {
        setSidebarWidth(600);
      } else {
        setSidebarOpened(true);
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (workspaceInfo) {
        setWorkspaceInfo({
          ...workspaceInfo,
          settings: {
            ...workspaceInfo.settings,
            sidebarWidth: sidebarWidthRef.current,
          },
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <MantineAppShell
      header={{ height: 0 }}
      navbar={{
        width: sidebarOpened ? sidebarWidth + 48 : 48,
        breakpoint: "sm",
      }}
      footer={{ height: 22 }}
      padding={0}
      transitionDuration={0}
      styles={{
        root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        navbar: {
          position: "absolute",
          top: 0,
          bottom: 22,
          borderRight: "1px solid var(--border-color)",
          overflow: "hidden",
          height: "auto",
          display: "flex",
          flexDirection: "row",
        },
        main: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 22,
          height: "auto",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg-app)",
        },
        footer: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 22,
          borderTop: "1px solid var(--border-color)",
          padding: 0,
        },
      }}
    >
      <MantineAppShell.Navbar className={classes.navbar}>
        <ActivityBar
          activeView={activeView}
          sidebarOpened={sidebarOpened}
          setSidebarOpened={setSidebarOpened}
        />
        {sidebarOpened && (
          <>
            <Box className={classes.sidebarContainer}>
              <Sidebar />
            </Box>
            <div className={classes.resizeHandle} onMouseDown={handleResizeMouseDown} />
          </>
        )}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className={classes.main}>
        <EditorTabs />
        <Box className={classes.editorWrapper}>
          {terminalOpened ? (
            <SplitPane
              topPanel={
                activeTabId ? (
                  <SplitPane
                    topPanel={<RequestEditor tabId={activeTabId} />}
                    bottomPanel={<ResponseViewer tabId={activeTabId} />}
                    orientation="horizontal"
                  />
                ) : (
                  <Box className={classes.emptyState}>
                    Select a request from explorer or press Ctrl+P to search
                  </Box>
                )
              }
              bottomPanel={<TerminalPanel />}
              orientation="vertical"
            />
          ) : activeTabId ? (
            <SplitPane
              topPanel={<RequestEditor tabId={activeTabId} />}
              bottomPanel={<ResponseViewer tabId={activeTabId} />}
              orientation="horizontal"
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
