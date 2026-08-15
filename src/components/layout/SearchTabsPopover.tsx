import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Popover, Tooltip, ActionIcon } from "@mantine/core";
import { IconChevronDown, IconX, IconFolder, IconFolderOpen } from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import { getMethodColor } from "@/utils/httpMethods";
import clsx from "clsx";
import classes from "./SearchTabsPopover.module.css";

interface SearchTabsPopoverProps {
  onRequestCloseTab: (tabId: string) => void;
}

export default function SearchTabsPopover({ onRequestCloseTab }: Readonly<SearchTabsPopoverProps>) {
  const [opened, setOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcut Ctrl+Shift+A or Cmd+Shift+A to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        e.stopPropagation();
        setOpened((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter tabs
  const filteredTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tabs;
    return tabs.filter((t) => {
      const nameMatch = t.name?.toLowerCase().includes(query);
      const methodMatch = t.method?.toLowerCase().includes(query);
      return nameMatch || methodMatch;
    });
  }, [tabs, searchQuery]);

  // Reset search and selection on open
  useEffect(() => {
    if (opened) {
      setSearchQuery("");
      // Select currently active tab by default
      const idx = tabs.findIndex((t) => t.id === activeTabId);
      setSelectedIndex(idx >= 0 ? idx : 0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [opened, activeTabId, tabs]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filteredTabs.length) {
      setSelectedIndex(Math.max(0, filteredTabs.length - 1));
    }
  }, [filteredTabs.length, selectedIndex]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setOpened(false);
    },
    [setActiveTab],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredTabs.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredTabs.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredTabs[selectedIndex];
      if (target) {
        handleSelectTab(target.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpened(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[selectedIndex]) {
      (items[selectedIndex] as HTMLElement).scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  if (tabs.length === 0) return null;

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      offset={4}
      withinPortal
      shadow="xl"
      classNames={{ dropdown: classes.popoverDropdown }}
    >
      <Popover.Target>
        <Tooltip label="Search open tabs (Ctrl+Shift+A)" position="bottom-end" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            onClick={() => setOpened((o) => !o)}
            style={{ color: "var(--text-muted)" }}
          >
            <IconChevronDown size={14} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        {/* Search header */}
        <div className={classes.searchHeader}>
          <input
            ref={inputRef}
            type="text"
            className={classes.searchInput}
            placeholder="Search tabs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className={classes.shortcutBadge}>Ctrl+Shift+A</span>
        </div>

        {/* Tab List */}
        <div className={classes.tabList} ref={listRef}>
          {filteredTabs.length === 0 ? (
            <div className={classes.emptyState}>No matching tabs found</div>
          ) : (
            filteredTabs.map((tab, idx) => {
              const isCurrent = tab.id === activeTabId;
              const isSelected = idx === selectedIndex;
              const isCollection = tab.nodeType === "collection";
              const isFolder = tab.nodeType === "folder";

              return (
                <div
                  key={tab.id}
                  className={clsx(
                    classes.tabItem,
                    isSelected && classes.tabItemActive,
                    isCurrent && classes.tabItemCurrent,
                  )}
                  onClick={() => handleSelectTab(tab.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className={classes.tabInfo}>
                    {isCollection ? (
                      <IconFolderOpen size={13} color="#818cf8" style={{ flexShrink: 0 }} />
                    ) : isFolder ? (
                      <IconFolder size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                    ) : (
                      <span
                        className={classes.methodBadge}
                        style={{ color: getMethodColor(tab.method) }}
                      >
                        {tab.method || "GET"}
                      </span>
                    )}
                    <span className={classes.tabName} title={tab.name}>
                      {tab.name}
                    </span>
                  </div>

                  <div className={classes.tabActions}>
                    {tab.isDirty && <span className={classes.dirtyDot} title="Unsaved changes" />}
                    <button
                      type="button"
                      className={classes.closeBtn}
                      title="Close Tab"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestCloseTab(tab.id);
                      }}
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
