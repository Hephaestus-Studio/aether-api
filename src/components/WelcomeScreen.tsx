import { useState, useEffect, useMemo } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  IconFolder,
  IconGitBranch,
  IconPlus,
  IconX,
  IconSearch,
  IconMinus,
  IconSquare,
  IconCopy,
} from "@tabler/icons-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import logoUrl from "@/assets/logo.svg";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useConfigStore } from "@/stores/configStore";
import classes from "./WelcomeScreen.module.css";

const parseWorkspacePath = (path: string) => {
  const homePattern = /^\/home\/[^/]+/;
  const parts = path.split("/");
  const folderName = parts[parts.length - 1] || path;
  const parentPath =
    parts
      .slice(0, parts.length - 1)
      .join("/")
      .replace(homePattern, "~") || "~";
  return { folderName, parentPath };
};

const getRepoNameFromUrl = (url: string): string => {
  try {
    const trimmed = url.trim().replace(/\/$/, "");
    const lastPart = trimmed.substring(trimmed.lastIndexOf("/") + 1);
    return lastPart.replace(/\.git$/, "") || "cloned-repo";
  } catch {
    return "cloned-repo";
  }
};

export default function WelcomeScreen() {
  const { open } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"projects" | "customize">("projects");
  const [recents, setRecents] = useState<string[]>(() => {
    const saved = localStorage.getItem("recent_workspaces");
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Dialogs State
  const [isNewWsOpen, setIsNewWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsParent, setNewWsParent] = useState("");

  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [cloneDest, setCloneDest] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [cloningProgress, setCloningProgress] = useState(0);

  // App Settings State
  const { config, updateConfig } = useConfigStore();

  // Load default directories when config is available
  useEffect(() => {
    if (config.defaultParentDirectory) {
      setNewWsParent(config.defaultParentDirectory);
      setCloneDest(config.defaultParentDirectory);
    }
  }, [config.defaultParentDirectory]);

  const handleOpenPath = async (path: string) => {
    try {
      await open(path);
      setRecents((prev) => {
        const next = [path, ...prev.filter((p) => p !== path)].slice(0, 8);
        localStorage.setItem("recent_workspaces", JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Failed to open workspace:", err);
    }
  };

  const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setRecents((prev) => {
      const next = prev.filter((p) => p !== path);
      localStorage.setItem("recent_workspaces", JSON.stringify(next));
      return next;
    });
  };

  const handleSelectParentFolder = async (target: "new" | "clone") => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Parent Location",
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (path) {
          if (target === "new") setNewWsParent(path);
          if (target === "clone") setCloneDest(path);
        }
      }
    } catch (err) {
      console.error("Failed to open folder selector:", err);
    }
  };

  const handleOpenFolderDirect = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Workspace Folder",
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (path) {
          await handleOpenPath(path);
        }
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim() || !newWsParent.trim()) return;
    try {
      const path = await invoke<string>("create_workspace", {
        name: newWsName.trim(),
        parentDirectory: newWsParent.trim(),
      });
      setIsNewWsOpen(false);
      setNewWsName("");
      await handleOpenPath(path);
    } catch (err) {
      console.error("Failed to create workspace:", err);
    }
  };

  const handleConfirmClone = async () => {
    if (!repoUrl.trim() || !cloneDest.trim()) return;
    setIsCloning(true);
    setCloningProgress(0);
  };

  // Simulating Cloning Process
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCloning) {
      interval = setInterval(() => {
        setCloningProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsCloning(false);
            const repoName = getRepoNameFromUrl(repoUrl);
            const finalPath = `${cloneDest}/${repoName}`;
            handleOpenPath(finalPath).then(() => {
              setIsCloneOpen(false);
              setRepoUrl("");
            });
            return 100;
          }
          return prev + Math.floor(Math.random() * 15) + 8;
        });
      }, 200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCloning, repoUrl, cloneDest]);

  const filteredRecents = useMemo(() => {
    return recents.filter((path) => {
      const { folderName } = parseWorkspacePath(path);
      return (
        folderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        path.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [recents, searchQuery]);

  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

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

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    try {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error("Failed to toggle maximize:", err);
    }
  };
  const handleClose = () => appWindow.close();

  return (
    <div className={classes.container}>
      {/* Sleek Undecorated Window Titlebar Drag Region */}
      <div className={classes.titleBar} data-tauri-drag-region>
        <span className={classes.windowTitle} data-tauri-drag-region></span>
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

      <div className={classes.body}>
        {/* Left Sidebar Pane */}
        <div className={classes.sidebar}>
          <div className={classes.sidebarHeader} data-tauri-drag-region>
            <div className={classes.logoWrapper}>
              <img src={logoUrl} alt="AetherAPI Logo" className={classes.logo} />
              <div>
                <h1 className={classes.title}>AetherAPI</h1>
                <span className={classes.version}>v0.2.0-beta</span>
              </div>
            </div>
          </div>

          <div className={classes.navigation}>
            <button
              className={`${classes.navItem} ${activeTab === "projects" ? classes.navItemActive : ""}`}
              onClick={() => setActiveTab("projects")}
            >
              Projects
            </button>
            <button
              className={`${classes.navItem} ${activeTab === "customize" ? classes.navItemActive : ""}`}
              onClick={() => setActiveTab("customize")}
            >
              Customize
            </button>
          </div>
        </div>

        {/* Right Content Pane */}
        <div className={classes.content}>
          <div className={classes.contentBody}>
            {activeTab === "projects" && (
              <div className={classes.tabProjects}>
                {recents.length > 0 && (
                  <div className={classes.recentHeader}>
                    <div className={classes.searchBox}>
                      <IconSearch size={14} className={classes.searchIcon} />
                      <input
                        type="text"
                        placeholder="Search recent workspaces..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={classes.searchInput}
                      />
                    </div>
                    <div className={classes.recentActions}>
                      <button
                        onClick={() => setIsNewWsOpen(true)}
                        className={classes.primaryActionBtn}
                        title="New Workspace"
                      >
                        <IconPlus size={16} stroke={2} />
                        <span>New Workspace</span>
                      </button>
                      <button
                        onClick={handleOpenFolderDirect}
                        className={classes.secondaryActionBtn}
                        title="Open Workspace"
                      >
                        <IconFolder size={16} stroke={1.5} />
                        <span>Open</span>
                      </button>
                      <button
                        onClick={() => setIsCloneOpen(true)}
                        className={classes.secondaryActionBtn}
                        title="Clone Repository"
                      >
                        <IconGitBranch size={16} stroke={1.5} />
                        <span>Clone</span>
                      </button>
                    </div>
                  </div>
                )}

                {recents.length > 0 ? (
                  // Non-empty recents list state
                  <div className={classes.recentContainer}>
                    <div className={classes.recentScrollList}>
                      {filteredRecents.length > 0 ? (
                        <ul className={classes.workspaceList}>
                          {filteredRecents.map((path) => {
                            const { folderName } = parseWorkspacePath(path);
                            return (
                              <li
                                key={path}
                                onClick={() => handleOpenPath(path)}
                                className={classes.workspaceCard}
                              >
                                <div className={classes.cardInfo}>
                                  <span className={classes.cardTitle}>{folderName}</span>
                                  <span className={classes.cardSubtitle}>{path}</span>
                                </div>
                                <button
                                  onClick={(e) => handleRemoveRecent(e, path)}
                                  className={classes.removeBtn}
                                  title="Remove from list"
                                >
                                  <IconX size={14} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className={classes.noResults}>No workspaces matched your search.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Empty state
                  <div className={classes.emptyState}>
                    <div className={classes.emptyMessage}>
                      <h2>Welcome to AetherAPI</h2>
                      <p>
                        Create a new workspace to start from scratch or open an existing repository.
                      </p>
                    </div>
                    <div className={classes.emptyActionCards}>
                      <div className={classes.actionCard} onClick={() => setIsNewWsOpen(true)}>
                        <div
                          className={classes.actionCardIcon}
                          style={{ background: "rgba(99, 102, 241, 0.15)", color: "#6366f1" }}
                        >
                          <IconPlus size={24} stroke={2} />
                        </div>
                        <h3>New Workspace</h3>
                        <p>Start a clean API workspace template from scratch</p>
                      </div>

                      <div className={classes.actionCard} onClick={handleOpenFolderDirect}>
                        <div
                          className={classes.actionCardIcon}
                          style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}
                        >
                          <IconFolder size={24} stroke={1.5} />
                        </div>
                        <h3>Open</h3>
                        <p>Open an existing workspace folder from your disk</p>
                      </div>

                      <div className={classes.actionCard} onClick={() => setIsCloneOpen(true)}>
                        <div
                          className={classes.actionCardIcon}
                          style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}
                        >
                          <IconGitBranch size={24} stroke={1.5} />
                        </div>
                        <h3>Clone Repository</h3>
                        <p>Pull files down from GitHub, GitLab, or raw URL</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "customize" && (
              <div className={classes.tabCustomize}>
                <div className={classes.customizeHeader}>
                  <div>
                    <h2>Customize AetherAPI</h2>
                    <p className={classes.sectionDesc}>
                      Configure global layout and application properties.
                    </p>
                  </div>
                </div>
                <div className={classes.customizeBody}>
                  <div className={classes.settingsGroup}>
                    {/* Card 1: Appearance */}
                    <div className={classes.settingsCard}>
                      <h3 className={classes.settingsCardTitle}>Appearance</h3>

                      <div className={classes.settingsRow}>
                        <div className={classes.rowLabel}>
                          <h4>UI Font Size</h4>
                          <span>Adjust scale of interface buttons, trees, and labels.</span>
                        </div>
                        <select
                          value={config.uiFontSize}
                          onChange={(e) => updateConfig({ uiFontSize: parseInt(e.target.value) })}
                          className={classes.settingsSelect}
                        >
                          <option value="12">12px (Small)</option>
                          <option value="13">13px (Default)</option>
                          <option value="14">14px (Medium)</option>
                          <option value="15">15px (Large)</option>
                          <option value="16">16px (Extra Large)</option>
                        </select>
                      </div>

                      <div className={classes.settingsRow}>
                        <div className={classes.rowLabel}>
                          <h4>Editor Font Size</h4>
                          <span>Adjust size of Monaco editor and text areas.</span>
                        </div>
                        <select
                          value={config.fontSize}
                          onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) })}
                          className={classes.settingsSelect}
                        >
                          <option value="12">12px</option>
                          <option value="13">13px</option>
                          <option value="14">14px</option>
                          <option value="15">15px</option>
                          <option value="16">16px</option>
                        </select>
                      </div>
                    </div>

                    {/* Card 2: Workspace Storage */}
                    <div className={classes.settingsCard}>
                      <h3 className={classes.settingsCardTitle}>Workspace Storage</h3>

                      <div className={classes.settingsRow}>
                        <div className={classes.rowLabel}>
                          <h4>Default Parent Location</h4>
                          <span>Pre-filled destination path for new workspace scaffolds.</span>
                        </div>
                        <div className={classes.locationPicker}>
                          <input
                            type="text"
                            readOnly
                            placeholder="No directory selected"
                            value={config.defaultParentDirectory || ""}
                            className={classes.locationInput}
                          />
                          <button
                            onClick={async () => {
                              const selected = await openDialog({
                                directory: true,
                                multiple: false,
                              });
                              if (selected) {
                                const path = Array.isArray(selected) ? selected[0] : selected;
                                if (path) {
                                  updateConfig({ defaultParentDirectory: path });
                                  setNewWsParent(path);
                                  setCloneDest(path);
                                }
                              }
                            }}
                            className={classes.pickerBtn}
                          >
                            Choose...
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={classes.contentFooter}>
            <span className={classes.copyright}>Hephaestus Studio © 2026</span>
          </div>
        </div>
      </div>

      {/* New Workspace Dialog Modal */}
      {isNewWsOpen && (
        <div className={classes.modalOverlay} onClick={() => setIsNewWsOpen(false)}>
          <div className={classes.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>Create New Workspace</h3>
              <button onClick={() => setIsNewWsOpen(false)} className={classes.modalCloseBtn}>
                <IconX size={16} />
              </button>
            </div>
            <div className={classes.modalBody}>
              <div className={classes.formField}>
                <label>Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. my-awesome-workspace"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className={classes.modalInput}
                  autoFocus
                />
              </div>
              <div className={classes.formField}>
                <label>Parent Location</label>
                <div className={classes.locationPicker}>
                  <input
                    type="text"
                    placeholder="Select parent folder (e.g. ~/Workspaces)"
                    value={newWsParent}
                    onChange={(e) => setNewWsParent(e.target.value)}
                    className={classes.locationInput}
                  />
                  <button
                    onClick={() => handleSelectParentFolder("new")}
                    className={classes.pickerBtn}
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>
            <div className={classes.modalFooter}>
              <button onClick={() => setIsNewWsOpen(false)} className={classes.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!newWsName.trim() || !newWsParent.trim()}
                className={classes.confirmBtn}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Repository Dialog Modal */}
      {isCloneOpen && (
        <div className={classes.modalOverlay} onClick={() => !isCloning && setIsCloneOpen(false)}>
          <div className={classes.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={classes.modalHeader}>
              <h3>Clone Repository</h3>
              {!isCloning && (
                <button onClick={() => setIsCloneOpen(false)} className={classes.modalCloseBtn}>
                  <IconX size={16} />
                </button>
              )}
            </div>
            <div className={classes.modalBody}>
              {!isCloning ? (
                <>
                  <div className={classes.formField}>
                    <label>Git Repository URL</label>
                    <input
                      type="text"
                      placeholder="e.g. https://github.com/org/repo.git"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className={classes.modalInput}
                      autoFocus
                    />
                  </div>
                  <div className={classes.formField}>
                    <label>Destination Folder</label>
                    <div className={classes.locationPicker}>
                      <input
                        type="text"
                        placeholder="Select destination folder (e.g. ~/Workspaces)"
                        value={cloneDest}
                        onChange={(e) => setCloneDest(e.target.value)}
                        className={classes.locationInput}
                      />
                      <button
                        onClick={() => handleSelectParentFolder("clone")}
                        className={classes.pickerBtn}
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={classes.cloneProgressWrapper}>
                  <div className={classes.progressLabelRow}>
                    <span>Cloning repository...</span>
                    <span>{cloningProgress}%</span>
                  </div>
                  <div className={classes.progressBar}>
                    <div
                      className={classes.progressFill}
                      style={{ width: `${cloningProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className={classes.modalFooter}>
              {!isCloning && (
                <>
                  <button onClick={() => setIsCloneOpen(false)} className={classes.cancelBtn}>
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmClone}
                    disabled={!repoUrl.trim() || !cloneDest.trim()}
                    className={classes.confirmBtn}
                  >
                    Clone
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
