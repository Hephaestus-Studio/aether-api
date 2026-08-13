import { useState, useEffect, useCallback } from "react";
import { Box, Button, LoadingOverlay, Text } from "@mantine/core";
import {
  IconFolder,
  IconFolderOpen,
  IconShieldLock,
  IconList,
  IconFileText,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { useTabStore } from "@/stores/tabStore";
import AuthEditor from "./AuthEditor";
import HeadersEditor from "./HeadersEditor";
import UndoableTextInput from "@/components/common/UndoableTextInput";
import type { CollectionDetails, FolderDetails } from "@/types/workspace";
import type { AuthConfig, KeyValuePair } from "@/types/request";
import clsx from "clsx";
import classes from "./FolderEditor.module.css";

interface FolderEditorProps {
  tabId: string;
  nodeType?: "collection" | "folder";
}

export default function FolderEditor({ tabId, nodeType }: Readonly<FolderEditorProps>) {
  const isFolder = nodeType === "folder";
  const isCollection = nodeType === "collection" || !isFolder;

  const [activeSubTab, setActiveSubTab] = useState<"auth" | "headers" | "docs">("auth");
  const [details, setDetails] = useState<CollectionDetails | FolderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const markDirty = useTabStore((s) => s.markDirty);
  const markClean = useTabStore((s) => s.markClean);
  const isDirty = useTabStore((s) => !!s.tabs.find((t) => t.id === tabId)?.isDirty);
  const updateTab = useTabStore((s) => s.updateTab);

  // Load collection/folder details from disk
  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      if (isFolder) {
        const res = await invoke<FolderDetails>("read_folder", { path: tabId });
        setDetails(res);
      } else {
        const res = await invoke<CollectionDetails>("read_collection", { path: tabId });
        setDetails(res);
      }
      markClean(tabId);
    } catch (err: any) {
      console.error("Error reading folder/collection details:", err);
      // Fallback try opposite if failed
      try {
        if (!isFolder) {
          const res = await invoke<FolderDetails>("read_folder", { path: tabId });
          setDetails(res);
        } else {
          const res = await invoke<CollectionDetails>("read_collection", { path: tabId });
          setDetails(res);
        }
        markClean(tabId);
      } catch (fallbackErr) {
        notifications.show({
          title: "Error Reading Item",
          message: err?.message || String(err),
          color: "red",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [tabId, isFolder, markClean]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleFieldChange = (field: string, value: any) => {
    if (!details) return;
    const updated = { ...details, [field]: value };
    setDetails(updated);
    markDirty(tabId);

    if (field === "name" && typeof value === "string") {
      updateTab(tabId, { name: value });
    }
  };

  const handleSave = async () => {
    if (!details) return;
    setSaving(true);
    try {
      if (isFolder) {
        await invoke("update_folder", { path: tabId, folder: details });
      } else {
        await invoke("update_collection", { path: tabId, collection: details });
      }
      markClean(tabId);
      notifications.show({
        title: "Saved",
        message: `${isFolder ? "Folder" : "Collection"} '${details.name}' saved successfully`,
        color: "green",
      });
    } catch (err: any) {
      console.error("Error saving folder/collection:", err);
      notifications.show({
        title: "Save Failed",
        message: err?.message || String(err),
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [details, isFolder, tabId]);

  if (loading || !details) {
    return (
      <Box className={classes.container} style={{ position: "relative" }}>
        <LoadingOverlay visible={true} />
      </Box>
    );
  }

  const authConfig: AuthConfig = details.auth || { type: isFolder ? "inherit" : "none" };
  const headersList: KeyValuePair[] = details.headers || [];

  return (
    <Box className={classes.container}>
      {/* Top Header Card */}
      <Box className={classes.headerBar}>
        <Box className={classes.headerLeft}>
          <div className={classes.iconWrapper}>
            {isCollection ? (
              <IconFolderOpen size={18} color="var(--mantine-color-indigo-4, #818cf8)" />
            ) : (
              <IconFolder size={18} color="var(--text-muted, #9ca3af)" />
            )}
          </div>

          <div className={classes.titleArea}>
            <div className={classes.titleRow}>
              <UndoableTextInput
                value={details.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder={isCollection ? "Collection Name" : "Folder Name"}
                className={classes.nameInput}
              />
              <span
                className={clsx(
                  classes.typeBadge,
                  isCollection ? classes.badgeCollection : classes.badgeFolder,
                )}
              >
                {isCollection ? "Collection" : "Folder"}
              </span>
            </div>
            <div className={classes.pathBreadcrumb}>{tabId}</div>
          </div>
        </Box>

        <Box className={classes.headerRight}>
          <Button
            size="xs"
            leftSection={<IconDeviceFloppy size={14} />}
            loading={saving}
            onClick={handleSave}
            className={classes.saveBtn}
          >
            {saving ? "Saving..." : isDirty ? "Save *" : "Save"}
          </Button>
        </Box>
      </Box>

      {/* Sub Tabs Navigation */}
      <Box className={classes.subTabsNav}>
        <button
          type="button"
          onClick={() => setActiveSubTab("auth")}
          className={clsx(classes.subTabBtn, activeSubTab === "auth" && classes.subTabBtnActive)}
        >
          <IconShieldLock size={14} />
          <span>Authorization</span>
          {authConfig.type !== "none" && authConfig.type !== "inherit" && (
            <span className={classes.tabBadge}>{authConfig.type}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("headers")}
          className={clsx(classes.subTabBtn, activeSubTab === "headers" && classes.subTabBtnActive)}
        >
          <IconList size={14} />
          <span>Headers</span>
          {headersList.length > 0 && <span className={classes.tabBadge}>{headersList.length}</span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("docs")}
          className={clsx(classes.subTabBtn, activeSubTab === "docs" && classes.subTabBtnActive)}
        >
          <IconFileText size={14} />
          <span>Docs</span>
        </button>
      </Box>

      {/* Active Tab Content Area */}
      <Box className={classes.tabContent}>
        {activeSubTab === "auth" && (
          <AuthEditor
            auth={authConfig}
            onChange={(newAuth) => handleFieldChange("auth", newAuth)}
            allowInherit={isFolder}
          />
        )}

        {activeSubTab === "headers" && (
          <HeadersEditor
            headers={headersList}
            onChange={(newHeaders) => handleFieldChange("headers", newHeaders)}
          />
        )}

        {activeSubTab === "docs" && (
          <Box className={classes.docsWrapper}>
            <Text className={classes.docsTitle}>Description / Documentation</Text>
            <textarea
              value={details.description || ""}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Add documentation, notes, or usage instructions for this folder/collection..."
              className={classes.docsTextarea}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
