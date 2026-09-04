import { useState, useEffect, memo } from "react";
import { Box, Button, Tabs, Menu, Tooltip, Text } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import {
  IconChevronDown,
  IconPlug,
  IconGlobe,
  IconBolt,
  IconAtom,
  IconArrowsExchange,
  IconBroadcast,
  IconPlayerPlay,
  IconCode,
  IconDeviceFloppy,
  IconRss,
} from "@tabler/icons-react";

import { notifications } from "@mantine/notifications";
import { useTabStore } from "@/stores/tabStore";
import { useEnvStore } from "@/stores/envStore";
import { useSseStore } from "@/stores/sseStore";
import { useSnippetStore } from "@/stores/snippetStore";
import { useCollision } from "@/hooks/useCollision";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import UrlInput from "../UrlInput";
import ParamsEditor from "../ParamsEditor";
import HeadersEditor from "../HeadersEditor";
import BodyEditor from "../BodyEditor";
import AuthEditor from "../AuthEditor";
import SseSettingsTab from "./SseSettingsTab";
import CodeSnippetModal from "@/components/snippet/CodeSnippetModal";
import { buildUrlWithParams, parseParamsFromUrl } from "@/utils/url";
import type { HttpRequestDetails, ProtocolType } from "@/types/request";
import classes from "./SseEditor.module.css";

interface SseEditorProps {
  tabId: string;
}

