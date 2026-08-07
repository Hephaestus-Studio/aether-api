import { useState } from "react";
import { Box, Group, Text, Badge, Tabs } from "@mantine/core";
import ResponseBody from "./ResponseBody";
import ResponseHeaders from "./ResponseHeaders";
import ResponseTimeline from "./ResponseTimeline";
import classes from "./ResponseViewer.module.css";

interface ResponseViewerProps {
  tabId: string;
}

export default function ResponseViewer(_props: Readonly<ResponseViewerProps>) {
  const [response] = useState<any>({
    status: 200,
    statusText: "OK",
    sizeBytes: 1205,
    timing: { ttfbMs: 28, totalMs: 47, downloadMs: 19 },
    headers: [
      ["Content-Type", "application/json"],
      ["Server", "nginx"],
    ],
    body: '{\n  "status": "success",\n  "data": {\n    "id": 1024,\n    "name": "Jane Doe"\n  }\n}',
    bodyType: "json",
  });

  return (
    <Box className={classes.container}>
      <Group gap={16} mb={12}>
        <Badge color="green" size="lg">
          {response.status} {response.statusText}
        </Badge>
        <Text size="xs" style={{ color: "var(--text-muted)" }}>
          Time:{" "}
          <strong style={{ color: "var(--text-primary)" }}>{response.timing.totalMs}ms</strong>
        </Text>
        <Text size="xs" style={{ color: "var(--text-muted)" }}>
          Size: <strong style={{ color: "var(--text-primary)" }}>{response.sizeBytes} B</strong>
        </Text>
      </Group>

      <Tabs defaultValue="body" className={classes.tabs}>
        <Tabs.List>
          <Tabs.Tab value="body">Response Body</Tabs.Tab>
          <Tabs.Tab value="headers">Headers</Tabs.Tab>
          <Tabs.Tab value="timeline">Timeline</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="body" className={classes.panel}>
          <ResponseBody response={response} />
        </Tabs.Panel>

        <Tabs.Panel value="headers" className={classes.panel}>
          <ResponseHeaders headers={response.headers} />
        </Tabs.Panel>

        <Tabs.Panel value="timeline" className={classes.panel}>
          <ResponseTimeline timing={response.timing} />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
