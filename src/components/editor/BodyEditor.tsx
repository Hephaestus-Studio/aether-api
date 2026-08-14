import { useState, useEffect, useRef } from "react";
import { Box, Group, Select, Checkbox, ActionIcon, Text, Menu, Button } from "@mantine/core";
import {
  IconTrash,
  IconChevronDown,
  IconUpload,
  IconFile,
  IconFolderOpen,
  IconCopy,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import MonacoEditor from "@/components/common/MonacoEditor";
import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "@/stores/configStore";
import MonacoErrorBoundary from "@/components/common/MonacoErrorBoundary";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import { useCollision } from "@/hooks/useCollision";
import type { RequestBody, KeyValuePair, MultipartField } from "@/types/request";
import clsx from "clsx";
import classes from "./BodyEditor.module.css";

const BODY_TYPES = [
  { label: "none", value: "none" },
  { label: "form-data", value: "multipartForm" },
  { label: "x-www-form-urlencoded", value: "formUrlencoded" },
  { label: "raw", value: "raw" },
  { label: "binary", value: "binary" },
];

interface BodyEditorProps {
  body: RequestBody;
  onChange: (v: RequestBody) => void;
}

export default function BodyEditor({ body, onChange }: Readonly<BodyEditorProps>) {
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

  // Cached content memory to preserve data when switching between tabs/modes
  const cachedRawContentRef = useRef<string>(
    body.type === "json" || body.type === "xml" || body.type === "text" || body.type === "yaml"
      ? body.content || ""
      : "",
  );
  const cachedFormUrlencodedRef = useRef<KeyValuePair[]>(
    body.type === "formUrlencoded"
      ? body.content
      : [{ key: "", value: "", enabled: true, description: "" }],
  );
  const cachedMultipartRef = useRef<MultipartField[]>(
    body.type === "multipartForm"
      ? body.content
      : [{ key: "", value: "", fieldType: "text" as const, enabled: true }],
  );
  const cachedBinaryPathRef = useRef<string>(body.type === "binary" ? body.filePath || "" : "");

  const minExpandedWidth = bodyType === "raw" ? 580 : 500;

  const {
    containerRef: typeRowRef,
    leftRef: radiosRef,
    rightRef: langSelectRef,
    isColliding: isBodyColliding,
  } = useCollision<HTMLDivElement>({
    gap: 16,
    minExpandedWidth,
    hysteresis: 8,
    dependencies: [bodyType],
  });

  const isCompact = isBodyColliding;

  const [copiedPath, setCopiedPath] = useState(false);

  // Sync types on load/update
  const bodyTypeProp = body.type;
  const binaryFilePath = body.type === "binary" ? body.filePath : undefined;

  useEffect(() => {
    if (
      bodyTypeProp === "json" ||
      bodyTypeProp === "xml" ||
      bodyTypeProp === "text" ||
      bodyTypeProp === "yaml"
    ) {
      setBodyType("raw");
      if (bodyTypeProp === "json") setRawLang("json");
      else if (bodyTypeProp === "xml") setRawLang("xml");
      else if (bodyTypeProp === "yaml") setRawLang("yaml");
      else setRawLang("text");
      cachedRawContentRef.current = (body as any).content || "";
    } else {
      setBodyType(bodyTypeProp);
      if (body.type === "formUrlencoded") {
        cachedFormUrlencodedRef.current = body.content;
      } else if (body.type === "multipartForm") {
        cachedMultipartRef.current = body.content;
      }
    }
    if (bodyTypeProp === "binary") {
      setBinaryPath(binaryFilePath || "");
      cachedBinaryPathRef.current = binaryFilePath || "";
    }
  }, [bodyTypeProp, binaryFilePath, body]);

  const handleTypeChange = (type: string) => {
    setBodyType(type);
    if (type === "none") {
      onChange({ type: "none" });
    } else if (type === "raw") {
      const rawContent = cachedRawContentRef.current || "";
      if (rawLang === "json") onChange({ type: "json", content: rawContent });
      else if (rawLang === "xml") onChange({ type: "xml", content: rawContent });
      else if (rawLang === "yaml") onChange({ type: "yaml", content: rawContent });
      else onChange({ type: "text", content: rawContent });
    } else if (type === "formUrlencoded") {
      const content =
        cachedFormUrlencodedRef.current.length > 0
          ? cachedFormUrlencodedRef.current
          : [{ key: "", value: "", enabled: true, description: "" }];
      onChange({
        type: "formUrlencoded",
        content,
      });
    } else if (type === "multipartForm") {
      const content: MultipartField[] =
        cachedMultipartRef.current.length > 0
          ? cachedMultipartRef.current
          : [{ key: "", value: "", fieldType: "text", enabled: true }];
      onChange({
        type: "multipartForm",
        content,
      });
    } else if (type === "binary") {
      const filePath = cachedBinaryPathRef.current || binaryPath || "";
      onChange({ type: "binary", filePath });
    }
  };

  const handleRawLangChange = (lang: string) => {
    setRawLang(lang);
    const content =
      body.type === "json" || body.type === "xml" || body.type === "text" || body.type === "yaml"
        ? (body as any).content || ""
        : cachedRawContentRef.current || "";

    cachedRawContentRef.current = content;

    if (lang === "json") {
      onChange({ type: "json", content });
    } else if (lang === "xml") {
      onChange({ type: "xml", content });
    } else if (lang === "yaml") {
      onChange({ type: "yaml", content });
    } else {
      onChange({ type: "text", content });
    }
  };

  // Raw Content Change Handler
  const handleContentChange = (content: string | undefined) => {
    const newContent = content || "";
    cachedRawContentRef.current = newContent;
    if (bodyType === "raw") {
      if (rawLang === "json") {
        onChange({ type: "json", content: newContent });
      } else if (rawLang === "xml") {
        onChange({ type: "xml", content: newContent });
      } else if (rawLang === "yaml") {
        onChange({ type: "yaml", content: newContent });
      } else {
        onChange({ type: "text", content: newContent });
      }
    }
  };

  // Form URL Encoded handlers
  const handleUrlencodedChange = (index: number, fields: Partial<KeyValuePair>) => {
    if (body.type !== "formUrlencoded") return;
    if (index >= body.content.length) {
      onChange({
        type: "formUrlencoded",
        content: [
          ...body.content,
          { key: "", value: "", enabled: true, description: "", ...fields },
        ],
      });
    } else {
      const next = [...body.content];
      next[index] = { ...next[index], ...fields };
      onChange({ type: "formUrlencoded", content: next });
    }
  };

  const handleUrlencodedDelete = (index: number) => {
    if (body.type !== "formUrlencoded") return;
    if (index >= body.content.length) return;
    onChange({
      type: "formUrlencoded",
      content: body.content.filter((_, i) => i !== index),
    });
  };

  // Form Data (Multipart) Handlers
  const handleMultipartChange = (index: number, fields: Partial<MultipartField>) => {
    if (body.type !== "multipartForm") return;
    if (index >= body.content.length) {
      onChange({
        type: "multipartForm",
        content: [
          ...body.content,
          { key: "", value: "", fieldType: "text", enabled: true, ...fields },
        ],
      });
    } else {
      const next = [...body.content];
      next[index] = { ...next[index], ...fields };
      onChange({ type: "multipartForm", content: next });
    }
  };

  const handleMultipartDelete = (index: number) => {
    if (body.type !== "multipartForm") return;
    if (index >= body.content.length) return;
    onChange({
      type: "multipartForm",
      content: body.content.filter((_, i) => i !== index),
    });
  };

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
      if (selected && typeof selected === "string") {
        setBinaryPath(selected);
        onChange({ type: "binary", filePath: selected });
      }
    } catch (err) {
      console.error("Error opening dialog:", err);
    }
  };

  const handleCopyBinaryPath = () => {
    if (!binaryPath) return;
    navigator.clipboard.writeText(binaryPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleRemoveBinary = () => {
    setBinaryPath("");
    onChange({ type: "binary", filePath: "" });
  };

  const monacoLang = () => {
    if (rawLang === "json") return "json";
    if (rawLang === "xml") return "xml";
    if (rawLang === "yaml") return "yaml";
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
      case "yaml":
        return "YAML";
      case "javascript":
        return "JavaScript";
      case "html":
        return "HTML";
      default:
        return "Text";
    }
  };

  return (
    <Box className={classes.container}>
      {/* Body type selection row */}
      <div ref={typeRowRef}>
        {isCompact ? (
          <Box className={classes.compactTypeRow}>
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
                <Menu.Dropdown className={classes.compactLangDropdown}>
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
                <Menu shadow="md" width={130} position="bottom-start">
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      size="xs"
                      className={classes.compactLangBtn}
                      rightSection={<IconChevronDown size={12} />}
                    >
                      {getRawLangLabel(rawLang)}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown className={classes.compactLangDropdown}>
                    <Menu.Item
                      onClick={() => handleRawLangChange("text")}
                      className={rawLang === "text" ? classes.compactItemActive : ""}
                      rightSection={
                        rawLang === "text" ? <IconCheck size={12} color="#ffffff" /> : null
                      }
                    >
                      Text
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => handleRawLangChange("javascript")}
                      className={rawLang === "javascript" ? classes.compactItemActive : ""}
                      rightSection={
                        rawLang === "javascript" ? <IconCheck size={12} color="#ffffff" /> : null
                      }
                    >
                      JavaScript
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => handleRawLangChange("json")}
                      className={rawLang === "json" ? classes.compactItemActive : ""}
                      rightSection={
                        rawLang === "json" ? <IconCheck size={12} color="#ffffff" /> : null
                      }
                    >
                      JSON
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => handleRawLangChange("html")}
                      className={rawLang === "html" ? classes.compactItemActive : ""}
                      rightSection={
                        rawLang === "html" ? <IconCheck size={12} color="#ffffff" /> : null
                      }
                    >
                      HTML
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => handleRawLangChange("xml")}
                      className={rawLang === "xml" ? classes.compactItemActive : ""}
                      rightSection={
                        rawLang === "xml" ? <IconCheck size={12} color="#ffffff" /> : null
                      }
                    >
                      XML
                    </Menu.Item>
                    <Menu.Item
                      onClick={() => handleRawLangChange("yaml")}
                      className={rawLang === "yaml" ? classes.compactItemActive : ""}
                      rightSection={
                        rawLang === "yaml" ? <IconCheck size={12} color="#ffffff" /> : null
                      }
                    >
                      YAML
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Box>
        ) : (
          <Box className={classes.typeRow}>
            <div ref={radiosRef} className={classes.pillGroup}>
              {BODY_TYPES.map((opt) => {
                const isActive = bodyType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={clsx(classes.typePill, isActive && classes.typePillActive)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {bodyType === "raw" && (
              <div
                ref={langSelectRef}
                style={{ display: "flex", alignItems: "center", marginLeft: "auto" }}
              >
                <Select
                  value={rawLang}
                  onChange={(val) => handleRawLangChange(val || "text")}
                  data={[
                    { label: "Text", value: "text" },
                    { label: "JavaScript", value: "javascript" },
                    { label: "JSON", value: "json" },
                    { label: "HTML", value: "html" },
                    { label: "XML", value: "xml" },
                    { label: "YAML", value: "yaml" },
                  ]}
                  allowDeselect={false}
                  checkIconPosition="right"
                  classNames={{
                    root: classes.langSelect,
                    input: classes.langSelectInput,
                    dropdown: classes.langSelectDropdown,
                    option: classes.langSelectOption,
                  }}
                />
              </div>
            )}
          </Box>
        )}
      </div>

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
              onMount={(editor, monaco) => {
                try {
                  // Bind Shift+Alt+F as an alternative shortcut for Format Document without duplicating context menu item
                  editor.addCommand(
                    monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
                    () => {
                      const val = editor.getValue();
                      if (!val) return;
                      try {
                        const parsed = JSON.parse(val);
                        const formatted = JSON.stringify(parsed, null, 2);
                        editor.setValue(formatted);
                        handleContentChange(formatted);
                      } catch {
                        try {
                          editor.getAction("editor.action.formatDocument")?.run();
                        } catch {}
                      }
                    },
                  );
                } catch (err) {
                  console.warn("Failed to register format shortcut:", err);
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
              {(body.content.length === 0 ||
              body.content[body.content.length - 1].key !== "" ||
              body.content[body.content.length - 1].value !== ""
                ? [...body.content, { key: "", value: "", enabled: true, description: "" }]
                : body.content
              ).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>
                    <Checkbox
                      checked={item.enabled}
                      onChange={(e) => handleUrlencodedChange(idx, { enabled: e.target.checked })}
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td>
                    <UndoableTextInput
                      value={item.key}
                      onChange={(e) => handleUrlencodedChange(idx, { key: e.target.value })}
                      placeholder="Key"
                      variant="unstyled"
                      className={classes.tableInput}
                    />
                  </td>
                  <td>
                    <UndoableTextInput
                      value={item.value}
                      onChange={(e) => handleUrlencodedChange(idx, { value: e.target.value })}
                      placeholder="Value"
                      variant="unstyled"
                      className={classes.tableInput}
                    />
                  </td>
                  <td>
                    <UndoableTextInput
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
              {(body.content.length === 0 ||
              body.content[body.content.length - 1].key !== "" ||
              body.content[body.content.length - 1].value !== ""
                ? [
                    ...body.content,
                    { key: "", value: "", fieldType: "text" as const, enabled: true },
                  ]
                : body.content
              ).map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>
                    <Checkbox
                      checked={item.enabled}
                      onChange={(e) => handleMultipartChange(idx, { enabled: e.target.checked })}
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td>
                    <UndoableTextInput
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
                      <UndoableTextInput
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
        <Box className={classes.binaryWrapper}>
          {!binaryPath ? (
            <div className={classes.binaryDropzone} onClick={handleSelectBinary}>
              <div className={classes.dropzoneIconWrapper}>
                <IconUpload size={22} />
              </div>
              <Text className={classes.dropzoneTitle}>Select a Binary File</Text>
              <Text className={classes.dropzoneSubtitle}>
                Choose any file (image, audio, pdf, archive, binary stream) to include directly in
                the HTTP request body.
              </Text>
              <button
                type="button"
                className={classes.selectFileBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectBinary();
                }}
              >
                <IconFolderOpen size={14} />
                Browse File
              </button>
            </div>
          ) : (
            <div className={classes.fileCard}>
              <div className={classes.fileCardHeader}>
                <div className={classes.fileStatusTag}>
                  <IconFile size={13} />
                  Binary Payload Ready
                </div>
                <div className={classes.fileActions}>
                  <button
                    type="button"
                    className={classes.changeFileBtn}
                    onClick={handleSelectBinary}
                  >
                    <IconFolderOpen size={13} />
                    Change
                  </button>
                  <button
                    type="button"
                    className={classes.removeFileBtn}
                    onClick={handleRemoveBinary}
                  >
                    <IconTrash size={13} />
                    Remove
                  </button>
                </div>
              </div>

              <div className={classes.fileCardBody}>
                <div className={classes.fileIconBox}>
                  <IconFile size={20} />
                </div>
                <div className={classes.fileMeta}>
                  <Text className={classes.fileName} title={binaryPath.split(/[\\/]/).pop()}>
                    {binaryPath.split(/[\\/]/).pop()}
                  </Text>
                  <div className={classes.filePathRow}>
                    <Text className={classes.fullPathText} title={binaryPath}>
                      {binaryPath}
                    </Text>
                    <button
                      type="button"
                      className={classes.copyPathBtn}
                      onClick={handleCopyBinaryPath}
                      title="Copy file path"
                    >
                      {copiedPath ? (
                        <IconCheck size={12} color="#34c759" />
                      ) : (
                        <IconCopy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={classes.binaryInfoBanner}>
            <IconInfoCircle size={14} style={{ flexShrink: 0 }} />
            <Text size="xs">
              Binary content will be transmitted as an unencoded byte stream (
              <code style={{ color: "#0084ff" }}>application/octet-stream</code>).
            </Text>
          </div>
        </Box>
      )}
    </Box>
  );
}
