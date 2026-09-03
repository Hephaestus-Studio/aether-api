import { useState, useEffect, memo } from "react";
import { Box, Button, Tabs, Menu, Tooltip, SegmentedControl, Group, Text } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import {
  IconChevronDown,
  IconPlug,
  IconGlobe,
  IconBolt,
  IconAtom,
  IconArrowsExchange,
  IconBroadcast,
  IconSend,
  IconPlayerStop,
  IconWand,
  IconDeviceFloppy,
} from "@tabler/icons-react";

import { notifications } from "@mantine/notifications";
import { useTabStore } from "@/stores/tabStore";
import { useEnvStore } from "@/stores/envStore";
import { useWebSocketStore } from "@/stores/websocketStore";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import MonacoEditor from "@/components/common/MonacoEditor";
import ParamsEditor from "../ParamsEditor";
import HeadersEditor from "../HeadersEditor";
import AuthEditor from "../AuthEditor";
import WebSocketSavedMessages from "./WebSocketSavedMessages";
import WebSocketSettingsTab from "./WebSocketSettingsTab";
import { buildUrlWithParams, parseParamsFromUrl } from "@/utils/url";
import type { HttpRequestDetails, WebSocketSavedMessage } from "@/types/request";
import classes from "./WebSocketEditor.module.css";

interface WebSocketEditorProps {
  tabId: string;
}

