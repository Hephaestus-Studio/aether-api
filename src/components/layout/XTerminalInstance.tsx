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
          background: "#121316",
          foreground: "#c9d1d9",
          cursor: "#339af0",
          cursorAccent: "#121316",
          selectionBackground: "rgba(51, 154, 240, 0.35)",
          black: "#484f58",
          red: "#ff7b72",
          green: "#3fb950",
          yellow: "#d29922",
          blue: "#58a6ff",
          magenta: "#bc8cff",
          cyan: "#39c5cf",
          white: "#b1bac4",
          brightBlack: "#6e7681",
          brightRed: "#ffa198",
          brightGreen: "#56d364",
          brightYellow: "#e3b341",
          brightBlue: "#79c0ff",
          brightMagenta: "#d2a8ff",
          brightCyan: "#56d4dd",
          brightWhite: "#f0f6fc",
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

      listen<string>(`terminal-data-${sessionId}`, (event) => {
        term.write(event.payload);
      }).then((fn) => {
        unlistenData = fn;
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
          backgroundColor: "#121316",
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
