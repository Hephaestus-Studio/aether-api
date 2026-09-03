import { useState } from "react";
import { Box, Group, Text, Badge, Button, Paper, Stack, Divider } from "@mantine/core";
import { IconCheck, IconArrowRight, IconSparkles } from "@tabler/icons-react";

interface SemanticRequestDiffProps {
  oursContent: string;
  theirsContent: string;
  onApplyMerge: (mergedYaml: string) => void;
}

// Simple key-value / block YAML extractor for Request objects
function parseYamlSections(yamlStr: string): Record<string, string> {
  const lines = yamlStr.split("\n");
  const sections: Record<string, string[]> = {};
  let currentKey = "general";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check if line starts top-level key like "name:", "method:", "url:", "headers:", "body:", etc.
    const topKeyMatch = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);
    if (topKeyMatch && !line.startsWith(" ") && !line.startsWith("\t")) {
      currentKey = topKeyMatch[1];
      if (!sections[currentKey]) {
        sections[currentKey] = [];
      }
      sections[currentKey].push(line);
    } else {
      if (!sections[currentKey]) {
        sections[currentKey] = [];
      }
      sections[currentKey].push(line);
    }
  }

  const result: Record<string, string> = {};
  for (const [key, valLines] of Object.entries(sections)) {
    result[key] = valLines.join("\n").trim();
  }
  return result;
}

export default function SemanticRequestDiff({
  oursContent,
  theirsContent,
  onApplyMerge,
}: Readonly<SemanticRequestDiffProps>) {
  const oursSections = parseYamlSections(oursContent);
  const theirsSections = parseYamlSections(theirsContent);

  // Collect all unique top-level keys
  const allKeys = Array.from(
    new Set([...Object.keys(oursSections), ...Object.keys(theirsSections)]),
  );

  // State: for each key, which version to choose: "ours" | "theirs"
  const [choices, setChoices] = useState<Record<string, "ours" | "theirs">>(() => {
    const initial: Record<string, "ours" | "theirs"> = {};
    for (const key of allKeys) {
      initial[key] = "ours"; // Default to ours
    }
    return initial;
  });

  const handleSelectAll = (version: "ours" | "theirs") => {
    const updated: Record<string, "ours" | "theirs"> = {};
    for (const key of allKeys) {
      updated[key] = version;
    }
    setChoices(updated);
  };

  const handleApply = () => {
    // Reconstruct merged YAML from selections
    const mergedBlocks: string[] = [];
    for (const key of allKeys) {
      const choice = choices[key] || "ours";
      const content = choice === "ours" ? oursSections[key] : theirsSections[key];
      if (content) {
        mergedBlocks.push(content);
      }
    }
    onApplyMerge(mergedBlocks.join("\n\n"));
  };

  return (
    <Box>
      {/* Quick Action Bar */}
      <Paper
        p="xs"
        mb="md"
        withBorder
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderColor: "var(--border-color, #2d2d2d)",
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconSparkles
              size={16}
              style={{ color: "var(--aether-color-primary-base, #6366f1)" }}
            />
            <Text size="xs" fw={600} c="#f1f5f9">
              Semantic API Diff (Field by Field)
            </Text>
          </Group>

          <Group gap="xs">
            <Button size="xs" variant="light" color="blue" onClick={() => handleSelectAll("ours")}>
              Take All Mine (Local)
            </Button>
            <Button
              size="xs"
              variant="light"
              color="violet"
              onClick={() => handleSelectAll("theirs")}
            >
              Take All Incoming (Remote)
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Field Sections */}
      <Stack gap="sm">
        {allKeys.map((key) => {
          const oursVal = oursSections[key] || "(empty / not set)";
          const theirsVal = theirsSections[key] || "(empty / not set)";
          const isSame = (oursSections[key] || "") === (theirsSections[key] || "");
          const currentChoice = choices[key] || "ours";

          return (
            <Paper
              key={key}
              p="sm"
              withBorder
              style={{
                backgroundColor: isSame
                  ? "rgba(0, 0, 0, 0.15)"
                  : currentChoice === "ours"
                    ? "rgba(59, 130, 246, 0.08)"
                    : "rgba(168, 85, 247, 0.08)",
                borderColor: isSame
                  ? "var(--border-color, #2d2d2d)"
                  : currentChoice === "ours"
                    ? "rgba(59, 130, 246, 0.5)"
                    : "rgba(168, 85, 247, 0.5)",
              }}
            >
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text
                    size="xs"
                    fw={700}
                    style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                  >
                    {key}
                  </Text>
                  {isSame ? (
                    <Badge size="xs" color="gray" variant="subtle">
                      Identical
                    </Badge>
                  ) : (
                    <Badge size="xs" color="orange" variant="light">
                      Conflicted
                    </Badge>
                  )}
                </Group>

                {!isSame && (
                  <Group gap="xs">
                    <Button
                      size="compact-xs"
                      variant={currentChoice === "ours" ? "filled" : "light"}
                      color="blue"
                      onClick={() => setChoices((prev) => ({ ...prev, [key]: "ours" }))}
                      leftSection={currentChoice === "ours" ? <IconCheck size={12} /> : undefined}
                    >
                      Use Mine
                    </Button>
                    <Button
                      size="compact-xs"
                      variant={currentChoice === "theirs" ? "filled" : "light"}
                      color="violet"
                      onClick={() => setChoices((prev) => ({ ...prev, [key]: "theirs" }))}
                      leftSection={currentChoice === "theirs" ? <IconCheck size={12} /> : undefined}
                    >
                      Use Incoming
                    </Button>
                  </Group>
                )}
              </Group>

              <Box
                style={{
                  display: "grid",
                  gridTemplateColumns: isSame ? "1fr" : "1fr 1fr",
                  gap: 12,
                }}
              >
                <Box>
                  <Text size="11px" c="dimmed" mb={4}>
                    Local (Mine / HEAD)
                  </Text>
                  <pre
                    style={{
                      margin: 0,
                      padding: "8px 10px",
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      color: "#f1f5f9",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "var(--font-mono, monospace)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 180,
                      overflowY: "auto",
                      border:
                        currentChoice === "ours" && !isSame
                          ? "1px solid #3b82f6"
                          : "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    {oursVal}
                  </pre>
                </Box>

                {!isSame && (
                  <Box>
                    <Text size="11px" c="#cbd5e1" mb={4}>
                      Incoming (Theirs / Remote)
                    </Text>
                    <pre
                      style={{
                        margin: 0,
                        padding: "8px 10px",
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        color: "#f1f5f9",
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: "var(--font-mono, monospace)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 180,
                        overflowY: "auto",
                        border:
                          currentChoice === "theirs"
                            ? "1px solid #a855f7"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {theirsVal}
                    </pre>
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}
      </Stack>

      <Divider my="md" />

      <Group justify="flex-end">
        <Button
          onClick={handleApply}
          size="sm"
          leftSection={<IconArrowRight size={16} />}
          style={{ backgroundColor: "var(--aether-color-primary-base)" }}
        >
          Apply Semantic Resolution
        </Button>
      </Group>
    </Box>
  );
}