export default memo(function WebSocketEditor({ tabId }: Readonly<WebSocketEditorProps>) {
  const [request, setRequest] = useState<HttpRequestDetails | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("params");

  // Message composer state
  const [composerFormat, setComposerFormat] = useState<"json" | "text" | "binary">("json");
  const [composerPayload, setComposerPayload] = useState(
    '{\n  "message": "Hello from Aether API"\n}',
  );

  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const isDirty = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.isDirty);
  const markDirty = useTabStore((s) => s.markDirty);
  const markClean = useTabStore((s) => s.markClean);
  const updateTab = useTabStore((s) => s.updateTab);
  const setDraft = useTabStore((s) => s.setDraft);
  const removeDraft = useTabStore((s) => s.removeDraft);
  const tabName = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.name);
  const setProtocol = useTabStore((s) => s.setProtocol);

  const connectionStatus = useWebSocketStore((s) => s.statuses[tabId]) || "disconnected";
  const connectWs = useWebSocketStore((s) => s.connect);
  const disconnectWs = useWebSocketStore((s) => s.disconnect);
  const sendMessageWs = useWebSocketStore((s) => s.sendMessage);
  const initEventListeners = useWebSocketStore((s) => s.initEventListeners);

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
          const wsUrl = data.url
            ? data.url.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://")
            : "wss://echo.websocket.org";
          const wsReq: HttpRequestDetails = {
            ...data,
            protocol: "websocket",
            url: wsUrl,
          };
          setRequest(wsReq);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn("Could not read request file, creating default:", err);
          const defaultReq: HttpRequestDetails = {
            id: tabId,
            name: tabName || "WebSocket Request",
            protocol: "websocket",
            method: "GET",
            url: "wss://echo.websocket.org",
            params: [],
            headers: [],
            body: { type: "none" },
            auth: { type: "none" },
            settings: {
              timeoutMs: 30000,
              followRedirects: true,
              maxRedirects: 10,
              verifySsl: true,
            },
            savedMessages: [],
            wsSettings: {
              heartbeatIntervalSecs: 0,
              autoPong: true,
              autoReconnect: false,
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

    markDirty(tabId);
  };

  const handleSave = async () => {
    if (!request || !isDirty) return;
    try {
      await invoke("update_request", { path: tabId, requestDetails: request });
      markClean(tabId);
      removeDraft(tabId);
      notifications.show({
        title: "WebSocket Request Saved",
        message: `Saved "${request.name || "WebSocket Request"}"`,
        color: "green",
        autoClose: 2000,
      });
    } catch (err) {
      console.error("Save error:", err);
      notifications.show({
        title: "Save Failed",
        message: String(err),
        color: "red",
      });
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (isDirty && request) {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isDirty, request, tabId]);

  const handleConnectToggle = () => {
    if (!request) return;

    if (connectionStatus === "connected" || connectionStatus === "connecting") {
      disconnectWs(tabId);
    } else {
      connectWs(tabId, request, activeEnvironmentName ?? undefined);
    }
  };

  const handleSendMessage = () => {
    if (!composerPayload.trim()) return;
    sendMessageWs(tabId, composerFormat, composerPayload, activeEnvironmentName ?? undefined);
  };

  const handlePrettify = () => {
    if (composerFormat !== "json") return;
    try {
      const parsed = JSON.parse(composerPayload);
      setComposerPayload(JSON.stringify(parsed, null, 2));
    } catch {
      notifications.show({
        title: "Invalid JSON",
        message: "Cannot format invalid JSON syntax",
        color: "red",
      });
    }
  };

  const handleSaveAsPreset = () => {
    if (!request) return;
    const newPreset: WebSocketSavedMessage = {
      id: crypto.randomUUID(),
      name: `Message Preset ${(request.savedMessages?.length || 0) + 1}`,
      format: composerFormat,
      payload: composerPayload,
    };
    const nextSaved = [...(request.savedMessages || []), newPreset];
    handleChange({ savedMessages: nextSaved });
    notifications.show({
      title: "Preset Saved",
      message: "Message added to Saved Messages tab",
      color: "teal",
      autoClose: 2000,
    });
  };

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  if (!request) return null;

  return (
    <Box className={classes.container}>
      {/* Title & Protocol Row */}
      <Box className={classes.titleRow}>
        <Menu shadow="md" width={220} position="bottom-start" radius="md">
          <Menu.Target>
            <button type="button" className={classes.protocolBtn} title="Select Protocol">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconPlug size={16} color="#00b4d8" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>WebSocket</span>
              </div>
              <IconChevronDown size={14} style={{ color: "#8e8e93" }} />
            </button>
          </Menu.Target>
          <Menu.Dropdown className={classes.protocolDropdownDropdown}>
            <Menu.Item
              leftSection={<IconGlobe size={16} color="#00b4d8" />}
              onClick={() => {
                setProtocol(tabId, "http");
                handleChange({ protocol: "http" });
              }}
            >
              <span style={{ width: 88, display: "inline-block" }}>HTTP</span>
            </Menu.Item>
            <Menu.Item
              leftSection={<IconPlug size={16} color="#00b4d8" />}
              onClick={() => {
                setProtocol(tabId, "websocket");
                handleChange({ protocol: "websocket" });
              }}
            >
              <span style={{ width: 88, display: "inline-block" }}>WebSocket</span>
            </Menu.Item>

            <Menu.Item leftSection={<IconBolt size={16} color="#ffca3a" />} disabled>
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
                    lineHeight: 1.3,
                    letterSpacing: "0.2px",
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
                    lineHeight: 1.3,
                    letterSpacing: "0.2px",
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
                    lineHeight: 1.3,
                    letterSpacing: "0.2px",
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
                    lineHeight: 1.3,
                    letterSpacing: "0.2px",
                  }}
                >
                  Coming soon
                </span>
              </div>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Box className={classes.requestNameContainer}>
          <UndoableTextInput
            value={request.name || ""}
            onValueChange={(val) => handleChange({ name: val })}
            className={classes.requestNameInput}
            placeholder="Request Name"
          />
        </Box>

        <Button
          className={classes.saveBtn}
          onClick={handleSave}
          disabled={!isDirty}
          data-disabled={!isDirty || undefined}
        >
          Save
        </Button>
      </Box>

      {/* Address Bar & Connect Row */}
      <Box className={classes.addressBarRow}>
        <Box className={classes.urlInputContainer}>
          <UndoableTextInput
            value={request.url}
            onValueChange={(val) => handleChange({ url: val })}
            className={classes.urlInput}
            placeholder="wss://echo.websocket.org or {{ws_url}}"
          />
        </Box>

        <Button
          className={classes.connectBtn}
          color={isConnected ? "red" : "blue"}
          variant={isConnected ? "light" : "filled"}
          loading={isConnecting}
          leftSection={isConnected ? <IconPlayerStop size={16} /> : <IconPlug size={16} />}
          onClick={handleConnectToggle}
        >
          {isConnected ? "Disconnect" : isConnecting ? "Connecting..." : "Connect"}
        </Button>

        {/* Status Indicator */}
        <Box className={`${classes.statusIndicator} ${classes[connectionStatus]}`}>
          <span
            className={`${classes.pulseDot} ${isConnected || isConnecting ? classes.active : ""}`}
          />
          <span>{connectionStatus.toUpperCase()}</span>
        </Box>
      </Box>

      {/* Handshake & Configuration Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} className={classes.tabs} keepMounted={false}>
        <Tabs.List className={classes.tabList}>
          <Tabs.Tab value="params">
            Params{" "}
            {request.params?.filter((p) => p.enabled && p.key).length > 0 &&
              `(${request.params.filter((p) => p.enabled && p.key).length})`}
          </Tabs.Tab>
          <Tabs.Tab value="headers">
            Headers{" "}
            {request.headers?.filter((h) => h.enabled && h.key).length > 0 &&
              `(${request.headers.filter((h) => h.enabled && h.key).length})`}
          </Tabs.Tab>
          <Tabs.Tab value="auth">Auth</Tabs.Tab>
          <Tabs.Tab value="saved">
            Saved Messages{" "}
            {request.savedMessages?.length ? `(${request.savedMessages.length})` : ""}
          </Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="params" className={classes.panel}>
          <ParamsEditor
            params={request.params || []}
            onChange={(params) => handleChange({ params })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="headers" className={classes.panel}>
          <HeadersEditor
            headers={request.headers || []}
            onChange={(headers) => handleChange({ headers })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="auth" className={classes.panel}>
          <AuthEditor
            auth={request.auth || { type: "none" }}
            onChange={(auth) => handleChange({ auth })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="saved" className={classes.panel}>
          <WebSocketSavedMessages
            messages={request.savedMessages || []}
            onChange={(savedMessages) => handleChange({ savedMessages })}
            onLoadToComposer={(fmt, pld) => {
              setComposerFormat(fmt);
              setComposerPayload(pld);
            }}
            onSendDirect={(fmt, pld) => {
              sendMessageWs(tabId, fmt, pld, activeEnvironmentName ?? undefined);
            }}
            isConnected={isConnected}
          />
        </Tabs.Panel>

        <Tabs.Panel value="settings" className={classes.panel}>
          <WebSocketSettingsTab
            settings={request.wsSettings}
            onChange={(wsSettings) => handleChange({ wsSettings })}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Message Composer (Bottom Area) */}
      <Box className={classes.composerSection}>
        <Box className={classes.composerHeader}>
          <Group gap="xs">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Message Composer
            </Text>
            <SegmentedControl
              size="xs"
              value={composerFormat}
              onChange={(val) => setComposerFormat(val as any)}
              data={[
                { label: "JSON", value: "json" },
                { label: "Text", value: "text" },
                { label: "Binary", value: "binary" },
              ]}
            />
          </Group>

          <Box className={classes.composerControls}>
            {composerFormat === "json" && (
              <Tooltip label="Prettify JSON" position="top">
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconWand size={14} />}
                  onClick={handlePrettify}
                >
                  Format
                </Button>
              </Tooltip>
            )}

            <Tooltip label="Save as preset template" position="top">
              <Button
                size="xs"
                variant="subtle"
                color="blue"
                leftSection={<IconDeviceFloppy size={14} />}
                onClick={handleSaveAsPreset}
              >
                Save Preset
              </Button>
            </Tooltip>
          </Box>
        </Box>

        <Box className={classes.composerEditorContainer}>
          <MonacoEditor
            height="100%"
            language={composerFormat === "json" ? "json" : "plaintext"}
            value={composerPayload}
            onChange={(val) => setComposerPayload(val || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              tabSize: 2,
            }}
          />
        </Box>

        <Box className={classes.composerFooter}>
          <Text size="xs" c="dimmed">
            Tip: Press Ctrl+Enter or click Send to transmit frame.
          </Text>

          <Button
            size="xs"
            color="blue"
            disabled={!isConnected || !composerPayload.trim()}
            leftSection={<IconSend size={14} />}
            onClick={handleSendMessage}
          >
            Send Message
          </Button>
        </Box>
      </Box>
    </Box>
  );
});
