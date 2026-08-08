import { useState, useEffect } from "react";
import { Box, Radio, Group, Select, Checkbox, TextInput, ActionIcon, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import Editor from "@monaco-editor/react";
import { open } from "@tauri-apps/plugin-dialog";
import type { RequestBody, KeyValuePair, MultipartField } from "@/types/request";
import classes from "./BodyEditor.module.css";

interface BodyEditorProps {
  body: RequestBody;
  onChange: (v: RequestBody) => void;
}

export default function BodyEditor({ body, onChange }: Readonly<BodyEditorProps>) {
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

  return (
    <Box className={classes.container}>
      {/* Body type selection row */}
      <Box className={classes.typeRow}>
        <Radio.Group value={bodyType} onChange={handleTypeChange} className={classes.radioGroup}>
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

        {bodyType === "raw" && (
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
        )}
      </Box>

      {/* Conditional Rendering of editors */}
      {bodyType === "none" && (
        <Box className={classes.emptyState}>This request does not have a body.</Box>
      )}

      {bodyType === "raw" && (
        <Box className={classes.editorContainer}>
          <Editor
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
              fontSize: 13,
              fontFamily: "JetBrains Mono, Fira Code, monospace",
              lineHeight: 20,
              padding: { top: 8, bottom: 8 },
              wordWrap: "on",
              tabSize: 2,
            }}
            onMount={(_, monaco) => {
              monaco.editor.defineTheme("aether-dark", {
                base: "vs-dark",
                inherit: true,
                rules: [],
                colors: {
                  "editor.background": "#212121",
                },
              });
            }}
          />
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
