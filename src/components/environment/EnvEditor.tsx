import { useState, useEffect } from "react";
import {
  Box,
  Table,
  TextInput,
  ActionIcon,
  Group,
  Button,
  Modal,
  Tooltip,
  Text,
  LoadingOverlay,
  ScrollArea,
  Menu,
} from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconTrash,
  IconPlus,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconDots,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { useEnvStore } from "@/stores/envStore";
import type { EnvVariableItem, EnvironmentDetails, EnvironmentSummary } from "@/types/environment";
import EnvSelector from "./EnvSelector";

export default function EnvEditor() {
  const { ref: containerRef, width } = useElementSize();
  const isCompact = width > 0 && width < 340;

  const {
    setEnvironments,
    activeEnvironmentName,
    setActiveEnvironment,
    activeVariables,
    setActiveVariables,
  } = useEnvStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New environment modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [creating, setCreating] = useState(false);

  // Rename environment modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamedName, setRenamedName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Fetch variables when active environment changes
  useEffect(() => {
    if (!activeEnvironmentName) {
      setActiveVariables([]);
      return;
    }

    setLoading(true);
    invoke<EnvironmentDetails>("read_environment", { name: activeEnvironmentName })
      .then((res) => {
        if (res && res.variables) {
          setActiveVariables(res.variables);
        } else {
          setActiveVariables([]);
        }
      })
      .catch((err) => {
        console.error("Error reading environment:", err);
        notifications.show({
          title: "Error Reading Environment",
          message: String(err),
          color: "red",
        });
      })
      .finally(() => setLoading(false));
  }, [activeEnvironmentName, setActiveVariables]);

  const handleItemChange = (index: number, fields: Partial<EnvVariableItem>) => {
    const next = [...activeVariables];
    next[index] = { ...next[index], ...fields };
    setActiveVariables(next);
  };

  const handleAdd = () => {
    setActiveVariables([...activeVariables, { key: "", value: "", type: "text", enabled: true }]);
  };

  const handleDelete = (index: number) => {
    setActiveVariables(activeVariables.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!activeEnvironmentName) {
      notifications.show({
        title: "No Environment Selected",
        message: "Please select an environment before saving changes.",
        color: "yellow",
      });
      return;
    }

    setSaving(true);
    try {
      await invoke("update_environment", {
        name: activeEnvironmentName,
        variables: activeVariables,
      });
      notifications.show({
        title: "Environment Saved",
        message: `Successfully saved changes to '${activeEnvironmentName}'`,
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
    if (!activeEnvironmentName) return;

    if (
      !window.confirm(`Are you sure you want to delete environment '${activeEnvironmentName}'?`)
    ) {
      return;
    }

    try {
      await invoke("delete_environment", { name: activeEnvironmentName });
      const envs = await invoke<EnvironmentSummary[]>("list_environments");
      setEnvironments(envs);
      setActiveEnvironment(null);
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

  return (
    <Box ref={containerRef} style={{ padding: "0 12px", position: "relative" }}>
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />

      {/* Header Selector & 3-Dots Management Menu */}
      <Group mb={12} align="center" gap="xs">
        <Box style={{ flex: 1 }}>
          <EnvSelector />
        </Box>
        <Menu shadow="md" width={180} position="bottom-end" zIndex={1000}>
          <Menu.Target>
            <Tooltip label="Environment Options">
              <ActionIcon variant="subtle" size="md">
                <IconDots size={16} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconPlus size={14} />}
              onClick={() => setCreateModalOpen(true)}
            >
              New Environment
            </Menu.Item>
            {activeEnvironmentName && activeEnvironmentName.toLowerCase() !== "global" && (
              <>
                <Menu.Item
                  leftSection={<IconPencil size={14} />}
                  onClick={() => {
                    setRenamedName(activeEnvironmentName);
                    setRenameModalOpen(true);
                  }}
                >
                  Rename Environment
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleDeleteEnvironment}
                >
                  Delete Environment
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {activeEnvironmentName ? (
        <>
          {/* Variables List: Compact Card Stack (< 340px) vs Table (>= 340px) */}
          {isCompact ? (
            <ScrollArea.Autosize mah={420} mb={12}>
              {activeVariables.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  No variables defined. Click "Add Variable" to create one.
                </Text>
              ) : (
                activeVariables.map((v, idx) => (
                  <Box
                    key={idx}
                    mb={8}
                    p={8}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: 6,
                      backgroundColor: "var(--bg-app)",
                    }}
                  >
                    <Group justify="space-between" mb={6} gap={6}>
                      <TextInput
                        value={v.key}
                        onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                        size="xs"
                        placeholder="Key"
                        style={{ flex: 1 }}
                      />
                      <Group gap={4}>
                        <Tooltip label={v.type === "secret" ? "Secret (masked)" : "Text (plain)"}>
                          <ActionIcon
                            variant="subtle"
                            color={v.type === "secret" ? "orange" : "gray"}
                            size="xs"
                            onClick={() =>
                              handleItemChange(idx, {
                                type: v.type === "secret" ? "text" : "secret",
                              })
                            }
                          >
                            {v.type === "secret" ? (
                              <IconLock size={14} />
                            ) : (
                              <IconLockOpen size={14} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="xs"
                          onClick={() => handleDelete(idx)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    <TextInput
                      value={v.value}
                      onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                      size="xs"
                      type={v.type === "secret" ? "password" : "text"}
                      placeholder="Value"
                    />
                  </Box>
                ))
              )}
            </ScrollArea.Autosize>
          ) : (
            <Table mb={12}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Key</Table.Th>
                  <Table.Th>Value</Table.Th>
                  <Table.Th style={{ width: 45, textAlign: "center" }}>Type</Table.Th>
                  <Table.Th style={{ width: 35 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {activeVariables.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text size="xs" c="dimmed" ta="center" py="sm">
                        No variables defined. Click "Add Variable" to create one.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  activeVariables.map((v, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        <TextInput
                          value={v.key}
                          onChange={(e) => handleItemChange(idx, { key: e.target.value })}
                          size="xs"
                          placeholder="Variable Key"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={v.value}
                          onChange={(e) => handleItemChange(idx, { value: e.target.value })}
                          size="xs"
                          type={v.type === "secret" ? "password" : "text"}
                          placeholder="Value"
                        />
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        <Tooltip label={v.type === "secret" ? "Secret (masked)" : "Text (plain)"}>
                          <ActionIcon
                            variant="subtle"
                            color={v.type === "secret" ? "orange" : "gray"}
                            size="xs"
                            onClick={() =>
                              handleItemChange(idx, {
                                type: v.type === "secret" ? "text" : "secret",
                              })
                            }
                          >
                            {v.type === "secret" ? (
                              <IconLock size={14} />
                            ) : (
                              <IconLockOpen size={14} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="xs"
                          onClick={() => handleDelete(idx)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          )}

          {/* Equal split responsive button row */}
          <Group justify="space-between" gap="xs">
            <Button
              size="xs"
              variant="default"
              onClick={handleAdd}
              leftSection={<IconPlus size={13} />}
              style={{ flex: 1, paddingLeft: 6, paddingRight: 6 }}
            >
              Add Variable
            </Button>
            <Button
              size="xs"
              loading={saving}
              onClick={handleSave}
              style={{ flex: 1, paddingLeft: 6, paddingRight: 6 }}
            >
              Save Changes
            </Button>
          </Group>
        </>
      ) : (
        <Text size="xs" c="dimmed" ta="center" py="md">
          Select or create an environment to edit variables.
        </Text>
      )}

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
