import { Menu } from "@mantine/core";
import { IconWorld, IconTerminal } from "@tabler/icons-react";
import { useEnvStore } from "@/stores/envStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import classes from "./StatusBar.module.css";

export default function StatusBar() {
  const { environments, activeEnvironmentName, setActiveEnvironment } = useEnvStore();
  const { workspacePath } = useWorkspaceStore();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const terminalOpened = useTabStore((s) => s.terminalOpened);
  const toggleTerminal = useTabStore((s) => s.toggleTerminal);

  return (
    <div className={classes.bar}>
      <div className={classes.leftGroup}>
        <button
          onClick={toggleTerminal}
          style={{
            background: "none",
            border: "none",
            color: terminalOpened ? "var(--aether-color-primary-base)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 3,
            transition: "all 0.15s ease",
          }}
          title="Toggle Terminal"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <IconTerminal size={13} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>Terminal</span>
        </button>
        <span
          style={{ width: 1, height: 12, backgroundColor: "var(--border-color)", margin: "0 8px" }}
        />
        <span className={classes.mutedText}>Ready</span>
      </div>

      <div className={classes.rightGroup}>
        {workspacePath && (
          <Menu position="top-end" withinPortal>
            <Menu.Target>
              <button className={classes.envBtn}>
                <IconWorld size={12} />
                <span className={classes.envText}>
                  {activeEnvironmentName === "global"
                    ? "Global"
                    : activeEnvironmentName || "Global"}
                </span>
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setActiveEnvironment("global")}>Global</Menu.Item>
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
