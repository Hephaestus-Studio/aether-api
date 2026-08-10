import type { KeyValuePair } from "@/types/request";

/**
 * Builds a full URL string by taking the base URL (before '?')
 * and appending all enabled query parameters with non-empty keys.
 */
export function buildUrlWithParams(url: string, params: KeyValuePair[]): string {
  if (!url) return "";

  let baseUrl = url;
  const qIndex = url.indexOf("?");
  if (qIndex !== -1) {
    baseUrl = url.substring(0, qIndex);
  }

  const enabledParams = params.filter((p) => p.enabled && p.key.trim() !== "");
  if (enabledParams.length === 0) {
    return baseUrl;
  }

  const searchParams = new URLSearchParams();
  for (const p of enabledParams) {
    searchParams.append(p.key.trim(), p.value);
  }

  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Parses query parameters from a URL string into a KeyValuePair array,
 * preserving descriptions and enabled states from existing params if matched.
 */
export function parseParamsFromUrl(url: string, currentParams: KeyValuePair[]): KeyValuePair[] {
  if (!url) return currentParams;

  const qIndex = url.indexOf("?");
  if (qIndex === -1) {
    return [{ key: "", value: "", enabled: true, description: "" }];
  }

  const queryString = url.substring(qIndex + 1);
  const searchParams = new URLSearchParams(queryString);

  const existingMap = new Map<string, KeyValuePair>();
  for (const p of currentParams) {
    if (p.key.trim() !== "") {
      existingMap.set(p.key.trim(), p);
    }
  }

  const parsedParams: KeyValuePair[] = [];
  searchParams.forEach((value, key) => {
    const existing = existingMap.get(key);
    parsedParams.push({
      key,
      value,
      enabled: existing ? existing.enabled : true,
      description: existing ? existing.description : "",
    });
  });

  parsedParams.push({ key: "", value: "", enabled: true, description: "" });
  return parsedParams;
}
