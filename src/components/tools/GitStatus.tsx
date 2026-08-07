import { useWorkspaceStore } from "@/stores/workspaceStore";
import { Box, Group, Text, Badge } from "@mantine/core";

export default function GitStatus() {
  const gitStatus = useWorkspaceStore((s) => s.gitStatus);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case "modified":
        return "yellow";
      case "untracked":
        return "blue";
      case "added":
        return "green";
      case "deleted":
        return "red";
      default:
        return "gray";
    }
  };

  if (!gitStatus) {
    return (
      <Box style={{ padding: 12, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
        No git repository detected or loaded.
      </Box>
    );
  }

  const branchName = gitStatus.branchName || "main";
  const modifiedFiles = gitStatus.modifiedFiles || [];

  return (
    <Box style={{ padding: "0 12px" }}>
      <Box mb={16}>
        <Text size="xs" style={{ color: "var(--text-muted)" }}>
          Active Branch: <strong style={{ color: "var(--text-primary)" }}>{branchName}</strong>
        </Text>
      </Box>
      {modifiedFiles.length === 0 ? (
        <Text size="xs" style={{ color: "var(--text-muted)" }}>
          No changes detected.
        </Text>
      ) : (
        modifiedFiles.map((file) => (
          <Box key={file.path} style={{ padding: "6px 8px", borderRadius: 4 }} mb={4}>
            <Group justify="space-between">
              <Text size="xs" style={{ color: "var(--text-primary)" }}>
                {file.path}
              </Text>
              <Badge size="xs" color={getBadgeColor(file.status)}>
                {file.status[0].toUpperCase()}
              </Badge>
            </Group>
          </Box>
        ))
      )}
    </Box>
  );
}
