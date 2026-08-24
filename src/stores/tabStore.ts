import { create } from "zustand";
import type { TabItem, HttpRequestDetails } from "@/types/request";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { saveWorkspaceSession } from "@/utils/workspaceSession";

interface TabState {
  tabs: TabItem[];
  activeTabId: string | null;
  closedTabsHistory: TabItem[];
  responses: Record<string, any>;
  loadingStates: Record<string, boolean>;
  protocols: Record<string, string>;
  drafts: Record<string, HttpRequestDetails>;

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
  replaceTabId: (oldId: string, newId: string) => void;
  reopenLastClosed: () => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  setResponse: (tabId: string, response: any) => void;
  setLoading: (tabId: string, loading: boolean) => void;
  setProtocol: (tabId: string, protocol: string) => void;
  setDraft: (tabId: string, draft: HttpRequestDetails) => void;
  removeDraft: (tabId: string) => void;
  terminalOpened: boolean;
  toggleTerminal: () => void;
  setTerminalOpened: (opened: boolean) => void;
  bottomPanelOpened: boolean;
  activeBottomPanelTab: "terminal" | "environment";
  openBottomPanel: (tab?: "terminal" | "environment") => void;
  closeBottomPanel: () => void;
  toggleEnvPanel: () => void;
  setEnvPanelOpened: (opened: boolean) => void;
  setActiveBottomPanelTab: (tab: "terminal" | "environment") => void;
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
  drafts: {},

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
    const { tabs, activeTabId, closedTabsHistory, responses, loadingStates, protocols, drafts } =
      get();
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

