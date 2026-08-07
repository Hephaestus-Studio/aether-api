import { useState } from "react";
import { Box, Title, Group, ActionIcon, Modal, TextInput, Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import FileTree from "@/components/explorer/FileTree";
import EnvEditor from "@/components/environment/EnvEditor";
import GitStatus from "@/components/tools/GitStatus";
import classes from "./Sidebar.module.css";

export default function Sidebar() {
  const activeView = useWorkspaceStore((s) => s.activeView);
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
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    }
  };

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Group justify="space-between" align="center">
          <Title order={6} className={classes.title}>
            {activeView}
          </Title>
          {activeView === "explorer" && (
            <ActionIcon
              onClick={() => setModalOpened(true)}
              variant="subtle"
              size="sm"
              aria-label="Create Collection"
            >
              <IconPlus size={16} />
            </ActionIcon>
          )}
        </Group>
      </Box>
      <Box className={classes.body}>
        {activeView === "explorer" && <FileTree />}
        {activeView === "environment" && <EnvEditor />}
        {activeView === "git" && <GitStatus />}
        {activeView === "settings" && (
          <Box className={classes.settingsText}>Workspace and layout configs</Box>
        )}
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
