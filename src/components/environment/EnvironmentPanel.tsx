import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Tooltip, Modal, Button, Group, Menu, TextInput, Text } from "@mantine/core";
import {
  IconWorld,
  IconPlus,
  IconDeviceFloppy,
  IconX,
  IconDotsVertical,
  IconPencil,
  IconShieldLock,
  IconKey,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { useEnvStore } from "@/stores/envStore";
import { useTabStore } from "@/stores/tabStore";
import EnvVariableRow from "./EnvVariableRow";
import type {
  EnvVariableItem,
  EnvironmentDetails,
  EnvironmentSummary,
  MasterKeyStatus,
} from "@/types/environment";
import clsx from "clsx";
import classes from "./EnvironmentPanel.module.css";

export default function EnvironmentPanel() {
  const environments = useEnvStore((s) => s.environments);
  const setEnvironments = useEnvStore((s) => s.setEnvironments);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const setActiveEnvironment = useEnvStore((s) => s.setActiveEnvironment);
  const activeVariables = useEnvStore((s) => s.activeVariables);
  const setActiveVariables = useEnvStore((s) => s.setActiveVariables);
  const updateActiveVariable = useEnvStore((s) => s.updateActiveVariable);
  const setEnvVariables = useEnvStore((s) => s.setEnvVariables);
  const dirtyEnvs = useEnvStore((s) => s.dirtyEnvs);
  const setEnvDirty = useEnvStore((s) => s.setEnvDirty);
  const hasMasterKey = useEnvStore((s) => s.hasMasterKey);
  const hasEncryptedSecrets = useEnvStore((s) => s.hasEncryptedSecrets);
  const setMasterKeyStatus = useEnvStore((s) => s.setMasterKeyStatus);
  const setMasterKeyModalOpen = useEnvStore((s) => s.setMasterKeyModalOpen);

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

  const [legacyCleanupModalOpen, setLegacyCleanupModalOpen] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Track revealed secrets locally per row index
  const [revealedSecrets, setRevealedSecrets] = useState<Record<number, boolean>>({});

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "above" | "below";
  } | null>(null);

  // Fetch Master Key status on mount
  useEffect(() => {
    invoke<MasterKeyStatus>("get_master_key_status")
      .then((status) => setMasterKeyStatus(status))
      .catch((err) => console.error("Error fetching master key status:", err));
  }, [setMasterKeyStatus]);

  // Fetch variables when active environment changes only if not yet in cache
  useEffect(() => {
    const envKey = (activeEnvironmentName || "global").toLowerCase();
    const currentVars = useEnvStore.getState().variablesByEnv[envKey];
    if (activeEnvironmentName && !currentVars) {
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
  }, [activeEnvironmentName, setEnvVariables]);

  const handleSelectEnv = useCallback(
    (name: string) => {
      if (name === activeEnvironmentName) return;
      setActiveEnvironment(name);
      setRevealedSecrets({});
    },
    [activeEnvironmentName, setActiveEnvironment],
  );

  // Virtual blank row at the bottom for quick entry without false dirty state
  const rows = useMemo(() => {
    return activeVariables.length === 0 ||
      activeVariables[activeVariables.length - 1].key !== "" ||
      activeVariables[activeVariables.length - 1].value !== ""
      ? [...activeVariables, { key: "", value: "", type: "text" as const, enabled: true }]
      : activeVariables;
  }, [activeVariables]);

  const handleItemChange = useCallback(
    (index: number, fields: Partial<EnvVariableItem>) => {
      // If user toggles variable to secret and there is no master key, prompt to set one
      if (fields.type === "secret" && !hasMasterKey) {
        setMasterKeyModalOpen(true);
        notifications.show({
          title: "Master Key Required",
          message: "Please set a Master Key to encrypt secret variables.",
          color: "yellow",
        });
      }

      updateActiveVariable(index, fields);
    },
    [hasMasterKey, setMasterKeyModalOpen, updateActiveVariable],
  );

  const handleAddVariable = useCallback(() => {
    const current = useEnvStore.getState().activeVariables;
    setActiveVariables([...current, { key: "", value: "", type: "text", enabled: true }]);
    setEnvDirty(activeEnvironmentName || "global", true);
  }, [activeEnvironmentName, setActiveVariables, setEnvDirty]);

  const handleDeleteVariable = useCallback(
    (index: number) => {
      const current = useEnvStore.getState().activeVariables;
      if (index >= current.length) return;
      setActiveVariables(current.filter((_, i) => i !== index));
      setEnvDirty(activeEnvironmentName || "global", true);
    },
    [activeEnvironmentName, setActiveVariables, setEnvDirty],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      const current = useEnvStore.getState().activeVariables;
      if (index <= 0 || index >= current.length) return;
      const next = [...current];
      const item = next[index];
      next[index] = next[index - 1];
      next[index - 1] = item;
      setActiveVariables(next);
      setEnvDirty(activeEnvironmentName || "global", true);
    },
    [activeEnvironmentName, setActiveVariables, setEnvDirty],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      const current = useEnvStore.getState().activeVariables;
      if (index >= current.length - 1) return;
      const next = [...current];
      const item = next[index];
      next[index] = next[index + 1];
      next[index + 1] = item;
      setActiveVariables(next);
      setEnvDirty(activeEnvironmentName || "global", true);
    },
    [activeEnvironmentName, setActiveVariables, setEnvDirty],
  );

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    const currentVars = useEnvStore.getState().activeVariables;
    if (index >= currentVars.length) return;
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

    const item = currentVars[index];
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
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
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
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const currentVars = useEnvStore.getState().activeVariables;
      const draggedIdx = Number(e.dataTransfer.getData("text/plain"));

      if (
        isNaN(draggedIdx) ||
        draggedIdx === targetIndex ||
        targetIndex >= currentVars.length ||
        draggedIdx >= currentVars.length
      ) {
        setDraggedIndex(null);
        setDropTarget(null);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isBelow = y >= rect.height / 2;

      let targetPos = isBelow ? targetIndex + 1 : targetIndex;
      if (draggedIdx < targetPos) {
        targetPos -= 1;
      }

      if (draggedIdx !== targetPos && targetPos >= 0 && targetPos < currentVars.length) {
        const next = [...currentVars];
        const [moved] = next.splice(draggedIdx, 1);
        next.splice(targetPos, 0, moved);
        setActiveVariables(next);
        setEnvDirty(useEnvStore.getState().activeEnvironmentName || "global", true);
      }

      setDraggedIndex(null);
      setDropTarget(null);
    },
    [setActiveVariables, setEnvDirty],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTarget(null);
  }, []);

  const handleToggleRevealSecret = useCallback((index: number) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

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
        message: `Saved variables for '${activeEnvironmentName}' directly to YAML.`,
        color: "green",
      });

      // Check legacy .env files and offer cleanup if present
      const status = await invoke<MasterKeyStatus>("get_master_key_status");
      setMasterKeyStatus(status);
      if (status.hasLegacyDotenv) {
        setLegacyCleanupModalOpen(true);
      }
    } catch (err: unknown) {
      console.error("Error updating environment:", err);
      const errStr = String(err);
      if (errStr.includes("MASTER_KEY_REQUIRED")) {
        setMasterKeyModalOpen(true);
        notifications.show({
          title: "Master Key Required",
          message: "Please set a Master Key before saving secret variables.",
          color: "red",
        });
      } else {
        notifications.show({
          title: "Save Failed",
          message: errStr,
          color: "red",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupLegacyFiles = async () => {
    setCleaningUp(true);
    try {
      const deleted = await invoke<string[]>("cleanup_legacy_dotenv_files");
      const status = await invoke<MasterKeyStatus>("get_master_key_status");
      setMasterKeyStatus(status);
      setLegacyCleanupModalOpen(false);
      notifications.show({
        title: "Workspace Cleaned",
        message: `Removed legacy files: ${deleted.join(", ")}`,
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "Cleanup Failed",
        message: String(err),
        color: "red",
      });
    } finally {
      setCleaningUp(false);
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
            onClick={() => setMasterKeyModalOpen(true)}
            className={clsx(
              classes.actionBtn,
              hasMasterKey ? classes.keyBtnActive : classes.keyBtnWarning,
            )}
            title={
              hasMasterKey
                ? "Master Key Active (AES-256-GCM)"
                : hasEncryptedSecrets
                  ? "Unlock Master Key to decrypt secrets"
                  : "Set Master Key to encrypt/decrypt secrets"
            }
          >
            {hasMasterKey ? (
              <IconShieldLock size={13} color="#22c55e" />
            ) : (
              <IconKey size={13} color="#eab308" />
            )}
            <span>
              {hasMasterKey
                ? "Master Key"
                : hasEncryptedSecrets
                  ? "Unlock Secrets"
                  : "Set Master Key"}
            </span>
          </button>

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
              const isRevealed = !!revealedSecrets[idx];

              return (
                <EnvVariableRow
                  key={idx}
                  item={v}
                  index={idx}
                  isLastRow={isLastRow}
                  isFirst={isFirst}
                  isLastVar={isLastVar}
                  isDragged={isDragged}
                  isTarget={isTarget}
                  dropPosition={isTarget ? dropTarget?.position : undefined}
                  isRevealed={isRevealed}
                  onToggleReveal={handleToggleRevealSecret}
                  onChange={handleItemChange}
                  onDelete={handleDeleteVariable}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenMasterKeyModal={() => setMasterKeyModalOpen(true)}
                />
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

      {/* Modal for cleaning up legacy .env files */}
      <Modal
        opened={legacyCleanupModalOpen}
        onClose={() => setLegacyCleanupModalOpen(false)}
        title={
          <Box style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertTriangle size={18} color="#eab308" />
            <Text fw={600} size="sm">
              Clean Up Legacy .env Files?
            </Text>
          </Box>
        }
        size="sm"
        centered
      >
        <Text size="xs" c="dimmed" mb="lg">
          Your environment variables have been successfully migrated directly into the YAML files in{" "}
          <code>environments/</code>. Would you like to delete the legacy <code>.env</code> and{" "}
          <code>.env.*</code> files at your workspace root to keep your project clean?
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            size="xs"
            onClick={() => setLegacyCleanupModalOpen(false)}
            disabled={cleaningUp}
          >
            Keep Files
          </Button>
          <Button color="red" size="xs" onClick={handleCleanupLegacyFiles} loading={cleaningUp}>
            Delete Legacy .env Files
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
