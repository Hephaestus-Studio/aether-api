import { useRef, useEffect, useCallback } from "react";

export function useUndoableInput(value: string = "", onChange: (val: string) => void) {
  const historyRef = useRef<string[]>([value || ""]);
  const pointerRef = useRef<number>(0);
  const isUndoRedoRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);

  // Sync external value changes (e.g. tab switches, reset)
  useEffect(() => {
    const val = value || "";
    const currentVal = historyRef.current[pointerRef.current];
    if (!isUndoRedoRef.current && val !== currentVal) {
      historyRef.current = [val];
      pointerRef.current = 0;
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string) => {
      const val = typeof e === "string" ? e : e.target.value;
      const now = Date.now();
      const timeDiff = now - lastChangeTimeRef.current;
      lastChangeTimeRef.current = now;

      if (!isUndoRedoRef.current) {
        const current = historyRef.current[pointerRef.current] ?? "";
        if (val !== current) {
          const isWordBreak =
            val.endsWith(" ") || val.endsWith("\n") || Math.abs(val.length - current.length) > 3;

          if (timeDiff < 350 && !isWordBreak && pointerRef.current > 0) {
            historyRef.current[pointerRef.current] = val;
          } else {
            const newHistory = historyRef.current.slice(0, pointerRef.current + 1);
            newHistory.push(val);
            if (newHistory.length > 50) newHistory.shift();
            historyRef.current = newHistory;
            pointerRef.current = newHistory.length - 1;
          }
        }
      } else {
        isUndoRedoRef.current = false;
      }

      onChange(val);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && isZ && !e.shiftKey) {
        if (pointerRef.current > 0) {
          e.preventDefault();
          e.stopPropagation();
          pointerRef.current -= 1;
          const prevVal = historyRef.current[pointerRef.current];
          isUndoRedoRef.current = true;
          onChange(prevVal);
        }
      } else if (isCtrlOrCmd && ((isZ && e.shiftKey) || isY)) {
        if (pointerRef.current < historyRef.current.length - 1) {
          e.preventDefault();
          e.stopPropagation();
          pointerRef.current += 1;
          const nextVal = historyRef.current[pointerRef.current];
          isUndoRedoRef.current = true;
          onChange(nextVal);
        }
      }
    },
    [onChange],
  );

  return {
    handleChange,
    handleKeyDown,
  };
}