    const newDrafts = { ...drafts };
    delete newDrafts[tabId];

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
      closedTabsHistory: [...closedTabsHistory, tabToClose],
      responses: newResponses,
      loadingStates: newLoadingStates,
      protocols: newProtocols,
      drafts: newDrafts,
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
    bottomPanelOpened,
    activeBottomPanelTab,
    layoutOrientation = "horizontal",
  }: {
    tabs: TabItem[];
    activeTabId: string | null;
    protocols?: Record<string, string>;
    terminalOpened?: boolean;
    bottomPanelOpened?: boolean;
    activeBottomPanelTab?: "terminal" | "environment";
    layoutOrientation?: "horizontal" | "vertical";
  }) => {
    const isBottomOpen = bottomPanelOpened ?? terminalOpened ?? false;
    const currentBottomTab = activeBottomPanelTab ?? "terminal";
    set({
      tabs,
      activeTabId,
      protocols,
      responsePanelOpened: false,
      bottomPanelOpened: isBottomOpen,
      activeBottomPanelTab: currentBottomTab,
      terminalOpened: isBottomOpen && currentBottomTab === "terminal",
      layoutOrientation,
    });
  },

  markDirty: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.isDirty) return;
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, isDirty: true } : t)),
    });
  },

  markClean: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab && !tab.isDirty) return;
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t)),
    });
  },

  updateTab: (tabId, updates) => {
    const { drafts } = get();
    let newDrafts = drafts;
    if (updates.name && drafts[tabId]) {
      newDrafts = {
        ...drafts,
        [tabId]: {
          ...drafts[tabId],
          name: updates.name,
        },
      };
    }
    set({
      tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
      drafts: newDrafts,
    });
  },

  replaceTabId: (oldId, newId) => {
    const { tabs, activeTabId, responses, loadingStates, protocols, drafts } = get();
    const newTabs = tabs.map((t) => (t.id === oldId ? { ...t, id: newId } : t));

    const newResponses = { ...responses };
    if (oldId in newResponses) {
      newResponses[newId] = newResponses[oldId];
      delete newResponses[oldId];
    }

    const newLoadingStates = { ...loadingStates };
    if (oldId in newLoadingStates) {
      newLoadingStates[newId] = newLoadingStates[oldId];
      delete newLoadingStates[oldId];
    }

    const newProtocols = { ...protocols };
    if (oldId in newProtocols) {
      newProtocols[newId] = newProtocols[oldId];
      delete newProtocols[oldId];
    }

    const newDrafts = { ...drafts };
    if (oldId in newDrafts) {
      newDrafts[newId] = newDrafts[oldId];
      delete newDrafts[oldId];
    }

    set({
      tabs: newTabs,
      activeTabId: activeTabId === oldId ? newId : activeTabId,
      responses: newResponses,
      loadingStates: newLoadingStates,
      protocols: newProtocols,
      drafts: newDrafts,
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
    set({
      tabs: [],
      activeTabId: null,
      responses: {},
      loadingStates: {},
      protocols: {},
      drafts: {},
    }),

  closeOtherTabs: (tabId) => {
    const { tabs, responses, loadingStates, protocols, drafts } = get();
    const newResponses = { [tabId]: responses[tabId] };
    const newLoadingStates = { [tabId]: loadingStates[tabId] };
    const newProtocols = { [tabId]: protocols[tabId] };
    const newDrafts = drafts[tabId] ? { [tabId]: drafts[tabId] } : {};
    set({
      tabs: tabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
      responses: newResponses,
      loadingStates: newLoadingStates,
      protocols: newProtocols,
      drafts: newDrafts,
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

  setDraft: (tabId, draft) => {
    set({
      drafts: {
        ...get().drafts,
        [tabId]: draft,
      },
    });
  },

  removeDraft: (tabId) => {
    const drafts = { ...get().drafts };
    delete drafts[tabId];
    set({ drafts });
  },

  bottomPanelOpened: false,
  activeBottomPanelTab: "terminal",
  openBottomPanel: (tab) => {
    set({
      bottomPanelOpened: true,
      activeBottomPanelTab: tab || get().activeBottomPanelTab,
      terminalOpened: (tab || get().activeBottomPanelTab) === "terminal",
    });
  },
  closeBottomPanel: () => {
    set({
      bottomPanelOpened: false,
      terminalOpened: false,
    });
  },
  setActiveBottomPanelTab: (tab) => {
    set({
      activeBottomPanelTab: tab,
      terminalOpened: tab === "terminal",
    });
  },
  terminalOpened: false,
  toggleTerminal: () => {
    const { bottomPanelOpened, activeBottomPanelTab } = get();
    if (!bottomPanelOpened) {
      set({
        bottomPanelOpened: true,
        activeBottomPanelTab: "terminal",
        terminalOpened: true,
      });
    } else if (activeBottomPanelTab === "terminal") {
      set({
        bottomPanelOpened: false,
        terminalOpened: false,
      });
    } else {
      set({
        activeBottomPanelTab: "terminal",
        terminalOpened: true,
      });
    }
  },
  setTerminalOpened: (opened: boolean) => {
    set({
      bottomPanelOpened: opened,
      activeBottomPanelTab: "terminal",
      terminalOpened: opened,
    });
  },
  toggleEnvPanel: () => {
    const { bottomPanelOpened, activeBottomPanelTab } = get();
    if (!bottomPanelOpened) {
      set({
        bottomPanelOpened: true,
        activeBottomPanelTab: "environment",
        terminalOpened: false,
      });
    } else if (activeBottomPanelTab === "environment") {
      set({
        bottomPanelOpened: false,
        terminalOpened: false,
      });
    } else {
      set({
        activeBottomPanelTab: "environment",
        terminalOpened: false,
      });
    }
  },
  setEnvPanelOpened: (opened: boolean) => {
    set({
      bottomPanelOpened: opened,
      activeBottomPanelTab: "environment",
      terminalOpened: false,
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
        bottomPanelOpened: state.bottomPanelOpened,
        activeBottomPanelTab: state.activeBottomPanelTab,
        layoutOrientation: state.layoutOrientation,
      });
    }
  });
}
