export type ShortcutHandler = (e: KeyboardEvent) => void;

class KeyboardRegistry {
  private readonly bindings: Map<string, ShortcutHandler> = new Map();

  public register(keyCombo: string, handler: ShortcutHandler) {
    this.bindings.set(keyCombo.toLowerCase(), handler);
  }

  public handleEvent(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    let key = "";
    if (modifier) key += "mod+";
    if (e.shiftKey) key += "shift+";
    key += e.key.toLowerCase();

    const handler = this.bindings.get(key);
    if (handler) {
      // Prevent triggering shortcuts inside native text inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        if (!key.startsWith("mod+")) return; // Allow mod keys in inputs
      }
      e.preventDefault();
      handler(e);
    }
  }
}

export const globalShortcuts = new KeyboardRegistry();

// Default shortcuts configuration map
export const SHORTCUTS = {
  SEND_REQUEST: "mod+enter",
  QUICK_OPEN: "mod+p",
  COMMAND_PALETTE: "mod+shift+p",
  TOGGLE_SIDEBAR: "mod+b",
  CLOSE_TAB: "mod+w",
};
