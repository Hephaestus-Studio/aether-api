import { useState } from "react";
import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Textarea,
  Card,
  Tooltip,
} from "@mantine/core";
import { IconPlus, IconTrash, IconSend, IconArrowDownLeft, IconEdit } from "@tabler/icons-react";
import type { WebSocketSavedMessage } from "@/types/request";

interface WebSocketSavedMessagesProps {
  messages: WebSocketSavedMessage[];
  onChange: (messages: WebSocketSavedMessage[]) => void;
  onLoadToComposer: (format: "json" | "text" | "binary", payload: string) => void;
  onSendDirect: (format: "json" | "text" | "binary", payload: string) => void;
  isConnected: boolean;
}

export default function WebSocketSavedMessages({
  messages = [],
  onChange,
  onLoadToComposer,
  onSendDirect,
  isConnected,
}: Readonly<WebSocketSavedMessagesProps>) {
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formFormat, setFormFormat] = useState<"json" | "text" | "binary">("json");
  const [formPayload, setFormPayload] = useState("");

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormName("");
    setFormFormat("json");
    setFormPayload('{\n  "type": "greeting",\n  "message": "Hello WebSocket"\n}');
    setModalOpened(true);
  };

  const handleOpenEdit = (msg: WebSocketSavedMessage) => {
    setEditingId(msg.id);
    setFormName(msg.name);
    setFormFormat(msg.format);
    setFormPayload(msg.payload);
    setModalOpened(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    if (editingId) {
      const updated = messages.map((m) =>
        m.id === editingId ? { ...m, name: formName, format: formFormat, payload: formPayload } : m,
      );
      onChange(updated);
    } else {
      const newPreset: WebSocketSavedMessage = {
        id: crypto.randomUUID(),
        name: formName,
        format: formFormat,
        payload: formPayload,
      };
      onChange([...messages, newPreset]);
    }
    setModalOpened(false);
  };

  const handleDelete = (id: string) => {
    onChange(messages.filter((m) => m.id !== id));
  };

  const formatColor = (format: string) => {
    switch (format) {
      case "json":
        return "teal";
      case "binary":
        return "violet";
      default:
        return "blue";
    }
  };

  return (
    <Box p="xs">
      <Group justify="space-between" mb="sm">
        <Text size="sm" c="dimmed">
          Saved Message Templates & Presets ({messages.length})
        </Text>
        <Button
          size="xs"
          variant="light"
          color="blue"
          leftSection={<IconPlus size={14} />}
          onClick={handleOpenAdd}
        >
          Add Preset
        </Button>
      </Group>

      {messages.length === 0 ? (
        <Card
          withBorder
          radius="md"
          p="lg"
          style={{ textAlign: "center", backgroundColor: "rgba(255, 255, 255, 0.01)" }}
        >
          <Text size="sm" c="dimmed">
            No saved messages yet. Create reusable message templates to quickly send recurring
            payloads.
          </Text>
          <Button
            size="xs"
            variant="outline"
            color="blue"
            mt="md"
            leftSection={<IconPlus size={14} />}
            onClick={handleOpenAdd}
            style={{ alignSelf: "center" }}
          >
            Create Preset
          </Button>
        </Card>
      ) : (
        <Stack gap="xs">
          {messages.map((msg) => (
            <Card
              key={msg.id}
              withBorder
              radius="sm"
              p="xs"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                transition: "all 0.15s ease",
              }}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge size="xs" color={formatColor(msg.format)} variant="light">
                    {msg.format.toUpperCase()}
                  </Badge>
                  <Text size="sm" fw={600} style={{ color: "var(--text-primary)" }}>
                    {msg.name}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Tooltip label="Load into Composer" position="top">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="blue"
                      onClick={() => onLoadToComposer(msg.format, msg.payload)}
                    >
                      <IconArrowDownLeft size={16} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="Send directly to server" position="top">
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="blue"
                      disabled={!isConnected}
                      onClick={() => onSendDirect(msg.format, msg.payload)}
                    >
                      <IconSend size={15} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="Edit Preset" position="top">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      onClick={() => handleOpenEdit(msg)}
                    >
                      <IconEdit size={15} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="Delete Preset" position="top">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(msg.id)}
                    >
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Text
                size="xs"
                c="dimmed"
                mt={4}
                lineClamp={1}
                style={{ fontFamily: "var(--aether-font-mono)", opacity: 0.8 }}
              >
                {msg.payload.replace(/\n/g, " ")}
              </Text>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingId ? "Edit Message Preset" : "New Message Preset"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Preset Name"
            placeholder="e.g. Subscribe to ticker"
            required
            value={formName}
            onChange={(e) => setFormName(e.currentTarget.value)}
          />

          <Select
            label="Payload Format"
            value={formFormat}
            onChange={(val) => setFormFormat((val as "json" | "text" | "binary") || "json")}
            data={[
              { value: "json", label: "JSON" },
              { value: "text", label: "Plain Text" },
              { value: "binary", label: "Binary (Hex / Base64)" },
            ]}
          />

          <Textarea
            label="Payload Body"
            placeholder="Message payload content"
            minRows={5}
            maxRows={12}
            autosize
            value={formPayload}
            onChange={(e) => setFormPayload(e.currentTarget.value)}
            style={{ fontFamily: "var(--aether-font-mono)" }}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setModalOpened(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleSave} disabled={!formName.trim()}>
              Save Preset
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
