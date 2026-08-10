import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Box } from "@mantine/core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";

export interface XTerminalHandle {
  clear: () => void;
  focus: () => void;
  fit: () => void;
}

interface XTerminalInstanceProps {
  sessionId: string;
  active: boolean;
  onExit?: () => void;
}

const XTerminalInstance = forwardRef<XTerminalHandle, XTerminalInstanceProps>(
  ({ sessionId, active, onExit }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        terminalRef.current?.clear();
      },
      focus: () => {
        terminalRef.current?.focus();
      },
      fit: () => {
        fitAddonRef.current?.fit();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
        lineHeight: 1.25,
        letterSpacing: 0,
        scrollback: 5000,
        allowProposedApi: true,
        theme: {
          background: "#212121",
          foreground: "#e5e7eb",
          cursor: "#2563eb",
          cursorAccent: "#212121",
          selectionBackground: "rgba(37, 99, 235, 0.35)",
          black: "#2d2d2d",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#f3f4f6",
          brightBlack: "#4b5563",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#fde047",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(containerRef.current);
      terminalRef.current = term;
      fitAddonRef.current = fitAddon;

      // Fit initial dimensions
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn("FitAddon error on init:", e);
      }

      // Sync size with backend
      if (term.cols && term.rows) {
        invoke("resize_terminal", {
          sessionId,
          cols: term.cols,
          rows: term.rows,
        }).catch((err) => console.error("Failed to resize terminal:", err));
      }

      // Send raw keystrokes to Rust PTY
      const dataDisposable = term.onData((data) => {
        invoke("write_terminal", { sessionId, data }).catch((err) =>
          console.error("Failed to write to terminal:", err),
        );
      });

      // Listen for incoming PTY stdout/stderr from Rust backend
      let unlistenData: UnlistenFn | null = null;
      let unlistenExit: UnlistenFn | null = null;
      let receivedStreamData = false;

      listen<string>(`terminal-data-${sessionId}`, (event) => {
        receivedStreamData = true;
        term.write(event.payload);
      }).then((fn) => {
        unlistenData = fn;
        // If listener attached after initial shell output was emitted, fetch and render the startup buffer
        invoke<string>("get_terminal_buffer", { sessionId })
          .then((buf) => {
            if (!receivedStreamData && buf) {
              term.write(buf);
              receivedStreamData = true;
            }
          })
          .catch(() => {});
      });

      listen(`terminal-exit-${sessionId}`, () => {
        term.write("\r\n\x1b[90m[Process completed]\x1b[0m\r\n");
        onExit?.();
      }).then((fn) => {
        unlistenExit = fn;
      });

      // ResizeObserver for auto-fit on panel resizing
      const resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current || containerRef.current.clientWidth === 0) return;
        try {
          fitAddon.fit();
          if (term.cols && term.rows) {
            invoke("resize_terminal", {
              sessionId,
              cols: term.cols,
              rows: term.rows,
            }).catch(() => {});
          }
        } catch {}
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        dataDisposable.dispose();
        if (unlistenData) unlistenData();
        if (unlistenExit) unlistenExit();
        resizeObserver.disconnect();
        term.dispose();
      };
    }, [sessionId]);

    // Handle tab activation (re-fit and focus)
    useEffect(() => {
      if (active) {
        const timer = setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
            terminalRef.current?.focus();
            if (terminalRef.current) {
              invoke("resize_terminal", {
                sessionId,
                cols: terminalRef.current.cols,
                rows: terminalRef.current.rows,
              }).catch(() => {});
            }
          } catch {}
        }, 30);
        return () => clearTimeout(timer);
      }
    }, [active, sessionId]);

    return (
      <Box
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          display: active ? "block" : "none",
          backgroundColor: "#212121",
          padding: "6px 8px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      />
    );
  },
);

XTerminalInstance.displayName = "XTerminalInstance";

export default XTerminalInstance;
