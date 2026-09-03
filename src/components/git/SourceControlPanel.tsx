import { useState, useEffect } from "react";
import { Box, Group, Text, ActionIcon, Textarea, Button, Tooltip } from "@mantine/core";
import {
  IconRefresh,
  IconPlus,
  IconMinus,
  IconTrash,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
  IconArrowsShuffle,
  IconGitBranch,
} from "@tabler/icons-react";
import { useGitStore } from "@/stores/gitStore";
import type { GitFileInfo } from "@/types/git";
import classes from "./SourceControlPanel.module.css";

interface SourceControlPanelProps {
  onClose?: () => void;
}

export default function SourceControlPanel({
  onClose: _onClose,
}: Readonly<SourceControlPanelProps>) {
  const status = useGitStore((s) => s.status);
  const isLoading = useGitStore((s) => s.isLoading);
  const isSyncing = useGitStore((s) => s.isSyncing);
  const isCommitting = useGitStore((s) => s.isCommitting);
  const error = useGitStore((s) => s.error);
  const refreshStatus = useGitStore((s) => s.refreshStatus);
  const stagePaths = useGitStore((s) => s.stagePaths);
  const unstagePaths = useGitStore((s) => s.unstagePaths);
  const discardChanges = useGitStore((s) => s.discardChanges);
  const commit = useGitStore((s) => s.commit);
  const smartSync = useGitStore((s) => s.smartSync);
  const openConflictResolver = useGitStore((s) => s.openConflictResolver);
  const setBranchModalOpen = useGitStore((s) => s.setBranchModalOpen);

  const [commitMessage, setCommitMessage] = useState("");
  const [stagedCollapsed, setStagedCollapsed] = useState(false);
  const [changesCollapsed, setChangesCollapsed] = useState(false);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      await commit(commitMessage.trim());
      setCommitMessage("");
    } catch (err) {
      console.error("Commit failed:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    }
  };

  const handleDiscard = (filePath: string) => {
    if (
      window.confirm(
        `Are you sure you want to discard all changes in ${filePath}? This action cannot be undone.`,
      )
    ) {
      discardChanges([filePath]);
    }
  };

  const renderStatusBadge = (file: GitFileInfo) => {
    switch (file.status) {
      case "modified":
        return <span className={`${classes.statusCode} ${classes.statusModified}`}>M</span>;
      case "added":
        return <span className={`${classes.statusCode} ${classes.statusAdded}`}>A</span>;
      case "deleted":
        return <span className={`${classes.statusCode} ${classes.statusDeleted}`}>D</span>;
      case "untracked":
        return <span className={`${classes.statusCode} ${classes.statusUntracked}`}>U</span>;
      case "conflicted":
        return <span className={`${classes.statusCode} ${classes.statusConflicted}`}>!</span>;
      default:
        return <span className={classes.statusCode}>{file.status[0].toUpperCase()}</span>;
    }
  };

  if (!status) {
    return (
      <Box className={classes.container} p="md">
        <Text size="xs" c="dimmed" ta="center">
          Not a Git repository or no workspace open.
        </Text>
      </Box>
    );
  }

  const stagedFiles = status.stagedFiles || [];
  const unstagedFiles = [...(status.unstagedFiles || []), ...(status.untrackedFiles || [])];
  const conflictedFiles = status.conflictedFiles || [];

  return (
    <Box className={classes.container}>
      {/* Sub Toolbar: Branch selector + Git Actions */}
      <Box className={classes.toolbar}>
        <button
          type="button"
          className={classes.branchTag}
          onClick={() => setBranchModalOpen(true)}
          title="Switch Branch"
        >
          <IconGitBranch size={13} style={{ color: "var(--aether-color-primary-base, #6366f1)" }} />
          <span>{status.branchName}</span>
        </button>

        <Group gap={4}>
          <Tooltip label="Refresh Status" position="bottom" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => refreshStatus()}
              loading={isLoading}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Sync (Pull & Push)" position="bottom" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => smartSync()}
              loading={isSyncing}
            >
              <IconArrowsShuffle size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      {error && (
        <Box
          p="xs"
          style={{
            backgroundColor: "rgba(255, 68, 68, 0.15)",
            borderBottom: "1px solid rgba(255, 68, 68, 0.3)",
            color: "#ff6b6b",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {error}
        </Box>
      )}

      {/* Commit Box */}
      <Box className={classes.commitSection}>
        <Textarea
          placeholder="Commit message (Ctrl+Enter to commit)"
          minRows={2}
          maxRows={5}
          autosize
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          size="xs"
          mb="xs"
          styles={{
            input: {
              backgroundColor: "rgba(0, 0, 0, 0.35)",
              borderColor: "var(--border-color, #2d2d2d)",
              color: "#ffffff",
              fontSize: 12,
            },
          }}
        />
        <Button
          fullWidth
          size="xs"
          leftSection={<IconCheck size={14} />}
          disabled={stagedFiles.length === 0 || !commitMessage.trim()}
          loading={isCommitting}
          onClick={handleCommit}
          style={{
            backgroundColor: "var(--aether-color-primary-base, #2563eb)",
            color: "#ffffff",
            fontWeight: 600,
          }}
        >
          Commit ({stagedFiles.length})
        </Button>
      </Box>

      {/* Body Lists */}
      <Box className={classes.body}>
        {/* Conflicted Files Section */}
        {conflictedFiles.length > 0 && (
          <Box mb="sm">
            <Box
              p="xs"
              style={{
                backgroundColor: "rgba(255, 107, 107, 0.12)",
                borderLeft: "3px solid #ff6b6b",
                margin: "0 8px 8px 8px",
                borderRadius: 4,
              }}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <IconAlertTriangle size={15} color="#ff6b6b" />
                  <Text size="xs" fw={700} c="red">
                    Merge Conflicts ({conflictedFiles.length})
                  </Text>
                </Group>
              </Group>
            </Box>

            {conflictedFiles.map((file) => (
              <Box
                key={file.path}
                className={classes.fileItem}
                onClick={() => openConflictResolver(file.path)}
                style={{ backgroundColor: "rgba(255, 107, 107, 0.06)" }}
              >
                <Group gap="xs" style={{ minWidth: 0 }}>
                  {renderStatusBadge(file)}
                  <span className={classes.filePath} style={{ color: "#ff8787", fontWeight: 600 }}>
                    {file.path}
                  </span>
                </Group>
                <Button size="compact-xs" variant="filled" color="red">
                  Resolve
                </Button>
              </Box>
            ))}
          </Box>
        )}

        {/* Staged Changes Section */}
        {stagedFiles.length > 0 && (
          <Box mb="xs">
            <Box
              className={classes.sectionHeader}
              onClick={() => setStagedCollapsed((prev) => !prev)}
            >
              <div className={classes.sectionHeaderTitle}>
                {stagedCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
                <span>STAGED CHANGES</span>
                <span className={classes.countBadge}>{stagedFiles.length}</span>
              </div>

              <Tooltip label="Unstage All Changes" position="left" withArrow>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={(e) => {
                    e.stopPropagation();
                    unstagePaths([]);
                  }}
                >
                  <IconMinus size={13} />
                </ActionIcon>
              </Tooltip>
            </Box>

            {!stagedCollapsed &&
              stagedFiles.map((file) => (
                <Box key={file.path} className={classes.fileItem}>
                  <Group gap="xs" style={{ minWidth: 0 }}>
                    {renderStatusBadge(file)}
                    <span className={classes.filePath} title={file.path}>
                      {file.path}
                    </span>
                  </Group>

                  <div className={classes.fileActions}>
                    <Tooltip label="Unstage Change" position="left" withArrow>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => unstagePaths([file.path])}
                      >
                        <IconMinus size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </Box>
              ))}
          </Box>
        )}

        {/* Changes (Unstaged + Untracked) Section */}
        <Box mb="xs">
          <Box
            className={classes.sectionHeader}
            onClick={() => setChangesCollapsed((prev) => !prev)}
          >
            <div className={classes.sectionHeaderTitle}>
              {changesCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
              <span>CHANGES</span>
              <span className={classes.countBadge}>{unstagedFiles.length}</span>
            </div>

            {unstagedFiles.length > 0 && (
              <Group gap={2}>
                <Tooltip label="Discard All Changes" position="left" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Are you sure you want to discard all changes?")) {
                        discardChanges([]);
                      }
                    }}
                  >
                    <IconTrash size={13} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="Stage All Changes" position="left" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="green"
                    onClick={(e) => {
                      e.stopPropagation();
                      stagePaths([]);
                    }}
                  >
                    <IconPlus size={13} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Box>

          {!changesCollapsed &&
            (unstagedFiles.length === 0 &&
            stagedFiles.length === 0 &&
            conflictedFiles.length === 0 ? (
              <div className={classes.emptyText}>Working tree is clean ✨</div>
            ) : (
              unstagedFiles.map((file) => (
                <Box key={file.path} className={classes.fileItem}>
                  <Group gap="xs" style={{ minWidth: 0 }}>
                    {renderStatusBadge(file)}
                    <span className={classes.filePath} title={file.path}>
                      {file.path}
                    </span>
                  </Group>

                  <div className={classes.fileActions}>
                    <Tooltip label="Discard Changes" position="left" withArrow>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => handleDiscard(file.path)}
                      >
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Tooltip>

                    <Tooltip label="Stage Changes" position="left" withArrow>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="green"
                        onClick={() => stagePaths([file.path])}
                      >
                        <IconPlus size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </Box>
              ))
            ))}
        </Box>
      </Box>
    </Box>
  );
}
