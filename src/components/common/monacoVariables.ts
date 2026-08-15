import { useEnvStore } from "@/stores/envStore";
import { getMergedActiveVariables } from "@/utils/placeholder";

let providersRegistered = false;

/**
 * Registers completion and hover providers for {{variable}} syntax across
 * supported Monaco languages (json, xml, yaml, plaintext, javascript, etc.)
 */
export function registerMonacoVariableProviders(monaco: any) {
  if (providersRegistered || !monaco) return;
  providersRegistered = true;

  const supportedLanguages = [
    "json",
    "xml",
    "yaml",
    "plaintext",
    "javascript",
    "typescript",
    "html",
  ];

  for (const lang of supportedLanguages) {
    // 1. Completion Provider for {{ trigger
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ["{", " "],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Match if cursor is after { or {{
        const match = textUntilPosition.match(/\{{1,2}([^}]*)$/);
        if (!match) return { suggestions: [] };

        const query = match[1].toLowerCase();
        const prefixLength = match[0].length;

        const { variablesByEnv, activeEnvironmentName } = useEnvStore.getState();
        const mergedVariables = getMergedActiveVariables(variablesByEnv, activeEnvironmentName);

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - prefixLength,
          endColumn: position.column,
        };

        const suggestions = mergedVariables
          .filter((v) => v.key.toLowerCase().includes(query))
          .map((v) => {
            const isSecret = v.type === "secret";
            const isLocked = v.isLocked;

            return {
              label: `{{${v.key}}}`,
              kind: monaco.languages.CompletionItemKind.Variable,
              documentation: isSecret
                ? isLocked
                  ? "🔒 Encrypted secret variable (Unlock required)"
                  : "🔒 Secret variable (Decrypted in session)"
                : v.value || "(empty string)",
              detail: `[${v.sourceEnv}] ${isSecret ? "Secret" : "Default"}`,
              insertText: `{{${v.key}}}`,
              range,
              sortText: `0_${v.key}`,
            };
          });

        return { suggestions };
      },
    });

    // 2. Hover Provider on {{variable}} tokens
    monaco.languages.registerHoverProvider(lang, {
      provideHover: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const regex = /\{\{([^}]+)\}\}/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(lineContent)) !== null) {
          const startCol = match.index + 1;
          const endCol = startCol + match[0].length;

          if (position.column >= startCol && position.column <= endCol) {
            const varName = match[1].trim();
            const { variablesByEnv, activeEnvironmentName } = useEnvStore.getState();
            const mergedVariables = getMergedActiveVariables(variablesByEnv, activeEnvironmentName);
            const matchedVar = mergedVariables.find((v) => v.key === varName);

            let contents: any[] = [];
            if (matchedVar) {
              const isLocked = matchedVar.isLocked;
              const isSecret = matchedVar.type === "secret";

              contents = [
                { value: `**Variable:** \`{{${varName}}}\`` },
                {
                  value: `**Environment:** \`${matchedVar.sourceEnv}\` (${isSecret ? "Secret" : "Default"})`,
                },
                {
                  value: isLocked
                    ? "🔒 **Status:** Locked (Master Key required to unlock)"
                    : isSecret
                      ? `**Value:** \`••••••••\` *(Secret)*`
                      : `**Value:** \`${matchedVar.value || "(empty string)"}\``,
                },
              ];
            } else {
              contents = [
                { value: `**Variable:** \`{{${varName}}}\`` },
                {
                  value: `⚠️ **Unresolved:** Not defined in \`${activeEnvironmentName || "Global"}\``,
                },
              ];
            }

            return {
              range: new monaco.Range(position.lineNumber, startCol, position.lineNumber, endCol),
              contents,
            };
          }
        }

        return null;
      },
    });
  }
}

/**
 * Sets up live model decorations for highlighting {{variable}} syntax in Monaco Editor
 */
export function setupMonacoVariableDecorations(editor: any, monaco: any) {
  if (!editor || !monaco) return () => {};

  let decorationsCollection: any = null;

  const updateDecorations = () => {
    const model = editor.getModel();
    if (!model) return;

    const matches = model.findMatches(
      "\\{\\{([^}]+)\\}\\}",
      false, // searchOnlyEditableRange
      true, // isRegex
      false, // matchCase
      null, // wordSeparators
      true, // captureMatches
    );

    const newDecorations = matches.map((m: any) => ({
      range: m.range,
      options: {
        inlineClassName: "monaco-variable-placeholder",
        hoverMessage: { value: `Variable: ${m.matches ? m.matches[0] : ""}` },
      },
    }));

    if (!decorationsCollection) {
      decorationsCollection = editor.createDecorationsCollection(newDecorations);
    } else {
      decorationsCollection.set(newDecorations);
    }
  };

  const contentDisposable = editor.onDidChangeModelContent(() => {
    updateDecorations();
  });

  updateDecorations();

  return () => {
    contentDisposable.dispose();
    if (decorationsCollection) {
      decorationsCollection.clear();
    }
  };
}
