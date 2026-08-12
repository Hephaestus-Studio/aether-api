import { Tooltip, UnstyledButton } from "@mantine/core";
import { IconFolders } from "@tabler/icons-react";
import classes from "./ActivityBar.module.css";

interface ActivityBarProps {
  setSidebarOpened: (opened: boolean | ((prev: boolean) => boolean)) => void;
}

export default function ActivityBar({ setSidebarOpened }: Readonly<ActivityBarProps>) {
  return (
    <Tooltip label="Show Explorer" position="right" withArrow>
      <UnstyledButton onClick={() => setSidebarOpened(true)} className={classes.collapsedStrip}>
        <IconFolders size={13} className={classes.collapsedIcon} />
        <span className={classes.verticalText}>EXPLORER</span>
      </UnstyledButton>
    </Tooltip>
  );
}
