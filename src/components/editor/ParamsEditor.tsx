import { useEffect } from "react";
import { Box, Table, TextInput, Checkbox, ActionIcon, Text, ScrollArea } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface ParamsEditorProps {
  params: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

export default function ParamsEditor({ params, onChange }: Readonly<ParamsEditorProps>) {
  const { ref: containerRef, width } = useElementSize();
  const showDescription = width >= 500 || width === 0;

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

  return (
    <Box
      ref={containerRef}
      style={{ border: "1px solid var(--border-color)", borderRadius: 4, overflow: "hidden" }}
    >
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
      </div>

      <ScrollArea type="hover" offsetScrollbars={false}>
        <Table
          withRowBorders
          withColumnBorders={false}
          style={{ tableLayout: "fixed", width: "100%", minWidth: showDescription ? 420 : "100%" }}
        >
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: "var(--bg-tab-inactive)" }}>
              <Table.Th style={{ width: 36, textAlign: "center", padding: 0 }}></Table.Th>
              <Table.Th
                style={{
                  width: showDescription ? "35%" : undefined,
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
                  width: showDescription ? "35%" : undefined,
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  padding: "6px 8px",
                }}
              >
                Value
              </Table.Th>
              {showDescription && (
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
              )}
              <Table.Th style={{ width: 36, padding: 0 }}></Table.Th>
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
                {showDescription && (
                  <Table.Td style={{ padding: 0, height: 32 }}>
                    <TextInput
                      value={p.description || ""}
                      onChange={(e) => handleItemChange(idx, { description: e.target.value })}
                      placeholder="Description"
                      variant="unstyled"
                      styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                    />
                  </Table.Td>
                )}
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
      </ScrollArea>
    </Box>
  );
}
