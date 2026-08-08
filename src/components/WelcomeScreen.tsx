import { useState, useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { IconFolder, IconGitBranch, IconBrandGithub } from "@tabler/icons-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import logoUrl from "@/assets/logo.svg";
import StatusBar from "@/components/layout/StatusBar";
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
  const [recents, setRecents] = useState<string[]>(() => {
    const saved = localStorage.getItem("recent_workspaces");
    return saved ? JSON.parse(saved) : [];
  });

  // QuickInput State for Git Clone
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [destFolder, setDestFolder] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [cloningProgress, setCloningProgress] = useState(0);

  const handleOpenPath = async (path: string) => {
    try {
      await open(path);
      setRecents((prev) => {
        const next = [path, ...prev.filter((p) => p !== path)].slice(0, 5);
        localStorage.setItem("recent_workspaces", JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Failed to open workspace:", err);
    }
  };

  const handleOpenFolder = async () => {
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
      console.error("Failed to open folder selector:", err);
    }
  };

  const handleConfirmClone = async () => {
    if (!repoUrl.trim()) return;
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select as Repository Destination",
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (path) {
          setDestFolder(path);
          setIsCloning(true);
          setCloningProgress(0);
        }
      }
    } catch (err) {
      console.error("Failed to select destination folder:", err);
    }
  };

  const handleCloneFromGitHub = () => {
    setRepoUrl("https://github.com/haiphamngoc-dev/ibus-buffalo");
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCloning) {
      interval = setInterval(() => {
        setCloningProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsCloning(false);
            const repoName = getRepoNameFromUrl(repoUrl);
            const finalPath = `${destFolder}/${repoName}`;
            handleOpenPath(finalPath).then(() => {
              setIsQuickInputOpen(false);
              setRepoUrl("");
              setDestFolder("");
            });
            return 100;
          }
          // Increment progress randomly
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 300);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCloning, repoUrl, destFolder]);

  return (
    <div className={classes.container}>
      <div className={classes.content}>
        <div className={classes.logoWrapper}>
          <div className={classes.logo}>
            <img src={logoUrl} alt="AetherAPI Logo" width="56" height="56" />
          </div>
          <h1 className={classes.title}>AetherAPI</h1>
        </div>

        <div className={classes.actionGroup}>
          <button onClick={handleOpenFolder} className={classes.openButton}>
            <IconFolder size={18} stroke={1.5} />
            Open Folder
          </button>

          <button onClick={() => setIsQuickInputOpen(true)} className={classes.cloneLink}>
            <IconGitBranch size={16} stroke={1.5} />
            Clone Repository
          </button>
        </div>

        {recents.length > 0 && (
          <div className={classes.sectionContainer}>
            <div className={classes.sectionHeader}>Workspaces</div>
            <ul className={classes.workspaceList}>
              {recents.map((path) => {
                const { folderName, parentPath } = parseWorkspacePath(path);
                return (
                  <li
                    key={path}
                    onClick={() => handleOpenPath(path)}
                    className={classes.workspaceCard}
                  >
                    <span className={classes.cardTitle}>{folderName}</span>
                    <span className={classes.cardSubtitle}>{parentPath}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div style={{ width: "100%", borderTop: "1px solid var(--border-color)" }}>
        <StatusBar />
      </div>

      {/* QuickInput Clone Dialog Overlay */}
      {isQuickInputOpen && (
        <div
          className={classes.quickInputOverlay}
          onClick={() => {
            if (!isCloning) setIsQuickInputOpen(false);
          }}
        >
          <div className={classes.quickInputContainer} onClick={(e) => e.stopPropagation()}>
            <div className={classes.quickInputBox}>
              <input
                type="text"
                className={classes.quickInputField}
                placeholder="Provide repository URL or pick a repository source."
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isCloning}
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && repoUrl.trim()) {
                    await handleConfirmClone();
                  } else if (e.key === "Escape") {
                    setIsQuickInputOpen(false);
                  }
                }}
              />
            </div>

            {!isCloning ? (
              <ul className={classes.quickInputList}>
                {repoUrl.trim() !== "" && (
                  <li className={classes.quickInputItem} onClick={handleConfirmClone}>
                    <span className={classes.quickInputItemLeft}>
                      Clone from URL <span className={classes.quickInputUrlMuted}>{repoUrl}</span>
                    </span>
                  </li>
                )}
                <li className={classes.quickInputItem} onClick={handleCloneFromGitHub}>
                  <span className={classes.quickInputItemLeft}>
                    <IconBrandGithub size={16} stroke={1.5} />
                    Clone from GitHub
                  </span>
                  <span className={classes.quickInputItemRight}>remote sources</span>
                </li>
              </ul>
            ) : (
              <div className={classes.quickInputProgress}>
                <div className={classes.progressLabelRow}>
                  <span className={classes.progressLabel}>Cloning repository...</span>
                  <span className={classes.progressPercent}>{Math.min(cloningProgress, 100)}%</span>
                </div>
                <div className={classes.progressBar}>
                  <div
                    className={classes.progressFill}
                    style={{ width: `${Math.min(cloningProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
