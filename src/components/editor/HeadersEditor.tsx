import { useState, useEffect } from "react";
import { Box, Table, TextInput, Checkbox, ActionIcon, Text, ScrollArea } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconTrash,
  IconInfoCircle,
  IconEye,
  IconEyeOff,
  IconGripVertical,
} from "@tabler/icons-react";
import type { KeyValuePair } from "@/types/request";

interface HeadersEditorProps {
  headers: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

const AUTO_GENERATED_HEADERS = [
  {
    key: "User-Agent",
    value: "AetherAPI/1.0.0",
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
  const [showAutoHeaders, setShowAutoHeaders] = useState(true);
  const { ref: containerRef, width } = useElementSize();
  const showDescription = width >= 500 || width === 0;

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "above" | "below";
  } | null>(null);

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = y < rect.height / 2 ? "above" : "below";

    setDropTarget((prev) => {
      if (prev?.index === index && prev.position === position) return prev;
      return { index, position };
    });
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDropTarget(null);
      return;
    }

    let targetPos = dropTarget?.position === "below" ? targetIndex + 1 : targetIndex;
    if (draggedIndex < targetPos) {
      targetPos -= 1;
    }

    if (draggedIndex !== targetPos && targetPos >= 0 && targetPos < headers.length) {
      const next = [...headers];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(targetPos, 0, moved);
      onChange(next);
    }

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  return (
    <Box
      ref={containerRef}
      style={{ border: "1px solid var(--border-color)", borderRadius: 4, overflow: "visible" }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Text
            size="xs"
            fw={600}
            c="dimmed"
            style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Headers
          </Text>
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
        </div>
      </div>

      <ScrollArea type="hover" offsetScrollbars={false}>
        <Table
          withRowBorders
          withColumnBorders={false}
          style={{ tableLayout: "fixed", width: "100%", minWidth: showDescription ? 450 : "100%" }}
        >
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: "var(--bg-tab-inactive)" }}>
              <Table.Th style={{ width: 26, textAlign: "center", padding: 0 }}></Table.Th>
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
          <Table.Tbody onDragLeave={() => setDropTarget(null)}>
            {/* 1. Show Auto-Generated Headers if enabled */}
            {showAutoHeaders &&
              AUTO_GENERATED_HEADERS.map((h, idx) => (
                <Table.Tr
                  key={`auto-${idx}`}
                  style={{ opacity: 0.5, backgroundColor: "rgba(255,255,255,0.01)" }}
                >
                  <Table.Td style={{ width: 26, padding: 0 }}></Table.Td>
                  <Table.Td style={{ textAlign: "center", padding: 0, height: 32, width: 36 }}>
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
                        height: 32,
                        padding: "0 8px",
                        fontSize: 13,
                        color: "var(--text-muted)",
                        fontFamily: "var(--aether-font-mono)",
                        gap: 4,
                      }}
                    >
                      <span style={{ flex: 1 }}>{h.key}</span>
                      <IconInfoCircle size={12} style={{ opacity: 0.7 }} />
                    </div>
                  </Table.Td>
                  <Table.Td style={{ padding: 0, height: 32 }}>
                    <div
                      style={{
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 8px",
                        fontSize: 13,
                        color: "var(--text-muted)",
                        fontFamily: "var(--aether-font-mono)",
                      }}
                    >
                      {h.value}
                    </div>
                  </Table.Td>
                  {showDescription && (
                    <Table.Td style={{ padding: 0, height: 32 }}>
                      <div
                        style={{
                          height: 32,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 8px",
                          fontSize: 13,
                          color: "var(--text-muted)",
                        }}
                      >
                        {h.description}
                      </div>
                    </Table.Td>
                  )}
                  <Table.Td style={{ width: 36, padding: 0 }}></Table.Td>
                </Table.Tr>
              ))}

            {/* 2. User editable headers */}
            {headers.map((h, idx) => {
              const isLastRow = idx === headers.length - 1 && !h.key && !h.value && !h.description;
              const isDragged = draggedIndex === idx;
              const isTarget = dropTarget?.index === idx;

              return (
                <Table.Tr
                  key={idx}
                  draggable={!isLastRow}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  style={{
                    opacity: isDragged ? 0.35 : 1,
                    boxShadow: isTarget
                      ? dropTarget.position === "above"
                        ? "inset 0 2px 0 0 var(--mantine-color-blue-5)"
                        : "inset 0 -2px 0 0 var(--mantine-color-blue-5)"
                      : undefined,
                    transition: "box-shadow 0.1s ease, opacity 0.15s ease",
                  }}
                >
                  <Table.Td style={{ textAlign: "center", padding: 0, height: 32, width: 26 }}>
                    {!isLastRow ? (
                      <div
                        style={{
                          cursor: "grab",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                          height: "100%",
                        }}
                        title="Drag to reorder"
                      >
                        <IconGripVertical size={13} />
                      </div>
                    ) : null}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "center", padding: 0, height: 32, width: 36 }}>
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
                  {showDescription && (
                    <Table.Td style={{ padding: 0, height: 32 }}>
                      <TextInput
                        value={h.description || ""}
                        onChange={(e) => handleItemChange(idx, { description: e.target.value })}
                        placeholder="Description"
                        variant="unstyled"
                        styles={{ input: { height: 32, fontSize: 13, padding: "0 8px" } }}
                      />
                    </Table.Td>
                  )}
                  <Table.Td style={{ textAlign: "center", padding: 0, height: 32, width: 36 }}>
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
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
