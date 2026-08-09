import { invoke } from "@tauri-apps/api/core";
import type { TabItem, HttpRequestDetails } from "@/types/request";

export interface PersistedTabSession {
  openTabs: string[];
  activeTabId: string | null;
  protocols?: Record<string, string>;
  terminalOpened?: boolean;
  layoutOrientation?: "horizontal" | "vertical";
}

export interface RestoredSessionResult {
  tabs: TabItem[];
  activeTabId: string | null;
  protocols: Record<string, string>;
  terminalOpened: boolean;
  layoutOrientation?: "horizontal" | "vertical";
}

const STORAGE_PREFIX = "aether_session_";

function getStorageKey(workspacePath: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(workspacePath)}`;
}

/**
 * Persists the current workspace session (open tabs, active tab, protocols, terminal panel state, layout orientation) to localStorage.
 */
export function saveWorkspaceSession(
  workspacePath: string,
  session: {
    tabs: TabItem[];
    activeTabId: string | null;
    protocols: Record<string, string>;
    terminalOpened: boolean;
    layoutOrientation?: "horizontal" | "vertical";
  },
): void {
  if (!workspacePath || typeof window === "undefined") return;

  try {
    const data: PersistedTabSession = {
      openTabs: session.tabs.map((t) => t.id),
      activeTabId: session.activeTabId,
      protocols: session.protocols,
      terminalOpened: session.terminalOpened,
      layoutOrientation: session.layoutOrientation,
    };

    localStorage.setItem(getStorageKey(workspacePath), JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save workspace session to localStorage:", err);
  }
}

/**
 * Loads and validates a persisted session for a given workspace path.
 * Checks each file against the disk via `read_request` and filters out any deleted/missing files.
 */
export async function restoreWorkspaceSession(
  workspacePath: string,
): Promise<RestoredSessionResult | null> {
  if (!workspacePath || typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getStorageKey(workspacePath));
    if (!raw) return null;

    const data: PersistedTabSession = JSON.parse(raw);
    if (!data || !Array.isArray(data.openTabs)) {
      return null;
    }

    const validTabs: TabItem[] = [];

    // Verify each open tab file on disk concurrently
    await Promise.all(
      data.openTabs.map(async (tabPath) => {
        try {
          const req = await invoke<HttpRequestDetails>("read_request", { path: tabPath });
          if (req) {
            const fallbackName =
              tabPath
                .split(/[/\\]/)
                .pop()
                ?.replace(/\.ya?ml$/, "") || "Request";
            validTabs.push({
              id: tabPath,
              name: req.name || fallbackName,
              method: req.method || "GET",
              isDirty: false,
            });
          }
        } catch {
          // File was deleted or moved; skip without error
          console.debug("Skipping missing tab file during session restore:", tabPath);
        }
      }),
    );

    // Preserve original tab ordering
    validTabs.sort((a, b) => data.openTabs.indexOf(a.id) - data.openTabs.indexOf(b.id));

    // Determine valid activeTabId
    const activeTabId =
      data.activeTabId && validTabs.some((t) => t.id === data.activeTabId)
        ? data.activeTabId
        : (validTabs[0]?.id ?? null);

    return {
      tabs: validTabs,
      activeTabId,
      protocols: data.protocols || {},
      terminalOpened: data.terminalOpened ?? false,
      layoutOrientation: data.layoutOrientation || "horizontal",
    };
  } catch (err) {
    console.error("Failed to restore workspace session:", err);
    return null;
  }
}

/**
 * Clears saved session for a workspace from localStorage.
 */
export function clearWorkspaceSession(workspacePath: string): void {
  if (!workspacePath || typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(workspacePath));
  } catch (err) {
    console.error("Failed to clear workspace session:", err);
  }
}
