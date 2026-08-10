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
  const responsePanelOpened = useTabStore((s) => s.responsePanelOpened);
  const layoutOrientation = useTabStore((s) => s.layoutOrientation);

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

  const navWidth = sidebarOpened ? sidebarWidth + 48 : 48;

  return (
    <Box className={classes.shellRoot}>
      {/* Middle row: Sidebar on left + Main Workspace on right */}
      <Box className={classes.workspaceRow}>
        {/* Navbar: ActivityBar (48px) + Sidebar */}
        <Box className={classes.navbar} style={{ width: navWidth }}>
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
        </Box>

        {/* Main Area: EditorTabs + RequestEditor/ResponseViewer/Terminal SplitPane */}
        <Box className={classes.mainArea}>
          <EditorTabs />
          <Box className={classes.editorWrapper}>
            <SplitPane
              collapsed={!terminalOpened}
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
              bottomPanel={terminalOpened ? <TerminalPanel /> : null}
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
