import { useState, useEffect } from "react";
import { Box, TextInput, Button, Tabs, Menu, ScrollArea } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import {
  IconChevronDown,
  IconGlobe,
  IconPlug,
  IconBolt,
  IconAtom,
  IconArrowsExchange,
  IconBroadcast,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useTabStore } from "@/stores/tabStore";
import { useEnvStore } from "@/stores/envStore";
import { useCollision } from "@/hooks/useCollision";
import MethodSelector from "./MethodSelector";
import ParamsEditor from "./ParamsEditor";
import HeadersEditor from "./HeadersEditor";
import BodyEditor from "./BodyEditor";
import AuthEditor from "./AuthEditor";
import UrlInput from "./UrlInput";
import { buildUrlWithParams, parseParamsFromUrl } from "@/utils/url";
import type { HttpRequestDetails } from "@/types/request";
import classes from "./RequestEditor.module.css";

interface RequestEditorProps {
  tabId: string;
}

export default function RequestEditor({ tabId }: Readonly<RequestEditorProps>) {
  const [request, setRequest] = useState<HttpRequestDetails | null>(null);

  const {
    containerRef: tabsHeaderRef,
    leftRef: tabsListRef,
    isColliding: isTabsColliding,
  } = useCollision<HTMLDivElement>({
    gap: 12,
    minExpandedWidth: 380,
    hysteresis: 8,
    dependencies: [request?.name, request?.headers?.length],
  });

  const [activeTab, setActiveTab] = useState<string | null>("params");
  const isCompact = isTabsColliding;
  const [loading, setLoading] = useState(false);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const isDirty = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.isDirty);
  const markDirty = useTabStore((s) => s.markDirty);
  const markClean = useTabStore((s) => s.markClean);
  const updateTab = useTabStore((s) => s.updateTab);
  const setResponse = useTabStore((s) => s.setResponse);
  const setTabLoading = useTabStore((s) => s.setLoading);
  const setResponsePanelOpened = useTabStore((s) => s.setResponsePanelOpened);

  const activeProtocol = useTabStore((s) => s.protocols[tabId]) || "http";
  const setProtocol = useTabStore((s) => s.setProtocol);

  const getProtocolIcon = (proto: string) => {
    switch (proto) {
      case "http":
        return <IconGlobe size={16} color="#00b4d8" />;
      case "websocket":
        return <IconPlug size={16} color="#ff9f1c" />;
      case "socketio":
        return <IconBolt size={16} color="#ffca3a" />;
      case "graphql":
        return <IconAtom size={16} color="#ff007f" />;
      case "grpc":
        return <IconArrowsExchange size={16} color="#007acc" />;
      case "mqtt":
        return <IconBroadcast size={16} color="#7209b7" />;
      default:
        return <IconGlobe size={16} color="#00b4d8" />;
    }
  };

  const handleProtocolChange = (proto: string) => {
    setProtocol(tabId, proto);
    notifications.show({
      title: "Protocol Selected",
      message: `Switched to ${proto.toUpperCase()} client layout (pipeline integration coming soon).`,
      color: "indigo",
    });
  };

  useEffect(() => {
    invoke<any>("read_request", { path: tabId })
      .then((res) => {
        if (res) {
          if (res.params && res.params.length > 0 && res.url) {
            const syncedUrl = buildUrlWithParams(res.url, res.params);
            setRequest({ ...res, url: syncedUrl });
          } else {
            setRequest(res);
          }
        }
      })
      .catch((err) => console.error("Error reading request details:", err));
  }, [tabId]);

  const handleSend = async () => {
    if (!request) return;
    setResponsePanelOpened(true);
    setLoading(true);
    setTabLoading(tabId, true);
    try {
      // Auto-save request details to disk only if there are unsaved changes
      if (isDirty) {
        await invoke("update_request", { path: tabId, requestDetails: request });
        markClean(tabId);
      }

      const response = await invoke<any>("execute_request", {
        requestPath: tabId,
        requestDetails: request,
        activeEnvironmentName,
      });
      console.log("HTTP Response:", response);
      setResponse(tabId, response);
    } catch (err: any) {
      console.error("HTTP Request execution error:", err);
      const errorMsg = String(err?.message || err);
      if (
        errorMsg.toLowerCase().includes("cancelled") ||
        errorMsg.includes("RequestCancelled")
      ) {
        return;
      }
      let displayMsg = errorMsg;
      if (displayMsg.includes("Tauri error")) {
        displayMsg = "Check URL format or backend server availability.";
      }
      notifications.show({
        title: "Request Failed",
        message: displayMsg,
        color: "red",
      });
    } finally {
      setLoading(false);
      setTabLoading(tabId, false);
    }
  };

  const handleCancel = async () => {
    try {
      await invoke("cancel_request", { requestPath: tabId });
      notifications.show({
        title: "Request Cancelled",
        message: "The HTTP request was cancelled.",
        color: "yellow",
      });
    } catch (err) {
      console.warn("Cancel request error:", err);
    } finally {
      setLoading(false);
      setTabLoading(tabId, false);
    }
  };

  const handleSave = async () => {
    if (!request || !isDirty) return;
    try {
      await invoke("update_request", { path: tabId, requestDetails: request });
      markClean(tabId);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleChange = (fields: Partial<HttpRequestDetails>) => {
    if (!request) return;

    let updatedFields = { ...fields };

    // Two-way synchronization between URL and Params
    if (fields.params !== undefined && fields.url === undefined) {
      updatedFields.url = buildUrlWithParams(request.url, fields.params);
    } else if (fields.url !== undefined && fields.params === undefined) {
      updatedFields.params = parseParamsFromUrl(fields.url, request.params);
    }

    setRequest({ ...request, ...updatedFields });
    if (updatedFields.method) {
      updateTab(tabId, { method: updatedFields.method });
    }
    if (updatedFields.name) {
      updateTab(tabId, { name: updatedFields.name });
    }
    markDirty(tabId);
  };

  if (!request) return null;

  const activeHeadersCount = request.headers.filter((h) => h.enabled && h.key.trim() !== "").length;

  const getTabLabel = (val: string | null) => {
    switch (val) {
      case "params":
        return "Params";
      case "auth":
        return "Authorization";
      case "headers":
        return `Headers${activeHeadersCount > 0 ? ` (${activeHeadersCount})` : ""}`;
      case "body":
        return "Body";
      default:
        return "Params";
    }
  };

  return (
    <Box className={classes.container}>
      {/* Title / Action Row */}
      <div className={classes.titleRow}>
        <Menu shadow="md" width={220} position="bottom-start" radius="md">
          <Menu.Target>
            <button
              type="button"
              className={classes.protocolBtn}
              title="Select Protocol"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {getProtocolIcon(activeProtocol)}
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {activeProtocol.toUpperCase()}
                </span>
              </div>
              <IconChevronDown size={14} style={{ color: "#8e8e93" }} />
            </button>
          </Menu.Target>
          <Menu.Dropdown className={classes.protocolDropdownDropdown}>
            <Menu.Item
              leftSection={<IconGlobe size={16} color="#00b4d8" />}
              onClick={() => handleProtocolChange("http")}
            >
              <span style={{ width: 88, display: "inline-block" }}>HTTP</span>
            </Menu.Item>
            <Menu.Item leftSection={<IconPlug size={16} color="#ff9f1c" />} disabled>
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ width: 88, display: "inline-block" }}>WebSocket</span>
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

        <div className={classes.requestNameContainer}>
          <TextInput
            variant="unstyled"
            value={request.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            placeholder="Request Name"
            className={classes.requestNameInput}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={!isDirty}
          className={classes.saveBtn}
        >
          Save
        </Button>
      </div>

      {/* Address Bar Row */}
      <div className={classes.addressBarRow}>
        <MethodSelector value={request.method} onChange={(val) => handleChange({ method: val })} />
        <div className={classes.urlInputContainer}>
          <UrlInput
            value={request.url}
            onChange={(val) => handleChange({ url: val })}
            placeholder="Enter URL or paste text"
            className={classes.urlInput}
          />
        </div>
        {loading ? (
          <Button
            onClick={handleCancel}
            color="red"
            variant="filled"
            className={classes.sendBtn}
          >
            Cancel
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            className={classes.sendBtn}
            style={{ backgroundColor: "var(--mantine-color-blue-6)" }}
          >
            Send
          </Button>
        )}
      </div>

      {/* Postman Style Tabs with Responsive Dropdown Fallback */}
      <Tabs value={activeTab} onChange={setActiveTab} className={classes.tabs}>
        <div ref={tabsHeaderRef} className={classes.tabHeaderWrapper}>
          {isCompact ? (
            <div className={classes.compactTabHeader}>
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
                    onClick={() => setActiveTab("params")}
                    className={activeTab === "params" ? classes.compactItemActive : ""}
                  >
                    Params
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setActiveTab("auth")}
                    className={activeTab === "auth" ? classes.compactItemActive : ""}
                  >
                    Authorization
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setActiveTab("headers")}
                    className={activeTab === "headers" ? classes.compactItemActive : ""}
                  >
                    Headers{activeHeadersCount > 0 ? ` (${activeHeadersCount})` : ""}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setActiveTab("body")}
                    className={activeTab === "body" ? classes.compactItemActive : ""}
                  >
                    Body
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          ) : (
            <div className={classes.tabListContainer}>
              <div ref={tabsListRef} style={{ flex: 1, minWidth: 0 }}>
                <ScrollArea
                  scrollbars="x"
                  className={classes.tabScrollArea}
                  type="never"
                  offsetScrollbars={false}
                >
                  <Tabs.List className={classes.tabList}>
                    <Tabs.Tab value="params">Params</Tabs.Tab>
                    <Tabs.Tab value="auth">Authorization</Tabs.Tab>
                    <Tabs.Tab value="headers">
                      Headers{activeHeadersCount > 0 ? ` (${activeHeadersCount})` : ""}
                    </Tabs.Tab>
                    <Tabs.Tab value="body">Body</Tabs.Tab>
                  </Tabs.List>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <Tabs.Panel value="params" className={classes.panel}>
          <ParamsEditor params={request.params} onChange={(val) => handleChange({ params: val })} />
        </Tabs.Panel>

        <Tabs.Panel value="auth" className={classes.panel}>
          <AuthEditor auth={request.auth} onChange={(val) => handleChange({ auth: val })} />
        </Tabs.Panel>

        <Tabs.Panel value="headers" className={classes.panel}>
          <HeadersEditor
            headers={request.headers}
            onChange={(val) => handleChange({ headers: val })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="body" className={classes.panel}>
          <BodyEditor body={request.body} onChange={(val) => handleChange({ body: val })} />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
