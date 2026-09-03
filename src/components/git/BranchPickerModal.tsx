import { useState, useEffect } from "react";
import { Modal, TextInput, Box, Group, Text, Badge, ScrollArea, Button } from "@mantine/core";
import { IconGitBranch, IconSearch, IconCheck, IconPlus } from "@tabler/icons-react";
import { useGitStore } from "@/stores/gitStore";

interface BranchPickerModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function BranchPickerModal({ opened, onClose }: Readonly<BranchPickerModalProps>) {
  const branches = useGitStore((s) => s.branches);
  const loadBranches = useGitStore((s) => s.loadBranches);
  const checkoutBranch = useGitStore((s) => s.checkoutBranch);
  const status = useGitStore((s) => s.status);

  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      loadBranches();
      setSearch("");
      setIsCreating(false);
      setNewBranchName("");
      setError(null);
    }
  }, [opened, loadBranches]);

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCheckout = async (branchName: string) => {
    try {
      setError(null);
      await checkoutBranch(branchName, false);
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      setError(null);
      await checkoutBranch(newBranchName.trim(), true);
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconGitBranch size={18} style={{ color: "var(--aether-color-primary-base)" }} />
          <Text fw={600} size="sm">
            Switch or Create Git Branch
          </Text>
        </Group>
      }
      size="md"
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

      {isCreating ? (
        <Box>
          <TextInput
            label="New Branch Name"
            placeholder="e.g., feature/user-auth"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.currentTarget.value)}
            data-autofocus
            mb="md"
            description={`Will branch off from '${status?.branchName || "HEAD"}'`}
          />
          <Group justify="flex-end">
            <Button variant="subtle" size="xs" onClick={() => setIsCreating(false)}>
              Back to list
            </Button>
            <Button
              size="xs"
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim()}
              style={{ backgroundColor: "var(--aether-color-primary-base)" }}
            >
              Create & Checkout
            </Button>
          </Group>
        </Box>
      ) : (
        <Box>
          <TextInput
            placeholder="Search branches..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            mb="xs"
            size="xs"
          />

          <Box mb="xs">
            <Button
              variant="light"
              fullWidth
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setIsCreating(true);
                setNewBranchName(search);
              }}
              style={{ justifyContent: "flex-start" }}
            >
              Create new branch {search ? `"${search}"` : ""}
            </Button>
          </Box>

          <ScrollArea.Autosize mah={300}>
            {filteredBranches.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                No branches found
              </Text>
            ) : (
              filteredBranches.map((branch) => (
                <Box
                  key={branch.name}
                  onClick={() => !branch.isCurrent && handleCheckout(branch.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 4,
                    cursor: branch.isCurrent ? "default" : "pointer",
                    backgroundColor: branch.isCurrent ? "rgba(255, 255, 255, 0.04)" : "transparent",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!branch.isCurrent)
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!branch.isCurrent) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <IconGitBranch
                      size={14}
                      style={{
                        color: branch.isCurrent
                          ? "var(--aether-color-primary-base)"
                          : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    />
                    <Text size="xs" fw={branch.isCurrent ? 600 : 400} truncate>
                      {branch.name}
                    </Text>
                    {branch.isRemote && (
                      <Badge size="xs" variant="outline" color="gray">
                        remote
                      </Badge>
                    )}
                  </Group>

                  {branch.isCurrent && (
                    <Badge
                      size="xs"
                      color="teal"
                      variant="light"
                      leftSection={<IconCheck size={10} />}
                    >
                      Current
                    </Badge>
                  )}
                </Box>
              ))
            )}
          </ScrollArea.Autosize>
        </Box>
      )}
    </Modal>
  );
}
