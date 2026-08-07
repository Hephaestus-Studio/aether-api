import { useState, useEffect } from "react";
import { Box, Group, Select, TextInput, Button, Tabs } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
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

  if (!request) return null;

  return (
    <Box className={classes.container}>
      <Group gap={8} mb={16}>
        <Select
          data={["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]}
          value={request.method}
          onChange={(val: any) => handleChange({ method: val })}
          className={classes.methodSelect}
        />
        <TextInput
          value={request.url}
          onChange={(e) => handleChange({ url: e.target.value })}
          placeholder="{{baseUrl}}/users"
          className={classes.urlInput}
        />
        <Button onClick={handleSend} loading={loading}>
          Send
        </Button>
        <Button variant="default" onClick={handleSave}>
          Save
        </Button>
      </Group>

      <Tabs defaultValue="params" className={classes.tabs}>
        <Tabs.List>
          <Tabs.Tab value="params">Params</Tabs.Tab>
          <Tabs.Tab value="headers">Headers</Tabs.Tab>
          <Tabs.Tab value="body">Body</Tabs.Tab>
          <Tabs.Tab value="auth">Auth</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="params" className={classes.panel}>
          <ParamsEditor params={request.params} onChange={(val) => handleChange({ params: val })} />
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

        <Tabs.Panel value="auth" className={classes.panel}>
          <AuthEditor auth={request.auth} onChange={(val) => handleChange({ auth: val })} />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
