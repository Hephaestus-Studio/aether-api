import { useState } from "react";
import { Box, Checkbox, ActionIcon, Text, ScrollArea, Tooltip } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconTrash,
  IconGripVertical,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import type { KeyValuePair } from "@/types/request";
import clsx from "clsx";
import classes from "./ParamsEditor.module.css";

interface ParamsEditorProps {
  params: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
}

export default function ParamsEditor({ params, onChange }: Readonly<ParamsEditorProps>) {
  const { ref: containerRef, width } = useElementSize();
  const showDescription = width >= 520 || width === 0;

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "above" | "below";
  } | null>(null);

  // Virtual blank row at the bottom if needed without mutating parent state on mount
  const rows =
    params.length === 0 ||
    params[params.length - 1].key !== "" ||
    params[params.length - 1].value !== ""
      ? [...params, { key: "", value: "", enabled: true, description: "" }]
      : params;

  const activeCount = params.filter((p) => p.enabled && (p.key.trim() || p.value.trim())).length;

  const handleItemChange = (index: number, fields: Partial<KeyValuePair>) => {
    if (index >= params.length) {
      onChange([...params, { key: "", value: "", enabled: true, description: "", ...fields }]);
    } else {
      const next = [...params];
      next[index] = { ...next[index], ...fields };
      onChange(next);
    }
  };

  const handleDelete = (index: number) => {
    if (index >= params.length) return;
    onChange(params.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0 || index >= params.length) return;
    const next = [...params];
    const item = next[index];
    next[index] = next[index - 1];
    next[index - 1] = item;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= params.length - 1) return;
    const next = [...params];
    const item = next[index];
    next[index] = next[index + 1];
    next[index + 1] = item;
    onChange(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (index >= params.length) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());

    // Create compact mini drag preview capsule
    const dragPreview = document.createElement("div");
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-9999px";
    dragPreview.style.left = "-9999px";
    dragPreview.style.display = "inline-flex";
    dragPreview.style.alignItems = "center";
    dragPreview.style.gap = "6px";
    dragPreview.style.padding = "2px 8px";
    dragPreview.style.height = "24px";
    dragPreview.style.boxSizing = "border-box";
    dragPreview.style.backgroundColor = "var(--bg-secondary, #18181a)";
    dragPreview.style.border = "1px solid var(--aether-color-primary-base, #3b82f6)";
    dragPreview.style.borderRadius = "4px";
    dragPreview.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    dragPreview.style.color = "#ffffff";
    dragPreview.style.fontSize = "11.5px";
    dragPreview.style.whiteSpace = "nowrap";
    dragPreview.style.zIndex = "99999";
    dragPreview.style.pointerEvents = "none";
    dragPreview.style.width = "auto";
    dragPreview.style.maxWidth = "220px";

    const item = params[index];
    const keyText = (item.key || "param").trim();

    const gripIcon = document.createElement("span");
    gripIcon.style.color = "var(--text-muted, #8e8e93)";
    gripIcon.style.fontSize = "10px";
    gripIcon.style.lineHeight = "1";
    gripIcon.textContent = "⋮⋮";

    const checkIcon = document.createElement("span");
    checkIcon.style.color = item.enabled
      ? "var(--aether-color-primary-base, #3b82f6)"
      : "var(--text-muted, #8e8e93)";
    checkIcon.style.fontSize = "11px";
    checkIcon.style.lineHeight = "1";
    checkIcon.textContent = item.enabled ? "☑" : "☐";

    const keySpan = document.createElement("span");
    keySpan.style.fontFamily = "var(--aether-font-mono, monospace)";
    keySpan.style.color = "var(--text-primary, #ffffff)";
    keySpan.style.fontWeight = "500";
    keySpan.style.overflow = "hidden";
    keySpan.style.textOverflow = "ellipsis";
    keySpan.style.maxWidth = "160px";
    keySpan.textContent = keyText;

    dragPreview.appendChild(gripIcon);
    dragPreview.appendChild(checkIcon);
    dragPreview.appendChild(keySpan);

    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 12, 12);

    setTimeout(() => {
      if (document.body.contains(dragPreview)) {
        document.body.removeChild(dragPreview);
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index || index >= params.length) return;
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

    if (draggedIndex === null || draggedIndex === targetIndex || targetIndex >= params.length) {
      setDraggedIndex(null);
      setDropTarget(null);
      return;
    }

    let targetPos = dropTarget?.position === "below" ? targetIndex + 1 : targetIndex;
    if (draggedIndex < targetPos) {
      targetPos -= 1;
    }

    if (draggedIndex !== targetPos && targetPos >= 0 && targetPos < params.length) {
      const next = [...params];
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
          <Text className={classes.headerTitle}>Query Parameters</Text>
          {activeCount > 0 && <span className={classes.countBadge}>{activeCount} active</span>}
        </div>
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
            {rows.map((p, idx) => {
              const isLastRow = idx === rows.length - 1 && !p.key && !p.value && !p.description;
              const isDragged = draggedIndex === idx;
              const isTarget = dropTarget?.index === idx;
              const isFirst = idx === 0;
              const isLastParam = idx === params.length - 1;

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
                      checked={p.enabled}
                      onChange={(e) => handleItemChange(idx, { enabled: e.target.checked })}
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </td>
                  <td className={classes.inputCell}>
                    <UndoableTextInput
                      value={p.key}
                      onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                      placeholder="Key"
                      variant="unstyled"
                      className={clsx(classes.tableInput, classes.monoInput)}
                    />
                  </td>
                  <td className={classes.inputCell}>
                    <UndoableTextInput
                      value={p.value}
                      onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                      placeholder="Value"
                      variant="unstyled"
                      className={clsx(classes.tableInput, classes.monoInput)}
                    />
                  </td>
                  {showDescription && (
                    <td className={classes.inputCell}>
                      <UndoableTextInput
                        value={p.description || ""}
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
                            disabled={isLastParam}
                            onClick={() => handleMoveDown(idx)}
                            className={classes.moveBtn}
                          >
                            <IconChevronDown size={12} />
                          </ActionIcon>
                        </Tooltip>
                        {(p.key || p.value || p.description) && (
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
