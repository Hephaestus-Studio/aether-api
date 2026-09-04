import { useState, useEffect, memo } from "react";
import { Box, Button, Tabs, Menu, ScrollArea, Tooltip } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import {
  IconChevronDown,
  IconGlobe,
  IconPlug,
  IconBolt,
  IconAtom,
  IconArrowsExchange,
  IconBroadcast,
  IconCode,
  IconRss,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useTabStore } from "@/stores/tabStore";
import { useEnvStore } from "@/stores/envStore";
import { useSnippetStore } from "@/stores/snippetStore";
import { useCollision } from "@/hooks/useCollision";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import MethodSelector from "./MethodSelector";
import ParamsEditor from "./ParamsEditor";
import HeadersEditor from "./HeadersEditor";
import BodyEditor from "./BodyEditor";
import AuthEditor from "./AuthEditor";
import UrlInput from "./UrlInput";
import CodeSnippetModal from "@/components/snippet/CodeSnippetModal";

import type { ParsedCurl } from "@/utils/curlParser";
import { buildUrlWithParams, parseParamsFromUrl } from "@/utils/url";
import type { HttpRequestDetails } from "@/types/request";
import classes from "./RequestEditor.module.css";

interface RequestEditorProps {
  tabId: string;
}

export default memo(function RequestEditor({ tabId }: Readonly<RequestEditorProps>) {
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
  const setSnippetModalOpen = useSnippetStore((s) => s.setSnippetModalOpen);
  const setDraft = useTabStore((s) => s.setDraft);
  const removeDraft = useTabStore((s) => s.removeDraft);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const isActive = activeTabId === tabId;
  const tabName = useTabStore((s) => s.tabs.find((t) => t.id === tabId)?.name);

  // Synchronize request name if updated externally (e.g. from Sidebar rename)
  useEffect(() => {
    if (tabName && request && request.name !== tabName) {
      setRequest((prev) => (prev ? { ...prev, name: tabName } : null));
    }
  }, [tabName]);

  const activeProtocol = useTabStore((s) => s.protocols[tabId]) || "http";
  const setProtocol = useTabStore((s) => s.setProtocol);

  const getProtocolIcon = (proto: string) => {
    switch (proto) {
      case "http":
        return <IconGlobe size={16} color="#00b4d8" />;
      case "websocket":
        return <IconPlug size={16} color="#00b4d8" />;
      case "sse":
        return <IconRss size={16} color="#e056fd" />;
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
    if (proto === "websocket" || proto === "sse") {
      setResponsePanelOpened(true);
    } else {
      notifications.show({
        title: "Protocol Selected",
        message: `Switched to ${proto.toUpperCase()} client layout (pipeline integration coming soon).`,
        color: "indigo",
      });
    }
    if (request) {
      handleChange({ protocol: proto });
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const currentDraft = useTabStore.getState().drafts[tabId];
    if (currentDraft) {
      setRequest(currentDraft);
      return;
    }

    invoke<any>("read_request", { path: tabId })
      .then((res) => {
        if (!isCancelled && res) {
          if (res.params && res.params.length > 0 && res.url) {
            const syncedUrl = buildUrlWithParams(res.url, res.params);
            setRequest({ ...res, url: syncedUrl });
          } else {
            setRequest(res);
          }
          markClean(tabId);
        }
      })
      .catch((err) => {
        if (!isCancelled) console.error("Error reading request details:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [tabId]);

  const handleSend = async () => {
    if (!request) return;
    setResponsePanelOpened(true);
    setLoading(true);
    setTabLoading(tabId, true);
    setResponse(tabId, null);
    try {
      // Auto-save request details to disk only if there are unsaved changes
      if (isDirty) {
        await invoke("update_request", { path: tabId, requestDetails: request });
        markClean(tabId);
        removeDraft(tabId);
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
      const rawMsg = String(err?.message || err);
      if (rawMsg.toLowerCase().includes("cancelled") || rawMsg.includes("RequestCancelled")) {
        return;
      }

      let displayMsg = rawMsg;
      let errorCode = "NETWORK_ERROR";
      try {
        const parsed = JSON.parse(rawMsg);
        if (parsed.message) displayMsg = parsed.message;
        if (parsed.code) errorCode = parsed.code;
      } catch {
        if (displayMsg.includes("Tauri error")) {
          displayMsg = "Check URL format or backend server availability.";
        }
      }

      setResponse(tabId, { error: displayMsg, code: errorCode });
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
      removeDraft(tabId);
      notifications.show({
        title: "Request Saved",
        message: `Saved changes to "${request.name || "Request"}"`,
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
    if (updatedFields.method) {
      updateTab(tabId, { method: updatedFields.method });
    }
    if (updatedFields.name) {
      updateTab(tabId, { name: updatedFields.name });
    }
    markDirty(tabId);
  };

  const handleImportCurl = (parsed: ParsedCurl) => {
    if (!request) return;

    const updates: Partial<HttpRequestDetails> = {
      method: parsed.method,
      url: parsed.url,
    };

    if (parsed.headers && parsed.headers.length > 0) {
      updates.headers = parsed.headers;
    }
    if (parsed.auth) {
      updates.auth = parsed.auth;
    }
    if (parsed.body) {
      updates.body = parsed.body;
    }

    const parsedParams = parseParamsFromUrl(parsed.url, request.params);
    if (parsedParams && parsedParams.length > 0) {
      updates.params = parsedParams;
    }

    handleChange(updates);

    notifications.show({
      title: "cURL Command Imported",
      message: `Converted ${parsed.method} request with ${parsed.headers?.length || 0} headers into active request`,
      color: "green",
      autoClose: 3000,
    });
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
            <button type="button" className={classes.protocolBtn} title="Select Protocol">
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
            <Menu.Item
              leftSection={<IconPlug size={16} color="#00b4d8" />}
              onClick={() => handleProtocolChange("websocket")}
            >
              <span style={{ width: 88, display: "inline-block" }}>WebSocket</span>
            </Menu.Item>
            <Menu.Item
              leftSection={<IconRss size={16} color="#e056fd" />}
              onClick={() => handleProtocolChange("sse")}
            >
              <span style={{ width: 88, display: "inline-block" }}>SSE</span>
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
            placeholder="Request Name"
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

        <Button
          variant="default"
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
            onImportCurl={handleImportCurl}
            placeholder="Enter URL or paste cURL text"
            className={classes.urlInput}
          />
        </div>
        {loading ? (
          <Button onClick={handleCancel} color="red" variant="filled" className={classes.sendBtn}>
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

      {/* Code Snippet Generator Modal - only render for active tab to prevent multi-modal overlap */}
      {isActive && <CodeSnippetModal request={request} requestPath={tabId} />}
    </Box>
  );
});
