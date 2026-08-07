import { useState } from "react";
import { Box, Title, Text, Button, Stack, List } from "@mantine/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import classes from "./WelcomeScreen.module.css";

export default function WelcomeScreen() {
  const { open } = useWorkspace();
  const [recents, setRecents] = useState<string[]>(() => {
    const saved = localStorage.getItem("recent_workspaces");
    return saved ? JSON.parse(saved) : [];
  });

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

  const handleScaffoldTemplate = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Folder to Scaffold Workspace",
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (path) {
          await handleOpenPath(path);
        }
      }
    } catch (err) {
      console.error("Failed to open scaffold folder selector:", err);
    }
  };

  return (
    <Box className={classes.container}>
      <Stack align="center" gap={8} mb={32}>
        <Title order={1} className={classes.title}>
          AetherAPI
        </Title>
        <Text size="sm" className={classes.subtitle}>
          OpenCollection based Native GUI Client powered by Tauri & Rust
        </Text>
      </Stack>

      <Stack gap={16} className={classes.buttonGroup} mb={32}>
        <Button onClick={handleOpenFolder} size="md">
          Open Workspace Folder
        </Button>
        <Button variant="default" onClick={handleScaffoldTemplate} size="md">
          Scaffold Workspace Template
        </Button>
      </Stack>

      {recents.length > 0 && (
        <Box className={classes.recentsContainer}>
          <Text className={classes.recentsTitle} mb={12}>
            RECENT WORKSPACES
          </Text>
          <List listStyleType="none" spacing={8}>
            {recents.map((path) => (
              <List.Item
                key={path}
                onClick={() => handleOpenPath(path)}
                className={classes.recentItem}
              >
                {path}
              </List.Item>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
