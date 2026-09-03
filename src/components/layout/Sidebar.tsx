import { useState } from "react";
import { Box, Group, ActionIcon, Modal, TextInput, Button } from "@mantine/core";
import {
  IconFolderPlus,
  IconRefresh,
  IconFold,
  IconFolderOpen,
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import FileTree from "@/components/explorer/FileTree";
import SourceControlPanel from "@/components/git/SourceControlPanel";
import type { WorkspaceTree } from "@/types/workspace";
import classes from "./Sidebar.module.css";

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: Readonly<SidebarProps>) {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const activeView = useWorkspaceStore((s) => s.activeView);
  const setTreeData = useWorkspaceStore((s) => s.setTreeData);
  const collapseAllCollections = useWorkspaceStore((s) => s.collapseAllCollections);
  const expandAllCollections = useWorkspaceStore((s) => s.expandAllCollections);

  const [modalOpened, setModalOpened] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [error, setError] = useState("");

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      await invoke("create_collection", { name: newCollectionName.trim() });
      setNewCollectionName("");
      setModalOpened(false);
      setError("");
      // Refresh tree
      if (workspacePath) {
        const tree = await invoke<WorkspaceTree>("open_workspace", {
          directoryPath: workspacePath,
        });
        setTreeData(tree.children);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    }
  };

  const handleRefresh = async () => {
    if (workspacePath) {
      try {
        const tree = await invoke<WorkspaceTree>("open_workspace", {
          directoryPath: workspacePath,
        });
        setTreeData(tree.children);
      } catch (err) {
        console.error("Failed to refresh workspace:", err);
      }
    }
  };

  const getFolderName = () => {
    if (!workspacePath) return "";
    const parts = workspacePath.split("/");
    return parts[parts.length - 1] || workspacePath;
  };

  return (
    <Box className={classes.container}>
      {/* Sidebar Panel Header */}
      <Box className={classes.header}>
        <span className={classes.sectionTitle}>
          {activeView === "git" ? "Source Control" : "Explorer"}
        </span>

        {onClose && (
          <ActionIcon
            variant="subtle"
            size="sm"
            className={classes.actionIcon}
            onClick={onClose}
            title="Collapse Sidebar"
          >
            <IconLayoutSidebarLeftCollapse size={15} />
          </ActionIcon>
        )}
      </Box>

      {/* View Content */}
      {activeView === "git" ? (
        <SourceControlPanel onClose={onClose} />
      ) : (
        <>
          {workspacePath && (
            <Box className={classes.sectionHeader}>
              <Group
                justify="space-between"
                align="center"
                style={{ width: "100%", minWidth: 0 }}
                gap={0}
                wrap="nowrap"
              >
                <div className={classes.sectionHeaderLeft}>
                  <IconChevronDown size={14} className={classes.chevronIcon} />
                  <span className={classes.sectionTitle} title={getFolderName()}>
                    {getFolderName()}
                  </span>
                </div>
                <div className={classes.actionsGroup}>
                  <ActionIcon
                    onClick={() => setModalOpened(true)}
                    variant="subtle"
                    size="xs"
                    className={classes.actionIcon}
                    title="New Collection"
                  >
                    <IconFolderPlus size={14} />
                  </ActionIcon>
                  <ActionIcon
                    onClick={handleRefresh}
                    variant="subtle"
                    size="xs"
                    className={classes.actionIcon}
                    title="Refresh Explorer"
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                  <ActionIcon
                    onClick={expandAllCollections}
                    variant="subtle"
                    size="xs"
                    className={classes.actionIcon}
                    title="Expand Collections"
                  >
                    <IconFolderOpen size={14} />
                  </ActionIcon>
                  <ActionIcon
                    onClick={collapseAllCollections}
                    variant="subtle"
                    size="xs"
                    className={classes.actionIcon}
                    title="Collapse Collections"
                  >
                    <IconFold size={14} />
                  </ActionIcon>
                </div>
              </Group>
            </Box>
          )}

          <Box className={classes.body}>
            <FileTree />
          </Box>
        </>
      )}

      {/* Modal for Creating Collection */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setNewCollectionName("");
          setError("");
        }}
        title="Create New Collection"
        centered
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateCollection();
          }}
        >
          <TextInput
            label="Collection Name"
            placeholder="e.g., User API, Payments"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.currentTarget.value)}
            error={error}
            data-autofocus
            required
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setModalOpened(false);
                setNewCollectionName("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </Group>
        </form>
      </Modal>
    </Box>
  );
}
