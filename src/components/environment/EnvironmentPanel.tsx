import { useState, useEffect } from "react";
import {
  Box,
  Checkbox,
  Tooltip,
  Modal,
  Button,
  Group,
  Menu,
  ActionIcon,
  TextInput,
} from "@mantine/core";
import {
  IconWorld,
  IconPlus,
  IconDeviceFloppy,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconX,
  IconDotsVertical,
  IconPencil,
  IconGripVertical,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { useEnvStore } from "@/stores/envStore";
import { useTabStore } from "@/stores/tabStore";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import type { EnvVariableItem, EnvironmentDetails, EnvironmentSummary } from "@/types/environment";
import clsx from "clsx";
import classes from "./EnvironmentPanel.module.css";

export default function EnvironmentPanel() {
  const {
    environments,
    setEnvironments,
    activeEnvironmentName,
    setActiveEnvironment,
    activeVariables,
    setActiveVariables,
    variablesByEnv,
    setEnvVariables,
    dirtyEnvs,
    setEnvDirty,
  } = useEnvStore();

  const closeBottomPanel = useTabStore((s) => s.closeBottomPanel);

  const [saving, setSaving] = useState(false);
  const isDirty = !!dirtyEnvs[(activeEnvironmentName || "global").toLowerCase()];

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamedName, setRenamedName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Track revealed secrets locally per row index
  const [revealedSecrets, setRevealedSecrets] = useState<Record<number, boolean>>({});

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "above" | "below";
  } | null>(null);

  // Fetch variables when active environment changes only if not yet in cache
  useEffect(() => {
    const envKey = (activeEnvironmentName || "global").toLowerCase();
    if (activeEnvironmentName && !variablesByEnv[envKey]) {
      invoke<EnvironmentDetails>("read_environment", { name: activeEnvironmentName })
        .then((res) => {
          if (res && res.variables) {
            setEnvVariables(activeEnvironmentName, res.variables);
          } else {
            setEnvVariables(activeEnvironmentName, []);
          }
        })
        .catch((err) => {
          console.error("Error reading environment:", err);
          setEnvVariables(activeEnvironmentName, []);
        });
    }
  }, [activeEnvironmentName, variablesByEnv, setEnvVariables]);

  const handleSelectEnv = (name: string) => {
    if (name === activeEnvironmentName) return;
    setActiveEnvironment(name);
    setRevealedSecrets({});
  };

  // Virtual blank row at the bottom for quick entry without false dirty state
  const rows =
    activeVariables.length === 0 ||
    activeVariables[activeVariables.length - 1].key !== "" ||
    activeVariables[activeVariables.length - 1].value !== ""
      ? [...activeVariables, { key: "", value: "", type: "text" as const, enabled: true }]
      : activeVariables;

  const handleItemChange = (index: number, fields: Partial<EnvVariableItem>) => {
    if (index >= activeVariables.length) {
      setActiveVariables([
        ...activeVariables,
        { key: "", value: "", type: "text", enabled: true, ...fields },
      ]);
    } else {
      const next = [...activeVariables];
      next[index] = { ...next[index], ...fields };
      setActiveVariables(next);
    }
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleAddVariable = () => {
    setActiveVariables([...activeVariables, { key: "", value: "", type: "text", enabled: true }]);
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleDeleteVariable = (index: number) => {
    if (index >= activeVariables.length) return;
    setActiveVariables(activeVariables.filter((_, i) => i !== index));
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0 || index >= activeVariables.length) return;
    const next = [...activeVariables];
    const item = next[index];
    next[index] = next[index - 1];
    next[index - 1] = item;
    setActiveVariables(next);
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleMoveDown = (index: number) => {
    if (index >= activeVariables.length - 1) return;
    const next = [...activeVariables];
    const item = next[index];
    next[index] = next[index + 1];
    next[index + 1] = item;
    setActiveVariables(next);
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (index >= activeVariables.length) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());

    // Create micro compact drag preview capsule
    const dragPreview = document.createElement("div");
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-9999px";
    dragPreview.style.left = "-9999px";
    dragPreview.style.display = "inline-flex";
    dragPreview.style.alignItems = "center";
    dragPreview.style.gap = "4px";
    dragPreview.style.padding = "0 6px";
    dragPreview.style.height = "19px";
    dragPreview.style.boxSizing = "border-box";
    dragPreview.style.backgroundColor = "var(--bg-secondary, #18181a)";
    dragPreview.style.border = "1px solid var(--aether-color-primary-base, #3b82f6)";
    dragPreview.style.borderRadius = "3px";
    dragPreview.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.5)";
    dragPreview.style.color = "#ffffff";
    dragPreview.style.fontSize = "10.5px";
    dragPreview.style.lineHeight = "1";
    dragPreview.style.whiteSpace = "nowrap";
    dragPreview.style.zIndex = "99999";
    dragPreview.style.pointerEvents = "none";
    dragPreview.style.width = "auto";
    dragPreview.style.maxWidth = "180px";

    const item = activeVariables[index];
    const keyText = (item.key || "variable").trim();

    const gripIcon = document.createElement("span");
    gripIcon.style.color = "var(--text-muted, #8e8e93)";
    gripIcon.style.fontSize = "8px";
    gripIcon.style.lineHeight = "1";
    gripIcon.textContent = "⋮⋮";

    const checkIcon = document.createElement("span");
    checkIcon.style.color = item.enabled
      ? "var(--aether-color-primary-base, #3b82f6)"
      : "var(--text-muted, #8e8e93)";
    checkIcon.style.fontSize = "9.5px";
    checkIcon.style.lineHeight = "1";
    checkIcon.textContent = item.enabled ? "☑" : "☐";

    const keySpan = document.createElement("span");
    keySpan.style.fontFamily = "var(--aether-font-mono, monospace)";
    keySpan.style.color = "var(--text-primary, #ffffff)";
    keySpan.style.fontSize = "10.5px";
    keySpan.style.fontWeight = "500";
    keySpan.style.overflow = "hidden";
    keySpan.style.textOverflow = "ellipsis";
    keySpan.style.maxWidth = "130px";
    keySpan.textContent = keyText;

    dragPreview.appendChild(gripIcon);
    dragPreview.appendChild(checkIcon);
    dragPreview.appendChild(keySpan);

    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 8, 9);

    setTimeout(() => {
      if (document.body.contains(dragPreview)) {
        document.body.removeChild(dragPreview);
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index || index >= activeVariables.length) return;
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

    if (
      draggedIndex === null ||
      draggedIndex === targetIndex ||
      targetIndex >= activeVariables.length
    ) {
      setDraggedIndex(null);
      setDropTarget(null);
      return;
    }

    let targetPos = dropTarget?.position === "below" ? targetIndex + 1 : targetIndex;
    if (draggedIndex < targetPos) {
      targetPos -= 1;
    }

    if (draggedIndex !== targetPos && targetPos >= 0 && targetPos < activeVariables.length) {
      const next = [...activeVariables];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(targetPos, 0, moved);
      setActiveVariables(next);
      setEnvDirty(activeEnvironmentName || "global", true);
    }

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleToggleRevealSecret = (index: number) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSave = async () => {
    if (!activeEnvironmentName) return;

    setSaving(true);
    try {
      await invoke("update_environment", {
        name: activeEnvironmentName,
        variables: activeVariables,
      });
      setEnvDirty(activeEnvironmentName, false);
      notifications.show({
        title: "Environment Saved",
        message: `Saved variables for '${activeEnvironmentName}'`,
        color: "green",
      });
    } catch (err) {
      console.error("Error updating environment:", err);
      notifications.show({
        title: "Save Failed",
        message: String(err),
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEnvironment = async () => {
    const trimmed = newEnvName.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      await invoke("create_environment", { name: trimmed });
      const envs = await invoke<EnvironmentSummary[]>("list_environments");
      setEnvironments(envs);
      setActiveEnvironment(trimmed);
      setCreateModalOpen(false);
      setNewEnvName("");
      notifications.show({
        title: "Environment Created",
        message: `Environment '${trimmed}' has been created.`,
        color: "green",
      });
    } catch (err) {
      console.error("Error creating environment:", err);
      notifications.show({
        title: "Create Failed",
        message: String(err),
        color: "red",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRenameEnvironment = async () => {
    if (!activeEnvironmentName) return;
    const trimmed = renamedName.trim();
    if (!trimmed || trimmed === activeEnvironmentName) {
      setRenameModalOpen(false);
      return;
    }

    setRenaming(true);
    try {
      await invoke("rename_environment", {
        oldName: activeEnvironmentName,
        newName: trimmed,
      });
      const envs = await invoke<EnvironmentSummary[]>("list_environments");
      setEnvironments(envs);
      setActiveEnvironment(trimmed);
      setRenameModalOpen(false);
      notifications.show({
        title: "Environment Renamed",
        message: `Renamed environment to '${trimmed}'`,
        color: "green",
      });
    } catch (err) {
      console.error("Error renaming environment:", err);
      notifications.show({
        title: "Rename Failed",
        message: String(err),
        color: "red",
      });
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!activeEnvironmentName || activeEnvironmentName.toLowerCase() === "global") return;

    if (
      !window.confirm(`Are you sure you want to delete environment '${activeEnvironmentName}'?`)
    ) {
      return;
    }

    try {
      await invoke("delete_environment", { name: activeEnvironmentName });
      const envs = await invoke<EnvironmentSummary[]>("list_environments");
      setEnvironments(envs);
      setActiveEnvironment("global");
      notifications.show({
        title: "Environment Deleted",
        message: `Environment '${activeEnvironmentName}' deleted.`,
        color: "blue",
      });
    } catch (err) {
      console.error("Error deleting environment:", err);
      notifications.show({
        title: "Delete Failed",
        message: String(err),
        color: "red",
      });
    }
  };

  const allEnvTabs = [
    { name: "global", label: "Global", isCustom: false },
    ...environments
      .filter((e) => e.name.toLowerCase() !== "global")
      .map((e) => ({ name: e.name, label: e.name, isCustom: true })),
  ];

  return (
    <Box className={classes.container}>
      {/* Header Bar */}
      <Box className={classes.header}>
        {/* Environment Tabs */}
        <Box className={classes.tabsContainer}>
          <IconWorld
            size={14}
            color="var(--aether-color-primary-base)"
            style={{ marginRight: 2, flexShrink: 0 }}
          />

          {allEnvTabs.map((env) => {
            const isActive =
              (activeEnvironmentName || "global").toLowerCase() === env.name.toLowerCase();
            return (
              <button
                key={env.name}
                type="button"
                onClick={() => handleSelectEnv(env.name)}
                className={`${classes.tab} ${isActive ? classes.tabActive : ""}`}
              >
                <span>{env.label}</span>
                {env.name === "global" && <span className={classes.tabBadge}>Shared</span>}
              </button>
            );
          })}

          <Tooltip label="New Environment" position="top" withArrow>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className={`${classes.actionBtn} ${classes.iconBtn}`}
            >
              <IconPlus size={13} />
            </button>
          </Tooltip>
        </Box>

        {/* Action Controls Toolbar */}
        <Box className={classes.actions}>
          <button
            type="button"
            onClick={handleAddVariable}
            className={classes.actionBtn}
            title="Add a new variable to this environment"
          >
            <IconPlus size={13} />
            <span>Add Variable</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${classes.actionBtn} ${classes.saveBtn} ${isDirty ? classes.saveBtnDirty : ""}`}
            title="Save environment variables (Ctrl+S)"
          >
            <IconDeviceFloppy size={13} />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>

          {activeEnvironmentName && activeEnvironmentName.toLowerCase() !== "global" && (
            <Menu shadow="md" width={200} position="bottom-end" withinPortal>
              <Menu.Target>
                <button
                  type="button"
                  className={`${classes.actionBtn} ${classes.iconBtn}`}
                  title="Environment options"
                >
                  <IconDotsVertical size={14} />
                </button>
              </Menu.Target>
              <Menu.Dropdown className={classes.menuDropdown}>
                <Menu.Item
                  leftSection={<IconPencil size={14} />}
                  className={classes.menuItem}
                  onClick={() => {
                    setRenamedName(activeEnvironmentName);
                    setRenameModalOpen(true);
                  }}
                >
                  Rename Environment
                </Menu.Item>
                <Menu.Divider className={classes.menuDivider} />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  className={classes.menuItem}
                  onClick={handleDeleteEnvironment}
                >
                  Delete Environment
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}

          <Tooltip label="Close Panel" position="top" withArrow>
            <button
              type="button"
              onClick={closeBottomPanel}
              className={`${classes.actionBtn} ${classes.iconBtn}`}
            >
              <IconX size={14} />
            </button>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Variable Table Grid */}
      <Box className={classes.body} onDragLeave={() => setDropTarget(null)}>
        {activeVariables.length === 0 && rows.length === 1 && !rows[0].key && !rows[0].value ? (
          <Box className={classes.emptyState}>
            <span>No variables configured for this environment.</span>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={13} />}
              onClick={handleAddVariable}
            >
              Add First Variable
            </Button>
          </Box>
        ) : (
          <Box className={classes.tableWrapper}>
            {/* Table Column Headers */}
            <Box className={classes.tableHeader}>
              <Box className={classes.colDrag}></Box>
              <Box className={classes.colCheck}></Box>
              <Box className={classes.colKey}>KEY</Box>
              <Box className={classes.colVal}>VALUE</Box>
              <Box className={classes.colType}>TYPE</Box>
              <Box className={classes.colActions}></Box>
            </Box>

            {/* Rows List */}
            {rows.map((v, idx) => {
              const isLastRow = idx === rows.length - 1 && !v.key && !v.value;
              const isDragged = draggedIndex === idx;
              const isTarget = dropTarget?.index === idx;
              const isFirst = idx === 0;
              const isLastVar = idx === activeVariables.length - 1;
              const isSecret = v.type === "secret";
              const isRevealed = !!revealedSecrets[idx];

              return (
                <Box
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
                      checked={v.enabled}
                      onChange={(e) => handleItemChange(idx, { enabled: e.currentTarget.checked })}
                      size="xs"
                      styles={{ root: { display: "inline-flex", verticalAlign: "middle" } }}
                    />
                  </Box>

                  {/* Key */}
                  <Box className={classes.colKey}>
                    <UndoableTextInput
                      variant="unstyled"
                      value={v.key}
                      onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                      placeholder="KEY_NAME"
                      className={classes.tableInput}
                    />
                  </Box>

                  {/* Value */}
                  <Box className={classes.colVal}>
                    <UndoableTextInput
                      variant="unstyled"
                      type={isSecret && !isRevealed ? "password" : "text"}
                      value={v.value}
                      onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                      placeholder="value"
                      className={classes.tableInput}
                      rightSection={
                        isSecret ? (
                          <Tooltip
                            label={isRevealed ? "Hide Secret" : "Reveal Secret"}
                            position="top"
                          >
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              color="orange"
                              onClick={() => handleToggleRevealSecret(idx)}
                            >
                              {isRevealed ? <IconLockOpen size={13} /> : <IconLock size={13} />}
                            </ActionIcon>
                          </Tooltip>
                        ) : null
                      }
                    />
                  </Box>

                  {/* Type Selector (Text / Secret) */}
                  <Box className={classes.colType}>
                    <Tooltip
                      label={
                        isSecret
                          ? "Secret: Stored in .env and gitignored"
                          : "Text: Stored in environment yaml file"
                      }
                      position="top"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleItemChange(idx, { type: isSecret ? "text" : "secret" })
                        }
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
                            disabled={isLastVar}
                            onClick={() => handleMoveDown(idx)}
                            className={classes.moveBtn}
                          >
                            <IconChevronDown size={12} />
                          </ActionIcon>
                        </Tooltip>
                        {(v.key || v.value) && (
                          <Tooltip label="Delete" position="top" withArrow openDelay={400}>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="xs"
                              onClick={() => handleDeleteVariable(idx)}
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
            })}
          </Box>
        )}
      </Box>

      {/* Modal for creating a new environment */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Environment"
        size="sm"
        centered
      >
        <TextInput
          label="Environment Name"
          placeholder="e.g. dev, staging, production"
          value={newEnvName}
          onChange={(e) => setNewEnvName(e.target.value)}
          data-autofocus
          mb="md"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCreateEnvironment();
            }
          }}
        />
        <Group justify="flex-end">
          <Button variant="default" size="xs" onClick={() => setCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button size="xs" loading={creating} onClick={handleCreateEnvironment}>
            Create
          </Button>
        </Group>
      </Modal>

      {/* Modal for renaming an environment */}
      <Modal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename Environment"
        size="sm"
        centered
      >
        <TextInput
          label="New Name"
          value={renamedName}
          onChange={(e) => setRenamedName(e.target.value)}
          data-autofocus
          mb="md"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleRenameEnvironment();
            }
          }}
        />
        <Group justify="flex-end">
          <Button variant="default" size="xs" onClick={() => setRenameModalOpen(false)}>
            Cancel
          </Button>
          <Button size="xs" loading={renaming} onClick={handleRenameEnvironment}>
            Rename
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
