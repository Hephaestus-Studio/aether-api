import { useState, useEffect } from "react";
import { Box, Table, TextInput, Checkbox, ActionIcon, Text, Textarea } from "@mantine/core";
import { IconTrash, IconInfoCircle, IconEye, IconEyeOff } from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface HeadersEditorProps {
  headers: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

const AUTO_GENERATED_HEADERS = [
  {
    key: "User-Agent",
    value: "PostmanRuntime/7.56.0",
    enabled: true,
    description: "Default user agent",
  },
  { key: "Accept", value: "*/*", enabled: true, description: "Accept all media types" },
  {
    key: "Accept-Encoding",
    value: "gzip, deflate, br",
    enabled: true,
    description: "Supported compression encodings",
  },
  {
    key: "Connection",
    value: "keep-alive",
    enabled: true,
    description: "Keep connection open for reuse",
  },
];

export default function HeadersEditor({ headers, onChange }: Readonly<HeadersEditorProps>) {
  const [isBulk, setIsBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showAutoHeaders, setShowAutoHeaders] = useState(true);

  // Automatically ensure there is always one blank row at the bottom of the custom headers list
  useEffect(() => {
    if (
      headers.length === 0 ||
      headers[headers.length - 1].key !== "" ||
      headers[headers.length - 1].value !== ""
    ) {
      onChange([...headers, { key: "", value: "", enabled: true, description: "" }]);
    }
  }, [headers, onChange]);

  // Keep bulk text synced with external updates
  useEffect(() => {
    if (isBulk) {
      setBulkText(formatBulkText(headers));
    }
  }, [headers, isBulk]);

  const handleItemChange = (index: number, fields: Partial<KeyValuePair>) => {
    const next = [...headers];
    next[index] = { ...next[index], ...fields };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    if (headers.length <= 1) {
      onChange([{ key: "", value: "", enabled: true, description: "" }]);
      return;
    }
    onChange(headers.filter((_, i) => i !== index));
  };

  const toggleBulkMode = () => {
    if (isBulk) {
      const parsed = parseBulkText(bulkText);
      onChange(parsed);
      setIsBulk(false);
    } else {
      setBulkText(formatBulkText(headers));
      setIsBulk(true);
    }
  };

  const handleBulkChange = (text: string) => {
    setBulkText(text);
  };

  const parseBulkText = (text: string): KeyValuePair[] => {
    const lines = text.split("\n");
    const parsed: KeyValuePair[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      const index = trimmed.indexOf(":");
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim();
        parsed.push({ key, value, enabled: true, description: "" });
      } else {
        parsed.push({ key: trimmed, value: "", enabled: true, description: "" });
      }
    }
    // Always append an empty row
    parsed.push({ key: "", value: "", enabled: true, description: "" });
    return parsed;
  };

  const formatBulkText = (items: KeyValuePair[]): string => {
    return items
      .filter((item) => item.key.trim() !== "" || item.value.trim() !== "")
      .map((item) => `${item.key}: ${item.value}`)
      .join("\n");
  };

  return (
    <Box style={{ border: "1px solid var(--border-color)", borderRadius: 4, overflow: "hidden" }}>
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-app)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Text
            size="xs"
            fw={600}
            c="dimmed"
            style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Headers
          </Text>
          {!isBulk && (
            <button
              type="button"
              onClick={() => setShowAutoHeaders(!showAutoHeaders)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {showAutoHeaders ? <IconEyeOff size={12} /> : <IconEye size={12} />}
              {showAutoHeaders ? "Hide auto-generated headers" : "Show auto-generated headers"}
            </button>
          )}
        </div>
        <Text
          size="xs"
          onClick={toggleBulkMode}
          style={{
            color: "var(--aether-color-primary-base)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {isBulk ? "Key-Value Edit" : "Bulk Edit"}
        </Text>
      </div>

      {isBulk ? (
        <Box style={{ padding: 12 }}>
          <Textarea
            value={bulkText}
            onChange={(e) => handleBulkChange(e.target.value)}
            placeholder="key: value&#10;anotherKey: anotherValue"
            minRows={6}
            maxRows={12}
            autosize
            styles={{
              input: {
                fontFamily: "var(--aether-font-mono)",
                fontSize: "var(--aether-editor-font-size, var(--aether-font-size-md))",
                lineHeight: "var(--aether-line-height-base)",
                backgroundColor: "var(--bg-sidebar)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              },
            }}
          />
        </Box>
      ) : (
        <Table
          withRowBorders
          withColumnBorders={false}
          style={{ tableLayout: "fixed", width: "100%" }}
        >
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: "var(--bg-tab-inactive)" }}>
              <Table.Th style={{ width: 40, textAlign: "center", padding: 0 }}></Table.Th>
              <Table.Th
                style={{
                  width: "30%",
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  padding: "6px 8px",
                }}
              >
                Key
              </Table.Th>
              <Table.Th
                style={{
                  width: "30%",
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  padding: "6px 8px",
                }}
              >
                Value
              </Table.Th>
              <Table.Th
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  padding: "6px 8px",
                }}
              >
                Description
              </Table.Th>
              <Table.Th style={{ width: 40, padding: 0 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {/* 1. Show Auto-Generated Headers if enabled */}
            {showAutoHeaders &&
              AUTO_GENERATED_HEADERS.map((h, idx) => (
                <Table.Tr
                  key={`auto-${idx}`}
                  style={{ opacity: 0.5, backgroundColor: "rgba(255,255,255,0.01)" }}
                >
                  <Table.Td style={{ textAlign: "center", padding: 0, height: 32 }}>
                    <Checkbox
                      checked={h.enabled}
                      disabled
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </Table.Td>
                  <Table.Td style={{ padding: 0, height: 32 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        height: "100%",
                        padding: "0 8px",
                      }}
                    >
                      <Text size="xs" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {h.key}
                      </Text>
                      <IconInfoCircle
                        size={12}
                        style={{ color: "var(--text-muted)", opacity: 0.8 }}
                      />
                    </div>
                  </Table.Td>
                  <Table.Td style={{ padding: 0, height: 32 }}>
                    <TextInput
                      value={h.value}
                      disabled
                      variant="unstyled"
                      styles={{
                        input: {
                          height: 32,
                          fontSize: 13,
                          padding: "0 8px",
                          color: "var(--text-muted)",
                          cursor: "not-allowed",
                        },
                      }}
                    />
                  </Table.Td>
                  <Table.Td style={{ padding: 0, height: 32 }}>
                    <TextInput
                      value={h.description}
                      disabled
                      variant="unstyled"
                      styles={{
                        input: {
                          height: 32,
                          fontSize: 13,
                          padding: "0 8px",
                          color: "var(--text-muted)",
                          cursor: "not-allowed",
                        },
                      }}
                    />
                  </Table.Td>
                  <Table.Td style={{ textAlign: "center", padding: 0, height: 32 }}></Table.Td>
                </Table.Tr>
              ))}

            {/* 2. Show Custom User Headers */}
            {headers.map((h, idx) => (
              <Table.Tr key={`custom-${idx}`}>
                <Table.Td style={{ textAlign: "center", padding: 0, height: 32 }}>
                  <Checkbox
                    checked={h.enabled}
                    onChange={(e) => handleItemChange(idx, { enabled: e.target.checked })}
                    styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                  />
                </Table.Td>
                <Table.Td style={{ padding: 0, height: 32 }}>
                  <TextInput
                    value={h.key}
                    onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                    placeholder="Key"
                    variant="unstyled"
                    styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                  />
                </Table.Td>
                <Table.Td style={{ padding: 0, height: 32 }}>
                  <TextInput
                    value={h.value}
                    onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                    placeholder="Value"
                    variant="unstyled"
                    styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                  />
                </Table.Td>
                <Table.Td style={{ padding: 0, height: 32 }}>
                  <TextInput
                    value={h.description || ""}
                    onChange={(e) => handleItemChange(idx, { description: e.target.value })}
                    placeholder="Description"
                    variant="unstyled"
                    styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                  />
                </Table.Td>
                <Table.Td style={{ textAlign: "center", padding: 0, height: 32 }}>
                  {h.key || h.value || h.description ? (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(idx)}
                      size="sm"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Box>
  );
}
