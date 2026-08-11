import { Box } from "@mantine/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import FileTreeNode from "./FileTreeNode";

export default function FileTree() {
  const treeData = useWorkspaceStore((s) => s.treeData);

  // Find the "collections" folder node
  const collectionsNode = treeData?.find((node) => node.name.toLowerCase() === "collections");

  const rootNodes = collectionsNode?.children || [];

  if (rootNodes.length === 0) {
    return (
      <Box
        style={{
          padding: "16px 12px",
          fontSize: "11.5px",
          color: "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        No collections yet. Click the "+" icon at the top of Explorer to create one.
      </Box>
    );
  }

  return (
    <Box style={{ padding: "2px 6px", minWidth: 0, overflowX: "hidden" }}>
      {rootNodes.map((node) => (
        <FileTreeNode key={node.id} node={node} parentNode={collectionsNode} />
      ))}
    </Box>
  );
}
