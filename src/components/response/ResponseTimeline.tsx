import { Box, Group, Text, Progress } from "@mantine/core";

interface ResponseTimelineProps {
  timing: any;
}

export default function ResponseTimeline({ timing }: Readonly<ResponseTimelineProps>) {
  return (
    <Box style={{ maxWidth: 400 }}>
      <Box mb={12}>
        <Group justify="space-between" mb={4}>
          <Text size="xs">TTFB (Time to First Byte)</Text>
          <Text size="xs" fw={700}>
            {timing.ttfbMs}ms
          </Text>
        </Group>
        <Progress value={(timing.ttfbMs / timing.totalMs) * 100} color="indigo" />
      </Box>
      <Box mb={12}>
        <Group justify="space-between" mb={4}>
          <Text size="xs">Content Download</Text>
          <Text size="xs" fw={700}>
            {timing.downloadMs}ms
          </Text>
        </Group>
        <Progress value={(timing.downloadMs / timing.totalMs) * 100} color="green" />
      </Box>
      <Box style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8 }}>
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Total Duration
          </Text>
          <Text size="sm" fw={700} color="indigo">
            {timing.totalMs}ms
          </Text>
        </Group>
      </Box>
    </Box>
  );
}
