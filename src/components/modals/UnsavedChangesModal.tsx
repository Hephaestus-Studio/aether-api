import { useState } from "react";
import { Modal, Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { useTabStore } from "@/stores/tabStore";
import { getMethodColor } from "@/utils/httpMethods";
import type { TabItem } from "@/types/request";
import classes from "./UnsavedChangesModal.module.css";

export interface PendingCloseAction {
  type: "single" | "others" | "all";
  tabId?: string;
  dirtyTabs: TabItem[];
}

interface UnsavedChangesModalProps {
  pendingAction: PendingCloseAction | null;
  onClose: () => void;
}

export default function UnsavedChangesModal({
  pendingAction,
  onClose,
}: Readonly<UnsavedChangesModalProps>) {
  const [isSaving, setIsSaving] = useState(false);
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabStore((s) => s.closeAllTabs);
  const markClean = useTabStore((s) => s.markClean);
  const removeDraft = useTabStore((s) => s.removeDraft);

  if (!pendingAction) return null;

  const { type, tabId, dirtyTabs } = pendingAction;
  const isSingle = type === "single" && dirtyTabs.length === 1;
  const singleTab = dirtyTabs[0];

  const handleExecuteClose = () => {
    if (type === "single" && tabId) {
      closeTab(tabId);
    } else if (type === "others" && tabId) {
      closeOtherTabs(tabId);
    } else if (type === "all") {
      closeAllTabs();
    }
  };

  const handleDontSave = () => {
    // Clean drafts for all dirty tabs being closed
    for (const tab of dirtyTabs) {
      removeDraft(tab.id);
    }
    handleExecuteClose();
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const drafts = useTabStore.getState().drafts;
      for (const tab of dirtyTabs) {
        const draft = drafts[tab.id];
        if (draft) {
          await invoke("update_request", { path: tab.id, requestDetails: draft });
        }
        markClean(tab.id);
        removeDraft(tab.id);
      }

      notifications.show({
        title: isSingle ? "Request Saved" : "Requests Saved",
        message: isSingle
          ? `Saved changes to "${singleTab.name}"`
          : `Saved changes to ${dirtyTabs.length} requests`,
        color: "green",
        autoClose: 2500,
      });

      handleExecuteClose();
      onClose();
    } catch (err: any) {
      console.error("Save on close error:", err);
      notifications.show({
        title: "Save Failed",
        message: String(err?.message || err),
        color: "red",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const title = isSingle
    ? `Do you want to save the changes to "${singleTab.name}"?`
    : `Do you want to save changes to ${dirtyTabs.length} requests?`;

  const description = isSingle
    ? `Your changes will be lost if you don't save them.`
    : `The following requests have unsaved changes. Your changes will be lost if you don't save them.`;

  return (
    <Modal
      opened={pendingAction !== null}
      onClose={onClose}
      withCloseButton={false}
      centered
      size={isSingle ? 420 : 480}
      overlayProps={{
        backgroundOpacity: 0.65,
        blur: 3,
      }}
      classNames={{
        content: classes.modalContent,
        header: classes.modalHeader,
        body: classes.modalBody,
      }}
    >
      <div className={classes.headerRow}>
        <div className={classes.warningIconWrapper}>
          <IconAlertTriangle size={18} stroke={2} />
        </div>
        <div className={classes.textColumn}>
          <div className={classes.modalTitle}>{title}</div>
          <div className={classes.modalDescription}>{description}</div>
        </div>
      </div>

      {!isSingle && (
        <div className={classes.requestsList}>
          {dirtyTabs.map((tab) => (
            <div key={tab.id} className={classes.requestItem}>
              <span
                className={classes.methodBadge}
                style={{ color: getMethodColor(tab.method) }}
              >
                {tab.method}
              </span>
              <span className={classes.requestName}>{tab.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className={classes.buttonGroup}>
        <Button
          variant="default"
          size="xs"
          onClick={onClose}
          disabled={isSaving}
          className={classes.cancelBtn}
        >
          Cancel
        </Button>
        <Button
          variant="light"
          color="red"
          size="xs"
          onClick={handleDontSave}
          disabled={isSaving}
          className={classes.dontSaveBtn}
        >
          Don't Save
        </Button>
        <Button
          variant="filled"
          color="indigo"
          size="xs"
          onClick={handleSave}
          loading={isSaving}
          className={classes.saveBtn}
        >
          {isSingle ? "Save" : "Save All"}
        </Button>
      </div>
    </Modal>
  );
}
