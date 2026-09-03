import { Box, Switch, NumberInput, Text, Group, Stack, Card } from "@mantine/core";
import { IconHeartbeat, IconRefresh } from "@tabler/icons-react";
import type { WebSocketSettings } from "@/types/request";

interface WebSocketSettingsTabProps {
  settings?: WebSocketSettings;
  onChange: (settings: WebSocketSettings) => void;
}

export default function WebSocketSettingsTab({
  settings = {},
  onChange,
}: Readonly<WebSocketSettingsTabProps>) {
  const current: WebSocketSettings = {
    heartbeatIntervalSecs: 0,
    autoPong: true,
    autoReconnect: false,
    maxReconnectAttempts: 5,
    ...settings,
  };

  const handleChange = (fields: Partial<WebSocketSettings>) => {
    onChange({ ...current, ...fields });
  };

  return (
    <Box p="xs">
      <Stack gap="md">
        <Card
          withBorder
          radius="md"
          p="md"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
        >
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconHeartbeat size={18} color="#00b4d8" />
              <Text fw={600} size="sm">
                Heartbeat / Keep-Alive (Ping/Pong)
              </Text>
            </Group>
          </Group>

          <Text size="xs" c="dimmed" mb="md">
            Automatically sends a WebSocket Ping frame periodically to keep the connection alive.
            Set to 0 to disable automatic ping.
          </Text>
          <Group gap="lg">
            <NumberInput
              label="Ping Interval (seconds)"
              description="0 = Disabled"
              value={current.heartbeatIntervalSecs || 0}
              min={0}
              max={3600}
              step={5}
              w={180}
              onChange={(val) => handleChange({ heartbeatIntervalSecs: Number(val) || 0 })}
            />
            <Switch
              label="Auto Reply with Pong"
              description="Automatically respond with a Pong frame when receiving a server Ping"
              checked={current.autoPong ?? true}
              onChange={(e) => handleChange({ autoPong: e.currentTarget.checked })}
              mt="md"
            />
          </Group>
        </Card>

        <Card
          withBorder
          radius="md"
          p="md"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
        >
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconRefresh size={18} color="#00b4d8" />
              <Text fw={600} size="sm">
                Auto Reconnect
              </Text>
            </Group>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Automatically attempt to reconnect if the connection drops unexpectedly.
          </Text>
          <Group gap="lg">
            <Switch
              label="Enable Auto Reconnect"
              checked={current.autoReconnect ?? false}
              onChange={(e) => handleChange({ autoReconnect: e.currentTarget.checked })}
            />
            {current.autoReconnect && (
              <NumberInput
                label="Max Reconnect Attempts"
                value={current.maxReconnectAttempts || 5}
                min={1}
                max={50}
                w={180}
                onChange={(val) => handleChange({ maxReconnectAttempts: Number(val) || 5 })}
              />
            )}
          </Group>
        </Card>
      </Stack>
    </Box>
  );
}
