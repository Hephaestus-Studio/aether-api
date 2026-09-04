import { Box, Switch, NumberInput, Text, Group, Stack, Card } from "@mantine/core";
import { IconRefresh, IconShieldCheck } from "@tabler/icons-react";
import type { SseSettings, RequestSettings } from "@/types/request";

interface SseSettingsTabProps {
  sseSettings?: SseSettings;
  requestSettings?: RequestSettings;
  onSseSettingsChange: (settings: SseSettings) => void;
  onRequestSettingsChange: (settings: RequestSettings) => void;
}

export default function SseSettingsTab({
  sseSettings = {},
  requestSettings,
  onSseSettingsChange,
  onRequestSettingsChange,
}: Readonly<SseSettingsTabProps>) {
  const currentSse: SseSettings = {
    autoReconnect: false,
    maxReconnectAttempts: 5,
    reconnectIntervalMs: 3000,
    ...sseSettings,
  };

  const currentReq: RequestSettings = {
    timeoutMs: 0,
    followRedirects: true,
    maxRedirects: 10,
    verifySsl: true,
    ...requestSettings,
  };

  const handleSseChange = (fields: Partial<SseSettings>) => {
    onSseSettingsChange({ ...currentSse, ...fields });
  };

  const handleReqChange = (fields: Partial<RequestSettings>) => {
    onRequestSettingsChange({ ...currentReq, ...fields });
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
              <IconRefresh size={18} color="#e056fd" />
              <Text fw={600} size="sm">
                Auto Reconnect (Stream Reconnection)
              </Text>
            </Group>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Automatically attempt to reconnect if the SSE connection drops unexpectedly (using
            server retry duration or fallback interval).
          </Text>
          <Group gap="lg" align="flex-end">
            <Switch
              label="Enable Auto Reconnect"
              checked={currentSse.autoReconnect ?? false}
              onChange={(e) => handleSseChange({ autoReconnect: e.currentTarget.checked })}
            />
            {currentSse.autoReconnect && (
              <>
                <NumberInput
                  label="Max Reconnect Attempts"
                  value={currentSse.maxReconnectAttempts || 5}
                  min={1}
                  max={50}
                  w={180}
                  onChange={(val) => handleSseChange({ maxReconnectAttempts: Number(val) || 5 })}
                />
                <NumberInput
                  label="Fallback Interval (ms)"
                  description="When retry: field is absent"
                  value={currentSse.reconnectIntervalMs || 3000}
                  min={500}
                  max={60000}
                  step={500}
                  w={200}
                  onChange={(val) => handleSseChange({ reconnectIntervalMs: Number(val) || 3000 })}
                />
              </>
            )}
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
              <IconShieldCheck size={18} color="#00b4d8" />
              <Text fw={600} size="sm">
                Security & Network Options
              </Text>
            </Group>
          </Group>
          <Group gap="xl" mt="xs">
            <Switch
              label="Verify SSL Certificates"
              checked={currentReq.verifySsl ?? true}
              onChange={(e) => handleReqChange({ verifySsl: e.currentTarget.checked })}
            />
            <Switch
              label="Follow HTTP Redirects"
              checked={currentReq.followRedirects ?? true}
              onChange={(e) => handleReqChange({ followRedirects: e.currentTarget.checked })}
            />
          </Group>
        </Card>
      </Stack>
    </Box>
  );
}
