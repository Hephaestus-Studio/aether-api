import { Tooltip } from "@mantine/core";
import { IconFolders, IconGitBranch } from "@tabler/icons-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useGitStore } from "@/stores/gitStore";
import classes from "./ActivityBar.module.css";

interface ActivityBarProps {
  sidebarOpened: boolean;
  setSidebarOpened: (opened: boolean | ((prev: boolean) => boolean)) => void;
}

export default function ActivityBar({
  sidebarOpened,
  setSidebarOpened,
}: Readonly<ActivityBarProps>) {
  const activeView = useWorkspaceStore((s) => s.activeView);
  const setActiveView = useWorkspaceStore((s) => s.setActiveView);

  const gitStatus = useGitStore((s) => s.status);
  const totalGitChanges =
    (gitStatus?.stagedFiles?.length || 0) +
    (gitStatus?.unstagedFiles?.length || 0) +
    (gitStatus?.untrackedFiles?.length || 0) +
    (gitStatus?.conflictedFiles?.length || 0);

  const hasConflicts = (gitStatus?.conflictedFiles?.length || 0) > 0;

  const handleTabClick = (view: "explorer" | "git") => {
    if (sidebarOpened && activeView === view) {
      // Toggle / collapse primary sidebar if clicking already active tab
      setSidebarOpened(false);
    } else {
      setActiveView(view);
      setSidebarOpened(true);
    }
  };

  return (
    <aside className={classes.activityRail} aria-label="Activity Bar">
      <div className={classes.topGroup}>
        {/* Explorer Icon */}
        <Tooltip label="Explorer" position="right" withArrow transitionProps={{ duration: 150 }}>
          <button
            type="button"
            className={`${classes.railButton} ${sidebarOpened && activeView === "explorer" ? classes.activeButton : ""}`}
            onClick={() => handleTabClick("explorer")}
            aria-label="Explorer"
          >
            {sidebarOpened && activeView === "explorer" && (
              <div className={classes.activeIndicator} />
            )}
            <IconFolders size={22} stroke={1.6} />
          </button>
        </Tooltip>

        {/* Source Control Icon */}
        <Tooltip
          label={
            hasConflicts
              ? `Source Control (${gitStatus?.conflictedFiles.length} Conflicts)`
              : `Source Control ${totalGitChanges > 0 ? `(${totalGitChanges} changes)` : ""}`
          }
          position="right"
          withArrow
          transitionProps={{ duration: 150 }}
        >
          <button
            type="button"
            className={`${classes.railButton} ${sidebarOpened && activeView === "git" ? classes.activeButton : ""}`}
            onClick={() => handleTabClick("git")}
            aria-label="Source Control"
          >
            {sidebarOpened && activeView === "git" && <div className={classes.activeIndicator} />}
            <IconGitBranch size={22} stroke={1.6} />
            {totalGitChanges > 0 && (
              <span className={`${classes.badge} ${hasConflicts ? classes.conflictBadge : ""}`}>
                {hasConflicts ? "!" : totalGitChanges > 99 ? "99+" : totalGitChanges}
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      <div className={classes.bottomGroup} />
    </aside>
  );
}
