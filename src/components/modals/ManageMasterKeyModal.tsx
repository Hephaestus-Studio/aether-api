import { useState, useEffect } from "react";
import { Modal, Button, TextInput, ActionIcon, Tooltip, Text, Box } from "@mantine/core";
import {
  IconKey,
  IconShieldLock,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { useEnvStore } from "@/stores/envStore";
import type { EnvironmentDetails, EnvironmentSummary, MasterKeyStatus } from "@/types/environment";
import clsx from "clsx";
import classes from "./MasterKeyModal.module.css";

interface ManageMasterKeyModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ManageMasterKeyModal({
  opened,
  onClose,
  onSuccess,
}: Readonly<ManageMasterKeyModalProps>) {
  // Setup input (when not having master key yet)
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Manage state inputs (when master key is already active in RAM)
  const [currentKeyInput, setCurrentKeyInput] = useState("");
  const [showCurrentKey, setShowCurrentKey] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMasterKey = useEnvStore((s) => s.hasMasterKey);
  const setMasterKeyStatus = useEnvStore((s) => s.setMasterKeyStatus);
  const setEnvVariables = useEnvStore((s) => s.setEnvVariables);

  // Automatically wipe sensitive inputs whenever modal closes
  useEffect(() => {
    if (!opened) {
      setKeyInput("");
      setShowKey(false);
      setCurrentKeyInput("");
      setShowCurrentKey(false);
      setNewKeyInput("");
      setShowNewKey(false);
      setCopied(false);
    }
  }, [opened]);

  const handleModalClose = () => {
    setKeyInput("");
    setShowKey(false);
    setCurrentKeyInput("");
    setShowCurrentKey(false);
    setNewKeyInput("");
    setShowNewKey(false);
    setCopied(false);
    onClose();
  };

  const handleGenerate = async () => {
    try {
      const generated = await invoke<string>("generate_master_key");
      if (hasMasterKey) {
        setNewKeyInput(generated);
        setShowNewKey(true);
      } else {
        setKeyInput(generated);
        setShowKey(true);
      }
      notifications.show({
        title: "Key Generated",
        message: "A new 256-bit random master key has been generated.",
        color: "blue",
      });
    } catch (err) {
      notifications.show({
        title: "Error Generating Key",
        message: String(err),
        color: "red",
      });
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notifications.show({
      title: "Copied to Clipboard",
      message: "Keep this key in a safe place to share with teammates.",
      color: "green",
    });
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

  const handleSaveKey = async () => {
    const keyToSave = hasMasterKey ? newKeyInput.trim() : keyInput.trim();
    const currentKey = hasMasterKey ? currentKeyInput.trim() : undefined;

    if (hasMasterKey) {
      if (!currentKey) {
        notifications.show({
          title: "Current Key Required",
          message: "Please enter your current Master Key to verify identity.",
          color: "red",
        });
        return;
      }
      if (!keyToSave) {
        notifications.show({
          title: "New Key Required",
          message: "Please enter a new Master Key or Passphrase.",
          color: "red",
        });
        return;
      }
    } else if (!keyToSave) {
      notifications.show({
        title: "Key Required",
        message: "Please enter a Master Key or Passphrase.",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("set_master_key", {
        key: keyToSave,
        currentKey: currentKey || null,
      });

      // Refresh master key status
      const status = await invoke<MasterKeyStatus>("get_master_key_status");
      setMasterKeyStatus(status);

      // Re-read all environment variables across all environments
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
        console.error("Failed to reload environments after master key update:", err);
      }

      notifications.show({
        title: hasMasterKey ? "Master Key Changed" : "Master Key Set",
        message: hasMasterKey
          ? "Master Key has been updated and secret variables re-encrypted."
          : "Master Key is now active. Secret variables are accessible.",
        color: "green",
      });

      onSuccess?.();
      handleModalClose();
    } catch (err) {
      notifications.show({
        title: "Error Setting Master Key",
        message: parseErrorMessage(err),
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!currentKeyInput.trim()) {
      notifications.show({
        title: "Current Key Required",
        message: "Please enter your current Master Key to confirm clearing.",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("remove_master_key", {
        currentKey: currentKeyInput.trim(),
      });
      const status = await invoke<MasterKeyStatus>("get_master_key_status");
      setMasterKeyStatus(status);

      notifications.show({
        title: "Master Key Cleared",
        message: "Master Key has been cleared for this session.",
        color: "gray",
      });

      // Re-read all environments to update locked states
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
              // Ignore
            }
          }),
        );
      } catch (err) {
        console.error("Failed to reload environments after master key removal:", err);
      }

      handleModalClose();
    } catch (err) {
      notifications.show({
        title: "Error Removing Key",
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
          <IconShieldLock size={18} color={hasMasterKey ? "#22c55e" : "#3b82f6"} />
          <Text fw={600} size="sm">
            {hasMasterKey ? "Manage Workspace Master Key" : "Set Workspace Master Key"}
          </Text>
        </Box>
      }
      centered
      size="md"
    >
      <div className={classes.modalContent}>
        <div className={clsx(classes.banner, hasMasterKey && classes.bannerActive)}>
          <IconKey
            size={18}
            className={classes.bannerIcon}
            color={hasMasterKey ? "#22c55e" : undefined}
          />
          <div className={classes.bannerText}>
            {hasMasterKey ? (
              <>
                Master Key is currently <strong>active</strong>. To clear it or rotate to a new key,
                please enter your current Master Key for security verification.
              </>
            ) : (
              <>
                Secret environment variables are encrypted with <strong>AES-256-GCM</strong>{" "}
                directly in <code>environments/*.yml</code>. The Master Key is held{" "}
                <strong>securely in this session</strong> and is never written to disk.
              </>
            )}
          </div>
        </div>

        {hasMasterKey ? (
          <>
            {/* Field 1: Current Key (Required) */}
            <div className={classes.inputGroup}>
              <div className={classes.labelRow}>
                <span className={classes.label}>
                  Current Master Key / Passphrase <span style={{ color: "#ef4444" }}>*</span>
                </span>
              </div>

              <TextInput
                type={showCurrentKey ? "text" : "password"}
                value={currentKeyInput}
                onChange={(e) => setCurrentKeyInput(e.currentTarget.value)}
                autoFocus
                data-autofocus
                placeholder="Enter current Master Key to confirm identity"
                className={classes.keyInput}
                rightSection={
                  <Tooltip label={showCurrentKey ? "Hide key" : "Show key"} position="top">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => setShowCurrentKey(!showCurrentKey)}
                    >
                      {showCurrentKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </ActionIcon>
                  </Tooltip>
                }
              />
            </div>

            {/* Field 2: New Key (Optional if clearing, required if changing) */}
            <div className={classes.inputGroup}>
              <div className={classes.labelRow}>
                <span className={classes.label}>New Master Key / Passphrase</span>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconRefresh size={12} />}
                  onClick={handleGenerate}
                  className={classes.generateBtn}
                >
                  Generate Strong Key
                </Button>
              </div>

              <TextInput
                type={showNewKey ? "text" : "password"}
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    currentKeyInput.trim() &&
                    newKeyInput.trim() &&
                    !isSubmitting
                  ) {
                    e.preventDefault();
                    handleSaveKey();
                  }
                }}
                placeholder="Enter new passphrase or generate a 32-byte Base64 key"
                className={classes.keyInput}
                rightSection={
                  <Box style={{ display: "flex", gap: 2, marginRight: 4 }}>
                    {newKeyInput && (
                      <Tooltip label={copied ? "Copied" : "Copy key"} position="top">
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          color={copied ? "green" : "gray"}
                          onClick={() => handleCopy(newKeyInput)}
                        >
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Tooltip label={showNewKey ? "Hide key" : "Show key"} position="top">
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        color="gray"
                        onClick={() => setShowNewKey(!showNewKey)}
                      >
                        {showNewKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </ActionIcon>
                    </Tooltip>
                  </Box>
                }
              />
            </div>
          </>
        ) : (
          <div className={classes.inputGroup}>
            <div className={classes.labelRow}>
              <span className={classes.label}>Master Key / Passphrase</span>
              <Button
                variant="subtle"
                size="compact-xs"
                leftSection={<IconRefresh size={12} />}
                onClick={handleGenerate}
                className={classes.generateBtn}
              >
                Generate Strong Key
              </Button>
            </div>

            <TextInput
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyInput.trim() && !isSubmitting) {
                  e.preventDefault();
                  handleSaveKey();
                }
              }}
              autoFocus
              data-autofocus
              placeholder="Enter passphrase or generate a 32-byte Base64 key"
              className={classes.keyInput}
              rightSection={
                <Box style={{ display: "flex", gap: 2, marginRight: 4 }}>
                  {keyInput && (
                    <Tooltip label={copied ? "Copied" : "Copy key"} position="top">
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        color={copied ? "green" : "gray"}
                        onClick={() => handleCopy(keyInput)}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
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
                </Box>
              }
            />
          </div>
        )}

        <div className={classes.footer}>
          <div>
            {hasMasterKey && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={handleRemoveKey}
                loading={isSubmitting}
                disabled={!currentKeyInput.trim()}
                title={
                  !currentKeyInput.trim()
                    ? "Enter current Master Key to confirm clearing"
                    : "Clear Master Key"
                }
              >
                Clear Key
              </Button>
            )}
          </div>
          <div className={classes.rightButtons}>
            <Button variant="default" size="xs" onClick={handleModalClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="filled"
              size="xs"
              onClick={handleSaveKey}
              loading={isSubmitting}
              disabled={
                hasMasterKey ? !currentKeyInput.trim() || !newKeyInput.trim() : !keyInput.trim()
              }
            >
              {hasMasterKey ? "Change Master Key" : "Set Master Key"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
