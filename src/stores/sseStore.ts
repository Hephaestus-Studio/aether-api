import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { notifications } from "@mantine/notifications";
import type { HttpRequestDetails, SseEventLog, SseStatus, SseMetrics } from "@/types/request";

interface SseStoreState {
  statuses: Record<string, SseStatus>;
  statusMessages: Record<string, string | undefined>;
  logs: Record<string, SseEventLog[]>;
  metrics: Record<string, SseMetrics>;
  filters: Record<string, string>; // "all" or specific event type name
  searchQueries: Record<string, string>;
  autoScroll: Record<string, boolean>;
  isInitialized: boolean;

  initEventListeners: () => Promise<() => void>;
  connect: (tabId: string, request: HttpRequestDetails, activeEnvName?: string) => Promise<void>;
  disconnect: (tabId: string) => Promise<void>;
  clearLogs: (tabId: string) => void;
  setFilter: (tabId: string, filter: string) => void;
  setSearchQuery: (tabId: string, query: string) => void;
  setAutoScroll: (tabId: string, auto: boolean) => void;
}

let isGlobalSseListenerSetup = false;

export const useSseStore = create<SseStoreState>((set) => ({
  statuses: {},
  statusMessages: {},
  logs: {},
  metrics: {},
  filters: {},
  searchQueries: {},
  autoScroll: {},
  isInitialized: false,

  initEventListeners: async () => {
    if (isGlobalSseListenerSetup) return () => {};
    isGlobalSseListenerSetup = true;

    const unlistenMsg = await listen<SseEventLog>("sse:event", (event) => {
      const msg = event.payload;
      const tabId = msg.tabId;
      if (!tabId) return;

      set((state) => {
        const currentLogs = state.logs[tabId] || [];
        const updatedLogs = [...currentLogs, msg];

        const currentMetrics = state.metrics[tabId] || {
          receivedCount: 0,
          receivedBytes: 0,
        };

        const updatedMetrics = {
          ...currentMetrics,
          receivedCount: currentMetrics.receivedCount + 1,
          receivedBytes: currentMetrics.receivedBytes + (msg.size || 0),
        };

        return {
          logs: { ...state.logs, [tabId]: updatedLogs },
          metrics: { ...state.metrics, [tabId]: updatedMetrics },
        };
      });
    });

    const unlistenStatus = await listen<{
      tabId: string;
      status: SseStatus;
      statusCode?: number;
      message?: string;
      timestamp: number;
    }>("sse:status", (event) => {
      const { tabId, status, message } = event.payload;
      if (!tabId) return;

      set((state) => {
        const nextStatuses = { ...state.statuses, [tabId]: status };
        const nextMessages = { ...state.statusMessages, [tabId]: message };
        const currentMetrics = state.metrics[tabId] || {
          receivedCount: 0,
          receivedBytes: 0,
        };

        const updatedMetrics = { ...currentMetrics };
        if (status === "connected") {
          updatedMetrics.connectedSince = Date.now();
        } else if (status === "disconnected") {
          updatedMetrics.connectedSince = undefined;
        }

        return {
          statuses: nextStatuses,
          statusMessages: nextMessages,
          metrics: { ...state.metrics, [tabId]: updatedMetrics },
        };
      });

      if (status === "connected") {
        notifications.show({
          title: "SSE Stream Connected",
          message: message || "Listening for events...",
          color: "teal",
          autoClose: 2500,
        });
      } else if (status === "error") {
        notifications.show({
          title: "SSE Stream Error",
          message: message || "An error occurred with the SSE connection",
          color: "red",
          autoClose: 5000,
        });
      }
    });

    set({ isInitialized: true });

    return () => {
      unlistenMsg();
      unlistenStatus();
      isGlobalSseListenerSetup = false;
    };
  },

  connect: async (tabId, request, activeEnvName) => {
    set((state) => ({
      statuses: { ...state.statuses, [tabId]: "connecting" },
      statusMessages: { ...state.statusMessages, [tabId]: "Connecting to event stream..." },
    }));

    try {
      await invoke("sse_connect", {
        tabId,
        requestPath: tabId,
        requestDetails: request,
        activeEnvironmentName: activeEnvName || null,
      });
    } catch (err) {
      console.error("SSE connect error:", err);
      set((state) => ({
        statuses: { ...state.statuses, [tabId]: "error" },
        statusMessages: { ...state.statusMessages, [tabId]: String(err) },
      }));
      notifications.show({
        title: "Connection Failed",
        message: String(err),
        color: "red",
      });
    }
  },

  disconnect: async (tabId) => {
    try {
      await invoke("sse_disconnect", { tabId });
      set((state) => ({
        statuses: { ...state.statuses, [tabId]: "disconnected" },
        statusMessages: { ...state.statusMessages, [tabId]: "Stream stopped" },
      }));
    } catch (err) {
      console.warn("SSE disconnect error:", err);
    }
  },

  clearLogs: (tabId) => {
    set((state) => ({
      logs: { ...state.logs, [tabId]: [] },
      metrics: {
        ...state.metrics,
        [tabId]: {
          receivedCount: 0,
          receivedBytes: 0,
          connectedSince: state.metrics[tabId]?.connectedSince,
        },
      },
    }));
  },

  setFilter: (tabId, filter) => {
    set((state) => ({
      filters: { ...state.filters, [tabId]: filter },
    }));
  },

  setSearchQuery: (tabId, query) => {
    set((state) => ({
      searchQueries: { ...state.searchQueries, [tabId]: query },
    }));
  },

  setAutoScroll: (tabId, auto) => {
    set((state) => ({
      autoScroll: { ...state.autoScroll, [tabId]: auto },
    }));
  },
}));
