import { useState } from "react";
import { Box, Checkbox, ActionIcon, Text, ScrollArea, Tooltip } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconTrash,
  IconGripVertical,
  IconEye,
  IconEyeOff,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import type { KeyValuePair } from "@/types/request";
import clsx from "clsx";
import classes from "./HeadersEditor.module.css";

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
  const showDescription = width >= 520 || width === 0;

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "above" | "below";
  } | null>(null);

  // Virtual blank row at the bottom if needed without mutating parent state on mount
  const rows =
    headers.length === 0 ||
    headers[headers.length - 1].key !== "" ||
    headers[headers.length - 1].value !== ""
      ? [...headers, { key: "", value: "", enabled: true, description: "" }]
      : headers;

  const activeCount =
    headers.filter((h) => h.enabled && (h.key.trim() || h.value.trim())).length +
    (showAutoHeaders ? AUTO_GENERATED_HEADERS.length : 0);

  const handleItemChange = (index: number, fields: Partial<KeyValuePair>) => {
    if (index >= headers.length) {
      onChange([...headers, { key: "", value: "", enabled: true, description: "", ...fields }]);
    } else {
      const next = [...headers];
      next[index] = { ...next[index], ...fields };
      onChange(next);
    }
  };

  const handleDelete = (index: number) => {
    if (index >= headers.length) return;
    onChange(headers.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0 || index >= headers.length) return;
    const next = [...headers];
    const item = next[index];
    next[index] = next[index - 1];
    next[index - 1] = item;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= headers.length - 1) return;
    const next = [...headers];
    const item = next[index];
    next[index] = next[index + 1];
    next[index + 1] = item;
    onChange(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (index >= headers.length) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index || index >= headers.length) return;
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

    if (draggedIndex === null || draggedIndex === targetIndex || targetIndex >= headers.length) {
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
    <Box ref={containerRef} className={classes.container}>
      <div className={classes.headerBar}>
        <div className={classes.headerTitleGroup}>
          <Text className={classes.headerTitle}>Headers</Text>
          {activeCount > 0 && <span className={classes.countBadge}>{activeCount} active</span>}
        </div>

        <button
          type="button"
          onClick={() => setShowAutoHeaders(!showAutoHeaders)}
          className={classes.autoToggleBtn}
        >
          {showAutoHeaders ? <IconEyeOff size={13} /> : <IconEye size={13} />}
          <span>
            {showAutoHeaders
              ? `Hide auto headers (${AUTO_GENERATED_HEADERS.length})`
              : `Show auto headers (${AUTO_GENERATED_HEADERS.length})`}
          </span>
        </button>
      </div>

      <ScrollArea type="hover" offsetScrollbars={false}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th style={{ width: 30, textAlign: "center", padding: 0 }}></th>
              <th style={{ width: 36, textAlign: "center", padding: 0 }}></th>
              <th style={{ width: showDescription ? "35%" : undefined }}>Key</th>
              <th style={{ width: showDescription ? "35%" : undefined }}>Value</th>
              {showDescription && <th>Description</th>}
              <th style={{ width: 72, textAlign: "center", padding: 0 }}></th>
            </tr>
          </thead>
          <tbody onDragLeave={() => setDropTarget(null)}>
            {/* 1. Show Auto-Generated Headers if enabled */}
            {showAutoHeaders &&
              AUTO_GENERATED_HEADERS.map((h, idx) => (
                <tr key={`auto-${idx}`} className={classes.autoRow}>
                  <td className={classes.dragCell}></td>
                  <td className={classes.checkCell}>
                    <Checkbox
                      checked={h.enabled}
                      disabled
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td className={classes.inputCell}>
                    <div className={classes.autoKeyCell}>
                      <span>{h.key}</span>
                      <span className={classes.systemBadge}>auto</span>
                    </div>
                  </td>
                  <td className={classes.inputCell}>
                    <div className={classes.autoValueCell}>{h.value}</div>
                  </td>
                  {showDescription && (
                    <td className={classes.inputCell}>
                      <div className={classes.autoDescCell}>{h.description}</div>
                    </td>
                  )}
                  <td className={classes.actionCell}></td>
                </tr>
              ))}

            {/* 2. User editable headers */}
            {rows.map((h, idx) => {
              const isLastRow = idx === rows.length - 1 && !h.key && !h.value && !h.description;
              const isDragged = draggedIndex === idx;
              const isTarget = dropTarget?.index === idx;
              const isFirst = idx === 0;
              const isLastHeader = idx === headers.length - 1;

              return (
                <tr
                  key={idx}
                  draggable={!isLastRow}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={clsx(
                    classes.row,
                    isDragged && classes.draggingRow,
                    isTarget && dropTarget.position === "above" && classes.dropAbove,
                    isTarget && dropTarget.position === "below" && classes.dropBelow,
                  )}
                >
                  <td className={classes.dragCell}>
                    {!isLastRow ? (
                      <div className={classes.dragHandle} title="Drag to reorder">
                        <IconGripVertical size={14} />
                      </div>
                    ) : null}
                  </td>
                  <td className={classes.checkCell}>
                    <Checkbox
                      checked={h.enabled}
                      onChange={(e) => handleItemChange(idx, { enabled: e.target.checked })}
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td className={classes.inputCell}>
                    <UndoableTextInput
                      value={h.key}
                      onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                      placeholder="Key"
                      variant="unstyled"
                      className={clsx(classes.tableInput, classes.monoInput)}
                    />
                  </td>
                  <td className={classes.inputCell}>
                    <UndoableTextInput
                      value={h.value}
                      onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                      placeholder="Value"
                      variant="unstyled"
                      className={clsx(classes.tableInput, classes.monoInput)}
                    />
                  </td>
                  {showDescription && (
                    <td className={classes.inputCell}>
                      <UndoableTextInput
                        value={h.description || ""}
                        onChange={(e) => handleItemChange(idx, { description: e.target.value })}
                        placeholder="Description"
                        variant="unstyled"
                        className={classes.tableInput}
                      />
                    </td>
                  )}
                  <td className={classes.actionCell}>
                    {!isLastRow && (
                      <div className={classes.rowActions}>
                        <Tooltip label="Move up" position="top" withArrow openDelay={400}>
                          <ActionIcon
                            variant="subtle"
                            size="xs"
                            disabled={isFirst}
                            onClick={() => handleMoveUp(idx)}
                            className={classes.moveBtn}
                          >
                            <IconChevronUp size={12} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Move down" position="top" withArrow openDelay={400}>
                          <ActionIcon
                            variant="subtle"
                            size="xs"
                            disabled={isLastHeader}
                            onClick={() => handleMoveDown(idx)}
                            className={classes.moveBtn}
                          >
                            <IconChevronDown size={12} />
                          </ActionIcon>
                        </Tooltip>
                        {(h.key || h.value || h.description) && (
                          <Tooltip label="Delete" position="top" withArrow openDelay={400}>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="xs"
                              onClick={() => handleDelete(idx)}
                              className={classes.deleteBtn}
                            >
                              <IconTrash size={13} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </Box>
  );
}
