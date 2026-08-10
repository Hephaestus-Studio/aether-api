import { useState, useEffect } from "react";
import { Box, Group, Text, Tabs, Loader, Menu, Button, HoverCard } from "@mantine/core";
import { IconGlobe, IconChevronDown, IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useTabStore } from "@/stores/tabStore";
import { useCollision } from "@/hooks/useCollision";
import { getStatusColor } from "@/utils/httpMethods";
import ResponseBody from "./ResponseBody";
import ResponseHeaders from "./ResponseHeaders";
import classes from "./ResponseViewer.module.css";

interface ResponseViewerProps {
  tabId: string;
}

export default function ResponseViewer({ tabId }: Readonly<ResponseViewerProps>) {
  const response = useTabStore((s) => s.responses[tabId]);
  const isLoading = useTabStore((s) => s.loadingStates[tabId]);
  const hasResponse = !!response && !("error" in response);
  const isError = !!response && "error" in response;

  const {
    containerRef: topHeaderRef,
    leftRef: tabsRef,
    rightRef: metricsRef,
    isColliding: isHeaderColliding,
  } = useCollision<HTMLDivElement>({
    gap: 16,
    minExpandedWidth: 620,
    hysteresis: 8,
    dependencies: [hasResponse, response?.status, response?.headers?.length],
  });

  const isCompact = isHeaderColliding;
  const showLabels = !isHeaderColliding;

  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string | null>("body");

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

  const responseBodySize = response?.sizeBytes || 0;
  const responseHeadersSize = calculateHeadersSize(response?.headers || []);
  const responseTotalSize = responseBodySize + responseHeadersSize;

  const requestHeadersSize = calculateRequestHeadersSize(requestDetails);
  const requestBodySize = calculateRequestBodySize(requestDetails);
  const requestTotalSize = requestHeadersSize + requestBodySize;

  // Timing breakdown calculations
  const dnsMs = response?.timing?.dnsMs || 0;
  const tcpMs = response?.timing?.tcpMs || 0;
  const tlsMs = response?.timing?.tlsMs || 0;
  const ttfbMs = response?.timing?.ttfbMs || 0;
  const downloadMs = response?.timing?.downloadMs || 0;
  const totalMs = response?.timing?.totalMs || 0;

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

  const getTabLabel = (val: string | null) => {
    switch (val) {
      case "body":
        return "Body";
      case "cookies":
        return "Cookies";
      case "headers":
        return `Headers (${response?.headers?.length || 0})`;
      default:
        return "Body";
    }
  };

  return (
    <Box className={classes.container} style={{ height: "100%", position: "relative" }}>
      {/* Empty State */}
      {!response && (
        <Box
          className={classes.emptyState}
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text size="sm" style={{ color: "var(--text-muted)" }}>
            No response. Send a request to see the response.
          </Text>
        </Box>
      )}

      {/* Error State */}
      {isError && (
        <Box style={{ height: "100%" }}>
          <Group
            gap={16}
            p={16}
            mb={12}
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <Text size="sm" fw={700} color="red">
              Error
            </Text>
          </Group>
          <Box p={16}>
            <Text size="sm" color="red">
              {(response as any)?.error}
            </Text>
          </Box>
        </Box>
      )}

      {/* Normal Tabs Layout */}
      {hasResponse && (
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          defaultValue="body"
          className={classes.tabs}
        >
          <Box ref={topHeaderRef} className={classes.topHeader}>
            {isCompact ? (
              <Menu shadow="md" width={180} position="bottom-start">
                <Menu.Target>
                  <Button
                    variant="subtle"
                    size="sm"
                    className={classes.compactTabSelectBtn}
                    rightSection={<IconChevronDown size={14} />}
                  >
                    <span className={classes.compactTabLabel}>{getTabLabel(activeTab)}</span>
                  </Button>
                </Menu.Target>
                <Menu.Dropdown className={classes.compactTabDropdown}>
                  <Menu.Item
                    onClick={() => setActiveTab("body")}
                    className={activeTab === "body" ? classes.compactItemActive : ""}
                  >
                    Body
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setActiveTab("cookies")}
                    className={activeTab === "cookies" ? classes.compactItemActive : ""}
                  >
                    Cookies
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setActiveTab("headers")}
                    className={activeTab === "headers" ? classes.compactItemActive : ""}
                  >
                    Headers ({response?.headers?.length || 0})
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <div ref={tabsRef}>
                <Tabs.List className={classes.tabsList}>
                  <Tabs.Tab value="body" className={classes.tabItem}>
                    Body
                  </Tabs.Tab>
                  <Tabs.Tab value="cookies" className={classes.tabItem}>
                    Cookies
                  </Tabs.Tab>
                  <Tabs.Tab value="headers" className={classes.tabItem}>
                    Headers{" "}
                    <span className={classes.headerCount}>({response?.headers?.length || 0})</span>
                  </Tabs.Tab>
                </Tabs.List>
              </div>
            )}

            <div ref={metricsRef} className={classes.metricsGroup}>
              <div className={classes.metricItem}>
                <IconGlobe size={15} style={{ color: "var(--text-muted)" }} />
                {showLabels && <span className={classes.metricLabel}>Status:</span>}
                <span
                  className={classes.metricValue}
                  style={{ color: getStatusColor(response?.status) }}
                >
                  {response?.status} {response?.statusText}
                </span>
              </div>

              <HoverCard
                width={400}
                position="bottom-end"
                withArrow
                shadow="md"
                openDelay={150}
                closeDelay={150}
              >
                <HoverCard.Target>
                  <div className={classes.metricItem} style={{ cursor: "pointer" }}>
                    {showLabels && <span className={classes.metricLabel}>Time:</span>}
                    <span className={classes.metricValueGreenUnderlined}>
                      {Math.round(totalMs)} ms
                    </span>
                  </div>
                </HoverCard.Target>
                <HoverCard.Dropdown className={classes.timePopoverDropdown}>
                  {/* Header row */}
                  <Box className={classes.timeHeaderRow}>
                    <Text className={classes.timeColHeader}>EVENT</Text>
                    <Box></Box>
                    <Text className={classes.timeColHeaderRight}>TIME</Text>
                  </Box>

                  {/* Event list */}
                  {waterfallData
                    .filter((phase) => !phase.isHidden)
                    .map((phase) => (
                      <Box
                        key={phase.label}
                        className={classes.timeRow}
                        style={{ opacity: phase.isMuted || phase.isCached ? 0.45 : 1 }}
                      >
                        <Text className={classes.timeEventCell}>{phase.label}</Text>
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
                          className={classes.timeDurationCell}
                          style={{ color: phase.isCached ? "var(--text-disabled)" : undefined }}
                        >
                          {phase.isCached ? "Cache" : `${phase.duration.toFixed(2)} ms`}
                        </Text>
                      </Box>
                    ))}

                  <Box className={classes.timeDivider} />

                  {/* Total row */}
                  <Box className={classes.timeTotalRow}>
                    <Text className={classes.timeTotalLabel}>Total</Text>
                    <Box></Box>
                    <Text className={classes.timeTotalValue}>
                      {`${calculatedTotalMs.toFixed(2)} ms`}
                    </Text>
                  </Box>
                </HoverCard.Dropdown>
              </HoverCard>

              <HoverCard
                width={290}
                position="bottom-end"
                withArrow
                shadow="md"
                openDelay={150}
                closeDelay={150}
              >
                <HoverCard.Target>
                  <div className={classes.metricItem} style={{ cursor: "pointer" }}>
                    {showLabels && <span className={classes.metricLabel}>Size:</span>}
                    <span className={classes.metricValueGreenUnderlined}>
                      {formatSize(responseTotalSize)}
                    </span>
                  </div>
                </HoverCard.Target>
                <HoverCard.Dropdown className={classes.sizePopoverDropdown}>
                  <Box className={classes.popoverSection}>
                    <Box className={classes.popoverTitleRow}>
                      <Box className={classes.arrowBoxBlue}>
                        <IconArrowDown size={12} color="#fff" />
                      </Box>
                      <Text className={classes.popoverTitleText}>Response Size</Text>
                      <Text className={classes.popoverTitleValue}>
                        {formatSize(responseTotalSize)}
                      </Text>
                    </Box>
                    <Box className={classes.popoverSubRow}>
                      <Text className={classes.popoverSubRowText}>Headers</Text>
                      <Text className={classes.popoverSubRowValue}>
                        {formatSize(responseHeadersSize)}
                      </Text>
                    </Box>
                    <Box className={classes.popoverSubRow}>
                      <Text className={classes.popoverSubRowText}>Body</Text>
                      <Text className={classes.popoverSubRowValue}>
                        {formatSize(responseBodySize)}
                      </Text>
                    </Box>
                    <Box className={classes.popoverSubRow} style={{ opacity: 0.6 }}>
                      <Text className={classes.popoverSubRowText}>Uncompressed</Text>
                      <Text className={classes.popoverSubRowValue}>
                        {formatSize(responseBodySize)}
                      </Text>
                    </Box>
                  </Box>

                  <Box className={classes.popoverSection} style={{ marginTop: 12 }}>
                    <Box className={classes.popoverTitleRow}>
                      <Box className={classes.arrowBoxOrange}>
                        <IconArrowUp size={12} color="#fff" />
                      </Box>
                      <Text className={classes.popoverTitleText}>Request Size</Text>
                      <Text className={classes.popoverTitleValue}>
                        {formatSize(requestTotalSize)}
                      </Text>
                    </Box>
                    <Box className={classes.popoverSubRow}>
                      <Text className={classes.popoverSubRowText}>Headers</Text>
                      <Text className={classes.popoverSubRowValue}>
                        {formatSize(requestHeadersSize)}
                      </Text>
                    </Box>
                    <Box className={classes.popoverSubRow}>
                      <Text className={classes.popoverSubRowText}>Body</Text>
                      <Text className={classes.popoverSubRowValue}>
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
            </div>
          </Box>

          <Tabs.Panel value="body" className={classes.panel} keepMounted>
            <ResponseBody response={response || {}} isActive={activeTab === "body"} />
          </Tabs.Panel>

          <Tabs.Panel value="cookies" className={classes.panel} keepMounted>
            <Box className={classes.placeholderTabContent}>
              <Text size="sm" style={{ color: "var(--text-muted)" }}>
                No cookies returned for this response.
              </Text>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="headers" className={classes.panel} keepMounted>
            <ResponseHeaders headers={response?.headers || []} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Box>
  );
}
