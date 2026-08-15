import { IconWorld, IconTerminal } from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import classes from "./StatusBar.module.css";

export default function StatusBar() {
  const bottomPanelOpened = useTabStore((s) => s.bottomPanelOpened);
  const activeBottomPanelTab = useTabStore((s) => s.activeBottomPanelTab);
  const toggleTerminal = useTabStore((s) => s.toggleTerminal);
  const toggleEnvPanel = useTabStore((s) => s.toggleEnvPanel);

  const isTerminalActive = bottomPanelOpened && activeBottomPanelTab === "terminal";
  const isEnvActive = bottomPanelOpened && activeBottomPanelTab === "environment";

  return (
    <div className={classes.bar}>
      <div className={classes.leftGroup}>
        <button
          onClick={toggleTerminal}
          style={{
            background: "none",
            border: "none",
            color: isTerminalActive ? "var(--aether-color-primary-base)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 3,
            transition: "all 0.15s ease",
          }}
          title="Toggle Terminal Panel (Ctrl+`)"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <IconTerminal size={13} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>Terminal</span>
        </button>

        <button
          onClick={toggleEnvPanel}
          style={{
            background: "none",
            border: "none",
            color: isEnvActive ? "var(--aether-color-primary-base)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 3,
            transition: "all 0.15s ease",
          }}
          title="Toggle Environments Panel"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <IconWorld size={13} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>Environments</span>
        </button>

        <span
          style={{ width: 1, height: 12, backgroundColor: "var(--border-color)", margin: "0 4px" }}
        />
        <span className={classes.mutedText}>Ready</span>
      </div>

      <div className={classes.rightGroup} />
    </div>
  );
}
