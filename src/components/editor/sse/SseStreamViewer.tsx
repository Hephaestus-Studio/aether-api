import { useState, useRef, useEffect, useMemo, memo } from "react";
import {
  Box,
  Group,
  Text,
  Badge,
  ActionIcon,
  Select,
  TextInput,
  Tooltip,
  CopyButton,
  Menu,
} from "@mantine/core";
import {
  IconSearch,
  IconTrash,
  IconArrowDown,
  IconRss,
  IconDownload,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFileText,
  IconCode,
} from "@tabler/icons-react";
import { useSseStore } from "@/stores/sseStore";
import classes from "./SseStreamViewer.module.css";

interface SseStreamViewerProps {
  tabId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function renderFormattedJson(jsonStr: string) {
  try {
    const obj = JSON.parse(jsonStr);
    const pretty = JSON.stringify(obj, null, 2);

    // Simple syntax highlighter for JSON
    const highlighted = pretty
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = classes.jsonNumber;
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = classes.jsonKey;
            } else {
              cls = classes.jsonString;
            }
          } else if (/true|false/.test(match)) {
            cls = classes.jsonBoolean;
          } else if (/null/.test(match)) {
            cls = classes.jsonNull;
          }
          return `<span class="${cls}">${match}</span>`;
        },
      );

    return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
  } catch {
    return <span>{jsonStr}</span>;
  }
}

