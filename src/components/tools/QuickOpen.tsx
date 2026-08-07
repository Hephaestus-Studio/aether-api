import { useState } from "react";
import { Modal, TextInput, Box, Text, Group } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

interface QuickOpenProps {
  opened: boolean;
  onClose: () => void;
}

export default function QuickOpen({ opened, onClose }: Readonly<QuickOpenProps>) {
  const [query, setQuery] = useState("");

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} size="md" radius="md">
      <TextInput
        placeholder="Search requests fuzzy..."
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        mb={12}
      />
      <Box>
        <Text size="xs" style={{ color: "var(--text-muted)" }} mb={8}>
          Recent files
        </Text>
        <Box
          style={{
            cursor: "pointer",
            padding: "8px 12px",
            borderRadius: 4,
            "&:hover": { backgroundColor: "var(--bg-tab-active)" },
          }}
        >
          <Group justify="space-between">
            <Text size="sm">login.yml</Text>
            <Text size="11px" style={{ color: "var(--text-muted)" }}>
              Auth APIs/
            </Text>
          </Group>
        </Box>
      </Box>
    </Modal>
  );
}
