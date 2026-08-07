import { Box, Tooltip, UnstyledButton, Stack } from "@mantine/core";
import { IconFolders, IconWorld, IconGitBranch, IconSettings } from "@tabler/icons-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import classes from "./ActivityBar.module.css";

interface ActivityBarProps {
  activeView: "explorer" | "environment" | "git" | "settings";
  sidebarOpened: boolean;
  setSidebarOpened: (opened: boolean) => void;
}

export default function ActivityBar({
  activeView,
  sidebarOpened,
  setSidebarOpened,
}: Readonly<ActivityBarProps>) {
  const setActiveView = useWorkspaceStore((s) => s.setActiveView);

  const views = [
    { id: "explorer" as const, label: "Explorer", icon: IconFolders },
    { id: "environment" as const, label: "Environments", icon: IconWorld },
    { id: "git" as const, label: "Git Control", icon: IconGitBranch },
    { id: "settings" as const, label: "Settings", icon: IconSettings },
  ];

  const handleTabClick = (viewId: "explorer" | "environment" | "git" | "settings") => {
    if (activeView === viewId && sidebarOpened) {
      setSidebarOpened(false);
    } else {
      setActiveView(viewId);
      setSidebarOpened(true);
    }
  };

  return (
    <Box className={classes.container}>
      <Stack gap={12} className={classes.stack}>
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id && sidebarOpened;

          return (
            <Tooltip key={v.id} label={v.label} position="right" withArrow>
              <UnstyledButton
                onClick={() => handleTabClick(v.id)}
                className={`${classes.button} ${isActive ? classes.buttonActive : ""}`}
              >
                <Icon size={20} stroke={1.5} />
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
