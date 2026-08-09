import { create } from "zustand";
import type { TabItem } from "@/types/request";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { saveWorkspaceSession } from "@/utils/workspaceSession";

interface TabState {
  tabs: TabItem[];
  activeTabId: string | null;
  closedTabsHistory: TabItem[];
  responses: Record<string, any>;
  loadingStates: Record<string, boolean>;
  protocols: Record<string, string>;

  openTab: (tab: TabItem) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  restoreSession: (session: {
    tabs: TabItem[];
    activeTabId: string | null;
    protocols?: Record<string, string>;
    terminalOpened?: boolean;
    layoutOrientation?: "horizontal" | "vertical";
  }) => void;
  markDirty: (tabId: string) => void;
  markClean: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabItem>) => void;
  reopenLastClosed: () => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  setResponse: (tabId: string, response: any) => void;
  setLoading: (tabId: string, loading: boolean) => void;
  setProtocol: (tabId: string, protocol: string) => void;
  terminalOpened: boolean;
  toggleTerminal: () => void;
  setTerminalOpened: (opened: boolean) => void;
  responsePanelOpened: boolean;
  toggleResponsePanel: () => void;
  setResponsePanelOpened: (opened: boolean) => void;
  layoutOrientation: "horizontal" | "vertical";
  toggleLayoutOrientation: () => void;
  setLayoutOrientation: (orientation: "horizontal" | "vertical") => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  closedTabsHistory: [],
  responses: {},
  loadingStates: {},
  protocols: {},

  openTab: (tab) => {
    const { tabs, responses } = get();
    const hasResponse = !!responses[tab.id];
    if (!tabs.some((t) => t.id === tab.id)) {
      set({
        tabs: [...tabs, tab],
        activeTabId: tab.id,
        responsePanelOpened: hasResponse,
      });
    } else {
      set({
        activeTabId: tab.id,
        responsePanelOpened: hasResponse,
      });
    }
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, closedTabsHistory, responses, loadingStates, protocols } = get();
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (!tabToClose) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    let newActiveId = activeTabId;

    if (activeTabId === tabId) {
      newActiveId = newTabs.at(-1)?.id ?? null;
    }

    const newResponses = { ...responses };
    delete newResponses[tabId];

    const newLoadingStates = { ...loadingStates };
    delete newLoadingStates[tabId];

    const newProtocols = { ...protocols };
    delete newProtocols[tabId];

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
      closedTabsHistory: [...closedTabsHistory, tabToClose],
      responses: newResponses,
      loadingStates: newLoadingStates,
      protocols: newProtocols,
    });
  },

  setActiveTab: (tabId) => {
    if (tabId) {
      const { responses } = get();
      const hasResponse = !!responses[tabId];
      set({
        activeTabId: tabId,
        responsePanelOpened: hasResponse,
      });
    } else {
      set({ activeTabId: tabId });
    }
  },

  restoreSession: ({
    tabs,
    activeTabId,
    protocols = {},
    terminalOpened = false,
    layoutOrientation = "horizontal",
  }) => {
    set({
      tabs,
      activeTabId,
      protocols,
      responsePanelOpened: false,
      terminalOpened,
      layoutOrientation,
    });
  },

  markDirty: (tabId) => {
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, isDirty: true } : t)),
    });
  },

  markClean: (tabId) => {
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t)),
    });
  },

  updateTab: (tabId, updates) => {
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
    });
  },

  reopenLastClosed: () => {
    const { closedTabsHistory } = get();
    const last = closedTabsHistory.at(-1);
    if (!last) return;
    get().openTab(last);
    set({ closedTabsHistory: closedTabsHistory.slice(0, -1) });
  },

  closeAllTabs: () =>
    set({ tabs: [], activeTabId: null, responses: {}, loadingStates: {}, protocols: {} }),

  closeOtherTabs: (tabId) => {
    const { tabs, responses, loadingStates, protocols } = get();
    const newResponses = { [tabId]: responses[tabId] };
    const newLoadingStates = { [tabId]: loadingStates[tabId] };
    const newProtocols = { [tabId]: protocols[tabId] };
    set({
      tabs: tabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
      responses: newResponses,
      loadingStates: newLoadingStates,
      protocols: newProtocols,
    });
  },

  setResponse: (tabId, response) => {
    set({
      responses: {
        ...get().responses,
        [tabId]: response,
      },
    });
  },

  setLoading: (tabId, loading) => {
    set({
      loadingStates: {
        ...get().loadingStates,
        [tabId]: loading,
      },
    });
  },

  setProtocol: (tabId, protocol) => {
    set({
      protocols: {
        ...get().protocols,
        [tabId]: protocol,
      },
    });
  },

  terminalOpened: false,
  toggleTerminal: () => {
    set({
      terminalOpened: !get().terminalOpened,
    });
  },
  setTerminalOpened: (opened: boolean) => {
    set({
      terminalOpened: opened,
    });
  },
  responsePanelOpened: true,
  toggleResponsePanel: () => {
    set({
      responsePanelOpened: !get().responsePanelOpened,
    });
  },
  setResponsePanelOpened: (opened: boolean) => {
    set({
      responsePanelOpened: opened,
    });
  },
  layoutOrientation: "horizontal",
  toggleLayoutOrientation: () => {
    set({
      layoutOrientation: get().layoutOrientation === "horizontal" ? "vertical" : "horizontal",
    });
  },
  setLayoutOrientation: (orientation: "horizontal" | "vertical") => {
    set({
      layoutOrientation: orientation,
    });
  },
}));

// Automatically persist workspace tab session changes
if (typeof window !== "undefined") {
  useTabStore.subscribe((state) => {
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (workspacePath) {
      saveWorkspaceSession(workspacePath, {
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        protocols: state.protocols,
        terminalOpened: state.terminalOpened,
        layoutOrientation: state.layoutOrientation,
      });
    }
  });
}
