import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPlus, IconTrash, IconX, IconTerminal2 } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import XTerminalInstance, { type XTerminalHandle } from "./XTerminalInstance";
import classes from "./TerminalPanel.module.css";

interface TerminalTab {
  id: string;
  title: string;
}

export default function TerminalPanel() {
  const setTerminalOpened = useTabStore((s) => s.setTerminalOpened);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const terminalRefs = useRef<Map<string, XTerminalHandle>>(new Map());
  const nextTabIndex = useRef(1);

  // Helper to spawn a new terminal tab
  const createNewTab = useCallback(async () => {
    try {
      const index = nextTabIndex.current++;
      const currentWs = useWorkspaceStore.getState().workspacePath;
      const sessionId = await invoke<string>("create_terminal_session", {
        cols: 80,
        rows: 24,
        cwd: currentWs || undefined,
      });

      const newTab: TerminalTab = {
        id: sessionId,
        title: `Terminal ${index}`,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(sessionId);
    } catch (err) {
      console.error("Failed to create terminal session:", err);
    }
  }, []);

  // Initialize first terminal tab once on mount
  useEffect(() => {
    let isMounted = true;

    const initFirstTab = async () => {
      try {
        const index = nextTabIndex.current++;
        const currentWs = useWorkspaceStore.getState().workspacePath;
        const sessionId = await invoke<string>("create_terminal_session", {
          cols: 80,
          rows: 24,
          cwd: currentWs || undefined,
        });

        if (isMounted) {
          const newTab: TerminalTab = {
            id: sessionId,
            title: `Terminal ${index}`,
          };
          setTabs([newTab]);
          setActiveTabId(sessionId);
        } else {
          invoke("close_terminal", { sessionId }).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to initialize terminal session:", err);
      }
    };

    initFirstTab();

    // Clean up all terminal sessions when panel unmounts (closes/hides)
    return () => {
      isMounted = false;
      invoke("close_all_terminals").catch((err) =>
        console.error("Failed to close all terminals on unmount:", err),
      );
    };
  }, []);

  // Handle closing a single terminal tab
  const handleCloseTab = async (e: React.MouseEvent, tabIdToClose: string) => {
    e.stopPropagation();

    try {
      await invoke("close_terminal", { sessionId: tabIdToClose });
    } catch (err) {
      console.error("Failed to close terminal session:", err);
    }

    terminalRefs.current.delete(tabIdToClose);

    setTabs((prevTabs) => {
      const remainingTabs = prevTabs.filter((t) => t.id !== tabIdToClose);

      // If no tabs remain, hide the whole terminal panel
      if (remainingTabs.length === 0) {
        setActiveTabId(null);
        setTerminalOpened(false);
        return [];
      }

      // If the closed tab was active, switch to the last tab or adjacent tab
      if (activeTabId === tabIdToClose) {
        const closedIndex = prevTabs.findIndex((t) => t.id === tabIdToClose);
        const nextActive =
          remainingTabs[Math.min(closedIndex, remainingTabs.length - 1)]?.id || null;
        setActiveTabId(nextActive);
      }

      return remainingTabs;
    });
  };

  // Handle clearing the active terminal screen
  const handleClear = () => {
    if (activeTabId) {
      terminalRefs.current.get(activeTabId)?.clear();
    }
  };

  // Handle close panel button
  const handleClosePanel = () => {
    setTerminalOpened(false);
  };

  return (
    <Box className={classes.container}>
      {/* Header bar with tabs & action controls */}
      <Box className={classes.header}>
        <Box className={classes.tabsContainer}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <UnstyledButton
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`${classes.tab} ${isActive ? classes.tabActive : ""}`}
              >
                <IconTerminal2 size={13} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span>{tab.title}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className={classes.tabCloseBtn}
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleCloseTab(e as any, tab.id);
                    }
                  }}
                  title="Close Terminal"
                >
                  <IconX size={11} />
                </span>
              </UnstyledButton>
            );
          })}

          <Tooltip label="New Terminal" position="top" withArrow>
            <UnstyledButton
              onClick={createNewTab}
              className={classes.actionBtn}
              style={{ width: 22, height: 22 }}
            >
              <IconPlus size={13} />
            </UnstyledButton>
          </Tooltip>
        </Box>

        {/* Action icons */}
        <Box className={classes.actions}>
          <Tooltip label="Clear Buffer" position="top" withArrow>
            <UnstyledButton onClick={handleClear} className={classes.actionBtn}>
              <IconTrash size={14} />
            </UnstyledButton>
          </Tooltip>
          <Tooltip label="Close Panel" position="top" withArrow>
            <UnstyledButton onClick={handleClosePanel} className={classes.actionBtn}>
              <IconX size={14} />
            </UnstyledButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Terminal Viewports Container */}
      <Box className={classes.terminalBody}>
        {tabs.map((tab) => (
          <XTerminalInstance
            key={tab.id}
            sessionId={tab.id}
            active={tab.id === activeTabId}
            ref={(handle) => {
              if (handle) {
                terminalRefs.current.set(tab.id, handle);
              } else {
                terminalRefs.current.delete(tab.id);
              }
            }}
            onExit={() => {
              // Automatically switch or handle exit if desired
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
