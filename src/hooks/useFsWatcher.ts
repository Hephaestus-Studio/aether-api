import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import type { FsChangeEventPayload } from "@/types/workspace";

export function useFsWatcher(onFsChange: (payload: FsChangeEventPayload) => void) {
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | null = null;

    listen<FsChangeEventPayload>("fs-change", (event) => {
      if (active) {
        onFsChange(event.payload);
      }
    }).then((unsub) => {
      if (!active) {
        unsub();
      } else {
        unlistenFn = unsub;
      }
    });

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [onFsChange]);
}
