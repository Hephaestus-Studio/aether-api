import { useState, useEffect, useRef } from "react";
import { Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import classes from "./TerminalPanel.module.css";

interface HistoryItem {
  type: "input" | "stdout" | "stderr" | "info";
  text: string;
}

export default function TerminalPanel() {
  const { workspacePath } = useWorkspaceStore();
  const toggleTerminal = useTabStore((s) => s.toggleTerminal);
  const [terminalCwd, setTerminalCwd] = useState<string>(".");
  const [inputVal, setInputVal] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      type: "info",
      text: "Welcome to Aether API Terminal.\nType standard shell commands (ls, git status, cargo check, pnpm dev) to execute them. Type 'clear' or 'cls' to clear history.",
    },
  ]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize cwd once workspacePath is available
  useEffect(() => {
    if (workspacePath) {
      setTerminalCwd(workspacePath);
    }
  }, [workspacePath]);

  // Scroll to bottom of output history
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when clicking anywhere in terminal body
  const handleBodyClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getDisplayPath = () => {
    if (!workspacePath) return ".";
    // Replace home path with ~ on Unix systems
    const home = "/home/haipn"; // Standard user home path for simplicity or general matches
    if (terminalCwd.startsWith(home)) {
      return terminalCwd.replace(home, "~");
    }
    // Just get directory folder name for short view
    return terminalCwd.split(/[\\/]/).pop() || terminalCwd;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const command = inputVal.trim();
    if (!command) return;

    const displayPath = getDisplayPath();
    const promptPrefix = `haipn@aether:${displayPath}$ `;

    // 1. Add input command to history
    setHistory((prev) => [...prev, { type: "input", text: `${promptPrefix}${command}` }]);
    setInputVal("");

    // 2. Handle Clear/Cls locally
    if (command === "clear" || command === "cls") {
      setHistory([]);
      return;
    }

    if (command === "help") {
      setHistory((prev) => [
        ...prev,
        {
          type: "info",
          text: "Available commands: standard shell commands (ls, pwd, cd, git, pnpm, cargo, etc.) or clear/cls to clear logs.",
        },
      ]);
      return;
    }

    // 3. Execute command on backend
    try {
      const result = await invoke<string>("run_terminal_command", {
        command,
        cwd: terminalCwd,
      });

      if (result.startsWith("NEW_CWD:")) {
        const newPath = result.substring(8);
        setTerminalCwd(newPath);
      } else {
        setHistory((prev) => [...prev, { type: "stdout", text: result }]);
      }
    } catch (err) {
      setHistory((prev) => [...prev, { type: "stderr", text: err as string }]);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const displayPath = getDisplayPath();

  return (
    <Box className={classes.container}>
      {/* Header bar */}
      <Box className={classes.header}>
        <Box className={classes.tabs}>
          <Text className={`${classes.tab} ${classes.tabActive}`}>Terminal</Text>
          <Text className={classes.tab} style={{ opacity: 0.5, cursor: "default" }}>
            Output
          </Text>
          <Text className={classes.tab} style={{ opacity: 0.5, cursor: "default" }}>
            Problems
          </Text>
        </Box>

        <Box className={classes.actions}>
          <Tooltip label="Clear Console" position="top" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={handleClearHistory}
              className={classes.actionBtn}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Close Terminal" position="top" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={toggleTerminal}
              className={classes.actionBtn}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        </Box>
      </Box>

      {/* Output Console and Input Area */}
      <Box ref={bodyRef} className={classes.body} onClick={handleBodyClick}>
        {history.map((item, idx) => {
          let color = "#cccccc";
          if (item.type === "stderr") color = "#ef4444";
          if (item.type === "info") color = "var(--aether-color-primary-base)";
          if (item.type === "input") color = "#ffffff";

          return (
            <Box key={idx} className={classes.historyLine} style={{ color }}>
              {item.text}
            </Box>
          );
        })}

        {/* Active Promp Input Line */}
        <form onSubmit={handleSubmit} className={classes.promptLine}>
          <span className={classes.promptText}>haipn@aether</span>
          <span className={classes.charText}>:</span>
          <span className={classes.pathText}>{displayPath}</span>
          <span className={classes.charText}>$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className={classes.input}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </form>
      </Box>
    </Box>
  );
}
