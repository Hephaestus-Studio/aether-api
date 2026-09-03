import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { notifications } from "@mantine/notifications";
import type {
  HttpRequestDetails,
  WebSocketMessageLog,
  WebSocketStatus,
  WsMetrics,
} from "@/types/request";

interface WebSocketStoreState {
  statuses: Record<string, WebSocketStatus>;
  statusMessages: Record<string, string | undefined>;
  logs: Record<string, WebSocketMessageLog[]>;
  metrics: Record<string, WsMetrics>;
  filters: Record<string, "all" | "in" | "out" | "pingpong">;
  searchQueries: Record<string, string>;
  autoScroll: Record<string, boolean>;
  isInitialized: boolean;

  initEventListeners: () => Promise<() => void>;
  connect: (tabId: string, request: HttpRequestDetails, activeEnvName?: string) => Promise<void>;
  disconnect: (tabId: string, code?: number, reason?: string) => Promise<void>;
  sendMessage: (
    tabId: string,
    format: "json" | "text" | "binary",
    payload: string,
    activeEnvName?: string,
  ) => Promise<void>;
  sendPing: (tabId: string, payload?: string) => Promise<void>;
  clearLogs: (tabId: string) => void;
  setFilter: (tabId: string, filter: "all" | "in" | "out" | "pingpong") => void;
  setSearchQuery: (tabId: string, query: string) => void;
  setAutoScroll: (tabId: string, auto: boolean) => void;
}

let isGlobalListenerSetup = false;

export const useWebSocketStore = create<WebSocketStoreState>((set, get) => ({
  statuses: {},
  statusMessages: {},
  logs: {},
  metrics: {},
  filters: {},
  searchQueries: {},
  autoScroll: {},
  isInitialized: false,

  initEventListeners: async () => {
    if (isGlobalListenerSetup) return () => {};
    isGlobalListenerSetup = true;

    const unlistenMsg = await listen<WebSocketMessageLog>("ws:message", (event) => {
      const msg = event.payload;
      const tabId = msg.tabId;
      if (!tabId) return;

      set((state) => {
        const currentLogs = state.logs[tabId] || [];
        const updatedLogs = [...currentLogs, msg];

        // Update basic metrics
        const currentMetrics = state.metrics[tabId] || {
          sentCount: 0,
          receivedCount: 0,
          sentBytes: 0,
          receivedBytes: 0,
        };

        const updatedMetrics = { ...currentMetrics };
        if (msg.direction === "in") {
          updatedMetrics.receivedCount += 1;
          updatedMetrics.receivedBytes += msg.size || 0;
        } else {
          updatedMetrics.sentCount += 1;
          updatedMetrics.sentBytes += msg.size || 0;
        }

        return {
          logs: { ...state.logs, [tabId]: updatedLogs },
          metrics: { ...state.metrics, [tabId]: updatedMetrics },
        };
      });
    });

    const unlistenStatus = await listen<{
      tabId: string;
      status: WebSocketStatus;
      message?: string;
      code?: number;
      timestamp: number;
    }>("ws:status", (event) => {
      const { tabId, status, message } = event.payload;
      if (!tabId) return;

      set((state) => {
        const nextStatuses = { ...state.statuses, [tabId]: status };
        const nextMessages = { ...state.statusMessages, [tabId]: message };
        const currentMetrics = state.metrics[tabId] || {
          sentCount: 0,
          receivedCount: 0,
          sentBytes: 0,
          receivedBytes: 0,
        };

        let updatedMetrics = { ...currentMetrics };
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
          title: "WebSocket Connected",
          message: message || "Handshake completed successfully",
          color: "teal",
          autoClose: 2500,
        });
      } else if (status === "error") {
        notifications.show({
          title: "WebSocket Error",
          message: message || "An error occurred with the WebSocket connection",
          color: "red",
          autoClose: 5000,
        });
      }
    });

    set({ isInitialized: true });

    return () => {
      unlistenMsg();
      unlistenStatus();
      isGlobalListenerSetup = false;
    };
  },

  connect: async (tabId, request, activeEnvName) => {
    set((state) => ({
      statuses: { ...state.statuses, [tabId]: "connecting" },
      statusMessages: { ...state.statusMessages, [tabId]: "Initiating connection..." },
    }));

    try {
      await invoke("ws_connect", {
        tabId,
        requestPath: tabId,
        requestDetails: request,
        activeEnvironmentName: activeEnvName || null,
        subprotocols: [],
      });
    } catch (err) {
      console.error("WebSocket connect error:", err);
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

  disconnect: async (tabId, code, reason) => {
    try {
      await invoke("ws_disconnect", {
        tabId,
        code: code || 1000,
        reason: reason || "Client closed connection",
      });
      set((state) => ({
        statuses: { ...state.statuses, [tabId]: "disconnected" },
        statusMessages: { ...state.statusMessages, [tabId]: "Disconnected" },
      }));
    } catch (err) {
      console.warn("WebSocket disconnect error:", err);
    }
  },

  sendMessage: async (tabId, format, payload, activeEnvName) => {
    const status = get().statuses[tabId];
    if (status !== "connected") {
      notifications.show({
        title: "Cannot Send Message",
        message: "WebSocket is not connected. Please connect first.",
        color: "yellow",
      });
      return;
    }

    try {
      await invoke("ws_send_message", {
        tabId,
        format,
        payload,
        activeEnvironmentName: activeEnvName || null,
      });
    } catch (err) {
      console.error("Send message error:", err);
      notifications.show({
        title: "Send Message Failed",
        message: String(err),
        color: "red",
      });
    }
  },

  sendPing: async (tabId, payload) => {
    const status = get().statuses[tabId];
    if (status !== "connected") return;

    try {
      await invoke("ws_send_ping", {
        tabId,
        payload: payload || null,
      });
      notifications.show({
        title: "Ping Sent",
        message: "Heartbeat Ping frame dispatched",
        color: "blue",
        autoClose: 1500,
      });
    } catch (err) {
      notifications.show({
        title: "Ping Failed",
        message: String(err),
        color: "red",
      });
    }
  },

  clearLogs: (tabId) => {
    set((state) => ({
      logs: { ...state.logs, [tabId]: [] },
      metrics: {
        ...state.metrics,
        [tabId]: {
          sentCount: 0,
          receivedCount: 0,
          sentBytes: 0,
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
