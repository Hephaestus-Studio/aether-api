import { Box } from "@mantine/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import FileTreeNode from "./FileTreeNode";

export default function FileTree() {
  const treeData = useWorkspaceStore((s) => s.treeData);

  if (!treeData || treeData.length === 0) {
    return (
      <Box style={{ padding: 16, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
        No collections yet. Right click to create one.
      </Box>
    );
  }

  return (
    <Box style={{ padding: "0 8px" }}>
      {treeData.map((node) => (
        <FileTreeNode key={node.id} node={node} />
      ))}
    </Box>
  );
}
