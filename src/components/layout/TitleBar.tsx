import { useState, useEffect, useRef } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import { useEnvStore } from "@/stores/envStore";
import { Menu } from "@mantine/core";
import {
  IconMinus,
  IconSquare,
  IconCopy,
  IconX,
  IconWorld,
  IconChevronDown,
  IconAdjustments,
  IconCheck,
  IconFolderOpen,
  IconFolderMinus,
  IconPower,
  IconTerminal2,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCut,
  IconClipboard,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useWindowState } from "@/hooks/useWindowState";
import AboutModal from "@/components/modals/AboutModal";
import logoUrl from "@/assets/logo.svg";
import classes from "./TitleBar.module.css";

export default function TitleBar() {
  const { open: openWorkspace, close: closeWorkspace } = useWorkspace();
  const { workspacePath } = useWorkspaceStore();
  const { isMaximized, toggleMaximize: handleMaximize, minimize: handleMinimize, close: handleClose } =
    useWindowState();
  const environments = useEnvStore((s) => s.environments);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const setActiveEnvironment = useEnvStore((s) => s.setActiveEnvironment);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toggleTerminal = useTabStore((s) => s.toggleTerminal);
  const toggleEnvPanel = useTabStore((s) => s.toggleEnvPanel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTerminal]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOpenFolder = async () => {
    setActiveMenu(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Workspace Folder",
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (path) {
          await openWorkspace(path);
          // Add to recent workspaces in localStorage
          const saved = localStorage.getItem("recent_workspaces");
          const recents: string[] = saved ? JSON.parse(saved) : [];
          const next = [path, ...recents.filter((p) => p !== path)].slice(0, 5);
          localStorage.setItem("recent_workspaces", JSON.stringify(next));
        }
      }
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  const handleCloseWorkspace = async () => {
    setActiveMenu(null);
    await closeWorkspace();
  };

  const menuItems = ["File", "Edit", "View", "Help"];

  return (
    <div className={classes.titleBar} data-tauri-drag-region>
      {/* Left: Logo & Menubar */}
      <div className={classes.left}>
        <div className={classes.logo}>
          <img src={logoUrl} alt="Logo" width="16" height="16" />
        </div>
        <div className={classes.menuBar} ref={dropdownRef}>
          {menuItems.map((menu) => (
            <div key={menu} className={classes.menuItemContainer}>
              <button
                className={`${classes.menuItem} ${activeMenu === menu ? classes.menuItemActive : ""}`}
                onClick={() => setActiveMenu(activeMenu === menu ? null : menu)}
                onMouseEnter={() => activeMenu !== null && setActiveMenu(menu)}
              >
                {menu}
              </button>

              {activeMenu === menu && menu === "File" && (
                <div className={classes.dropdownMenu}>
                  <div className={classes.dropdownItem} onClick={handleOpenFolder}>
                    <div className={classes.dropdownItemLeft}>
                      <IconFolderOpen size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Open Workspace</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+O</span>
                  </div>
                  {workspacePath && (
                    <div className={classes.dropdownItem} onClick={handleCloseWorkspace}>
                      <div className={classes.dropdownItemLeft}>
                        <IconFolderMinus size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                        <span>Close Workspace</span>
                      </div>
                      <span className={classes.dropdownShortcut}>Ctrl+F4</span>
                    </div>
                  )}
                  <div className={classes.divider} />
                  <div className={classes.dropdownItem} onClick={handleClose}>
                    <div className={classes.dropdownItemLeft}>
                      <IconPower size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Exit</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Alt+F4</span>
                  </div>
                </div>
              )}

              {activeMenu === menu && menu === "View" && (
                <div className={classes.dropdownMenu}>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => {
                      toggleEnvPanel();
                      setActiveMenu(null);
                    }}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconWorld size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Toggle Environments</span>
                    </div>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => {
                      toggleTerminal();
                      setActiveMenu(null);
                    }}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconTerminal2 size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Toggle Terminal</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+`</span>
                  </div>
                </div>
              )}

              {activeMenu === menu && menu === "Edit" && (
                <div className={classes.dropdownMenu}>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("undo")}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconArrowBackUp size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Undo</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+Z</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("redo")}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconArrowForwardUp size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Redo</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+Y</span>
                  </div>
                  <div className={classes.divider} />
                  <div className={classes.dropdownItem} onClick={() => document.execCommand("cut")}>
                    <div className={classes.dropdownItemLeft}>
                      <IconCut size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Cut</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+X</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("copy")}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconCopy size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Copy</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+C</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("paste")}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconClipboard size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>Paste</span>
                    </div>
                    <span className={classes.dropdownShortcut}>Ctrl+V</span>
                  </div>
                </div>
              )}

              {activeMenu === menu && menu === "Help" && (
                <div className={classes.dropdownMenu}>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => {
                      setIsAboutOpen(true);
                      setActiveMenu(null);
                    }}
                  >
                    <div className={classes.dropdownItemLeft}>
                      <IconInfoCircle size={14} stroke={1.8} className={classes.dropdownItemIcon} />
                      <span>About</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Middle: Drag Region */}
      <div className={classes.center} data-tauri-drag-region />

      {/* Right: Environment Selector & Window Controls */}
      <div className={classes.right}>
        {workspacePath && (
          <div className={classes.envSelectorWrapper}>
            <Menu position="bottom-end" withinPortal shadow="xl">
              <Menu.Target>
                <button className={classes.envButton} title="Switch Active Environment">
                  <IconWorld size={13} className={classes.envIcon} />
                  <span className={classes.envText}>
                    {activeEnvironmentName === "global"
                      ? "Global"
                      : activeEnvironmentName || "Global"}
                  </span>
                  <IconChevronDown size={11} className={classes.envChevron} />
                </button>
              </Menu.Target>
              <Menu.Dropdown className={classes.envDropdown}>
                <Menu.Item
                  onClick={() => setActiveEnvironment("global")}
                  className={
                    activeEnvironmentName === "global" || !activeEnvironmentName
                      ? classes.envItemActive
                      : ""
                  }
                  rightSection={
                    activeEnvironmentName === "global" || !activeEnvironmentName ? (
                      <IconCheck size={12} color="#ffffff" />
                    ) : null
                  }
                >
                  Global
                </Menu.Item>
                {environments.map((env) => {
                  const isActive = activeEnvironmentName?.toLowerCase() === env.name.toLowerCase();
                  return (
                    <Menu.Item
                      key={env.name}
                      onClick={() => setActiveEnvironment(env.name)}
                      className={isActive ? classes.envItemActive : ""}
                      rightSection={isActive ? <IconCheck size={12} color="#ffffff" /> : null}
                    >
                      {env.name}
                    </Menu.Item>
                  );
                })}
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconAdjustments size={12} />}
                  onClick={() => useTabStore.getState().openBottomPanel("environment")}
                >
                  Configure Environments...
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        )}

        <div className={classes.windowControls}>
          <button onClick={handleMinimize} className={classes.controlButton} title="Minimize">
            <IconMinus size={14} stroke={1.8} />
          </button>
          <button
            onClick={handleMaximize}
            className={classes.controlButton}
            title={isMaximized ? "Restore Down" : "Maximize"}
          >
            {isMaximized ? (
              <IconCopy size={12} stroke={1.8} />
            ) : (
              <IconSquare size={12} stroke={1.8} />
            )}
          </button>
          <button
            onClick={handleClose}
            className={`${classes.controlButton} ${classes.closeButton}`}
            title="Close"
          >
            <IconX size={14} stroke={1.8} />
          </button>
        </div>
      </div>

      {/* About Modal Dialog */}
      <AboutModal opened={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
