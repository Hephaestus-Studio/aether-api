import { useState, useEffect } from "react";
import { Box, Select, TextInput, Button, Tabs } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { IconDeviceFloppy, IconChevronDown, IconGlobe } from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import { useEnvStore } from "@/stores/envStore";
import ParamsEditor from "./ParamsEditor";
import HeadersEditor from "./HeadersEditor";
import BodyEditor from "./BodyEditor";
import AuthEditor from "./AuthEditor";
import type { HttpRequestDetails } from "@/types/request";
import classes from "./RequestEditor.module.css";

interface RequestEditorProps {
  tabId: string;
}

export default function RequestEditor({ tabId }: Readonly<RequestEditorProps>) {
  const [request, setRequest] = useState<HttpRequestDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const markDirty = useTabStore((s) => s.markDirty);
  const markClean = useTabStore((s) => s.markClean);

  useEffect(() => {
    invoke<any>("read_request", { path: tabId })
      .then((res) => setRequest(res))
      .catch((err) => console.error("Error reading request details:", err));
  }, [tabId]);

  const handleSend = async () => {
    if (!request) return;
    setLoading(true);
    try {
      const response = await invoke<any>("execute_request", {
        requestPath: tabId,
        activeEnvironmentName,
      });
      console.log("HTTP Response:", response);
    } catch (err) {
      console.error("HTTP Request execution error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!request) return;
    try {
      await invoke("update_request", { path: tabId, requestDetails: request });
      markClean(tabId);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleChange = (fields: Partial<HttpRequestDetails>) => {
    if (!request) return;
    setRequest({ ...request, ...fields });
    markDirty(tabId);
  };

  const getMethodColor = (method?: string) => {
    const m = (method || "GET").toUpperCase();
    switch (m) {
      case "GET":
        return "#10b981";
      case "POST":
        return "#f59e0b";
      case "PUT":
        return "#3b82f6";
      case "PATCH":
        return "#8b5cf6";
      case "DELETE":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  if (!request) return null;

  const activeHeadersCount = request.headers.filter((h) => h.enabled && h.key.trim() !== "").length;

  return (
    <Box className={classes.container}>
      {/* Title Row */}
      <div className={classes.titleRow}>
        <div className={classes.requestTitleGroup}>
          <IconGlobe size={18} color={getMethodColor(request.method)} />
          <TextInput
            variant="unstyled"
            value={request.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            placeholder="Request Name"
            className={classes.requestNameInput}
          />
        </div>
        <Button
          variant="subtle"
          leftSection={<IconDeviceFloppy size={15} />}
          onClick={handleSave}
          className={classes.saveBtn}
          size="xs"
        >
          Save
        </Button>
      </div>

      {/* Address Bar Row */}
      <div className={classes.addressBarRow}>
        <div className={classes.addressBarContainer}>
          <Select
            data={["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]}
            value={request.method}
            onChange={(val: any) => handleChange({ method: val })}
            variant="unstyled"
            className={classes.methodSelect}
            styles={{
              input: {
                color: getMethodColor(request.method),
                fontWeight: 700,
              },
            }}
          />
          <div className={classes.addressBarSeparator} />
          <TextInput
            value={request.url}
            onChange={(e) => handleChange({ url: e.target.value })}
            placeholder="Enter URL or paste text"
            variant="unstyled"
            className={classes.urlInput}
          />
        </div>
        <Button
          onClick={handleSend}
          loading={loading}
          className={classes.sendBtn}
          rightSection={<IconChevronDown size={14} style={{ opacity: 0.8 }} />}
          style={{ backgroundColor: "var(--mantine-color-blue-6)" }}
        >
          Send
        </Button>
      </div>

      {/* Postman Style Tabs */}
      <Tabs defaultValue="params" className={classes.tabs}>
        <div className={classes.tabListContainer}>
          <Tabs.List className={classes.tabList}>
            <Tabs.Tab value="params">Params</Tabs.Tab>
            <Tabs.Tab value="auth">Authorization</Tabs.Tab>
            <Tabs.Tab value="headers">
              Headers{activeHeadersCount > 0 ? ` (${activeHeadersCount})` : ""}
            </Tabs.Tab>
            <Tabs.Tab value="body">Body</Tabs.Tab>
            <Tabs.Tab value="pre-script" disabled>
              Pre-request Script
            </Tabs.Tab>
            <Tabs.Tab value="tests" disabled>
              Tests
            </Tabs.Tab>
            <Tabs.Tab value="settings" disabled>
              Settings
            </Tabs.Tab>
          </Tabs.List>
          <Button variant="transparent" size="xs" color="blue" style={{ fontWeight: 500 }}>
            Cookies
          </Button>
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
