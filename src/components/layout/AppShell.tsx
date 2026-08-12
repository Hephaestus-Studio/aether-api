import { useState, useRef, useEffect } from "react";
import { Box } from "@mantine/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import ActivityBar from "./ActivityBar";
import Sidebar from "./Sidebar";
import EditorTabs from "./EditorTabs";
import StatusBar from "./StatusBar";
import SplitPane from "./SplitPane";
import TerminalPanel from "./TerminalPanel";
import EnvironmentPanel from "@/components/environment/EnvironmentPanel";
import RequestEditor from "@/components/editor/RequestEditor";
import ResponseViewer from "@/components/response/ResponseViewer";
import QuickOpen from "@/components/tools/QuickOpen";
import CommandPalette from "@/components/tools/CommandPalette";
import classes from "./AppShell.module.css";

export default function AppShell() {
  const { workspaceInfo, setWorkspaceInfo } = useWorkspaceStore();
  const [sidebarOpened, setSidebarOpened] = useState(true);
  const [quickOpenOpened, setQuickOpenOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const bottomPanelOpened = useTabStore((s) => s.bottomPanelOpened);
  const activeBottomPanelTab = useTabStore((s) => s.activeBottomPanelTab);
  const responsePanelOpened = useTabStore((s) => s.responsePanelOpened);
  const layoutOrientation = useTabStore((s) => s.layoutOrientation);

  const MIN_SIDEBAR_WIDTH = 280;
  const MAX_SIDEBAR_WIDTH = 600;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return Math.max(MIN_SIDEBAR_WIDTH, workspaceInfo?.settings?.sidebarWidth || 280);
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

      const clampedWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (workspaceInfo) {
        setWorkspaceInfo({
          ...workspaceInfo,
          settings: {
            ...workspaceInfo.settings,
            sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, sidebarWidthRef.current),
          },
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const navWidth = sidebarOpened ? Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth) : 24;

  return (
    <Box className={classes.shellRoot}>
      {/* Middle row: Sidebar on left + Main Workspace on right */}
      <Box className={classes.workspaceRow}>
        {/* Navbar: ActivityBar (24px thin strip when collapsed) or Sidebar (when expanded) */}
        <Box className={classes.navbar} style={{ width: navWidth }}>
          {!sidebarOpened ? (
            <ActivityBar setSidebarOpened={setSidebarOpened} />
          ) : (
            <>
              <Box className={classes.sidebarContainer}>
                <Sidebar onClose={() => setSidebarOpened(false)} />
              </Box>
              <div className={classes.resizeHandle} onMouseDown={handleResizeMouseDown} />
            </>
          )}
        </Box>

        {/* Main Area: EditorTabs + RequestEditor/ResponseViewer/Terminal SplitPane */}
        <Box className={classes.mainArea}>
          <EditorTabs />
          <Box className={classes.editorWrapper}>
            <SplitPane
              collapsed={!bottomPanelOpened}
              topPanel={
                activeTabId ? (
                  <SplitPane
                    collapsed={!responsePanelOpened}
                    topPanel={<RequestEditor tabId={activeTabId} />}
                    bottomPanel={<ResponseViewer tabId={activeTabId} />}
                    orientation={layoutOrientation}
                    minTopSize={layoutOrientation === "horizontal" ? 320 : 180}
                    minBottomSize={layoutOrientation === "horizontal" ? 280 : 160}
                  />
                ) : (
                  <Box className={classes.emptyState}>
                    Select a request from explorer or press Ctrl+P to search
                  </Box>
                )
              }
              bottomPanel={
                bottomPanelOpened ? (
                  <Box style={{ height: "100%", width: "100%", position: "relative" }}>
                    <Box
                      style={{
                        height: "100%",
                        width: "100%",
                        display: activeBottomPanelTab === "terminal" ? "block" : "none",
                      }}
                    >
                      <TerminalPanel />
                    </Box>
                    <Box
                      style={{
                        height: "100%",
                        width: "100%",
                        display: activeBottomPanelTab === "environment" ? "block" : "none",
                      }}
                    >
                      <EnvironmentPanel />
                    </Box>
                  </Box>
                ) : null
              }
              orientation="vertical"
            />
          </Box>
        </Box>
      </Box>

      {/* Bottom row: StatusBar (22px) */}
      <Box className={classes.statusBarWrapper}>
        <StatusBar />
      </Box>

      {/* Power tools shortcuts modals */}
      <QuickOpen opened={quickOpenOpened} onClose={() => setQuickOpenOpened(false)} />
      <CommandPalette
        opened={commandPaletteOpened}
        onClose={() => setCommandPaletteOpened(false)}
      />
    </Box>
  );
}
