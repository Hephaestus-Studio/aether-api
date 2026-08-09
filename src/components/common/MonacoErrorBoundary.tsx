import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Text, Group } from "@mantine/core";
import { IconRefresh, IconAlertTriangle } from "@tabler/icons-react";

interface Props {
  children: ReactNode;
  fallbackContent?: string;
  height?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MonacoErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("MonacoErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            height: this.props.height || "100%",
            backgroundColor: "var(--bg-panel, #212121)",
            padding: 16,
            overflow: "hidden",
          }}
        >
          <Group justify="space-between" mb={12}>
            <Group gap={8}>
              <IconAlertTriangle size={16} color="var(--mantine-color-yellow-5, #fcc419)" />
              <Text size="xs" fw={600} style={{ color: "var(--text-muted, #888)" }}>
                Editor encountered an error. Displaying fallback view.
              </Text>
            </Group>
            <Button
              size="xs"
              variant="light"
              color="indigo"
              leftSection={<IconRefresh size={14} />}
              onClick={this.handleReset}
            >
              Reload Editor
            </Button>
          </Group>

          {this.props.fallbackContent !== undefined ? (
            <Box
              component="pre"
              style={{
                flex: 1,
                margin: 0,
                padding: 12,
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderRadius: 4,
                overflow: "auto",
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-primary, #e0e0e0)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {this.props.fallbackContent}
            </Box>
          ) : (
            <Box
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted, #888)",
                fontSize: 13,
              }}
            >
              {this.state.error?.message || "Failed to render editor"}
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default MonacoErrorBoundary;
