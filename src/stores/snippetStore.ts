import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SNIPPET_OPTIONS,
  type SnippetLanguageId,
  type SnippetOptions,
} from "@/utils/codeGenerators";

interface SnippetStoreState {
  isSnippetModalOpen: boolean;
  isSettingsModalOpen: boolean;
  selectedLanguage: SnippetLanguageId;
  options: SnippetOptions;
  setSnippetModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setSelectedLanguage: (lang: SnippetLanguageId) => void;
  updateLanguageOptions: <K extends keyof SnippetOptions>(
    lang: K,
    newOpts: Partial<SnippetOptions[K]>,
  ) => void;
  resetOptions: () => void;
}

export const useSnippetStore = create<SnippetStoreState>()(
  persist(
    (set) => ({
      isSnippetModalOpen: false,
      isSettingsModalOpen: false,
      selectedLanguage: "curl",
      options: DEFAULT_SNIPPET_OPTIONS,

      setSnippetModalOpen: (open) => set({ isSnippetModalOpen: open }),
      setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
      setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),

      updateLanguageOptions: (lang, newOpts) =>
        set((state) => ({
          options: {
            ...state.options,
            [lang]: {
              ...state.options[lang],
              ...newOpts,
            },
          },
        })),

      resetOptions: () => set({ options: DEFAULT_SNIPPET_OPTIONS }),
    }),
    {
      name: "aether_snippet_settings",
      partialize: (state) => ({
        selectedLanguage: state.selectedLanguage,
        options: state.options,
      }),
    },
  ),
);
