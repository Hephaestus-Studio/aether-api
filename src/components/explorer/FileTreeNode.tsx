import { useState } from "react";
import { Box, Group, Text, Menu, UnstyledButton, Modal, TextInput, Button } from "@mantine/core";
import {
  IconFolder,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconSettings,
} from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceTreeNode } from "@/types/workspace";
import classes from "./FileTreeNode.module.css";

interface FileTreeNodeProps {
  node: WorkspaceTreeNode;
}

export default function FileTreeNode({ node }: Readonly<FileTreeNodeProps>) {
  const [expanded, setExpanded] = useState(false);
  const [modalType, setModalType] = useState<"newFolder" | "rename" | "delete" | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const openTab = useTabStore((s) => s.openTab);
  const isFolder = node.nodeType === "collection" || node.nodeType === "folder";
  const { gitStatus, workspacePath, setTreeData } = useWorkspaceStore();

  const getNodeGitStatus = () => {
    if (!gitStatus || !gitStatus.modifiedFiles) return null;

    // Check exact match (for files)
    const exact = gitStatus.modifiedFiles.find((f) => f && f.path === node.id);
    if (exact) return exact.status;

    // Check if children match (for directories)
    if (isFolder) {
      const hasModifiedChildren = gitStatus.modifiedFiles.some(
        (f) => f && f.path && f.path.startsWith(node.id + "/"),
      );
      if (hasModifiedChildren) {
        return "modified";
      }
    }
    return null;
  };

  const getGitColor = (status: string | null) => {
    switch (status) {
      case "modified":
        return "var(--mantine-color-yellow-5)";
      case "untracked":
      case "added":
        return "var(--mantine-color-green-5)";
      default:
        return "var(--text-primary)";
    }
  };

  const getChevron = () => {
    if (!isFolder) {
      return <Box className={classes.indentPlaceholder} />;
    }
    return expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />;
  };

  const getMethodColor = (method?: string) => {
    const m = (method || "GET").toUpperCase();
    switch (m) {
      case "GET":
        return "#2ec4b6";
      case "POST":
        return "#ff9f1c";
      case "PUT":
        return "#3a86c8";
      case "PATCH":
        return "#8338ec";
      case "DELETE":
        return "#e63946";
      default:
        return "#9ca3af";
    }
  };

  const getMethodText = (method?: string) => {
    const m = (method || "GET").toUpperCase();
    if (m === "DELETE") return "DEL";
    return m;
  };

  const getIcon = () => {
    switch (node.nodeType) {
      case "collection":
        return expanded ? (
          <IconFolderOpen size={16} color="var(--mantine-color-indigo-4)" />
        ) : (
          <IconFolder size={16} color="var(--mantine-color-indigo-4)" />
        );
      case "folder":
        return expanded ? <IconFolderOpen size={16} /> : <IconFolder size={16} />;
      case "request":
        return (
          <span className={classes.methodTag} style={{ color: getMethodColor(node.method) }}>
            {getMethodText(node.method)}
          </span>
        );
      default:
        return <IconSettings size={16} />;
    }
  };

  const handleNodeClick = () => {
    if (node.nodeType === "request") {
      openTab({
        id: node.path,
        name: node.name,
        method: node.method || "GET",
        isDirty: false,
      });
    } else {
      setExpanded(!expanded);
    }
  };

  const nodeGitStatus = getNodeGitStatus();

  const handleNewRequest = async () => {
    try {
      let baseName = "New Request";
      let count = 0;
      let cleanName = baseName;

      const childrenNames = node.children?.map((c) => c.name.toLowerCase()) || [];
      while (
        childrenNames.includes(cleanName.toLowerCase()) ||
        childrenNames.includes(`${cleanName.toLowerCase()}.yml`)
      ) {
        count++;
        cleanName = `${baseName} ${count}`;
      }

      const cleanFilename = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, "_") + ".yml";
      const relativeFilePath = `${node.id}/${cleanFilename}`;

      const defaultRequestDetails = {
        schemaVersion: "1.0.0",
        type: "request",
        name: cleanName,
        description: null,
        seq: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        method: "GET",
        url: "",
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none" },
        settings: {
          timeoutMs: 30000,
          followRedirects: true,
          maxRedirects: 10,
          verifySsl: true,
        },
      };

      await invoke("update_request", {
        path: relativeFilePath,
        requestDetails: defaultRequestDetails,
      });

      if (workspacePath) {
        const tree = await invoke<any>("open_workspace", { directoryPath: workspacePath });
        setTreeData(tree.children);
      }

      const normalizedWorkspace = workspacePath || "";
      const absolutePath = normalizedWorkspace.endsWith("/")
        ? `${normalizedWorkspace}${relativeFilePath}`
        : `${normalizedWorkspace}/${relativeFilePath}`;

      openTab({
        id: absolutePath,
        name: cleanName,
        method: "GET",
        isDirty: false,
      });

      setExpanded(true);
    } catch (err: any) {
      console.error("Failed to auto-create request:", err);
      alert(err.message || String(err));
    }
  };

  const handleNewFolder = () => {
    setModalType("newFolder");
    setInputValue("");
    setError("");
  };

  const handleRename = () => {
    setModalType("rename");
    setInputValue(node.name.replace(/\.(yml|yaml|json)$/i, ""));
    setError("");
  };

  const handleDelete = () => {
    setModalType("delete");
    setInputValue("");
    setError("");
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "newFolder":
        return "Create New Folder";
      case "rename":
        return "Rename Item";
      case "delete":
        return "Confirm Delete";
      default:
        return "";
    }
  };

  const getInputLabel = () => {
    switch (modalType) {
      case "newFolder":
        return "Folder Name";
      case "rename":
        return "New Name";
      default:
        return "";
    }
  };

  const getInputPlaceholder = () => {
    switch (modalType) {
      case "newFolder":
        return "e.g., auth, products";
      case "rename":
        return "e.g., New Name";
      default:
        return "";
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType !== "delete" && !inputValue.trim()) return;

    try {
      const cleanInput = inputValue.trim();

      if (modalType === "newFolder") {
        await invoke("create_folder", {
          parentPath: node.id,
          name: cleanInput,
        });
      } else if (modalType === "rename") {
        await invoke("rename_item", {
          path: node.id,
          newName: cleanInput,
        });
      } else if (modalType === "delete") {
        await invoke("delete_item", {
          path: node.id,
        });
      }

      setModalType(null);
      setInputValue("");
      setError("");

      if (workspacePath) {
        const tree = await invoke<any>("open_workspace", { directoryPath: workspacePath });
        setTreeData(tree.children);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    }
  };

  return (
    <Box className={classes.nodeWrapper}>
      <Menu position="bottom-start" withinPortal>
        <Menu.ContextMenu>
          <UnstyledButton onClick={handleNodeClick} className={classes.button}>
            <Group gap={6}>
              {getChevron()}
              {getIcon()}
              <Text className={classes.label} style={{ color: getGitColor(nodeGitStatus) }}>
                {node.name.replace(/\.(yml|yaml|json)$/i, "")}
              </Text>
            </Group>
            {!isFolder && nodeGitStatus && (
              <Text
                size="10px"
                style={{
                  color: getGitColor(nodeGitStatus),
                  fontWeight: 600,
                  paddingRight: 4,
                }}
              >
                {nodeGitStatus === "untracked" ? "U" : "M"}
              </Text>
            )}
          </UnstyledButton>
        </Menu.ContextMenu>
        <Menu.Dropdown>
          {isFolder && (
            <>
              <Menu.Item onClick={handleNewRequest}>New Request</Menu.Item>
              <Menu.Item onClick={handleNewFolder}>New Folder</Menu.Item>
            </>
          )}
          <Menu.Item onClick={handleRename}>Rename</Menu.Item>
          <Menu.Item onClick={handleDelete} color="red">
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {isFolder && expanded && node.children && (
        <Box className={classes.childrenContainer}>
          {node.children.map((child) => (
            <FileTreeNode key={child.id} node={child} />
          ))}
        </Box>
      )}

      <Modal
        opened={modalType !== null}
        onClose={() => {
          setModalType(null);
          setInputValue("");
          setError("");
        }}
        title={getModalTitle()}
        centered
        size="sm"
      >
        <form onSubmit={handleModalSubmit}>
          {modalType !== "delete" ? (
            <TextInput
              label={getInputLabel()}
              placeholder={getInputPlaceholder()}
              value={inputValue}
              onChange={(e) => setInputValue(e.currentTarget.value)}
              error={error}
              data-autofocus
              required
            />
          ) : (
            <Text size="sm" mb="md">
              Are you sure you want to delete{" "}
              <strong>{node.name.replace(/\.(yml|yaml|json)$/i, "")}</strong>? This action cannot be
              undone.
            </Text>
          )}
          {modalType === "delete" && error && (
            <Text color="red" size="xs" mt="xs">
              {error}
            </Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setModalType(null);
                setInputValue("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" color={modalType === "delete" ? "red" : "blue"}>
              {modalType === "delete" ? "Delete" : "Save"}
            </Button>
          </Group>
        </form>
      </Modal>
    </Box>
  );
}
