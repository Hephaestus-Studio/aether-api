import { useEffect } from "react";
import { Box, Table, TextInput, Checkbox, ActionIcon, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface HeadersEditorProps {
  headers: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

export default function HeadersEditor({ headers, onChange }: Readonly<HeadersEditorProps>) {
  // Automatically ensure there is always one blank row at the bottom
  useEffect(() => {
    if (
      headers.length === 0 ||
      headers[headers.length - 1].key !== "" ||
      headers[headers.length - 1].value !== ""
    ) {
      onChange([...headers, { key: "", value: "", enabled: true, description: "" }]);
    }
  }, [headers, onChange]);

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

  return (
    <Box style={{ border: "1px solid var(--border-color)", borderRadius: 4, overflow: "hidden" }}>
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-app)",
        }}
      >
        <Text
          size="xs"
          fw={600}
          c="dimmed"
          style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
        >
          Headers
        </Text>
      </div>
      <Table withRowBorders withColumnBorders style={{ tableLayout: "fixed", width: "100%" }}>
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
          {headers.map((h, idx) => (
            <Table.Tr key={idx}>
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
    </Box>
  );
}
