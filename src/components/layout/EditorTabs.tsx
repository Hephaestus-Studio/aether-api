import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  ScrollArea,
  Group,
  Text,
  Menu,
  CloseButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconLayoutColumns,
  IconLayoutRows,
  IconFolder,
  IconFolderOpen,
} from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import { getMethodColor } from "@/utils/httpMethods";
import UnsavedChangesModal, {
  type PendingCloseAction,
} from "@/components/modals/UnsavedChangesModal";
import SearchTabsPopover from "./SearchTabsPopover";
import classes from "./EditorTabs.module.css";

export default function EditorTabs() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const protocols = useTabStore((s) => s.protocols);
  const setActiveTab = useTabStore((s) => s.setActiveTab);

  const closeTab = useTabStore((s) => s.closeTab);
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabStore((s) => s.closeAllTabs);
  const responsePanelOpened = useTabStore((s) => s.responsePanelOpened);
  const toggleResponsePanel = useTabStore((s) => s.toggleResponsePanel);
  const toggleLayoutOrientation = useTabStore((s) => s.toggleLayoutOrientation);
  const layoutOrientation = useTabStore((s) => s.layoutOrientation);

  const [pendingCloseAction, setPendingCloseAction] = useState<PendingCloseAction | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleRequestCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.isDirty) {
        setPendingCloseAction({
          type: "single",
          tabId,
          dirtyTabs: [tab],
        });
      } else {
        closeTab(tabId);
      }
    },
    [tabs, closeTab],
  );

  const handleRequestCloseOtherTabs = useCallback(
    (tabId: string) => {
      const dirtyTabs = tabs.filter((t) => t.id !== tabId && t.isDirty);
      if (dirtyTabs.length > 0) {
        setPendingCloseAction({
          type: "others",
          tabId,
          dirtyTabs,
        });
      } else {
        closeOtherTabs(tabId);
      }
    },
    [tabs, closeOtherTabs],
  );

  const handleRequestCloseAllTabs = useCallback(() => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      setPendingCloseAction({
        type: "all",
        dirtyTabs,
      });
    } else {
      closeAllTabs();
    }
  }, [tabs, closeAllTabs]);

  // Keyboard shortcut: Ctrl+W or Cmd+W to close active tab with dirty check
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        e.stopPropagation();
        if (activeTabId) {
          handleRequestCloseTab(activeTabId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeTabId, handleRequestCloseTab]);

  // Mouse wheel horizontal scrolling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (viewportRef.current && e.deltaY) {
      viewportRef.current.scrollLeft += e.deltaY;
    }
  };

  // Scroll active tab into view when switched
  useEffect(() => {
    if (!activeTabId || !viewportRef.current) return;
    const activeEl = viewportRef.current.querySelector(`.${classes.tabActive}`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  return (
    <Box className={classes.tabBar}>
      <ScrollArea
        className={classes.scrollArea}
        scrollbars="x"
        viewportRef={viewportRef}
        onWheel={handleWheel}
      >
        <Group gap={0} wrap="nowrap" className={classes.tabGroup}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isCollection = tab.nodeType === "collection";
            const isFolder = tab.nodeType === "folder";

            return (
              <Menu key={tab.id} position="bottom-start" withinPortal>
                <Menu.ContextMenu>
                  <Box
                    onClick={() => setActiveTab(tab.id)}
                    className={`${classes.tab} ${isActive ? classes.tabActive : ""}`}
                  >
                    {isCollection ? (
                      <IconFolderOpen
                        size={13}
                        color="var(--mantine-color-indigo-4, #818cf8)"
                        style={{ flexShrink: 0 }}
                      />
                    ) : isFolder ? (
                      <IconFolder
                        size={13}
                        color="var(--text-muted, #9ca3af)"
                        style={{ flexShrink: 0 }}
                      />
                    ) : (
                      (() => {
                        const isWs =
                          protocols[tab.id] === "websocket" ||
                          tab.protocol === "websocket" ||
                          tab.method === "WS";
                        const isSse =
                          protocols[tab.id] === "sse" ||
                          tab.protocol === "sse" ||
                          tab.method === "SSE";
                        const displayMethod = isWs ? "WS" : isSse ? "SSE" : tab.method || "GET";
                        return (
                          <Text
                            size="xs"
                            fw={700}
                            style={{ color: getMethodColor(displayMethod) }}
                            className={classes.methodText}
                          >
                            {displayMethod}
                          </Text>
                        );
                      })()
                    )}
                    <Text size="xs" className={classes.nameText} truncate>
                      {tab.name}
                    </Text>
                    {tab.isDirty && <Box className={classes.dirtyMarker} />}
                    <CloseButton
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestCloseTab(tab.id);
                      }}
                      className={classes.closeBtn}
                    />
                  </Box>
                </Menu.ContextMenu>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => handleRequestCloseTab(tab.id)}>Close Tab</Menu.Item>
                  <Menu.Item onClick={() => handleRequestCloseOtherTabs(tab.id)}>
                    Close Others
                  </Menu.Item>
                  <Menu.Item onClick={() => handleRequestCloseAllTabs()}>Close All</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            );
          })}
        </Group>
      </ScrollArea>

      {tabs.length > 0 && (
        <Group gap={4} px={6} className={classes.actionsGroup}>
          {/* Quick Tab Search Popover (Ctrl+Shift+A) */}
          <SearchTabsPopover onRequestCloseTab={handleRequestCloseTab} />

          {responsePanelOpened && (
            <Tooltip
              label={
                layoutOrientation === "horizontal"
                  ? "Switch to Top/Bottom layout"
                  : "Switch to Side-by-Side layout"
              }
              position="bottom-end"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={toggleLayoutOrientation}
                className={classes.actionBtn}
              >
                {layoutOrientation === "horizontal" ? (
                  <IconLayoutRows size={15} />
                ) : (
                  <IconLayoutColumns size={15} />
                )}
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip
            label={responsePanelOpened ? "Hide Response Panel" : "Show Response Panel"}
            position="bottom-end"
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              onClick={toggleResponsePanel}
              className={classes.actionBtn}
            >
              {responsePanelOpened ? (
                <IconLayoutSidebarRightCollapse size={15} />
              ) : (
                <IconLayoutSidebarRightExpand size={15} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesModal
        pendingAction={pendingCloseAction}
        onClose={() => setPendingCloseAction(null)}
      />
    </Box>
  );
}
