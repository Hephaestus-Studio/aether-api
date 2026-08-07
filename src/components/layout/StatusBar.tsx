import { Box, Group, Text, Menu, UnstyledButton } from "@mantine/core";
import { IconGitBranch, IconWorld } from "@tabler/icons-react";
import { useEnvStore } from "@/stores/envStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import classes from "./StatusBar.module.css";

export default function StatusBar() {
  const { environments, activeEnvironmentName, setActiveEnvironment } = useEnvStore();
  const gitStatus = useWorkspaceStore((s) => s.gitStatus);
  const branchName = gitStatus?.branchName || "main";

  return (
    <Box className={classes.bar}>
      <Group gap={12} className={classes.leftGroup}>
        <Text className={classes.mutedText}>Ready</Text>
        <UnstyledButton className={classes.gitBtn}>
          <IconGitBranch size={12} style={{ color: "var(--text-muted)" }} />
          <Text size="11px" style={{ color: "var(--text-muted)" }}>
            {branchName}
          </Text>
        </UnstyledButton>
      </Group>

      <Group gap={16} className={classes.rightGroup}>
        <Menu position="top-end" withinPortal>
          <Menu.Target>
            <UnstyledButton className={classes.envBtn}>
              <IconWorld size={12} style={{ color: "var(--text-muted)" }} />
              <Text className={classes.envText}>{activeEnvironmentName || "No Environment"}</Text>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setActiveEnvironment(null)}>No Environment</Menu.Item>
            {environments.map((env) => (
              <Menu.Item key={env.name} onClick={() => setActiveEnvironment(env.name)}>
                {env.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Text className={classes.mutedText}>UTF-8</Text>
      </Group>
    </Box>
  );
}
