import type { EnvVariableItem } from "@/types/environment";

export interface UrlSegment {
  text: string;
  isPlaceholder: boolean;
  varName?: string;
  isResolved?: boolean;
  isLocked?: boolean;
  isSecret?: boolean;
  resolvedValue?: string;
}

/**
 * Parses a URL string into segments of plain text and variable placeholders.
 * Resolves each placeholder against the active environment variables list.
 */
export function parseUrlPlaceholders(
  url: string,
  activeVariables: EnvVariableItem[],
): UrlSegment[] {
  if (!url) return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const segments: UrlSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const varsMap = new Map<string, EnvVariableItem>();
  for (const v of activeVariables) {
    if (v.enabled !== false && v.key.trim() !== "") {
      varsMap.set(v.key.trim(), v);
    }
  }

  while ((match = regex.exec(url)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: url.substring(lastIndex, match.index),
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

    segments.push({
      text: rawMatch,
      isPlaceholder: true,
      varName,
      isResolved,
      isLocked,
      isSecret,
      resolvedValue,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < url.length) {
    segments.push({
      text: url.substring(lastIndex),
      isPlaceholder: false,
    });
  }

  return segments;
}
