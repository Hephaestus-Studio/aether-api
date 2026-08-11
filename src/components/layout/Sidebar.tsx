import { useState } from "react";
import { Box, Group, ActionIcon, Modal, TextInput, Button } from "@mantine/core";
import {
  IconFolderPlus,
  IconRefresh,
  IconFold,
  IconDots,
  IconChevronDown,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import FileTree from "@/components/explorer/FileTree";
import EnvEditor from "@/components/environment/EnvEditor";
import type { WorkspaceTree } from "@/types/workspace";
import classes from "./Sidebar.module.css";

export default function Sidebar() {
  const { activeView, workspacePath, setTreeData } = useWorkspaceStore();
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

  const getTitle = () => {
    switch (activeView) {
      case "explorer":
        return "Explorer";
      case "environment":
        return "Environments";
      default:
        return activeView;
    }
  };

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Group justify="space-between" align="center" style={{ width: "100%" }}>
          <span className={classes.title}>{getTitle()}</span>
          <ActionIcon variant="subtle" size="sm" className={classes.actionIcon}>
            <IconDots size={16} />
          </ActionIcon>
        </Group>
      </Box>

      {activeView === "explorer" && workspacePath && (
        <Box className={classes.sectionHeader}>
          <Group justify="space-between" align="center" style={{ width: "100%" }} gap={0}>
            <Group gap={4} className={classes.sectionHeaderLeft}>
              <IconChevronDown size={14} className={classes.chevronIcon} />
              <span className={classes.sectionTitle}>{getFolderName()}</span>
            </Group>
            <Group gap={2} className={classes.actionsGroup}>
              <ActionIcon
                onClick={() => setModalOpened(true)}
                variant="subtle"
                size="sm"
                className={classes.actionIcon}
                title="New Collection"
              >
                <IconFolderPlus size={14} />
              </ActionIcon>
              <ActionIcon
                onClick={handleRefresh}
                variant="subtle"
                size="sm"
                className={classes.actionIcon}
                title="Refresh Explorer"
              >
                <IconRefresh size={14} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={classes.actionIcon}
                title="Collapse Folders"
              >
                <IconFold size={14} />
              </ActionIcon>
            </Group>
          </Group>
        </Box>
      )}

      <Box className={classes.body}>
        {activeView === "explorer" && <FileTree />}
        {activeView === "environment" && <EnvEditor />}
      </Box>

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
