import { Menu } from "@mantine/core";
import { IconWorld } from "@tabler/icons-react";
import { useEnvStore } from "@/stores/envStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import classes from "./StatusBar.module.css";

export default function StatusBar() {
  const { environments, activeEnvironmentName, setActiveEnvironment } = useEnvStore();
  const { workspacePath } = useWorkspaceStore();
  const activeTabId = useTabStore((s) => s.activeTabId);

  return (
    <div className={classes.bar}>
      <div className={classes.leftGroup}>
        <span className={classes.mutedText}>Ready</span>
      </div>

      <div className={classes.rightGroup}>
        {workspacePath && (
          <Menu position="top-end" withinPortal>
            <Menu.Target>
              <button className={classes.envBtn}>
                <IconWorld size={12} />
                <span className={classes.envText}>{activeEnvironmentName || "No Environment"}</span>
              </button>
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
        )}
        {activeTabId && <span className={classes.mutedText}>UTF-8</span>}
      </div>
    </div>
  );
}
