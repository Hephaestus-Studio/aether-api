import { useState } from "react";
import { Modal, TextInput, Box, Text, Group } from "@mantine/core";
import { IconTerminal } from "@tabler/icons-react";

interface CommandPaletteProps {
  opened: boolean;
  onClose: () => void;
}

export default function CommandPalette({ opened, onClose }: Readonly<CommandPaletteProps>) {
  const [query, setQuery] = useState("");

  const commands = [
    { title: "Send Request", shortcut: "Ctrl+Enter" },
    { title: "Close Active Tab", shortcut: "Ctrl+W" },
    { title: "Toggle Sidebar", shortcut: "Ctrl+B" },
  ];

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} size="md" radius="md">
      <TextInput
        placeholder="Type command name..."
        leftSection={<IconTerminal size={16} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        mb={12}
      />
      <Box>
        {commands.map((cmd) => (
          <Box
            key={cmd.title}
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 4,
              "&:hover": { backgroundColor: "var(--bg-tab-active)" },
            }}
            mb={4}
          >
            <Group justify="space-between">
              <Text size="sm">{cmd.title}</Text>
              <Text size="11px" style={{ color: "var(--text-muted)" }}>
                {cmd.shortcut}
              </Text>
            </Group>
          </Box>
        ))}
      </Box>
    </Modal>
  );
}
