import { useState, useEffect } from "react";
import { Box, Group, Text, Tabs, Loader, Menu, Button, HoverCard } from "@mantine/core";
import { IconGlobe, IconChevronDown, IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useTabStore } from "@/stores/tabStore";
import ResponseBody from "./ResponseBody";
import ResponseHeaders from "./ResponseHeaders";
import classes from "./ResponseViewer.module.css";

interface ResponseViewerProps {
  tabId: string;
}

export default function ResponseViewer({ tabId }: Readonly<ResponseViewerProps>) {
  const response = useTabStore((s) => s.responses[tabId]);
  const isLoading = useTabStore((s) => s.loadingStates[tabId]);
  const [requestDetails, setRequestDetails] = useState<any>(null);

  useEffect(() => {
    if (response) {
      invoke<any>("read_request", { path: tabId })
        .then((res) => setRequestDetails(res))
        .catch((err) => console.error("Error reading request details:", err));
    }
  }, [response, tabId]);

  if (isLoading) {
    return (
      <Box className={classes.loadingState}>
        <Loader size="md" color="indigo" />
        <Text size="xs" style={{ color: "var(--text-muted)", marginTop: 8 }}>
          Sending request...
        </Text>
      </Box>
    );
  }

  if (!response) {
    return (
      <Box className={classes.emptyState}>
        <Text size="sm" style={{ color: "var(--text-muted)" }}>
          No response. Send a request to see the response.
        </Text>
      </Box>
    );
  }

  if ("error" in response) {
    return (
      <Box className={classes.container}>
        <Group gap={16} p={16} mb={12} border-bottom="1px solid var(--border-color)">
          <Text size="sm" fw={700} color="red">
            Error
          </Text>
        </Group>
        <Box p={16}>
          <Text size="sm" color="red">
            {response.error}
          </Text>
        </Box>
      </Box>
    );
  }

  const handleDownloadResponse = () => {
    const blob = new Blob([response.body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${tabId.split(/[/\\]/).pop() || "data"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateHeadersSize = (headers: [string, string][]) => {
    if (!headers) return 0;
    return headers.reduce((acc, [k, v]) => acc + k.length + v.length + 4, 0);
  };

  const calculateRequestHeadersSize = (req: any) => {
    if (!req) return 0;
    let size = 0;
    try {
      const urlObj = new URL(req.url || "http://localhost");
      size +=
        (req.method || "GET").length +
        1 +
        urlObj.pathname.length +
        urlObj.search.length +
        1 +
        8 +
        2;
      size += 6 + urlObj.host.length + 2;
    } catch {
      size += (req.method || "GET").length + 1 + (req.url || "").length + 1 + 8 + 2;
    }
    if (req.headers) {
      size += req.headers
        .filter((h: any) => h.enabled)
        .reduce((acc: number, h: any) => acc + h.key.length + h.value.length + 4, 0);
    }
    return size;
  };

  const calculateRequestBodySize = (req: any) => {
    if (!req || !req.body || req.body.type === "none") return 0;
    if (req.body.content) {
      return new Blob([req.body.content]).size;
    }
    if (req.body.type === "formUrlencoded" && Array.isArray(req.body.content)) {
      const formText = req.body.content
        .filter((kv: any) => kv.enabled)
        .map((kv: any) => `${encodeURIComponent(kv.key)}=${encodeURIComponent(kv.value)}`)
        .join("&");
      return new Blob([formText]).size;
    }
    return 0;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const responseBodySize = response.sizeBytes || 0;
  const responseHeadersSize = calculateHeadersSize(response.headers || []);
  const responseTotalSize = responseBodySize + responseHeadersSize;

  const requestHeadersSize = calculateRequestHeadersSize(requestDetails);
  const requestBodySize = calculateRequestBodySize(requestDetails);
  const requestTotalSize = requestHeadersSize + requestBodySize;

  // Timing breakdown calculations
  const dnsMs = response.timing?.dnsMs || 0;
  const tcpMs = response.timing?.tcpMs || 0;
  const tlsMs = response.timing?.tlsMs || 0;
  const ttfbMs = response.timing?.ttfbMs || 0;
  const downloadMs = response.timing?.downloadMs || 0;
  const totalMs = response.timing?.totalMs || 0;

  const prepareMs = 1.2;
  const socketMs = 1.0;
  const processMs = 0.4;

  const isHttps = requestDetails?.url?.startsWith("https");
  const isDnsCached = dnsMs === 0;
  const isTcpCached = tcpMs === 0;
  const isTlsCached = isHttps && tlsMs === 0;

  const connectionOverhead = dnsMs + tcpMs + tlsMs + prepareMs + socketMs;
  const transferStartMs = Math.max(0.1, ttfbMs - connectionOverhead);

  // Recalculate total duration based on active (non-cached) times
  const activeDns = isDnsCached ? 0 : dnsMs;
  const activeTcp = isTcpCached ? 0 : tcpMs;
  const activeTls = isTlsCached ? 0 : tlsMs;

  const calculatedTotalMs =
    prepareMs +
    socketMs +
    activeDns +
    activeTcp +
    activeTls +
    transferStartMs +
    downloadMs +
    processMs;

  const phases = [
    { label: "Prepare", duration: prepareMs, isMuted: true, isCached: false },
    { label: "Socket Initialization", duration: socketMs, isMuted: false, isCached: false },
    { label: "DNS Lookup", duration: dnsMs, isMuted: false, isCached: isDnsCached },
    { label: "TCP Handshake", duration: tcpMs, isMuted: false, isCached: isTcpCached },
    {
      label: "SSL Handshake",
      duration: tlsMs,
      isMuted: false,
      isCached: isTlsCached,
      isHidden: !isHttps && tlsMs === 0,
    },
    { label: "Transfer Start", duration: transferStartMs, isMuted: false, isCached: false },
    { label: "Download", duration: downloadMs, isMuted: false, isCached: false },
    { label: "Process", duration: processMs, isMuted: true, isCached: false },
  ];

  let accumStart = 0;
  const waterfallData = phases.map((phase) => {
    const duration = phase.isCached ? 0 : phase.duration;
    const start = accumStart;
    accumStart += duration;

    let width = 0;
    if (!phase.isCached && !phase.isHidden) {
      const rawWidth = (duration / calculatedTotalMs) * 100;
      width = rawWidth < 1 ? 1 : rawWidth;
    }

    const left = (start / calculatedTotalMs) * 100;
    return {
      label: phase.label,
      duration: phase.duration,
      isMuted: phase.isMuted,
      isCached: phase.isCached,
      isHidden: phase.isHidden,
      width,
      left,
    };
  });

  return (
    <Box className={classes.container}>
      <Tabs defaultValue="body" className={classes.tabs}>
        <Box className={classes.topHeader}>
          <Tabs.List className={classes.tabsList}>
            <Tabs.Tab value="body" className={classes.tabItem}>
              Body
            </Tabs.Tab>
            <Tabs.Tab value="cookies" className={classes.tabItem}>
              Cookies
            </Tabs.Tab>
            <Tabs.Tab value="headers" className={classes.tabItem}>
              Headers <span className={classes.headerCount}>({response.headers?.length || 0})</span>
            </Tabs.Tab>
            <Tabs.Tab value="testResults" className={classes.tabItem}>
              Test Results
            </Tabs.Tab>
          </Tabs.List>

          <Group gap={16} wrap="nowrap" className={classes.metricsGroup}>
            <Group gap={4} wrap="nowrap" className={classes.metricLabel}>
              <IconGlobe size={14} />
              <span>Status:</span>
              <span className={classes.metricValueGreen}>
                {response.status} {response.statusText}
              </span>
            </Group>

            <HoverCard
              width={350}
              position="bottom-end"
              withArrow
              shadow="md"
              openDelay={200}
              closeDelay={200}
            >
              <HoverCard.Target>
                <Group gap={4} wrap="nowrap" className={classes.metricLabelInteractive}>
                  <span>Time:</span>
                  <span className={classes.metricValueGreenUnderlined}>
                    {Math.round(totalMs)} ms
                  </span>
                </Group>
              </HoverCard.Target>
              <HoverCard.Dropdown className={classes.timePopoverDropdown}>
                {/* Header row */}
                <Box className={classes.timeHeaderRow}>
                  <Text size="xxs" fw={700} style={{ color: "var(--text-muted)", width: 110 }}>
                    EVENT
                  </Text>
                  <Text
                    size="xxs"
                    fw={700}
                    style={{ color: "var(--text-muted)", width: 140, textAlign: "center" }}
                  ></Text>
                  <Text
                    size="xxs"
                    fw={700}
                    style={{ color: "var(--text-muted)", width: 60, textAlign: "right" }}
                  >
                    TIME
                  </Text>
                </Box>

                {/* Event list */}
                {waterfallData
                  .filter((phase) => !phase.isHidden)
                  .map((phase) => (
                    <Box
                      key={phase.label}
                      className={classes.timeRow}
                      style={{ opacity: phase.isMuted || phase.isCached ? 0.5 : 1 }}
                    >
                      <Text size="xs" className={classes.timeEventCell}>
                        {phase.label}
                      </Text>
                      <Box className={classes.timeTimelineCell}>
                        <Box className={classes.waterfallTrack}>
                          {phase.width > 0 && (
                            <Box
                              className={
                                phase.isMuted ? classes.waterfallBarGrey : classes.waterfallBar
                              }
                              style={{
                                left: `${phase.left}%`,
                                width: `${phase.width}%`,
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                      <Text
                        size="xs"
                        className={classes.timeDurationCell}
                        style={{ color: phase.isCached ? "var(--text-disabled)" : undefined }}
                      >
                        {phase.isCached
                          ? "Cache"
                          : phase.duration >= 100
                            ? `${phase.duration.toFixed(0)} ms`
                            : `${phase.duration.toFixed(2)} ms`}
                      </Text>
                    </Box>
                  ))}

                <Box className={classes.timeDivider} />

                {/* Total row */}
                <Box className={classes.timeRow} style={{ marginTop: 8 }}>
                  <Text size="xs" fw={700} className={classes.timeTotalLabel}>
                    Total
                  </Text>
                  <Box className={classes.timeTimelineCell}></Box>
                  <Text size="xs" fw={700} className={classes.timeTotalValue}>
                    {calculatedTotalMs >= 100
                      ? `${calculatedTotalMs.toFixed(0)} ms`
                      : `${calculatedTotalMs.toFixed(2)} ms`}
                  </Text>
                </Box>
              </HoverCard.Dropdown>
            </HoverCard>

            <HoverCard
              width={280}
              position="bottom-end"
              withArrow
              shadow="md"
              openDelay={200}
              closeDelay={200}
            >
              <HoverCard.Target>
                <Group gap={4} wrap="nowrap" className={classes.metricLabelInteractive}>
                  <span>Size:</span>
                  <span className={classes.metricValueGreenUnderlined}>
                    {formatSize(responseTotalSize)}
                  </span>
                </Group>
              </HoverCard.Target>
              <HoverCard.Dropdown className={classes.sizePopoverDropdown}>
                <Box className={classes.popoverSection}>
                  <Box className={classes.popoverTitleRow}>
                    <Box className={classes.arrowBoxBlue}>
                      <IconArrowDown size={12} color="#fff" />
                    </Box>
                    <Text size="xs" fw={700} className={classes.popoverTitleText}>
                      Response Size
                    </Text>
                    <Text
                      size="xs"
                      fw={700}
                      style={{ marginLeft: "auto", color: "var(--text-primary)" }}
                    >
                      {formatSize(responseTotalSize)}
                    </Text>
                  </Box>
                  <Box className={classes.popoverSubRow}>
                    <Text size="xs" style={{ color: "var(--text-muted)" }}>
                      Headers
                    </Text>
                    <Text size="xs" style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
                      {formatSize(responseHeadersSize)}
                    </Text>
                  </Box>
                  <Box className={classes.popoverSubRow}>
                    <Text size="xs" style={{ color: "var(--text-muted)" }}>
                      Body
                    </Text>
                    <Text size="xs" style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
                      {formatSize(responseBodySize)}
                    </Text>
                  </Box>
                  <Box className={classes.popoverSubRow} style={{ opacity: 0.6 }}>
                    <Text size="xs" style={{ color: "var(--text-muted)" }}>
                      Uncompressed
                    </Text>
                    <Text size="xs" style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
                      {formatSize(responseBodySize)}
                    </Text>
                  </Box>
                </Box>

                <Box className={classes.popoverSection} style={{ marginTop: 12 }}>
                  <Box className={classes.popoverTitleRow}>
                    <Box className={classes.arrowBoxOrange}>
                      <IconArrowUp size={12} color="#fff" />
                    </Box>
                    <Text size="xs" fw={700} className={classes.popoverTitleText}>
                      Request Size
                    </Text>
                    <Text
                      size="xs"
                      fw={700}
                      style={{ marginLeft: "auto", color: "var(--text-primary)" }}
                    >
                      {formatSize(requestTotalSize)}
                    </Text>
                  </Box>
                  <Box className={classes.popoverSubRow}>
                    <Text size="xs" style={{ color: "var(--text-muted)" }}>
                      Headers
                    </Text>
                    <Text size="xs" style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
                      {formatSize(requestHeadersSize)}
                    </Text>
                  </Box>
                  <Box className={classes.popoverSubRow}>
                    <Text size="xs" style={{ color: "var(--text-muted)" }}>
                      Body
                    </Text>
                    <Text size="xs" style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
                      {formatSize(requestBodySize)}
                    </Text>
                  </Box>
                </Box>

                <Box className={classes.popoverFooter}>
                  <Text
                    size="xxs"
                    style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 10 }}
                  >
                    All size calculations are approximate
                  </Text>
                </Box>
              </HoverCard.Dropdown>
            </HoverCard>

            <Menu shadow="md" width={150}>
              <Menu.Target>
                <Button
                  variant="subtle"
                  size="xs"
                  color="indigo"
                  rightSection={<IconChevronDown size={12} />}
                  className={classes.saveBtn}
                >
                  Save Response
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={handleDownloadResponse}>Save to file...</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Box>

        <Tabs.Panel value="body" className={classes.panel}>
          <ResponseBody response={response} />
        </Tabs.Panel>

        <Tabs.Panel value="cookies" className={classes.panel}>
          <Box className={classes.placeholderTabContent}>
            <Text size="sm" style={{ color: "var(--text-muted)" }}>
              No cookies returned for this response.
            </Text>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="headers" className={classes.panel}>
          <ResponseHeaders headers={response.headers} />
        </Tabs.Panel>

        <Tabs.Panel value="testResults" className={classes.panel}>
          <Box className={classes.placeholderTabContent}>
            <Text size="sm" style={{ color: "var(--text-muted)" }}>
              No tests were run for this request.
            </Text>
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
