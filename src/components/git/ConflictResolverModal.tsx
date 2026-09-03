import { useState, useEffect } from "react";
import { Modal, Box, Group, Text, Badge, Button, SegmentedControl } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconCode,
  IconSparkles,
  IconX,
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";
import Editor from "@monaco-editor/react";
import { useGitStore } from "@/stores/gitStore";
import SemanticRequestDiff from "./SemanticRequestDiff";
import classes from "./ConflictResolverModal.module.css";

export default function ConflictResolverModal() {
  const isConflictModalOpen = useGitStore((s) => s.isConflictModalOpen);
  const activeConflictFile = useGitStore((s) => s.activeConflictFile);
  const activeConflictData = useGitStore((s) => s.activeConflictData);
  const status = useGitStore((s) => s.status);
  const closeConflictResolver = useGitStore((s) => s.closeConflictResolver);
  const resolveConflict = useGitStore((s) => s.resolveConflict);
  const abortMerge = useGitStore((s) => s.abortMerge);
  const isLoading = useGitStore((s) => s.isLoading);

  const [mode, setMode] = useState<"semantic" | "raw">("semantic");
  const [mergedText, setMergedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeConflictData) {
      // Default mergedText to Ours initially or raw without markers if possible
      setMergedText(activeConflictData.oursContent);
      // If not a YAML file, default to raw mode
      if (!activeConflictData.isRequestYaml) {
        setMode("raw");
      } else {
        setMode("semantic");
      }
      setError(null);
    }
  }, [activeConflictData]);

  if (!isConflictModalOpen || !activeConflictData || !activeConflictFile) {
    return null;
  }

  const conflictedList = status?.conflictedFiles || [];
  const currentIndex = conflictedList.findIndex((f) => f.path === activeConflictFile);
  const totalConflicts = conflictedList.length;

  const handleResolve = async (contentToSave: string) => {
    try {
      setError(null);
      await resolveConflict(activeConflictFile, contentToSave);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const handleAcceptOurs = () => {
    handleResolve(activeConflictData.oursContent);
  };

  const handleAcceptTheirs = () => {
    handleResolve(activeConflictData.theirsContent);
  };

  return (
    <Modal
      opened={isConflictModalOpen}
      onClose={closeConflictResolver}
      title={
        <div className={classes.modalHeader}>
          <Group gap="xs">
            <IconAlertTriangle size={18} color="#ff922b" />
            <Text fw={600} size="sm">
              Resolve Conflict: {activeConflictFile}
            </Text>
            <Badge color="orange" variant="light" size="xs">
              {currentIndex >= 0 ? `${currentIndex + 1} of ${totalConflicts}` : "Conflicted"}
            </Badge>
          </Group>
        </div>
      }
      size="90%"
      centered
      styles={{
        header: {
          backgroundColor: "var(--bg-app, #212121)",
          borderBottom: "1px solid var(--border-color, #2d2d2d)",
        },
        content: {
          backgroundColor: "var(--bg-app, #212121)",
          border: "1px solid var(--border-color, #2d2d2d)",
        },
        body: { padding: "16px" },
      }}
    >
      {error && (
        <Box
          p="xs"
          mb="sm"
          style={{
            backgroundColor: "rgba(255, 68, 68, 0.1)",
            border: "1px solid rgba(255, 68, 68, 0.3)",
            borderRadius: 4,
            color: "#ff6b6b",
            fontSize: 12,
          }}
        >
          {error}
        </Box>
      )}

      {/* Mode Switcher & Quick Buttons */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          {activeConflictData.isRequestYaml && (
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(val) => setMode(val as "semantic" | "raw")}
              data={[
                {
                  label: (
                    <Group gap={4}>
                      <IconSparkles size={14} />
                      <span>Semantic Diff</span>
                    </Group>
                  ),
                  value: "semantic",
                },
                {
                  label: (
                    <Group gap={4}>
                      <IconCode size={14} />
                      <span>Raw 3-Way Diff</span>
                    </Group>
                  ),
                  value: "raw",
                },
              ]}
            />
          )}
        </Group>

        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconDownload size={14} />}
            onClick={handleAcceptOurs}
            loading={isLoading}
          >
            Accept Mine (Local)
          </Button>
          <Button
            size="xs"
            variant="light"
            color="violet"
            leftSection={<IconUpload size={14} />}
            onClick={handleAcceptTheirs}
            loading={isLoading}
          >
            Accept Incoming (Theirs)
          </Button>
        </Group>
      </Group>

      {/* Main Diff Content */}
      {mode === "semantic" && activeConflictData.isRequestYaml ? (
        <SemanticRequestDiff
          oursContent={activeConflictData.oursContent}
          theirsContent={activeConflictData.theirsContent}
          onApplyMerge={(merged) => handleResolve(merged)}
        />
      ) : (
        <Box>
          <div className={classes.editorContainer}>
            {/* Left: Ours (Read-only) */}
            <div className={classes.pane}>
              <div className={classes.paneHeader}>
                <Text size="xs" c="blue" fw={600}>
                  Local (Mine / HEAD)
                </Text>
                <Badge size="xs" variant="outline" color="blue">
                  Ours
                </Badge>
              </div>
              <div className={classes.paneBody}>
                <Editor
                  height="100%"
                  language={activeConflictData.isRequestYaml ? "yaml" : "plaintext"}
                  theme="vs-dark"
                  value={activeConflictData.oursContent}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>

            {/* Center: Result (Interactive / Editable) */}
            <div
              className={classes.pane}
              style={{ borderColor: "var(--aether-color-primary-base)" }}
            >
              <div
                className={classes.paneHeader}
                style={{ backgroundColor: "rgba(59, 130, 246, 0.08)" }}
              >
                <Text size="xs" c="teal" fw={600}>
                  Merged Result (Editable)
                </Text>
                <Badge size="xs" color="teal">
                  Result
                </Badge>
              </div>
              <div className={classes.paneBody}>
                <Editor
                  height="100%"
                  language={activeConflictData.isRequestYaml ? "yaml" : "plaintext"}
                  theme="vs-dark"
                  value={mergedText}
                  onChange={(val) => setMergedText(val || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>

            {/* Right: Theirs (Read-only) */}
            <div className={classes.pane}>
              <div className={classes.paneHeader}>
                <Text size="xs" c="violet" fw={600}>
                  Incoming (Theirs / Remote)
                </Text>
                <Badge size="xs" variant="outline" color="violet">
                  Theirs
                </Badge>
              </div>
              <div className={classes.paneBody}>
                <Editor
                  height="100%"
                  language={activeConflictData.isRequestYaml ? "yaml" : "plaintext"}
                  theme="vs-dark"
                  value={activeConflictData.theirsContent}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>
          </div>

          <div className={classes.footerActions}>
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={() => {
                if (window.confirm("Are you sure you want to abort the merge/rebase?")) {
                  abortMerge();
                }
              }}
            >
              Abort Merge
            </Button>

            <Group gap="xs">
              <Button variant="subtle" size="xs" onClick={closeConflictResolver}>
                Cancel
              </Button>
              <Button
                size="xs"
                color="teal"
                leftSection={<IconCheck size={14} />}
                onClick={() => handleResolve(mergedText)}
                loading={isLoading}
              >
                Accept Merged Result & Stage
              </Button>
            </Group>
          </div>
        </Box>
      )}
    </Modal>
  );
}
