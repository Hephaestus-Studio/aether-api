import { create } from "zustand";
import type { EnvironmentSummary, EnvVariableItem } from "@/types/environment";

interface EnvState {
  environments: EnvironmentSummary[];
  activeEnvironmentName: string | null;
  activeVariables: EnvVariableItem[];

  setEnvironments: (envs: EnvironmentSummary[]) => void;
  setActiveEnvironment: (name: string | null) => void;
  setActiveVariables: (vars: EnvVariableItem[]) => void;
}

export const useEnvStore = create<EnvState>((set) => ({
  environments: [],
  activeEnvironmentName: null,
  activeVariables: [],

  setEnvironments: (envs) => set({ environments: envs }),
  setActiveEnvironment: (name) => set({ activeEnvironmentName: name }),
  setActiveVariables: (vars) => set({ activeVariables: vars }),
}));
