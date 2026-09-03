import { useState, useRef, useEffect, useMemo, memo } from "react";
import {
  Box,
  Group,
  Text,
  Badge,
  ActionIcon,
  SegmentedControl,
  TextInput,
  Tooltip,
  Button,
  CopyButton,
} from "@mantine/core";
import {
  IconSearch,
  IconTrash,
  IconArrowDown,
  IconArrowUp,
  IconBolt,
  IconDownload,
  IconCopy,
  IconCheck,
  IconArrowsSort,
  IconPlug,
} from "@tabler/icons-react";
import { useWebSocketStore } from "@/stores/websocketStore";
import classes from "./WebSocketStreamViewer.module.css";

interface WebSocketStreamViewerProps {
  tabId: string;
}

export default memo(function WebSocketStreamViewer({
  tabId,
}: Readonly<WebSocketStreamViewerProps>) {
  const logs = useWebSocketStore((s) => s.logs[tabId]) || [];
  const status = useWebSocketStore((s) => s.statuses[tabId]) || "disconnected";
  const clearLogs = useWebSocketStore((s) => s.clearLogs);
  const sendPing = useWebSocketStore((s) => s.sendPing);

  const [filter, setFilter] = useState<"all" | "in" | "out" | "pingpong">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages based on tab, direction filter, and search text
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by direction / pingpong
      if (filter === "in" && log.direction !== "in") return false;
      if (filter === "out" && log.direction !== "out") return false;
      if (filter === "pingpong" && log.format !== "ping" && log.format !== "pong") return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return log.payload.toLowerCase().includes(q) || log.format.toLowerCase().includes(q);
      }

      return true;
    });
  }, [logs, filter, searchQuery]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Handle manual user scroll to toggle auto-scroll pause
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  const formatTime = (epochMs: number) => {
    const d = new Date(epochMs);
    return `${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleExportLogs = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ws-log-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <Box className={classes.container}>
      {/* Top Toolbar */}
      <Box className={classes.toolbar}>
        <Box className={classes.toolbarLeft}>
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={(val) => setFilter(val as any)}
            data={[
              { label: `All (${logs.length})`, value: "all" },
              {
                label: (
                  <Group gap={4} wrap="nowrap">
                    <IconArrowDown size={12} color="#20c997" />
                    <span>IN</span>
                  </Group>
                ),
                value: "in",
              },
              {
                label: (
                  <Group gap={4} wrap="nowrap">
                    <IconArrowUp size={12} color="#00b4d8" />
                    <span>OUT</span>
                  </Group>
                ),
                value: "out",
              },
              {
                label: (
                  <Group gap={4} wrap="nowrap">
                    <IconBolt size={12} color="#ffca3a" />
                    <span>Ping/Pong</span>
                  </Group>
                ),
                value: "pingpong",
              },
            ]}
          />

          <TextInput
            placeholder="Search payload..."
            leftSection={<IconSearch size={14} style={{ color: "var(--text-muted)" }} />}
            leftSectionPointerEvents="none"
            size="xs"
            className={classes.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </Box>

        <Box className={classes.toolbarRight}>
          <Tooltip label="Send manual Ping frame" position="top">
            <Button
              size="xs"
              variant="subtle"
              color="yellow"
              disabled={status !== "connected"}
              leftSection={<IconBolt size={14} />}
              onClick={() => sendPing(tabId)}
            >
              Ping
            </Button>
          </Tooltip>

          <Tooltip
            label={
              autoScroll
                ? "Auto-scroll is ON (Click to lock)"
                : "Auto-scroll paused (Click to resume)"
            }
            position="top"
          >
            <ActionIcon
              size="sm"
              variant={autoScroll ? "filled" : "light"}
              color={autoScroll ? "blue" : "gray"}
              onClick={() => {
                setAutoScroll(!autoScroll);
                if (!autoScroll && scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }}
            >
              <IconArrowsSort size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Export Stream Logs (JSON)" position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              disabled={logs.length === 0}
              onClick={handleExportLogs}
            >
              <IconDownload size={15} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Clear Message Stream" position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              disabled={logs.length === 0}
              onClick={() => clearLogs(tabId)}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        </Box>
      </Box>

      {/* Message Stream List */}
      <Box className={classes.messagesList} ref={scrollRef} onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <Box className={classes.emptyState}>
            <IconPlug size={36} stroke={1.5} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            <Text size="sm" fw={600}>
              {status === "connected"
                ? "Connected. Waiting for messages..."
                : "No WebSocket messages yet"}
            </Text>
            <Text size="xs" c="dimmed" maw={320}>
              {status === "connected"
                ? "Send a message from the composer or wait for inbound server frames."
                : "Connect to a WebSocket server above to start streaming messages in real-time."}
            </Text>
          </Box>
        ) : (
          filteredLogs.map((log) => {
            const isPingPong = log.format === "ping" || log.format === "pong";
            const isJson = log.format === "json";
            const cardClass = isPingPong
              ? `${classes.messageCard} ${classes.pingpong}`
              : log.direction === "in"
                ? `${classes.messageCard} ${classes.inbound}`
                : `${classes.messageCard} ${classes.outbound}`;

            return (
              <Box key={log.id} className={cardClass}>
                <Box className={classes.messageHeader}>
                  <Box className={classes.messageMeta}>
                    {isPingPong ? (
                      <Badge size="xs" color="yellow" variant="light">
                        {log.format.toUpperCase()}
                      </Badge>
                    ) : log.direction === "in" ? (
                      <Badge
                        size="xs"
                        color="teal"
                        variant="light"
                        leftSection={<IconArrowDown size={10} />}
                      >
                        IN
                      </Badge>
                    ) : (
                      <Badge
                        size="xs"
                        color="cyan"
                        variant="light"
                        leftSection={<IconArrowUp size={10} />}
                      >
                        OUT
                      </Badge>
                    )}

                    <Badge size="xs" color="gray" variant="outline">
                      {log.format.toUpperCase()}
                    </Badge>

                    <Text className={classes.timeText}>{formatTime(log.timestamp)}</Text>
                  </Box>

                  <Group gap={6}>
                    <Text className={classes.sizeText}>{formatSize(log.size)}</Text>
                    <CopyButton value={log.payload} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied" : "Copy Payload"} position="top">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color={copied ? "teal" : "gray"}
                            onClick={copy}
                          >
                            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </Box>

                <Box className={classes.payloadBox}>
                  {isJson
                    ? (() => {
                        try {
                          const parsed = JSON.parse(log.payload);
                          return JSON.stringify(parsed, null, 2);
                        } catch {
                          return log.payload;
                        }
                      })()
                    : log.payload}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
});
