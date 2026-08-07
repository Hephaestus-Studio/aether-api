import { useState } from "react";
import { Box, Group, Text, Menu, UnstyledButton } from "@mantine/core";
import {
  IconFolder,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconFileCode,
  IconSettings,
} from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { WorkspaceTreeNode } from "@/types/workspace";
import classes from "./FileTreeNode.module.css";

interface FileTreeNodeProps {
  node: WorkspaceTreeNode;
}

export default function FileTreeNode({ node }: Readonly<FileTreeNodeProps>) {
  const [expanded, setExpanded] = useState(false);
  const openTab = useTabStore((s) => s.openTab);
  const isFolder = node.nodeType === "collection" || node.nodeType === "folder";
  const gitStatus = useWorkspaceStore((s) => s.gitStatus);

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
        return <IconFileCode size={16} color="var(--color-get)" />;
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

  return (
    <Box className={classes.nodeWrapper}>
      <Menu position="bottom-start" withinPortal>
        <Menu.ContextMenu>
          <UnstyledButton onClick={handleNodeClick} className={classes.button}>
            <Group gap={6}>
              {getChevron()}
              {getIcon()}
              <Text className={classes.label} style={{ color: getGitColor(nodeGitStatus) }}>
                {node.name}
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
              <Menu.Item>New Request</Menu.Item>
              <Menu.Item>New Folder</Menu.Item>
            </>
          )}
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item color="red">Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {isFolder && expanded && node.children && (
        <Box className={classes.childrenContainer}>
          {node.children.map((child) => (
            <FileTreeNode key={child.id} node={child} />
          ))}
        </Box>
      )}
    </Box>
  );
}
