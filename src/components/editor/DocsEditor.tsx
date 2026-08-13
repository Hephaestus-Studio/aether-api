import { useState, useRef, useMemo, useCallback } from "react";
import { Box, Tooltip, Button } from "@mantine/core";
import {
  IconEdit,
  IconEye,
  IconLayoutColumns,
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconH3,
  IconCode,
  IconSourceCode,
  IconQuote,
  IconList,
  IconListNumbers,
  IconCheckbox,
  IconLink,
  IconTable,
  IconMinus,
  IconFileText,
} from "@tabler/icons-react";
import { marked } from "marked";
import MonacoEditor from "@/components/common/MonacoEditor";
import clsx from "clsx";
import classes from "./DocsEditor.module.css";

interface DocsEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

type EditorMode = "edit" | "split" | "preview";

// Configure marked options for clean GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function DocsEditor({
  value,
  onChange,
  placeholder = "Write documentation in Markdown...",
}: Readonly<DocsEditorProps>) {
  const [mode, setMode] = useState<EditorMode>("split");
  const editorRef = useRef<any>(null);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // Format insertion handler for toolbar buttons
  const insertFormatting = useCallback(
    (before: string, after: string = "", defaultText: string = "") => {
      const editor = editorRef.current;
      if (!editor || editor.isDisposed?.()) return;

      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return;

      const selectedText = model.getValueInRange(selection);
      const textToInsert = selectedText || defaultText;
      const replacement = `${before}${textToInsert}${after}`;

      editor.executeEdits("markdown-format", [
        {
          range: selection,
          text: replacement,
          forceMoveMarkers: true,
        },
      ]);
      editor.pushUndoStop();
      editor.focus();

      const newSelectionStart = selection.startColumn + before.length;
      const newSelectionEnd = newSelectionStart + textToInsert.length;
      editor.setSelection({
        startLineNumber: selection.startLineNumber,
        startColumn: newSelectionStart,
        endLineNumber: selection.endLineNumber,
        endColumn: newSelectionEnd,
      });

      const updatedVal = model.getValue();
      onChange(updatedVal);
    },
    [onChange],
  );

  // Render markdown HTML
  const renderedHtml = useMemo(() => {
    if (!value || !value.trim()) return "";
    try {
      return marked.parse(value) as string;
    } catch (err) {
      console.error("Markdown parse error:", err);
      return `<p style="color: red;">Error parsing markdown: ${String(err)}</p>`;
    }
  }, [value]);

  const wordCount = useMemo(() => {
    if (!value || !value.trim()) return 0;
    return value.trim().split(/\s+/).length;
  }, [value]);

  const charCount = value ? value.length : 0;

  return (
    <Box className={classes.container}>
      {/* Top Toolbar */}
      <Box className={classes.toolbar}>
        <Box className={classes.toolbarLeft}>
          {/* Mode Switcher */}
          <div className={classes.modeToggle}>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={clsx(classes.modeBtn, mode === "edit" && classes.modeBtnActive)}
            >
              <IconEdit size={14} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("split")}
              className={clsx(classes.modeBtn, mode === "split" && classes.modeBtnActive)}
            >
              <IconLayoutColumns size={14} />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={clsx(classes.modeBtn, mode === "preview" && classes.modeBtnActive)}
            >
              <IconEye size={14} />
              <span>Preview</span>
            </button>
          </div>

          {/* Markdown Formatting Action Icons (Available in edit/split mode) */}
          {mode !== "preview" && (
            <div className={classes.formatGroup}>
              <Tooltip label="Heading 1" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("# ", "\n", "Heading 1")}
                  className={classes.formatBtn}
                >
                  <IconH1 size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Heading 2" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("## ", "\n", "Heading 2")}
                  className={classes.formatBtn}
                >
                  <IconH2 size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Heading 3" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("### ", "\n", "Heading 3")}
                  className={classes.formatBtn}
                >
                  <IconH3 size={14} />
                </button>
              </Tooltip>

              <Tooltip label="Bold (Ctrl+B)" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("**", "**", "bold text")}
                  className={classes.formatBtn}
                >
                  <IconBold size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Italic (Ctrl+I)" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("*", "*", "italic text")}
                  className={classes.formatBtn}
                >
                  <IconItalic size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Strikethrough" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("~~", "~~", "strikethrough")}
                  className={classes.formatBtn}
                >
                  <IconStrikethrough size={14} />
                </button>
              </Tooltip>

              <Tooltip label="Inline Code" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("`", "`", "code")}
                  className={classes.formatBtn}
                >
                  <IconCode size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Code Block" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("```\n", "\n```\n", "// code here")}
                  className={classes.formatBtn}
                >
                  <IconSourceCode size={14} />
                </button>
              </Tooltip>

              <Tooltip label="Quote" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("> ", "\n", "quote")}
                  className={classes.formatBtn}
                >
                  <IconQuote size={14} />
                </button>
              </Tooltip>

              <Tooltip label="Bulleted List" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("- ", "\n", "List item")}
                  className={classes.formatBtn}
                >
                  <IconList size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Numbered List" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("1. ", "\n", "List item")}
                  className={classes.formatBtn}
                >
                  <IconListNumbers size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Task List" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("- [ ] ", "\n", "Task item")}
                  className={classes.formatBtn}
                >
                  <IconCheckbox size={14} />
                </button>
              </Tooltip>

              <Tooltip label="Link" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("[", "](https://example.com)", "link title")}
                  className={classes.formatBtn}
                >
                  <IconLink size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Table" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() =>
                    insertFormatting(
                      "\n| Column 1 | Column 2 |\n| -------- | -------- |\n| ",
                      " | Value 2  |\n",
                      "Value 1",
                    )
                  }
                  className={classes.formatBtn}
                >
                  <IconTable size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Horizontal Rule" withArrow position="bottom">
                <button
                  type="button"
                  onClick={() => insertFormatting("\n---\n", "", "")}
                  className={classes.formatBtn}
                >
                  <IconMinus size={14} />
                </button>
              </Tooltip>
            </div>
          )}
        </Box>

        <Box className={classes.toolbarRight}>
          <div className={classes.statsBadge}>
            {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount} chars
          </div>
        </Box>
      </Box>

      {/* Main Workspace Area */}
      <Box className={classes.workspace}>
        {/* Editor Pane (in edit or split mode) */}
        {(mode === "edit" || mode === "split") && (
          <Box className={classes.editorPane}>
            <MonacoEditor
              value={value || ""}
              onChange={(val) => onChange(val || "")}
              language="markdown"
              theme="aether-dark"
              beforeMount={(monaco) => {
                try {
                  monaco.editor.defineTheme("aether-dark", {
                    base: "vs-dark",
                    inherit: true,
                    rules: [],
                    colors: {
                      "editor.background": "#1e1e1e",
                    },
                  });
                } catch {}
              }}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                wordWrap: "on",
                lineNumbers: "off",
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 0,
                scrollBeyondLastLine: false,
                fontSize: 13,
                fontFamily: "var(--aether-font-mono, monospace)",
                smoothScrolling: true,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </Box>
        )}

        {/* Split Divider */}
        {mode === "split" && <div className={classes.splitDivider} />}

        {/* Preview Pane (in split or preview mode) */}
        {(mode === "preview" || mode === "split") && (
          <Box className={classes.previewPane}>
            {renderedHtml ? (
              <div
                className={classes.markdownBody}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <div className={classes.emptyDocs}>
                <IconFileText size={36} stroke={1.5} opacity={0.5} />
                <div className={classes.emptyTitle}>No documentation provided</div>
                <div className={classes.emptySubtext}>
                  {placeholder}
                </div>
                {mode === "preview" && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => setMode("edit")}
                    style={{ marginTop: 8 }}
                  >
                    Start Writing
                  </Button>
                )}
              </div>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
