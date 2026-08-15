import type { EnvVariableItem } from "@/types/environment";

export interface MergedEnvVariable extends EnvVariableItem {
  sourceEnv: string;
}

export interface VariableSegment {
  text: string;
  isPlaceholder: boolean;
  varName?: string;
  isResolved?: boolean;
  isLocked?: boolean;
  isSecret?: boolean;
  resolvedValue?: string;
  sourceEnv?: string;
}

// Backward compatibility alias
export type UrlSegment = VariableSegment;

/**
 * Merges variables from the Global environment and the Active environment.
 * If a variable key exists in both, the Active environment overrides the Global one.
 */
export function getMergedActiveVariables(
  variablesByEnv: Record<string, EnvVariableItem[]>,
  activeEnvName: string | null,
): MergedEnvVariable[] {
  const mergedMap = new Map<string, MergedEnvVariable>();

  // 1. Global variables
  const globalVars = variablesByEnv["global"] || [];
  for (const v of globalVars) {
    if (v.enabled !== false && v.key.trim() !== "") {
      mergedMap.set(v.key.trim(), {
        ...v,
        sourceEnv: "Global",
      });
    }
  }

  // 2. Active environment variables (override global)
  if (activeEnvName && activeEnvName.toLowerCase() !== "global") {
    const activeVars =
      Object.entries(variablesByEnv).find(
        ([k]) => k.toLowerCase() === activeEnvName.toLowerCase(),
      )?.[1] || [];

    for (const v of activeVars) {
      if (v.enabled !== false && v.key.trim() !== "") {
        mergedMap.set(v.key.trim(), {
          ...v,
          sourceEnv: activeEnvName,
        });
      }
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Parses a string template (e.g. URL, param value, header, body) into segments of
 * plain text and variable placeholders {{var}}.
 * Resolves each placeholder against the active/merged environment variables list.
 */
export function parseVariablePlaceholders(
  input: string,
  activeVariables: (EnvVariableItem & { sourceEnv?: string })[],
): VariableSegment[] {
  if (!input) return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const segments: VariableSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const varsMap = new Map<string, EnvVariableItem & { sourceEnv?: string }>();
  for (const v of activeVariables) {
    if (v.enabled !== false && v.key.trim() !== "") {
      varsMap.set(v.key.trim(), v);
    }
  }

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: input.substring(lastIndex, match.index),
        isPlaceholder: false,
      });
    }

    const rawMatch = match[0];
    const varName = match[1].trim();
    const matchedVar = varsMap.get(varName);
    const isLocked = !!matchedVar?.isLocked;
    const isSecret = matchedVar?.type === "secret";
    const isResolved = !!matchedVar && !isLocked;
    const resolvedValue = isResolved ? matchedVar.value : undefined;
    const sourceEnv = matchedVar?.sourceEnv || "Global";

    segments.push({
      text: rawMatch,
      isPlaceholder: true,
      varName,
      isResolved,
      isLocked,
      isSecret,
      resolvedValue,
      sourceEnv,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({
      text: input.substring(lastIndex),
      isPlaceholder: false,
    });
  }

  return segments;
}

/**
 * Backward compatibility wrapper for parseUrlPlaceholders
 */
export function parseUrlPlaceholders(
  url: string,
  activeVariables: (EnvVariableItem & { sourceEnv?: string })[],
): VariableSegment[] {
  return parseVariablePlaceholders(url, activeVariables);
}