export default memo(function SseStreamViewer({ tabId }: Readonly<SseStreamViewerProps>) {
  const logs = useSseStore((s) => s.logs[tabId]) || [];
  const status = useSseStore((s) => s.statuses[tabId]) || "disconnected";
  const metrics = useSseStore((s) => s.metrics[tabId]) || {
    receivedCount: 0,
    receivedBytes: 0,
  };
  const clearLogs = useSseStore((s) => s.clearLogs);

  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  // Timer for connected duration
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);
  useEffect(() => {
    if (status === "connected" && metrics.connectedSince) {
      const interval = setInterval(() => {
        setElapsedSecs(Math.floor((Date.now() - (metrics.connectedSince || Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSecs(0);
    }
  }, [status, metrics.connectedSince]);

  // Extract list of unique event types from logs
  const availableEventTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.event || "message"));
    const list = Array.from(set).map((e) => ({ value: e, label: `event: ${e}` }));
    return [{ value: "all", label: "All Events" }, ...list];
  }, [logs]);

  // Filter messages
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterEvent !== "all" && log.event !== filterEvent) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.data.toLowerCase().includes(q) ||
          log.event.toLowerCase().includes(q) ||
          (log.eventId && log.eventId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, filterEvent, searchQuery]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id], // Default is open (undefined -> false)
    }));
  };

  // Export functions
  const handleExport = (format: "json" | "ndjson" | "txt") => {
    if (filteredLogs.length === 0) return;

    let content = "";
    let mimeType = "text/plain";
    let filename = `sse-events-${Date.now()}.${format}`;

    if (format === "json") {
      content = JSON.stringify(filteredLogs, null, 2);
      mimeType = "application/json";
    } else if (format === "ndjson") {
      content = filteredLogs.map((l) => JSON.stringify(l)).join("\n");
      mimeType = "application/x-ndjson";
    } else {
      content = filteredLogs
        .map(
          (l) =>
            `[${formatTime(l.timestamp)}] event: ${l.event}${
              l.eventId ? ` id: ${l.eventId}` : ""
            }\n${l.data}\n`,
        )
        .join("\n---\n\n");
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allLogsText = useMemo(() => {
    return filteredLogs.map((l) => l.data).join("\n\n");
  }, [filteredLogs]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <Box className={classes.container}>
      {/* Top Toolbar */}
      <div className={classes.toolbar}>
        <Group gap="xs" style={{ flex: 1 }}>
          <Select
            size="xs"
            value={filterEvent}
            onChange={(val) => setFilterEvent(val || "all")}
            data={availableEventTypes}
            style={{ width: 140 }}
            comboboxProps={{ shadow: "md", transitionProps: { transition: "pop", duration: 150 } }}
          />

          <TextInput
            size="xs"
            leftSection={<IconSearch size={14} />}
            placeholder="Search payload..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            className={classes.searchBox}
          />
        </Group>

        <Group gap="xs">
          <Tooltip label={autoScroll ? "Auto-scroll ON" : "Auto-scroll paused"}>
            <ActionIcon
              size="sm"
              variant={autoScroll ? "light" : "subtle"}
              color={autoScroll ? "teal" : "gray"}
              onClick={() => setAutoScroll(!autoScroll)}
            >
              <IconArrowDown size={14} />
            </ActionIcon>
          </Tooltip>

          <CopyButton value={allLogsText}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copied all payload!" : "Copy all payload"}>
                <ActionIcon size="sm" variant="subtle" color="gray" onClick={copy}>
                  {copied ? <IconCheck size={14} color="#10b981" /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>

          <Menu shadow="md" width={160} position="bottom-end">
            <Menu.Target>
              <Tooltip label="Export events">
                <ActionIcon size="sm" variant="subtle" color="gray">
                  <IconDownload size={14} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconCode size={14} color="#93c5fd" />}
                onClick={() => handleExport("json")}
              >
                Export JSON (.json)
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileText size={14} color="#86efac" />}
                onClick={() => handleExport("ndjson")}
              >
                Export NDJSON (.ndjson)
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileText size={14} color="#fcd34d" />}
                onClick={() => handleExport("txt")}
              >
                Export Plain Text (.txt)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Tooltip label="Clear stream logs">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => clearLogs(tabId)}
              disabled={logs.length === 0}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {/* Main Event Stream Card List */}
      <div className={classes.eventList} ref={scrollRef} onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <div className={classes.emptyState}>
            <IconRss size={36} color="#71717a" />
            <div>
              {status === "connected"
                ? "Listening for SSE events..."
                : logs.length > 0
                  ? "No events match current filter/search"
                  : "No stream data received yet. Click Connect to start listening."}
            </div>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isCardOpen = expandedCards[log.id] !== false; // Open by default
            const isJson =
              (log.data.startsWith("{") && log.data.endsWith("}")) ||
              (log.data.startsWith("[") && log.data.endsWith("]"));

            return (
              <div key={log.id || index} className={classes.eventCard}>
                <div
                  className={`${classes.cardHeader} ${isCardOpen ? classes.cardHeaderOpen : ""}`}
                  onClick={() => toggleCard(log.id)}
                >
                  <Group gap="xs">
                    {isCardOpen ? (
                      <IconChevronDown size={14} color="#a1a1aa" />
                    ) : (
                      <IconChevronRight size={14} color="#a1a1aa" />
                    )}
                    <Text size="xs" fw={700} c="dimmed">
                      #{index + 1}
                    </Text>

                    <Badge
                      size="xs"
                      variant="filled"
                      color={
                        log.event === "error"
                          ? "red"
                          : log.event === "ping"
                            ? "gray"
                            : log.event === "delta"
                              ? "violet"
                              : "pink"
                      }
                    >
                      {log.event || "message"}
                    </Badge>

                    {log.eventId && (
                      <Badge size="xs" variant="outline" color="cyan">
                        id: {log.eventId}
                      </Badge>
                    )}

                    {log.retry && (
                      <Badge size="xs" variant="subtle" color="orange">
                        retry: {log.retry}ms
                      </Badge>
                    )}
                  </Group>

                  <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                    <Text size="xs" c="dimmed">
                      {formatBytes(log.size)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatTime(log.timestamp)}
                    </Text>
                    <CopyButton value={log.data}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied!" : "Copy payload"}>
                          <ActionIcon size="xs" variant="subtle" color="gray" onClick={copy}>
                            {copied ? (
                              <IconCheck size={12} color="#10b981" />
                            ) : (
                              <IconCopy size={12} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </div>

                {isCardOpen && (
                  <div className={classes.cardBody}>
                    {isJson ? renderFormattedJson(log.data) : log.data}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Auto-scroll paused float indicator */}
      {!autoScroll && (
        <div className={classes.scrollPauseNotice} onClick={() => setAutoScroll(true)}>
          <IconArrowDown size={12} /> Auto-scroll paused. Click to resume.
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className={classes.statusBar}>
        <div className={classes.statusIndicator}>
          <span
            className={`${classes.statusDot} ${
              status === "connected"
                ? classes.statusConnected
                : status === "connecting"
                  ? classes.statusConnecting
                  : status === "error"
                    ? classes.statusError
                    : classes.statusDisconnected
            }`}
          />
          <span style={{ textTransform: "capitalize" }}>{status}</span>
          {status === "connected" && (
            <span style={{ marginLeft: 6, color: "#a1a1aa" }}>({formatDuration(elapsedSecs)})</span>
          )}
        </div>

        <Group gap="md">
          <span>Events: {metrics.receivedCount || logs.length}</span>
          <span>Size: {formatBytes(metrics.receivedBytes || 0)}</span>
        </Group>
      </div>
    </Box>
  );
});