export default memo(function SseEditor({ tabId }: Readonly<SseEditorProps>) {
  const [request, setRequest] = useState<HttpRequestDetails | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("params");
  const setSnippetModalOpen = useSnippetStore((s) => s.setSnippetModalOpen);

  const { containerRef: tabsHeaderRef, leftRef: tabsListRef } = useCollision<HTMLDivElement>({
    gap: 12,
    minExpandedWidth: 380,
    hysteresis: 8,
    dependencies: [request?.name, request?.headers?.length],
  });

  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const isDirty = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.isDirty);
  const markDirty = useTabStore((s) => s.markDirty);
  const markClean = useTabStore((s) => s.markClean);
  const updateTab = useTabStore((s) => s.updateTab);
  const setDraft = useTabStore((s) => s.setDraft);
  const removeDraft = useTabStore((s) => s.removeDraft);
  const tabName = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.name);
  const setProtocol = useTabStore((s) => s.setProtocol);

  const connectionStatus = useSseStore((s) => s.statuses[tabId]) || "disconnected";
  const connectSse = useSseStore((s) => s.connect);
  const disconnectSse = useSseStore((s) => s.disconnect);
  const initEventListeners = useSseStore((s) => s.initEventListeners);

  useEffect(() => {
    initEventListeners();
  }, [initEventListeners]);

  // Load request from disk or drafts
  useEffect(() => {
    let isCancelled = false;
    const currentDraft = useTabStore.getState().drafts[tabId];
    if (currentDraft) {
      setRequest(currentDraft);
      return;
    }

    invoke<HttpRequestDetails>("read_request", { path: tabId })
      .then((data) => {
        if (!isCancelled) {
          const sseReq: HttpRequestDetails = {
            ...data,
            protocol: "sse",
            method: data.method === "POST" ? "POST" : "GET",
          };
          setRequest(sseReq);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("Could not read request file, creating default SSE request:", err);
          const defaultReq: HttpRequestDetails = {
            id: tabId,
            name: tabName || "SSE Stream",
            protocol: "sse",
            method: "GET",
            url: "https://echo.websocket.events/.sse",
            params: [],
            headers: [],
            body: { type: "none" },
            auth: { type: "none" },
            settings: {
              timeoutMs: 0,
              followRedirects: true,
              maxRedirects: 10,
              verifySsl: true,
            },
            sseSettings: {
              autoReconnect: false,
              maxReconnectAttempts: 5,
              reconnectIntervalMs: 3000,
            },
          };
          setRequest(defaultReq);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [tabId, tabName]);

  useEffect(() => {
    if (tabName && request && request.name !== tabName) {
      setRequest((prev) => (prev ? { ...prev, name: tabName } : null));
    }
  }, [tabName]);

  const handleChange = (fields: Partial<HttpRequestDetails>) => {
    if (!request) return;

    let updatedFields = { ...fields };

    // Two-way synchronization between URL and Params
    if (fields.params !== undefined && fields.url === undefined) {
      updatedFields.url = buildUrlWithParams(request.url, fields.params);
    } else if (fields.url !== undefined && fields.params === undefined) {
      updatedFields.params = parseParamsFromUrl(fields.url, request.params);
    }

    const nextRequest = { ...request, ...updatedFields };
    setRequest(nextRequest);
    setDraft(tabId, nextRequest);

    if (updatedFields.name && updatedFields.name !== tabName) {
      updateTab(tabId, { name: updatedFields.name });
    }

    if (updatedFields.method && updatedFields.method !== request.method) {
      updateTab(tabId, { method: updatedFields.method });
    }

    markDirty(tabId);
  };

  const handleSave = async () => {
    if (!request) return;
    try {
      await invoke("update_request", {
        path: tabId,
        request: {
          ...request,
          protocol: "sse",
        },
      });
      markClean(tabId);
      removeDraft(tabId);
      notifications.show({
        title: "Request Saved",
        message: "SSE request configuration saved to disk",
        color: "teal",
        autoClose: 2000,
      });
    } catch (err) {
      console.error("Failed to save SSE request:", err);
      notifications.show({
        title: "Save Failed",
        message: String(err),
        color: "red",
      });
    }
  };

  const handleConnectToggle = () => {
    if (!request) return;
    if (connectionStatus === "connected" || connectionStatus === "connecting") {
      disconnectSse(tabId);
    } else {
      connectSse(tabId, request, activeEnvironmentName || undefined);
    }
  };

  const handleSwitchProtocol = (newProto: ProtocolType) => {
    if (!request) return;
    setProtocol(tabId, newProto);
    handleChange({ protocol: newProto });
  };

  if (!request) {
    return (
      <Box className={classes.container}>
        <Text c="dimmed" size="sm">
          Loading SSE stream details...
        </Text>
      </Box>
    );
  }

  const isStreaming = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <Box className={classes.container}>
      {/* Title Bar with Protocol Selector, Request Name & Actions */}
      <div className={classes.titleRow}>
        <Menu shadow="md" width={180} position="bottom-start">
          <Menu.Target>
            <button className={classes.protocolBtn} type="button">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconRss size={16} color="#e056fd" />
                <span style={{ textTransform: "uppercase" }}>SSE</span>
              </div>
              <IconChevronDown size={14} color="#8e8e93" />
            </button>
          </Menu.Target>
          <Menu.Dropdown className={classes.protocolDropdownDropdown}>
            <Menu.Item
              leftSection={<IconGlobe size={16} color="#10b981" />}
              onClick={() => handleSwitchProtocol("http")}
            >
              HTTP
            </Menu.Item>
            <Menu.Item
              leftSection={<IconPlug size={16} color="#00b4d8" />}
              onClick={() => handleSwitchProtocol("websocket")}
            >
              WebSocket
            </Menu.Item>
            <Menu.Item
              leftSection={<IconRss size={16} color="#e056fd" />}
              onClick={() => handleSwitchProtocol("sse")}
            >
              SSE (Server-Sent Events)
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<IconBolt size={16} color="#eab308" />} disabled>
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ width: 88, display: "inline-block" }}>Socket.IO</span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    padding: "1px 6px",
                    borderRadius: 4,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#8e8e93",
                    whiteSpace: "nowrap",
                  }}
                >
                  Coming soon
                </span>
              </div>
            </Menu.Item>
            <Menu.Item leftSection={<IconAtom size={16} color="#ff007f" />} disabled>
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ width: 88, display: "inline-block" }}>GraphQL</span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    padding: "1px 6px",
                    borderRadius: 4,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#8e8e93",
                    whiteSpace: "nowrap",
                  }}
                >
                  Coming soon
                </span>
              </div>
            </Menu.Item>
            <Menu.Item leftSection={<IconArrowsExchange size={16} color="#007acc" />} disabled>
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ width: 88, display: "inline-block" }}>gRPC</span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    padding: "1px 6px",
                    borderRadius: 4,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#8e8e93",
                    whiteSpace: "nowrap",
                  }}
                >
                  Coming soon
                </span>
              </div>
            </Menu.Item>
            <Menu.Item leftSection={<IconBroadcast size={16} color="#7209b7" />} disabled>
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ width: 88, display: "inline-block" }}>MQTT</span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    padding: "1px 6px",
                    borderRadius: 4,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#8e8e93",
                    whiteSpace: "nowrap",
                  }}
                >
                  Coming soon
                </span>
              </div>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <div className={classes.requestNameContainer}>
          <UndoableTextInput
            variant="unstyled"
            value={request.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            placeholder="SSE Stream Name"
            className={classes.requestNameInput}
          />
        </div>

        <Tooltip label="Code Snippets" position="bottom">
          <Button
            variant="default"
            leftSection={<IconCode size={15} />}
            onClick={() => setSnippetModalOpen(true)}
            className={classes.snippetBtn}
          >
            Code
          </Button>
        </Tooltip>

        <Tooltip label="Save request (Ctrl+S)" position="bottom">
          <Button
            variant="filled"
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            disabled={!isDirty}
            className={classes.saveBtn}
          >
            Save
          </Button>
        </Tooltip>
      </div>

      {/* URL & Connect Bar */}
      <div className={classes.urlRow}>
        <Menu shadow="md" width={110} position="bottom-start">
          <Menu.Target>
            <button
              className={classes.methodSelector}
              type="button"
              style={{
                color: request.method === "POST" ? "#f59e0b" : "#10b981",
              }}
            >
              <span>{request.method || "GET"}</span>
              <IconChevronDown size={14} color="#8e8e93" />
            </button>
          </Menu.Target>
          <Menu.Dropdown className={classes.protocolDropdownDropdown}>
            <Menu.Item
              style={{ color: "#10b981", fontWeight: 700 }}
              onClick={() => handleChange({ method: "GET" })}
            >
              GET
            </Menu.Item>
            <Menu.Item
              style={{ color: "#f59e0b", fontWeight: 700 }}
              onClick={() => handleChange({ method: "POST" })}
            >
              POST
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <div className={classes.urlInputWrapper}>
          <UrlInput
            value={request.url}
            onChange={(newUrl) => handleChange({ url: newUrl })}
            placeholder="https://api.example.com/events or http://localhost:8000/stream"
          />
        </div>

        <Button
          onClick={handleConnectToggle}
          loading={isConnecting}
          className={isStreaming ? classes.disconnectBtn : classes.connectBtn}
          leftSection={
            isStreaming ? <span className={classes.pulseIndicator} /> : <IconPlayerPlay size={16} />
          }
        >
          {isStreaming ? "Stop Stream" : isConnecting ? "Connecting" : "Connect"}
        </Button>
      </div>

      {/* Request Configuration Tabs */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div className={classes.tabsHeader} ref={tabsHeaderRef}>
          <Tabs.List className={classes.tabsList} ref={tabsListRef}>
            <Tabs.Tab value="params">
              Params
              {request.params.filter((p) => p.enabled && p.key).length > 0 &&
                ` (${request.params.filter((p) => p.enabled && p.key).length})`}
            </Tabs.Tab>
            <Tabs.Tab value="headers">
              Headers
              {request.headers.filter((h) => h.enabled && h.key).length > 0 &&
                ` (${request.headers.filter((h) => h.enabled && h.key).length})`}
            </Tabs.Tab>
            {request.method === "POST" && <Tabs.Tab value="body">Body</Tabs.Tab>}
            <Tabs.Tab value="auth">Auth</Tabs.Tab>
            <Tabs.Tab value="settings">Settings</Tabs.Tab>
          </Tabs.List>
        </div>

        <div className={classes.tabsPanel}>
          <Tabs.Panel value="params">
            <ParamsEditor
              params={request.params}
              onChange={(newParams) => handleChange({ params: newParams })}
            />
          </Tabs.Panel>

          <Tabs.Panel value="headers">
            <HeadersEditor
              headers={request.headers}
              onChange={(newHeaders) => handleChange({ headers: newHeaders })}
            />
          </Tabs.Panel>

          {request.method === "POST" && (
            <Tabs.Panel value="body">
              <BodyEditor
                body={request.body}
                onChange={(newBody) => handleChange({ body: newBody })}
              />
            </Tabs.Panel>
          )}

          <Tabs.Panel value="auth">
            <AuthEditor
              auth={request.auth}
              onChange={(newAuth) => handleChange({ auth: newAuth })}
            />
          </Tabs.Panel>

          <Tabs.Panel value="settings">
            <SseSettingsTab
              sseSettings={request.sseSettings}
              requestSettings={request.settings}
              onSseSettingsChange={(newSse) => handleChange({ sseSettings: newSse })}
              onRequestSettingsChange={(newReq) => handleChange({ settings: newReq })}
            />
          </Tabs.Panel>
        </div>
      </Tabs>

      {/* Code Snippet Modal */}
      <CodeSnippetModal request={request} />
    </Box>
  );
});
