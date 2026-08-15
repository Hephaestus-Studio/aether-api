import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
} from "@tabler/icons-react";
import AboutModal from "@/components/modals/AboutModal";
import logoUrl from "@/assets/logo.svg";
import classes from "./TitleBar.module.css";

export default function TitleBar() {
  const { open: openWorkspace, close: closeWorkspace } = useWorkspace();
  const { workspacePath } = useWorkspaceStore();
  const environments = useEnvStore((s) => s.environments);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const setActiveEnvironment = useEnvStore((s) => s.setActiveEnvironment);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
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

  const appWindow = getCurrentWindow();

  // Monitor Window Maximized State
  useEffect(() => {
    const updateMaximized = async () => {
      try {
        const max = await appWindow.isMaximized();
        setIsMaximized(max);
      } catch (err) {
        console.error("Failed to check window maximized state:", err);
      }
    };

    updateMaximized();

    let unlisten: () => void;
    appWindow
      .onResized(() => {
        updateMaximized();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);

    return () => {
      if (unlisten) unlisten();
    };
  }, [appWindow]);

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

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMaximize = async () => {
    try {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error(err);
    }
  };

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
                    <span>Open Workspace</span>
                    <span className={classes.dropdownShortcut}>Ctrl+O</span>
                  </div>
                  {workspacePath && (
                    <div className={classes.dropdownItem} onClick={handleCloseWorkspace}>
                      <span>Close Workspace</span>
                      <span className={classes.dropdownShortcut}>Ctrl+F4</span>
                    </div>
                  )}
                  <div className={classes.divider} />
                  <div className={classes.dropdownItem} onClick={handleClose}>
                    <span>Exit</span>
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
                    <span>Toggle Environments</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => {
                      toggleTerminal();
                      setActiveMenu(null);
                    }}
                  >
                    <span>Toggle Terminal</span>
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
                    <span>Undo</span>
                    <span className={classes.dropdownShortcut}>Ctrl+Z</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("redo")}
                  >
                    <span>Redo</span>
                    <span className={classes.dropdownShortcut}>Ctrl+Y</span>
                  </div>
                  <div className={classes.divider} />
                  <div className={classes.dropdownItem} onClick={() => document.execCommand("cut")}>
                    <span>Cut</span>
                    <span className={classes.dropdownShortcut}>Ctrl+X</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("copy")}
                  >
                    <span>Copy</span>
                    <span className={classes.dropdownShortcut}>Ctrl+C</span>
                  </div>
                  <div
                    className={classes.dropdownItem}
                    onClick={() => document.execCommand("paste")}
                  >
                    <span>Paste</span>
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
                    <span>About</span>
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
