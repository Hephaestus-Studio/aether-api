import type { EnvVariableItem } from "@/types/environment";

export interface UrlSegment {
  text: string;
  isPlaceholder: boolean;
  varName?: string;
  isResolved?: boolean;
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

  const varsMap = new Map<string, string>();
  for (const v of activeVariables) {
    if (v.enabled !== false && v.key.trim() !== "") {
      varsMap.set(v.key.trim(), v.value);
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
    const isResolved = varsMap.has(varName);
    const resolvedValue = isResolved ? varsMap.get(varName) : undefined;

    segments.push({
      text: rawMatch,
      isPlaceholder: true,
      varName,
      isResolved,
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
