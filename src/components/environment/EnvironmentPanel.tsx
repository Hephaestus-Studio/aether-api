import { useState, useEffect } from "react";
import {
  Box,
  TextInput,
  Checkbox,
  Tooltip,
  Modal,
  Button,
  Group,
  Menu,
  ActionIcon,
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
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { useEnvStore } from "@/stores/envStore";
import { useTabStore } from "@/stores/tabStore";
import type { EnvVariableItem, EnvironmentDetails, EnvironmentSummary } from "@/types/environment";
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

  const handleItemChange = (index: number, fields: Partial<EnvVariableItem>) => {
    const next = [...activeVariables];
    next[index] = { ...next[index], ...fields };
    setActiveVariables(next);
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleAddVariable = () => {
    setActiveVariables([...activeVariables, { key: "", value: "", type: "text", enabled: true }]);
    setEnvDirty(activeEnvironmentName || "global", true);
  };

  const handleDeleteVariable = (index: number) => {
    setActiveVariables(activeVariables.filter((_, i) => i !== index));
    setEnvDirty(activeEnvironmentName || "global", true);
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
      <Box className={classes.body}>
        {activeVariables.length === 0 ? (
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
              <Box className={classes.colCheck}></Box>
              <Box className={classes.colKey}>Variable Key</Box>
              <Box className={classes.colVal}>Value</Box>
              <Box className={classes.colType}>Type</Box>
              <Box className={classes.colActions}></Box>
            </Box>

            {/* Rows List */}
            {activeVariables.map((v, idx) => {
              const isSecret = v.type === "secret";
              const isRevealed = !!revealedSecrets[idx];

              return (
                <Box key={idx} className={classes.row}>
                  {/* Enabled Checkbox */}
                  <Box className={classes.colCheck}>
                    <Checkbox
                      checked={v.enabled}
                      onChange={(e) => handleItemChange(idx, { enabled: e.currentTarget.checked })}
                      size="xs"
                    />
                  </Box>

                  {/* Key */}
                  <Box className={classes.colKey}>
                    <TextInput
                      variant="unstyled"
                      value={v.key}
                      onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                      placeholder="KEY_NAME"
                      className={classes.keyInput}
                    />
                  </Box>

                  {/* Value */}
                  <Box className={classes.colVal}>
                    <TextInput
                      variant="unstyled"
                      type={isSecret && !isRevealed ? "password" : "text"}
                      value={v.value}
                      onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                      placeholder="value"
                      className={classes.valInput}
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
                        style={{
                          background: isSecret
                            ? "rgba(255, 159, 28, 0.15)"
                            : "rgba(255, 255, 255, 0.05)",
                          border: isSecret
                            ? "1px solid rgba(255, 159, 28, 0.3)"
                            : "1px solid var(--border-color)",
                          color: isSecret ? "#ff9f1c" : "var(--text-muted)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        {isSecret ? <IconLock size={11} /> : null}
                        <span>{isSecret ? "SECRET" : "TEXT"}</span>
                      </button>
                    </Tooltip>
                  </Box>

                  {/* Delete Action */}
                  <Box className={classes.colActions}>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => handleDeleteVariable(idx)}
                      title="Delete variable"
                    >
                      <IconTrash size={13} />
                    </ActionIcon>
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
