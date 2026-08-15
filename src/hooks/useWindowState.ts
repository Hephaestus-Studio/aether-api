import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useWindowState() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const updateMaximized = async () => {
      try {
        const max = await appWindow.isMaximized();
        setIsMaximized(max);
      } catch (err) {
        console.error("Failed to check window maximized state:", err);
      }
    };

    updateMaximized();

    let unlisten: () => void;
    appWindow
      .onResized(() => {
        updateMaximized();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(console.error);

    return () => {
      if (unlisten) unlisten();
    };
  }, [appWindow]);

  const toggleMaximize = async () => {
    try {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error("Failed to toggle maximize:", err);
    }
  };

  const minimize = () => appWindow.minimize();
  const close = () => appWindow.close();

  return { isMaximized, toggleMaximize, minimize, close, appWindow };
}
