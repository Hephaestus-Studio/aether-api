import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useTauriCommand<TInput = any, TOutput = any>(commandName: string) {
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (args: TInput): Promise<TOutput> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<TOutput>(commandName, args as any);
        setData(result);
        return result;
      } catch (err: any) {
        // Parse structured error from Rust AppError enum
        const formattedError =
          typeof err === "string"
            ? { code: "INTERNAL_ERROR", message: err }
            : (err as { code: string; message: string });
        setError(formattedError);
        throw formattedError;
      } finally {
        setLoading(false);
      }
    },
    [commandName],
  );

  return { data, error, loading, execute };
}
