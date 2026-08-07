import { create } from "zustand";
import type { TabItem } from "@/types/request";

interface TabState {
  tabs: TabItem[];
  activeTabId: string | null;
  closedTabsHistory: TabItem[];

  openTab: (tab: TabItem) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  markDirty: (tabId: string) => void;
  markClean: (tabId: string) => void;
  reopenLastClosed: () => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  closedTabsHistory: [],

  openTab: (tab) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.id === tab.id)) {
      set({ tabs: [...tabs, tab], activeTabId: tab.id });
    } else {
      set({ activeTabId: tab.id });
    }
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, closedTabsHistory } = get();
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (!tabToClose) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    let newActiveId = activeTabId;

    if (activeTabId === tabId) {
      newActiveId = newTabs.at(-1)?.id ?? null;
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
      closedTabsHistory: [...closedTabsHistory, tabToClose],
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

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

  reopenLastClosed: () => {
    const { closedTabsHistory } = get();
    const last = closedTabsHistory.at(-1);
    if (!last) return;
    get().openTab(last);
    set({ closedTabsHistory: closedTabsHistory.slice(0, -1) });
  },

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    set({
      tabs: tabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
    });
  },
}));
