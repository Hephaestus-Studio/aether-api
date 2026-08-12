import { create } from "zustand";
import type { EnvironmentSummary, EnvVariableItem } from "@/types/environment";

interface EnvState {
  environments: EnvironmentSummary[];
  activeEnvironmentName: string | null;
  activeVariables: EnvVariableItem[];
  variablesByEnv: Record<string, EnvVariableItem[]>;
  dirtyEnvs: Record<string, boolean>;

  setEnvironments: (envs: EnvironmentSummary[]) => void;
  setActiveEnvironment: (name: string | null) => void;
  setActiveVariables: (vars: EnvVariableItem[]) => void;
  setEnvVariables: (envName: string, vars: EnvVariableItem[]) => void;
  setEnvDirty: (envName: string, dirty: boolean) => void;
}

export const useEnvStore = create<EnvState>((set, get) => ({
  environments: [],
  activeEnvironmentName: "global",
  activeVariables: [],
  variablesByEnv: {},
  dirtyEnvs: {},

  setEnvironments: (envs) => set({ environments: envs }),
  setActiveEnvironment: (name) => {
    const { variablesByEnv } = get();
    const envKey = (name || "global").toLowerCase();
    const existing = Object.entries(variablesByEnv).find(([k]) => k.toLowerCase() === envKey)?.[1];

    set({
      activeEnvironmentName: name,
      activeVariables: existing || [],
    });
  },
  setActiveVariables: (vars) => {
    const { activeEnvironmentName, variablesByEnv } = get();
    const envKey = (activeEnvironmentName || "global").toLowerCase();
    set({
      activeVariables: vars,
      variablesByEnv: {
        ...variablesByEnv,
        [envKey]: vars,
      },
    });
  },
  setEnvVariables: (envName, vars) => {
    const { activeEnvironmentName, variablesByEnv } = get();
    const envKey = envName.toLowerCase();
    const currentKey = (activeEnvironmentName || "global").toLowerCase();
    const isCurrent = currentKey === envKey;

    set({
      variablesByEnv: {
        ...variablesByEnv,
        [envKey]: vars,
      },
      ...(isCurrent ? { activeVariables: vars } : {}),
    });
  },
  setEnvDirty: (envName, dirty) => {
    const { dirtyEnvs } = get();
    set({
      dirtyEnvs: {
        ...dirtyEnvs,
        [envName.toLowerCase()]: dirty,
      },
    });
  },
}));
