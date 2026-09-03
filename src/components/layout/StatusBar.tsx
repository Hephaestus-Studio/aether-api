import { useEffect } from "react";
import {
  IconWorld,
  IconTerminal,
  IconGitBranch,
  IconArrowsShuffle,
  IconAlertTriangle,
  IconArrowUp,
  IconArrowDown,
} from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import { useGitStore } from "@/stores/gitStore";
import BranchPickerModal from "@/components/git/BranchPickerModal";
import ConflictResolverModal from "@/components/git/ConflictResolverModal";
import classes from "./StatusBar.module.css";

export default function StatusBar() {
  const bottomPanelOpened = useTabStore((s) => s.bottomPanelOpened);
  const activeBottomPanelTab = useTabStore((s) => s.activeBottomPanelTab);
  const toggleTerminal = useTabStore((s) => s.toggleTerminal);
  const toggleEnvPanel = useTabStore((s) => s.toggleEnvPanel);

  const gitStatus = useGitStore((s) => s.status);
  const isSyncing = useGitStore((s) => s.isSyncing);
  const isBranchModalOpen = useGitStore((s) => s.isBranchModalOpen);
  const setBranchModalOpen = useGitStore((s) => s.setBranchModalOpen);
  const smartSync = useGitStore((s) => s.smartSync);
  const refreshStatus = useGitStore((s) => s.refreshStatus);
  const openConflictResolver = useGitStore((s) => s.openConflictResolver);

  // Poll git status periodically
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(() => {
      refreshStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const isTerminalActive = bottomPanelOpened && activeBottomPanelTab === "terminal";
  const isEnvActive = bottomPanelOpened && activeBottomPanelTab === "environment";

  const hasConflicts = (gitStatus?.conflictedFiles?.length || 0) > 0;

  return (
    <div className={classes.bar}>
      <div className={classes.leftGroup}>
        {/* Git Branch Switcher */}
        {gitStatus && (
          <button
            onClick={() => setBranchModalOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              borderRadius: 3,
              transition: "all 0.15s ease",
            }}
            title="Switch or Create Git Branch"
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <IconGitBranch size={13} style={{ color: "var(--aether-color-primary-base)" }} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{gitStatus.branchName}</span>
          </button>
        )}

        {/* Git Sync Button */}
        {gitStatus && (
          <button
            onClick={() => smartSync()}
            disabled={isSyncing}
            style={{
              background: "none",
              border: "none",
              color: isSyncing ? "var(--aether-color-primary-base)" : "var(--text-muted)",
              cursor: isSyncing ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              borderRadius: 3,
              transition: "all 0.15s ease",
            }}
            title={`Sync with remote (Ahead: ${gitStatus.aheadCount}, Behind: ${gitStatus.behindCount})`}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <IconArrowsShuffle
              size={13}
              style={{
                animation: isSyncing ? "spin 1s linear infinite" : "none",
              }}
            />
            {gitStatus.aheadCount > 0 && (
              <span style={{ fontSize: 10, display: "flex", alignItems: "center" }}>
                <IconArrowUp size={10} />
                {gitStatus.aheadCount}
              </span>
            )}
            {gitStatus.behindCount > 0 && (
              <span style={{ fontSize: 10, display: "flex", alignItems: "center" }}>
                <IconArrowDown size={10} />
                {gitStatus.behindCount}
              </span>
            )}
            {gitStatus.aheadCount === 0 && gitStatus.behindCount === 0 && (
              <span style={{ fontSize: 11 }}>Sync</span>
            )}
          </button>
        )}

        {/* Merge Conflict Alert */}
        {hasConflicts && (
          <button
            onClick={() => {
              if (gitStatus?.conflictedFiles?.[0]) {
                openConflictResolver(gitStatus.conflictedFiles[0].path);
              }
            }}
            style={{
              background: "rgba(255, 107, 107, 0.15)",
              border: "1px solid rgba(255, 107, 107, 0.4)",
              color: "#ff6b6b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 3,
              fontWeight: 600,
              fontSize: 11,
            }}
            title="Resolve merge conflicts"
          >
            <IconAlertTriangle size={13} />
            <span>{gitStatus?.conflictedFiles.length} Conflicts</span>
          </button>
        )}

        {gitStatus && (
          <span
            style={{
              width: 1,
              height: 12,
              backgroundColor: "var(--border-color)",
              margin: "0 4px",
            }}
          />
        )}

        {/* Terminal Toggle */}
        <button
          onClick={toggleTerminal}
          style={{
            background: "none",
            border: "none",
            color: isTerminalActive ? "var(--aether-color-primary-base)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 3,
            transition: "all 0.15s ease",
          }}
          title="Toggle Terminal Panel (Ctrl+`)"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <IconTerminal size={13} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>Terminal</span>
        </button>

        {/* Environments Toggle */}
        <button
          onClick={toggleEnvPanel}
          style={{
            background: "none",
            border: "none",
            color: isEnvActive ? "var(--aether-color-primary-base)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 3,
            transition: "all 0.15s ease",
          }}
          title="Toggle Environments Panel"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <IconWorld size={13} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>Environments</span>
        </button>

        <span
          style={{ width: 1, height: 12, backgroundColor: "var(--border-color)", margin: "0 4px" }}
        />
        <span className={classes.mutedText}>Ready</span>
      </div>

      <div className={classes.rightGroup} />

      {/* Git Global Modals */}
      <BranchPickerModal opened={isBranchModalOpen} onClose={() => setBranchModalOpen(false)} />
      <ConflictResolverModal />
    </div>
  );
}
