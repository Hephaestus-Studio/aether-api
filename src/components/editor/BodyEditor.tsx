import { useState, useEffect } from "react";
import {
  Box,
  Radio,
  Group,
  Select,
  Checkbox,
  TextInput,
  ActionIcon,
  Text,
  Menu,
  Button,
} from "@mantine/core";
import { IconTrash, IconChevronDown } from "@tabler/icons-react";
import MonacoEditor from "@/components/common/MonacoEditor";
import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "@/stores/configStore";
import MonacoErrorBoundary from "@/components/common/MonacoErrorBoundary";
import { useCollision } from "@/hooks/useCollision";
import type { RequestBody, KeyValuePair, MultipartField } from "@/types/request";
import classes from "./BodyEditor.module.css";

interface BodyEditorProps {
  body: RequestBody;
  onChange: (v: RequestBody) => void;
}

export default function BodyEditor({ body, onChange }: Readonly<BodyEditorProps>) {
  const {
    containerRef: typeRowRef,
    leftRef: radiosRef,
    rightRef: langSelectRef,
    isColliding: isBodyColliding,
  } = useCollision<HTMLDivElement>({ gap: 16, minExpandedWidth: 590, hysteresis: 8 });

  const isCompact = isBodyColliding;
  const { config } = useConfigStore();
  // Translate RequestBody types to Postman body types: none, multipartForm, formUrlencoded, raw, binary
  const [bodyType, setBodyType] = useState<string>(() => {
    if (
      body.type === "json" ||
      body.type === "xml" ||
      body.type === "text" ||
      body.type === "yaml"
    ) {
      return "raw";
    }
    return body.type;
  });

  const [rawLang, setRawLang] = useState<string>(() => {
    if (body.type === "json") return "json";
    if (body.type === "xml") return "xml";
    if (body.type === "yaml") return "yaml";
    return "text";
  });

  const [binaryPath, setBinaryPath] = useState<string>("");

  // Sync types on load/update
  useEffect(() => {
    if (
      body.type === "json" ||
      body.type === "xml" ||
      body.type === "text" ||
      body.type === "yaml"
    ) {
      setBodyType("raw");
    } else {
      setBodyType(body.type);
    }
  }, [body.type]);

  const handleTypeChange = (type: string) => {
    setBodyType(type);
    if (type === "none") {
      onChange({ type: "none" });
    } else if (type === "raw") {
      // Set to active rawLang
      if (rawLang === "json") onChange({ type: "json", content: "" });
      else if (rawLang === "xml") onChange({ type: "xml", content: "" });
      else onChange({ type: "text", content: "" });
    } else if (type === "formUrlencoded") {
      onChange({
        type: "formUrlencoded",
        content: [{ key: "", value: "", enabled: true, description: "" }],
      });
    } else if (type === "multipartForm") {
      onChange({
        type: "multipartForm",
        content: [{ key: "", value: "", fieldType: "text", enabled: true }],
      });
    } else if (type === "binary") {
      onChange({ type: "none" }); // Simulated locally
    }
  };

  const handleRawLangChange = (lang: string) => {
    setRawLang(lang);
    const content =
      body.type === "json" || body.type === "xml" || body.type === "text"
        ? (body as any).content || ""
        : "";

    if (lang === "json") {
      onChange({ type: "json", content });
    } else if (lang === "xml") {
      onChange({ type: "xml", content });
    } else {
      onChange({ type: "text", content });
    }
  };

  // Raw Content Change Handler
  const handleContentChange = (content: string | undefined) => {
    if (bodyType === "raw") {
      if (rawLang === "json") {
        onChange({ type: "json", content: content || "" });
      } else if (rawLang === "xml") {
        onChange({ type: "xml", content: content || "" });
      } else {
        onChange({ type: "text", content: content || "" });
      }
    }
  };

  // Form URL Encoded handlers
  const handleUrlencodedChange = (index: number, fields: Partial<KeyValuePair>) => {
    if (body.type !== "formUrlencoded") return;
    const next = [...body.content];
    next[index] = { ...next[index], ...fields };
    onChange({ type: "formUrlencoded", content: next });
  };

  const handleUrlencodedDelete = (index: number) => {
    if (body.type !== "formUrlencoded") return;
    if (body.content.length <= 1) {
      onChange({
        type: "formUrlencoded",
        content: [{ key: "", value: "", enabled: true, description: "" }],
      });
      return;
    }
    onChange({
      type: "formUrlencoded",
      content: body.content.filter((_, i) => i !== index),
    });
  };

  // Ensure Form URL Encoded has a blank row
  useEffect(() => {
    if (body.type === "formUrlencoded") {
      const items = body.content;
      if (
        items.length === 0 ||
        items[items.length - 1].key !== "" ||
        items[items.length - 1].value !== ""
      ) {
        onChange({
          type: "formUrlencoded",
          content: [...items, { key: "", value: "", enabled: true, description: "" }],
        });
      }
    }
  }, [body, onChange]);

  // Form Data (Multipart) Handlers
  const handleMultipartChange = (index: number, fields: Partial<MultipartField>) => {
    if (body.type !== "multipartForm") return;
    const next = [...body.content];
    next[index] = { ...next[index], ...fields };
    onChange({ type: "multipartForm", content: next });
  };

  const handleMultipartDelete = (index: number) => {
    if (body.type !== "multipartForm") return;
    if (body.content.length <= 1) {
      onChange({
        type: "multipartForm",
        content: [{ key: "", value: "", fieldType: "text", enabled: true }],
      });
      return;
    }
    onChange({
      type: "multipartForm",
      content: body.content.filter((_, i) => i !== index),
    });
  };

  // Ensure Multipart Form has a blank row
  useEffect(() => {
    if (body.type === "multipartForm") {
      const items = body.content;
      if (
        items.length === 0 ||
        items[items.length - 1].key !== "" ||
        items[items.length - 1].value !== ""
      ) {
        onChange({
          type: "multipartForm",
          content: [...items, { key: "", value: "", fieldType: "text", enabled: true }],
        });
      }
    }
  }, [body, onChange]);

  const handleSelectFile = async (index: number) => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });
      if (selected) {
        handleMultipartChange(index, { value: selected as string });
      }
    } catch (err) {
      console.error("Error opening dialog:", err);
    }
  };

  const handleSelectBinary = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });
      if (selected) {
        setBinaryPath(selected as string);
      }
    } catch (err) {
      console.error("Error opening dialog:", err);
    }
  };

  const monacoLang = () => {
    if (rawLang === "json") return "json";
    if (rawLang === "xml") return "xml";
    if (rawLang === "javascript") return "javascript";
    if (rawLang === "html") return "html";
    return "plaintext";
  };

  const getBodyTypeLabel = (type: string) => {
    switch (type) {
      case "none":
        return "none";
      case "multipartForm":
        return "form-data";
      case "formUrlencoded":
        return "x-www-form-urlencoded";
      case "raw":
        return "raw";
      case "binary":
        return "binary";
      default:
        return type;
    }
  };

  const getRawLangLabel = (lang: string) => {
    switch (lang) {
      case "json":
        return "JSON";
      case "xml":
        return "XML";
      case "javascript":
        return "JavaScript";
      case "html":
        return "HTML";
      default:
        return "Text";
    }
  };

  const handleBeautify = () => {
    if (bodyType === "raw") {
      const content =
        body.type === "json" || body.type === "xml" || body.type === "text" || body.type === "yaml"
          ? body.content
          : "";
      if (rawLang === "json" && content) {
        try {
          const parsed = JSON.parse(content);
          onChange({ type: "json", content: JSON.stringify(parsed, null, 2) });
        } catch {
          // ignore invalid json formatting errors
        }
      }
    }
  };

  return (
    <Box className={classes.container}>
      {/* Body type selection row */}
      {isCompact ? (
        <Box ref={typeRowRef} className={classes.compactTypeRow}>
          <Group gap={8}>
            <Menu shadow="md" width={170} position="bottom-start">
              <Menu.Target>
                <Button
                  variant="subtle"
                  size="xs"
                  className={classes.compactSelectBtn}
                  rightSection={<IconChevronDown size={14} />}
                >
                  {getBodyTypeLabel(bodyType)}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => handleTypeChange("none")}>none</Menu.Item>
                <Menu.Item onClick={() => handleTypeChange("multipartForm")}>form-data</Menu.Item>
                <Menu.Item onClick={() => handleTypeChange("formUrlencoded")}>
                  x-www-form-urlencoded
                </Menu.Item>
                <Menu.Item onClick={() => handleTypeChange("raw")}>raw</Menu.Item>
                <Menu.Item onClick={() => handleTypeChange("binary")}>binary</Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {bodyType === "raw" && (
              <Menu shadow="md" width={140} position="bottom-start">
                <Menu.Target>
                  <Button
                    variant="transparent"
                    size="xs"
                    className={classes.compactLangBtn}
                    rightSection={<IconChevronDown size={14} />}
                  >
                    {getRawLangLabel(rawLang)}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => handleRawLangChange("text")}>Text</Menu.Item>
                  <Menu.Item onClick={() => handleRawLangChange("javascript")}>
                    JavaScript
                  </Menu.Item>
                  <Menu.Item onClick={() => handleRawLangChange("json")}>JSON</Menu.Item>
                  <Menu.Item onClick={() => handleRawLangChange("html")}>HTML</Menu.Item>
                  <Menu.Item onClick={() => handleRawLangChange("xml")}>XML</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>

          {bodyType === "raw" && rawLang === "json" && (
            <Button
              variant="transparent"
              size="xs"
              color="blue"
              onClick={handleBeautify}
              className={classes.beautifyBtn}
            >
              Beautify
            </Button>
          )}
        </Box>
      ) : (
        <Box ref={typeRowRef} className={classes.typeRow}>
          <div ref={radiosRef}>
            <Radio.Group
              value={bodyType}
              onChange={handleTypeChange}
              className={classes.radioGroup}
            >
              <Group>
                <Radio value="none" label="none" className={classes.radioItem} />
                <Radio value="multipartForm" label="form-data" className={classes.radioItem} />
                <Radio
                  value="formUrlencoded"
                  label="x-www-form-urlencoded"
                  className={classes.radioItem}
                />
                <Radio value="raw" label="raw" className={classes.radioItem} />
                <Radio value="binary" label="binary" className={classes.radioItem} />
              </Group>
            </Radio.Group>
          </div>

          {bodyType === "raw" && (
            <div ref={langSelectRef}>
              <Select
                value={rawLang}
                onChange={(val) => handleRawLangChange(val || "text")}
                data={[
                  { label: "Text", value: "text" },
                  { label: "JavaScript", value: "javascript" },
                  { label: "JSON", value: "json" },
                  { label: "HTML", value: "html" },
                  { label: "XML", value: "xml" },
                ]}
                className={classes.langSelect}
              />
            </div>
          )}
        </Box>
      )}

      {/* Conditional Rendering of editors */}
      {bodyType === "none" && (
        <Box className={classes.emptyState}>This request does not have a body.</Box>
      )}

      {bodyType === "raw" && (
        <Box className={classes.editorContainer}>
          <MonacoErrorBoundary
            fallbackContent={
              body.type === "json" ||
              body.type === "xml" ||
              body.type === "text" ||
              body.type === "yaml"
                ? body.content
                : ""
            }
          >
            <MonacoEditor
              height="100%"
              language={monacoLang()}
              theme="aether-dark"
              value={
                body.type === "json" ||
                body.type === "xml" ||
                body.type === "text" ||
                body.type === "yaml"
                  ? body.content
                  : ""
              }
              onChange={handleContentChange}
              options={{
                minimap: { enabled: false },
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                fontSize: config.fontSize || 13,
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace",
                lineHeight: Math.round((config.fontSize || 13) * 1.5),
                padding: { top: 8, bottom: 8 },
                wordWrap: "on",
                tabSize: 2,
              }}
              beforeMount={(monaco) => {
                try {
                  monaco.editor.defineTheme("aether-dark", {
                    base: "vs-dark",
                    inherit: true,
                    rules: [],
                    colors: {
                      "editor.background": "#212121",
                    },
                  });
                } catch {
                  // theme already defined or failed safely
                }
              }}
            />
          </MonacoErrorBoundary>
        </Box>
      )}

      {bodyType === "formUrlencoded" && body.type === "formUrlencoded" && (
        <Box className={classes.tableContainer}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}></th>
                <th style={{ width: "30%" }}>Key</th>
                <th style={{ width: "30%" }}>Value</th>
                <th>Description</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {body.content.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>
                    <Checkbox
                      checked={item.enabled}
                      onChange={(e) => handleUrlencodedChange(idx, { enabled: e.target.checked })}
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td>
                    <TextInput
                      value={item.key}
                      onChange={(e) => handleUrlencodedChange(idx, { key: e.target.value })}
                      placeholder="Key"
                      variant="unstyled"
                      className={classes.tableInput}
                    />
                  </td>
                  <td>
                    <TextInput
                      value={item.value}
                      onChange={(e) => handleUrlencodedChange(idx, { value: e.target.value })}
                      placeholder="Value"
                      variant="unstyled"
                      className={classes.tableInput}
                    />
                  </td>
                  <td>
                    <TextInput
                      value={item.description || ""}
                      onChange={(e) => handleUrlencodedChange(idx, { description: e.target.value })}
                      placeholder="Description"
                      variant="unstyled"
                      className={classes.tableInput}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {item.key || item.value || item.description ? (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleUrlencodedDelete(idx)}
                        size="sm"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      {bodyType === "multipartForm" && body.type === "multipartForm" && (
        <Box className={classes.tableContainer}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}></th>
                <th style={{ width: "30%" }}>Key</th>
                <th style={{ width: 90 }}>Type</th>
                <th style={{ width: "30%" }}>Value</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {body.content.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>
                    <Checkbox
                      checked={item.enabled}
                      onChange={(e) => handleMultipartChange(idx, { enabled: e.target.checked })}
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td>
                    <TextInput
                      value={item.key}
                      onChange={(e) => handleMultipartChange(idx, { key: e.target.value })}
                      placeholder="Key"
                      variant="unstyled"
                      className={classes.tableInput}
                    />
                  </td>
                  <td>
                    <Select
                      value={item.fieldType}
                      onChange={(val) =>
                        handleMultipartChange(idx, { fieldType: (val || "text") as any, value: "" })
                      }
                      data={["text", "file"]}
                      className={classes.typeSelect}
                    />
                  </td>
                  <td>
                    {item.fieldType === "text" ? (
                      <TextInput
                        value={item.value}
                        onChange={(e) => handleMultipartChange(idx, { value: e.target.value })}
                        placeholder="Value"
                        variant="unstyled"
                        className={classes.tableInput}
                      />
                    ) : (
                      <Box className={classes.fileRow}>
                        <button
                          type="button"
                          onClick={() => handleSelectFile(idx)}
                          className={classes.fileBtn}
                        >
                          Choose File
                        </button>
                        <Text className={classes.filePath} title={item.value}>
                          {item.value ? item.value.split(/[\\/]/).pop() : "No file selected"}
                        </Text>
                      </Box>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {item.key || item.value ? (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleMultipartDelete(idx)}
                        size="sm"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      {bodyType === "binary" && (
        <Box className={classes.binaryContainer}>
          <button type="button" onClick={handleSelectBinary} className={classes.fileBtn}>
            Choose File
          </button>
          <Text className={classes.binaryPath} title={binaryPath}>
            {binaryPath ? binaryPath : "No file selected"}
          </Text>
        </Box>
      )}
    </Box>
  );
}
