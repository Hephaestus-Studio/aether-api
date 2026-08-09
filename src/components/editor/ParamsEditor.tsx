import { useState, useEffect } from "react";
import { Box, Table, TextInput, Checkbox, ActionIcon, Text, Textarea } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface ParamsEditorProps {
  params: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

export default function ParamsEditor({ params, onChange }: Readonly<ParamsEditorProps>) {
  const [isBulk, setIsBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Automatically ensure there is always one blank row at the bottom of the table
  useEffect(() => {
    if (
      params.length === 0 ||
      params[params.length - 1].key !== "" ||
      params[params.length - 1].value !== ""
    ) {
      onChange([...params, { key: "", value: "", enabled: true, description: "" }]);
    }
  }, [params, onChange]);

  // Keep bulk text in sync with external updates (like changes via URL address bar)
  useEffect(() => {
    if (isBulk) {
      setBulkText(formatBulkText(params));
    }
  }, [params, isBulk]);

  const handleItemChange = (index: number, fields: Partial<KeyValuePair>) => {
    const next = [...params];
    next[index] = { ...next[index], ...fields };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    if (params.length <= 1) {
      onChange([{ key: "", value: "", enabled: true, description: "" }]);
      return;
    }
    onChange(params.filter((_, i) => i !== index));
  };

  const toggleBulkMode = () => {
    if (isBulk) {
      const parsed = parseBulkText(bulkText);
      onChange(parsed);
      setIsBulk(false);
    } else {
      setBulkText(formatBulkText(params));
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
        <Text
          size="xs"
          fw={600}
          c="dimmed"
          style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
        >
          Query Parameters
        </Text>
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
            {params.map((p, idx) => (
              <Table.Tr key={idx}>
                <Table.Td style={{ textAlign: "center", padding: 0, height: 32 }}>
                  <Checkbox
                    checked={p.enabled}
                    onChange={(e) => handleItemChange(idx, { enabled: e.target.checked })}
                    styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                  />
                </Table.Td>
                <Table.Td style={{ padding: 0, height: 32 }}>
                  <TextInput
                    value={p.key}
                    onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                    placeholder="Key"
                    variant="unstyled"
                    styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                  />
                </Table.Td>
                <Table.Td style={{ padding: 0, height: 32 }}>
                  <TextInput
                    value={p.value}
                    onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                    placeholder="Value"
                    variant="unstyled"
                    styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                  />
                </Table.Td>
                <Table.Td style={{ padding: 0, height: 32 }}>
                  <TextInput
                    value={p.description || ""}
                    onChange={(e) => handleItemChange(idx, { description: e.target.value })}
                    placeholder="Description"
                    variant="unstyled"
                    styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                  />
                </Table.Td>
                <Table.Td style={{ textAlign: "center", padding: 0, height: 32 }}>
                  {p.key || p.value || p.description ? (
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
