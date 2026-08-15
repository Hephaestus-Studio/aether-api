import { useState, useEffect } from "react";
import { Modal, Button, TextInput, ActionIcon, Tooltip, Text, Box } from "@mantine/core";
import { IconKey, IconShieldLock, IconEye, IconEyeOff } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { useEnvStore } from "@/stores/envStore";
import type { EnvironmentDetails, EnvironmentSummary, MasterKeyStatus } from "@/types/environment";
import classes from "./MasterKeyModal.module.css";

interface UnlockMasterKeyModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UnlockMasterKeyModal({
  opened,
  onClose,
  onSuccess,
}: Readonly<UnlockMasterKeyModalProps>) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setMasterKeyStatus = useEnvStore((s) => s.setMasterKeyStatus);
  const setEnvVariables = useEnvStore((s) => s.setEnvVariables);

  // Automatically wipe sensitive input whenever modal closes
  useEffect(() => {
    if (!opened) {
      setKeyInput("");
      setShowKey(false);
    }
  }, [opened]);

  const handleModalClose = () => {
    setKeyInput("");
    setShowKey(false);
    onClose();
  };

  const parseErrorMessage = (err: any): string => {
    const raw = String(err?.message || err);
    try {
      const parsed = JSON.parse(raw);
      if (parsed.message) return parsed.message;
    } catch {
      // Not JSON
    }
    return raw;
  };

  const handleUnlock = async () => {
    const keyToSave = keyInput.trim();
    if (!keyToSave) {
      notifications.show({
        title: "Key Required",
        message: "Please enter your workspace Master Key or Passphrase.",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("set_master_key", {
        key: keyToSave,
        currentKey: null,
      });

      // Refresh master key status
      const status = await invoke<MasterKeyStatus>("get_master_key_status");
      setMasterKeyStatus(status);

      // Re-read all environment variables across all environments to decrypt secrets in UI
      try {
        const envList = await invoke<EnvironmentSummary[]>("list_environments");
        useEnvStore.getState().setEnvironments(envList);
        const envNames = Array.from(new Set(["global", ...envList.map((e) => e.name)]));
        await Promise.all(
          envNames.map(async (name) => {
            try {
              const details = await invoke<EnvironmentDetails>("read_environment", {
                name,
              });
              if (details && details.variables) {
                setEnvVariables(name, details.variables);
              }
            } catch {
              // Environment might not exist yet
            }
          }),
        );
      } catch (err) {
        console.error("Failed to reload environments after unlocking master key:", err);
      }

      notifications.show({
        title: "Master Key Unlocked",
        message: "Secret variables are now unlocked and accessible.",
        color: "green",
      });

      onSuccess?.();
      handleModalClose();
    } catch (err) {
      notifications.show({
        title: "Error Unlocking Secrets",
        message: parseErrorMessage(err),
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleModalClose}
      title={
        <Box style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconShieldLock size={18} color="#eab308" />
          <Text fw={600} size="sm">
            Unlock Workspace Secrets
          </Text>
        </Box>
      }
      centered
      size="md"
    >
      <div className={classes.modalContent}>
        <div className={classes.banner}>
          <IconKey size={18} className={classes.bannerIcon} color="#eab308" />
          <div className={classes.bannerText}>
            This workspace contains secret variables encrypted with <strong>AES-256-GCM</strong>.
            Enter the Master Key or Passphrase to unlock and access them for this session.
          </div>
        </div>

        <div className={classes.inputGroup}>
          <div className={classes.labelRow}>
            <span className={classes.label}>
              Master Key / Passphrase <span style={{ color: "#ef4444" }}>*</span>
            </span>
          </div>

          <TextInput
            type={showKey ? "text" : "password"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyInput.trim() && !isSubmitting) {
                e.preventDefault();
                handleUnlock();
              }
            }}
            autoFocus
            data-autofocus
            placeholder="Enter your workspace Master Key or Passphrase"
            className={classes.keyInput}
            rightSection={
              <Tooltip label={showKey ? "Hide key" : "Show key"} position="top">
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color="gray"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                </ActionIcon>
              </Tooltip>
            }
          />
        </div>

        <div className={classes.footer}>
          <div />
          <div className={classes.rightButtons}>
            <Button variant="default" size="xs" onClick={handleModalClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="filled"
              color="yellow"
              size="xs"
              onClick={handleUnlock}
              loading={isSubmitting}
              disabled={!keyInput.trim()}
            >
              Unlock Secrets
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
