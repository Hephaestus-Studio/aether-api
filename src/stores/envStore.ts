import { create } from "zustand";
import type { EnvironmentSummary, EnvVariableItem, MasterKeyStatus } from "@/types/environment";

interface EnvState {
  environments: EnvironmentSummary[];
  activeEnvironmentName: string | null;
  activeVariables: EnvVariableItem[];
  variablesByEnv: Record<string, EnvVariableItem[]>;
  dirtyEnvs: Record<string, boolean>;
  hasMasterKey: boolean;
  hasEncryptedSecrets: boolean;
  hasLegacyDotenv: boolean;
  isUnlockModalOpen: boolean;
  isManageMasterKeyModalOpen: boolean;
  isMasterKeyModalOpen: boolean;

  setEnvironments: (envs: EnvironmentSummary[]) => void;
  setActiveEnvironment: (name: string | null) => void;
  setActiveVariables: (vars: EnvVariableItem[]) => void;
  updateActiveVariable: (index: number, fields: Partial<EnvVariableItem>) => void;
  setEnvVariables: (envName: string, vars: EnvVariableItem[]) => void;
  setEnvDirty: (envName: string, dirty: boolean) => void;
  setMasterKeyStatus: (status: MasterKeyStatus) => void;
  setUnlockModalOpen: (open: boolean) => void;
  setManageMasterKeyModalOpen: (open: boolean) => void;
  setMasterKeyModalOpen: (open: boolean) => void;
  reset: () => void;
}

export const useEnvStore = create<EnvState>((set, get) => ({
  environments: [],
  activeEnvironmentName: "global",
  activeVariables: [],
  variablesByEnv: {},
  dirtyEnvs: {},
  hasMasterKey: false,
  hasEncryptedSecrets: false,
  hasLegacyDotenv: false,
  isUnlockModalOpen: false,
  isManageMasterKeyModalOpen: false,
  isMasterKeyModalOpen: false,

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
  updateActiveVariable: (index, fields) => {
    const { activeVariables, activeEnvironmentName, variablesByEnv, dirtyEnvs } = get();
    const envKey = (activeEnvironmentName || "global").toLowerCase();

    let next: EnvVariableItem[];
    if (index >= activeVariables.length) {
      next = [...activeVariables, { key: "", value: "", type: "text", enabled: true, ...fields }];
    } else {
      next = [...activeVariables];
      next[index] = { ...next[index], ...fields };
    }

    const wasDirty = !!dirtyEnvs[envKey];
    set({
      activeVariables: next,
      variablesByEnv: {
        ...variablesByEnv,
        [envKey]: next,
      },
      ...(wasDirty ? {} : { dirtyEnvs: { ...dirtyEnvs, [envKey]: true } }),
    });
  },
  setEnvVariables: (envName, vars) => {
    const envKey = envName.toLowerCase();
    set((state) => {
      const currentKey = (state.activeEnvironmentName || "global").toLowerCase();
      const isCurrent = currentKey === envKey;
      return {
        variablesByEnv: {
          ...state.variablesByEnv,
          [envKey]: vars,
        },
        ...(isCurrent ? { activeVariables: vars } : {}),
      };
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
  setMasterKeyStatus: (status) => {
    set({
      hasMasterKey: status.hasMasterKey,
      hasEncryptedSecrets: status.hasEncryptedSecrets,
      hasLegacyDotenv: status.hasLegacyDotenv,
    });
  },
  setUnlockModalOpen: (open) => {
    set({ isUnlockModalOpen: open });
  },
  setManageMasterKeyModalOpen: (open) => {
    set({ isManageMasterKeyModalOpen: open });
  },
  setMasterKeyModalOpen: (open) => {
    if (open) {
      const { hasEncryptedSecrets, hasMasterKey } = get();
      if (hasEncryptedSecrets && !hasMasterKey) {
        set({ isUnlockModalOpen: true, isMasterKeyModalOpen: true });
      } else {
        set({ isManageMasterKeyModalOpen: true, isMasterKeyModalOpen: true });
      }
    } else {
      set({
        isUnlockModalOpen: false,
        isManageMasterKeyModalOpen: false,
        isMasterKeyModalOpen: false,
      });
    }
  },
  reset: () => {
    set({
      environments: [],
      activeEnvironmentName: "global",
      activeVariables: [],
      variablesByEnv: {},
      dirtyEnvs: {},
      hasMasterKey: false,
      hasEncryptedSecrets: false,
      hasLegacyDotenv: false,
      isUnlockModalOpen: false,
      isManageMasterKeyModalOpen: false,
      isMasterKeyModalOpen: false,
    });
  },
}));
