import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface AppConfig {
  theme: string;
  fontSize: number;
  uiFontSize: number;
  defaultParentDirectory: string | null;
}

interface ConfigState {
  config: AppConfig;
  isLoading: boolean;
  loadConfig: () => Promise<void>;
  updateConfig: (updater: Partial<AppConfig>) => Promise<void>;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: "dark",
  fontSize: 13,
  uiFontSize: 13,
  defaultParentDirectory: null,
};

export const useConfigStore = create<ConfigState>((set, get) => {
  // Listen for tauri events to keep instances synchronized across different windows
  let isListening = false;

  if (typeof window !== "undefined") {
    if (!isListening) {
      isListening = true;
      listen<AppConfig>("config-changed", (event) => {
        if (event.payload) {
          set({ config: event.payload });
        }
      }).catch((err) => {
        console.error("Failed to setup config-changed listener:", err);
      });
    }
  }

  return {
    config: DEFAULT_CONFIG,
    isLoading: false,
    loadConfig: async () => {
      set({ isLoading: true });
      try {
        const cfg = await invoke<AppConfig>("get_app_config");
        if (cfg) {
          set({ config: cfg });
        }
      } catch (err) {
        console.error("Failed to load app config:", err);
      } finally {
        set({ isLoading: false });
      }
    },
    updateConfig: async (updater) => {
      const nextConfig = { ...get().config, ...updater };
      set({ config: nextConfig });
      try {
        await invoke("update_app_config", { config: nextConfig });
      } catch (err) {
        console.error("Failed to update app config:", err);
      }
    },
  };
});
