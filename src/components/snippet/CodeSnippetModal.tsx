import { useState, useMemo } from "react";
import { Modal, Select, Tooltip } from "@mantine/core";
import { IconTerminal2, IconSettings, IconCopy, IconCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useSnippetStore } from "@/stores/snippetStore";
import { useEnvStore } from "@/stores/envStore";
import {
  SUPPORTED_LANGUAGES,
  generateSnippet,
  type SnippetLanguageId,
} from "@/utils/codeGenerators";
import { highlightSnippet } from "@/utils/codeGenerators/syntaxHighlighter";
import type { EnvVariableItem } from "@/types/environment";
import type { HttpRequestDetails } from "@/types/request";
import LanguageSettingsModal from "./LanguageSettingsModal";
import classes from "./CodeSnippetModal.module.css";

interface CodeSnippetModalProps {
  request: HttpRequestDetails;
}

export default function CodeSnippetModal({ request }: Readonly<CodeSnippetModalProps>) {
  const {
    isSnippetModalOpen,
    setSnippetModalOpen,
    setSettingsModalOpen,
    selectedLanguage,
    setSelectedLanguage,
    options,
  } = useSnippetStore();

  const [copied, setCopied] = useState(false);
  const activeVariables = useEnvStore((s) => s.activeVariables);

  // Resolve headers and URL with environment variables
  const { resolvedUrl, resolvedHeaders } = useMemo(() => {
    if (!isSnippetModalOpen) {
      return { resolvedUrl: "", resolvedHeaders: {} };
    }

    const varMap = new Map(
      (activeVariables || [])
        .filter((v: EnvVariableItem) => v.enabled)
        .map((v: EnvVariableItem) => [v.key, v.value]),
    );

    const replaceVars = (str: string): string => {
      if (!str) return "";
      return str.replace(/\{\{([^}]+)\}\}/g, (_, key: string): string => {
        const trimmed = key.trim();
        return varMap.get(trimmed) ?? `{{${trimmed}}}`;
      });
    };

    const rUrl = replaceVars(request.url);

    const rHeaders: Record<string, string> = {};
    (request.headers || []).forEach((h) => {
      if (h.enabled && h.key.trim()) {
        rHeaders[replaceVars(h.key.trim())] = replaceVars(h.value || "");
      }
    });

    // Injected Auth headers
    if (request.auth) {
      if (request.auth.type === "bearer" && request.auth.bearer.token) {
        const token = replaceVars(request.auth.bearer.token);
        const prefix = request.auth.bearer.prefix || "Bearer";
        rHeaders["Authorization"] = `${prefix} ${token}`;
      } else if (request.auth.type === "basic") {
        const user = replaceVars(request.auth.basic.username);
        const pass = replaceVars(request.auth.basic.password);
        try {
          const b64 = btoa(unescape(encodeURIComponent(`${user}:${pass}`)));
          rHeaders["Authorization"] = `Basic ${b64}`;
        } catch {
          // Fallback if encoding fails
        }
      } else if (request.auth.type === "apikey" && request.auth.apikey.key) {
        const key = replaceVars(request.auth.apikey.key);
        const val = replaceVars(request.auth.apikey.value);
        if (request.auth.apikey.addTo === "header") {
          rHeaders[key] = val;
        }
      }
    }

    return { resolvedUrl: rUrl, resolvedHeaders: rHeaders };
  }, [isSnippetModalOpen, request, activeVariables]);

  const generatedCode = useMemo(() => {
    if (!isSnippetModalOpen) return "";
    return generateSnippet(selectedLanguage, {
      request,
      resolvedUrl,
      resolvedHeaders,
      options,
    });
  }, [isSnippetModalOpen, selectedLanguage, request, resolvedUrl, resolvedHeaders, options]);

  const lineCount = useMemo(() => {
    if (!generatedCode) return 0;
    return generatedCode.split("\n").length;
  }, [generatedCode]);

  const lineNumbers = useMemo(() => {
    if (lineCount === 0) return "";
    return Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");
  }, [lineCount]);

  const highlightedCode = useMemo(() => {
    if (!isSnippetModalOpen || !generatedCode) return "";
    return highlightSnippet(generatedCode, selectedLanguage);
  }, [isSnippetModalOpen, generatedCode, selectedLanguage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    notifications.show({
      title: "Copied code snippet",
      message: `Code snippet for ${selectedLanguage} copied to clipboard`,
      color: "blue",
      autoClose: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const selectData = SUPPORTED_LANGUAGES.map((l) => ({
    label: l.name,
    value: l.id,
  }));

  return (
    <>
      <Modal
        opened={isSnippetModalOpen}
        onClose={() => setSnippetModalOpen(false)}
        title={
          <div className={classes.modalTitle}>
            <IconTerminal2 size={18} color="#60a5fa" />
            <span>Code Snippet</span>
          </div>
        }
        size="lg"
        centered
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          title: classes.modalTitle,
          body: classes.modalBody,
        }}
      >
        {/* Top Control Bar */}
        <div className={classes.topBar}>
          <div className={classes.topBarLeft}>
            <Select
              className={classes.langSelect}
              value={selectedLanguage}
              onChange={(val) => setSelectedLanguage((val as SnippetLanguageId) || "curl")}
              data={selectData}
              allowDeselect={false}
            />
          </div>

          <div className={classes.topBarRight}>
            <Tooltip label={`Configure settings for ${selectedLanguage}`} position="top">
              <button
                type="button"
                className={classes.actionBtn}
                onClick={() => setSettingsModalOpen(true)}
              >
                <IconSettings size={15} />
                <span>Settings</span>
              </button>
            </Tooltip>

            <button type="button" className={classes.actionBtn} onClick={handleCopy}>
              {copied ? (
                <>
                  <IconCheck size={15} color="#4ade80" />
                  <span style={{ color: "#4ade80" }}>Copied</span>
                </>
              ) : (
                <>
                  <IconCopy size={15} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Display Area */}
        <div className={classes.codeContainer}>
          <div className={classes.lineNumbers}>{lineNumbers}</div>
          <div className={classes.codeScroll}>
            <pre className={classes.codePre}>{highlightedCode}</pre>
          </div>
        </div>
      </Modal>

      {/* Language Specific Settings Modal */}
      <LanguageSettingsModal />
    </>
  );
}
