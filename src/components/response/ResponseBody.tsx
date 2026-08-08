import { useState, useRef, useEffect } from "react";
import { Box, Group, SegmentedControl, Menu, Button, ActionIcon, Text } from "@mantine/core";
import { IconChevronDown, IconCode, IconCopy, IconSearch, IconDownload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import Editor from "@monaco-editor/react";
import classes from "./ResponseViewer.module.css";

interface ResponseBodyProps {
  response: any;
}

const formatXML = (text: string) => {
  try {
    let formatted = "";
    const reg = /(>)(<)(\/*)/g;
    let xml = text.replace(reg, "$1\r\n$2$3");
    let pad = 0;
    xml.split("\r\n").forEach((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }

      let padding = "";
      for (let i = 0; i < pad; i++) {
        padding += "  ";
      }

      formatted += padding + node + "\r\n";
      pad += indent;
    });
    return formatted.trim();
  } catch {
    return text;
  }
};

export default function ResponseBody({ response }: Readonly<ResponseBodyProps>) {
  const [mode, setMode] = useState<string>("pretty");
  const [language, setLanguage] = useState<string>("auto");
  const [formattedContent, setFormattedContent] = useState<string>("");
  const editorRef = useRef<any>(null);

  const initialLanguage = response.bodyType || "json";

  useEffect(() => {
    const activeLang = language === "auto" ? initialLanguage : language;
    if (mode === "pretty") {
      if (activeLang === "json") {
        try {
          setFormattedContent(JSON.stringify(JSON.parse(response.body), null, 2));
        } catch {
          setFormattedContent(response.body);
        }
      } else if (activeLang === "xml") {
        setFormattedContent(formatXML(response.body));
      } else {
        setFormattedContent(response.body);
      }
    } else {
      setFormattedContent(response.body);
    }
  }, [response.body, initialLanguage, mode, language]);

  const handleDownloadResponse = () => {
    const blob = new Blob([response.body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrettify = () => {
    const activeLang = language === "auto" ? initialLanguage : language;
    if (activeLang === "json") {
      try {
        const parsed = JSON.parse(response.body);
        setFormattedContent(JSON.stringify(parsed, null, 2));
        notifications.show({
          title: "Prettified",
          message: "JSON content formatted successfully.",
          color: "green",
        });
      } catch (err) {
        notifications.show({
          title: "Formatting Failed",
          message: "Invalid JSON format: " + (err as Error).message,
          color: "red",
        });
      }
    } else if (activeLang === "xml") {
      setFormattedContent(formatXML(response.body));
      notifications.show({
        title: "Prettified",
        message: "XML content formatted successfully.",
        color: "green",
      });
    } else {
      notifications.show({
        message: "Prettify is only supported for JSON and XML formats currently.",
        color: "blue",
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response.body);
    notifications.show({
      message: "Response body copied to clipboard!",
      color: "indigo",
    });
  };

  const handleSearch = () => {
    if (editorRef.current) {
      editorRef.current.trigger("source", "actions.find", null);
    }
  };

  const isBinary = response.bodyType === "binary";

  if (isBinary) {
    return (
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 32,
        }}
      >
        <Text size="sm" mb={12} style={{ color: "var(--text-muted)" }}>
          Binary response or format not supported by the previewer.
        </Text>
        <Button
          variant="light"
          size="xs"
          color="indigo"
          leftSection={<IconDownload size={14} />}
          onClick={handleDownloadResponse}
        >
          Download Response
        </Button>
      </Box>
    );
  }

  const editorLanguage = language === "auto" ? initialLanguage : language;

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Sub-control bar */}
      <Box className={classes.bodyControlBar}>
        <Box className={classes.bodyControlLeft}>
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={setMode}
            style={{ width: 320 }}
            data={[
              { label: "Pretty", value: "pretty" },
              { label: "Raw", value: "raw" },
              { label: "Preview", value: "preview" },
              { label: "Visualize", value: "visualize" },
            ]}
          />

          {mode === "pretty" && (
            <Group gap={4}>
              <Menu shadow="md" width={120}>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="gray"
                    rightSection={<IconChevronDown size={12} />}
                    style={{ fontSize: 12, height: 26, padding: "0 8px" }}
                  >
                    {language === "auto"
                      ? `Auto (${initialLanguage.toUpperCase()})`
                      : language.toUpperCase()}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => setLanguage("json")}>JSON</Menu.Item>
                  <Menu.Item onClick={() => setLanguage("xml")}>XML</Menu.Item>
                  <Menu.Item onClick={() => setLanguage("html")}>HTML</Menu.Item>
                  <Menu.Item onClick={() => setLanguage("text")}>TEXT</Menu.Item>
                  <Menu.Item onClick={() => setLanguage("auto")}>Auto Detect</Menu.Item>
                </Menu.Dropdown>
              </Menu>

              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={handlePrettify}
                title="Prettify code"
              >
                <IconCode size={16} />
              </ActionIcon>
            </Group>
          )}
        </Box>

        <Box className={classes.bodyControlRight}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={handleCopy}
            title="Copy response body"
          >
            <IconCopy size={16} />
          </ActionIcon>
          {(mode === "pretty" || mode === "raw") && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={handleSearch}
              title="Search content"
            >
              <IconSearch size={16} />
            </ActionIcon>
          )}
        </Box>
      </Box>

      <Box className={classes.editorContainer}>
        {(mode === "pretty" || mode === "raw") && (
          <Editor
            height="100%"
            language={
              mode === "raw"
                ? "plaintext"
                : editorLanguage === "text"
                  ? "plaintext"
                  : editorLanguage
            }
            theme="aether-dark"
            value={mode === "raw" ? response.body : formattedContent}
            beforeMount={(monaco) => {
              monaco.editor.defineTheme("aether-dark", {
                base: "vs-dark",
                inherit: true,
                rules: [],
                colors: {
                  "editor.background": "#212121", // matching var(--bg-panel)
                },
              });
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            loading={
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--text-muted)",
                }}
              >
                Loading editor...
              </Box>
            }
            options={{
              readOnly: true,
              minimap: { enabled: false },
              folding: true,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: "JetBrains Mono, Fira Code, monospace",
              renderLineHighlight: "none",
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
              },
            }}
          />
        )}

        {mode === "preview" && (
          <Box
            style={{ height: "100%", width: "100%", backgroundColor: "#fff", overflow: "hidden" }}
          >
            {editorLanguage === "html" ? (
              <iframe
                srcDoc={response.body}
                title="Response Preview"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            ) : (
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#000",
                }}
              >
                Preview is only supported for HTML responses.
              </Box>
            )}
          </Box>
        )}

        {mode === "visualize" && (
          <Box
            p={16}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
            }}
          >
            Visualize mode allows rendering custom templates (coming soon).
          </Box>
        )}
      </Box>
    </Box>
  );
}
