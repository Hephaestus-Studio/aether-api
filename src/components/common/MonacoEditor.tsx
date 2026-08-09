import { useEffect, useRef, useState, type ReactNode } from "react";
import loader from "@monaco-editor/loader";

export interface MonacoEditorProps {
  value?: string;
  defaultValue?: string;
  language?: string;
  theme?: string;
  height?: string | number;
  width?: string | number;
  options?: Record<string, any>;
  beforeMount?: (monaco: any) => void;
  onMount?: (editor: any, monaco: any) => void;
  onChange?: (value: string | undefined) => void;
  loading?: ReactNode;
  className?: string;
}

export default function MonacoEditor({
  value,
  defaultValue = "",
  language = "plaintext",
  theme = "aether-dark",
  height = "100%",
  width = "100%",
  options = {},
  beforeMount,
  onMount,
  onChange,
  loading = "Loading editor...",
  className,
}: Readonly<MonacoEditorProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  const valueRef = useRef(value);
  valueRef.current = value;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const beforeMountRef = useRef(beforeMount);
  beforeMountRef.current = beforeMount;

  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  // Initialize editor on mount
  useEffect(() => {
    let isCancelled = false;
    let editorInstance: any = null;
    let contentListener: any = null;

    loader
      .init()
      .then((monaco) => {
        if (isCancelled || !containerRef.current) return;
        monacoRef.current = monaco;

        try {
          beforeMountRef.current?.(monaco);
        } catch (err) {
          console.warn("Monaco beforeMount error:", err);
        }

        if (isCancelled || !containerRef.current) return;

        editorInstance = monaco.editor.create(containerRef.current, {
          value: valueRef.current !== undefined ? valueRef.current : defaultValue,
          language,
          theme,
          automaticLayout: true,
          ...options,
        });

        editorRef.current = editorInstance;
        setIsReady(true);

        try {
          onMountRef.current?.(editorInstance, monaco);
        } catch (err) {
          console.warn("Monaco onMount error:", err);
        }

        contentListener = editorInstance.onDidChangeModelContent(() => {
          if (!editorInstance || editorInstance.isDisposed?.()) return;
          const currentVal = editorInstance.getValue();
          if (currentVal !== valueRef.current) {
            onChangeRef.current?.(currentVal);
          }
        });
      })
      .catch((err) => {
        if (err?.type !== "cancelation") {
          console.error("Monaco initialization error:", err);
        }
      });

    return () => {
      isCancelled = true;
      if (contentListener) {
        try {
          contentListener.dispose();
        } catch {}
      }
      if (editorInstance) {
        try {
          const model = editorInstance.getModel();
          if (model) {
            model.dispose();
          }
          editorInstance.dispose();
        } catch (err) {
          console.warn("Error disposing Monaco editor instance:", err);
        }
      }
      editorRef.current = null;
      monacoRef.current = null;
      setIsReady(false);
    };
  }, []); // Run only once per DOM mount

  // Sync value changes safely
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDisposed?.()) return;

    try {
      const model = editor.getModel();
      if (!model || model.isDisposed?.()) return;

      if (value !== undefined && value !== editor.getValue()) {
        editor.executeEdits("", [
          {
            range: model.getFullModelRange(),
            text: value,
            forceMoveMarkers: true,
          },
        ]);
        editor.pushUndoStop();
      }
    } catch (err) {
      console.warn("Failed to update Monaco editor value:", err);
    }
  }, [value]);

  // Sync language changes safely
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || editor.isDisposed?.()) return;

    try {
      const model = editor.getModel();
      if (model && !model.isDisposed?.() && language) {
        monaco.editor.setModelLanguage(model, language);
      }
    } catch (err) {
      console.warn("Failed to update Monaco editor language:", err);
    }
  }, [language]);

  // Sync theme changes safely
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !theme) return;

    try {
      monaco.editor.setTheme(theme);
    } catch (err) {
      console.warn("Failed to set Monaco editor theme:", err);
    }
  }, [theme]);

  // Sync options safely
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDisposed?.()) return;

    try {
      editor.updateOptions(options);
    } catch (err) {
      console.warn("Failed to update Monaco editor options:", err);
    }
  }, [options]);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
      }}
      className={className}
    >
      {!isReady && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            color: "var(--text-muted, #888)",
          }}
        >
          {loading}
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          display: isReady ? "block" : "none",
        }}
      />
    </div>
  );
}
