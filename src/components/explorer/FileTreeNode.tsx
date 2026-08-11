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
import { getMethodColor } from "@/utils/httpMethods";
import clsx from "clsx";
import classes from "./FileTreeNode.module.css";

interface FileTreeNodeProps {
  node: WorkspaceTreeNode;
  parentNode?: WorkspaceTreeNode;
}

let activeDraggedNode: { node: WorkspaceTreeNode; parentNode?: WorkspaceTreeNode } | null = null;

export default function FileTreeNode({ node, parentNode }: Readonly<FileTreeNodeProps>) {
  const [expanded, setExpanded] = useState(false);
  const [modalType, setModalType] = useState<"newFolder" | "rename" | "delete" | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dropPosition, setDropPosition] = useState<"above" | "below" | "inside" | null>(null);
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
      const result = await invoke<{ id: string; path: string; name: string }>("create_request", {
        parentPath: node.id,
        name: "New Request",
      });

      if (workspacePath) {
        const tree = await invoke<any>("open_workspace", { directoryPath: workspacePath });
        setTreeData(tree.children);
      }

      openTab({
        id: result.path,
        name: result.name,
        method: "GET",
        isDirty: false,
      });

      setExpanded(true);
    } catch (err: any) {
      console.error("Failed to auto-create request:", err);
      alert(err.message || String(err));
    }
  };

  const handleDuplicate = async () => {
    try {
      await invoke("duplicate_item", { path: node.id });
      if (workspacePath) {
        const tree = await invoke<any>("open_workspace", { directoryPath: workspacePath });
        setTreeData(tree.children);
      }
    } catch (err: any) {
      console.error("Failed to duplicate request:", err);
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

  const replaceTabId = useTabStore((s) => s.replaceTabId);
  const updateTab = useTabStore((s) => s.updateTab);

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
        const result = await invoke<{ newPath: string }>("rename_item", {
          oldPath: node.id,
          newName: cleanInput,
        });
        // Request files keep their UUID v7 filename (not renamed on disk), only display name updates.
        if (node.nodeType === "request") {
          updateTab(node.path, { name: cleanInput });
        } else if (result.newPath && result.newPath !== node.path) {
          replaceTabId(node.path, result.newPath);
        }
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

  const handleDragStart = (e: React.DragEvent) => {
    activeDraggedNode = { node, parentNode };
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";

    // Create a compact custom drag ghost matching the exact item size
    const dragGhost = document.createElement("div");
    dragGhost.className = classes.dragPreview;

    if (node.nodeType === "request") {
      const methodSpan = document.createElement("span");
      methodSpan.style.color = getMethodColor(node.method);
      methodSpan.style.fontSize = "10px";
      methodSpan.style.fontWeight = "800";
      methodSpan.style.marginRight = "2px";
      methodSpan.innerText = getMethodText(node.method);

      const labelSpan = document.createElement("span");
      labelSpan.style.fontSize = "12px";
      labelSpan.style.color = "var(--text-primary, #ffffff)";
      labelSpan.innerText = node.name.replace(/\.(yml|yaml|json)$/i, "");

      dragGhost.appendChild(methodSpan);
      dragGhost.appendChild(labelSpan);
    } else {
      const labelSpan = document.createElement("span");
      labelSpan.style.fontSize = "12px";
      labelSpan.style.color = "var(--text-primary, #ffffff)";
      labelSpan.innerText = node.name.replace(/\.(yml|yaml|json)$/i, "");
      dragGhost.appendChild(labelSpan);
    }

    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 16, 12);

    setTimeout(() => {
      if (document.body.contains(dragGhost)) {
        document.body.removeChild(dragGhost);
      }
    }, 0);
  };

  const handleDragEnd = () => {
    activeDraggedNode = null;
    setIsDragging(false);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!activeDraggedNode) return;
    const dragged = activeDraggedNode.node;

    if (dragged.id === node.id) return;
    if (
      (dragged.nodeType === "folder" || dragged.nodeType === "collection") &&
      node.id.startsWith(dragged.id + "/")
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (isFolder) {
      if (y < height * 0.25) {
        setDropPosition("above");
      } else if (y > height * 0.75) {
        setDropPosition("below");
      } else {
        setDropPosition("inside");
      }
    } else {
      if (y < height * 0.5) {
        setDropPosition("above");
      } else {
        setDropPosition("below");
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setDropPosition(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const pos = dropPosition;
    setDropPosition(null);

    if (!activeDraggedNode || !pos) return;
    const dragged = activeDraggedNode.node;

    if (dragged.id === node.id) return;
    if (
      (dragged.nodeType === "folder" || dragged.nodeType === "collection") &&
      node.id.startsWith(dragged.id + "/")
    ) {
      return;
    }

    let targetParentPath = "";
    let prevSeq: string | undefined = undefined;
    let nextSeq: string | undefined = undefined;

    if (pos === "inside") {
      targetParentPath = node.id;
      const children = (node.children || []).filter((c) => c.id !== dragged.id);
      if (children.length > 0) {
        prevSeq = children[children.length - 1].seq ?? undefined;
      }
    } else {
      targetParentPath = parentNode?.id || (node.nodeType === "collection" ? "collections" : "");
      const siblings = (parentNode?.children || []).filter((c) => c.id !== dragged.id);
      const targetIdx = siblings.findIndex((s) => s.id === node.id);

      if (targetIdx !== -1) {
        if (pos === "above") {
          prevSeq = targetIdx > 0 ? (siblings[targetIdx - 1].seq ?? undefined) : undefined;
          nextSeq = siblings[targetIdx].seq ?? undefined;
        } else {
          prevSeq = siblings[targetIdx].seq ?? undefined;
          nextSeq =
            targetIdx < siblings.length - 1
              ? (siblings[targetIdx + 1].seq ?? undefined)
              : undefined;
        }
      }
    }

    try {
      const result = await invoke<{ newPath: string; newId: string; newSeq: string }>("move_item", {
        sourcePath: dragged.id,
        targetParentPath,
        prevSeq,
        nextSeq,
      });

      if (result.newPath && result.newPath !== dragged.path) {
        replaceTabId(dragged.path, result.newPath);
      }

      if (pos === "inside") {
        setExpanded(true);
      }

      if (workspacePath) {
        const tree = await invoke<any>("open_workspace", { directoryPath: workspacePath });
        setTreeData(tree.children);
      }
    } catch (err: any) {
      console.error("Failed to move/reorder item:", err);
    } finally {
      activeDraggedNode = null;
      setIsDragging(false);
    }
  };

  return (
    <Box className={classes.nodeWrapper}>
      <Menu position="bottom-start" withinPortal>
        <Menu.ContextMenu>
          <UnstyledButton
            onClick={handleNodeClick}
            className={clsx(
              classes.button,
              isDragging && classes.dragging,
              dropPosition === "above" && classes.dropAbove,
              dropPosition === "below" && classes.dropBelow,
              dropPosition === "inside" && classes.dropInside,
            )}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Group gap={6}>
              {getChevron()}
              {getIcon()}
              <Text className={classes.label} style={{ color: getGitColor(nodeGitStatus) }}>
                {node.name.replace(/\.(yml|yaml|json)$/i, "")}
              </Text>
            </Group>
            {!isFolder && nodeGitStatus && (
              <Text
                className={classes.gitBadge}
                style={{
                  color: getGitColor(nodeGitStatus),
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
          {!isFolder && node.nodeType === "request" && (
            <Menu.Item onClick={handleDuplicate}>Duplicate</Menu.Item>
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
            <FileTreeNode key={child.id} node={child} parentNode={node} />
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
