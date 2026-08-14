import React, { memo } from "react";
import { Box, Checkbox, Tooltip, TextInput, ActionIcon } from "@mantine/core";
import {
  IconLock,
  IconLockOpen,
  IconTrash,
  IconGripVertical,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import type { EnvVariableItem } from "@/types/environment";
import clsx from "clsx";
import classes from "./EnvironmentPanel.module.css";

interface EnvVariableRowProps {
  item: EnvVariableItem;
  index: number;
  isLastRow: boolean;
  isFirst: boolean;
  isLastVar: boolean;
  isDragged: boolean;
  isTarget: boolean;
  dropPosition?: "above" | "below";
  isRevealed: boolean;
  onToggleReveal: (index: number) => void;
  onChange: (index: number, fields: Partial<EnvVariableItem>) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onOpenMasterKeyModal: () => void;
}

function EnvVariableRowComponent({
  item,
  index,
  isLastRow,
  isFirst,
  isLastVar,
  isDragged,
  isTarget,
  dropPosition,
  isRevealed,
  onToggleReveal,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onOpenMasterKeyModal,
}: Readonly<EnvVariableRowProps>) {
  const isSecret = item.type === "secret";

  return (
    <Box
      draggable={!isLastRow}
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className={clsx(
        classes.row,
        isDragged && classes.draggingRow,
        isTarget && dropPosition === "above" && classes.dropAbove,
        isTarget && dropPosition === "below" && classes.dropBelow,
      )}
    >
      {/* Drag Handle */}
      <Box className={classes.colDrag}>
        {!isLastRow && (
          <div className={classes.dragHandle} title="Drag to reorder">
            <IconGripVertical size={14} />
          </div>
        )}
      </Box>

      {/* Enabled Checkbox */}
      <Box className={classes.colCheck}>
        <Checkbox
          checked={item.enabled}
          onChange={(e) => onChange(index, { enabled: e.currentTarget.checked })}
          size="xs"
          styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
        />
      </Box>

      {/* Key */}
      <Box className={classes.colKey}>
        <UndoableTextInput
          variant="unstyled"
          value={item.key}
          onChange={(e) => onChange(index, { key: e.target.value })}
          placeholder="KEY_NAME"
          className={classes.tableInput}
        />
      </Box>

      {/* Value */}
      <Box className={classes.colVal}>
        {item.isLocked ? (
          <TextInput
            variant="unstyled"
            value=""
            disabled
            placeholder="[Locked: Enter Master Key to decrypt]"
            className={clsx(classes.tableInput, classes.lockedInput)}
            rightSection={
              <Tooltip label="Unlock Secret with Master Key" position="top">
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color="yellow"
                  onClick={onOpenMasterKeyModal}
                >
                  <IconLock size={13} />
                </ActionIcon>
              </Tooltip>
            }
          />
        ) : isSecret && !isRevealed && item.value ? (
          <div className={classes.maskedValueContainer} title="Reveal secret to view or edit">
            <span className={classes.maskedValueDots}>••••••••</span>
            <Tooltip label="Reveal Secret to Edit" position="top">
              <ActionIcon
                variant="subtle"
                size="xs"
                color="orange"
                onClick={() => onToggleReveal(index)}
              >
                <IconLock size={13} />
              </ActionIcon>
            </Tooltip>
          </div>
        ) : (
          <UndoableTextInput
            variant="unstyled"
            type="text"
            value={item.value}
            onChange={(e) => onChange(index, { value: e.target.value })}
            placeholder="value"
            className={classes.tableInput}
            rightSection={
              isSecret ? (
                <Tooltip label="Hide Secret" position="top">
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    color="orange"
                    onClick={() => onToggleReveal(index)}
                  >
                    <IconLockOpen size={13} />
                  </ActionIcon>
                </Tooltip>
              ) : null
            }
          />
        )}
      </Box>

      {/* Type Selector (Text / Secret) */}
      <Box className={classes.colType}>
        <Tooltip
          label={
            isSecret
              ? "Secret: Encrypted with AES-256-GCM in YAML file (safe for Git)"
              : "Text: Stored in plain text in YAML file"
          }
          position="top"
        >
          <button
            type="button"
            onClick={() => onChange(index, { type: isSecret ? "text" : "secret" })}
            className={clsx(
              classes.typeBadge,
              isSecret ? classes.typeBadgeSecret : classes.typeBadgeText,
            )}
          >
            {isSecret ? <IconLock size={11} /> : null}
            <span>{isSecret ? "SECRET" : "TEXT"}</span>
          </button>
        </Tooltip>
      </Box>

      {/* Row Actions */}
      <Box className={classes.colActions}>
        {!isLastRow && (
          <div className={classes.rowActions}>
            <Tooltip label="Move up" position="top" withArrow openDelay={400}>
              <ActionIcon
                variant="subtle"
                size="xs"
                disabled={isFirst}
                onClick={() => onMoveUp(index)}
                className={classes.moveBtn}
              >
                <IconChevronUp size={12} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Move down" position="top" withArrow openDelay={400}>
              <ActionIcon
                variant="subtle"
                size="xs"
                disabled={isLastVar}
                onClick={() => onMoveDown(index)}
                className={classes.moveBtn}
              >
                <IconChevronDown size={12} />
              </ActionIcon>
            </Tooltip>
            {(item.key || item.value) && (
              <Tooltip label="Delete" position="top" withArrow openDelay={400}>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => onDelete(index)}
                  className={classes.deleteBtn}
                >
                  <IconTrash size={13} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        )}
      </Box>
    </Box>
  );
}

export const EnvVariableRow = memo(EnvVariableRowComponent);
export default EnvVariableRow;
