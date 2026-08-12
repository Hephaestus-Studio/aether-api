import { useRef, useEffect } from "react";
import { Box, HoverCard } from "@mantine/core";
import { useEnvStore } from "@/stores/envStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { parseUrlPlaceholders } from "@/utils/placeholder";
import { parseCurl, isCurlCommand, type ParsedCurl } from "@/utils/curlParser";
import { useUndoableInput } from "@/hooks/useUndoableInput";
import classes from "./UrlInput.module.css";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onImportCurl?: (parsed: ParsedCurl) => void;
  placeholder?: string;
  className?: string;
}

export default function UrlInput({
  value,
  onChange,
  onImportCurl,
  placeholder = "Enter URL or paste cURL text",
  className,
}: Readonly<UrlInputProps>) {
  const activeVariables = useEnvStore((s) => s.activeVariables);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { handleChange: handleUndoableChange, handleKeyDown: handleUndoableKeyDown } =
    useUndoableInput(value, onChange);

  const segments = parseUrlPlaceholders(value, activeVariables);

  const handleScroll = () => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  const handleOpenEnvEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    useWorkspaceStore.getState().setActiveView("environment");
  };

  const handlePlaceholderMouseDown = (e: React.MouseEvent<HTMLSpanElement>, startIndex: number) => {
    if (!inputRef.current) return;

    let offset = 0;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        offset = pos.offset;
      }
    } else if ((document as any).caretRangeFromPoint) {
      const range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        offset = range.startOffset;
      }
    }

    const targetCaret = startIndex + offset;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(targetCaret, targetCaret);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (isCurlCommand(pastedText)) {
      e.preventDefault();
      const parsed = parseCurl(pastedText);
      if (parsed && onImportCurl) {
        onImportCurl(parsed);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isCurlCommand(val)) {
      const parsed = parseCurl(val);
      if (parsed && onImportCurl) {
        onImportCurl(parsed);
        return;
      }
    }
    handleUndoableChange(val);
  };

  let charOffset = 0;

  return (
    <Box className={classes.wrapper}>
      <div className={classes.inputContainer}>
        {/* Synchronized Overlay Layer (z-index: 2, pointer-events: none) */}
        <div ref={overlayRef} className={classes.overlay}>
          {segments.map((seg, idx) => {
            const start = charOffset;
            charOffset += seg.text.length;

            if (seg.isPlaceholder) {
              const isResolved = seg.isResolved;
              return (
                <HoverCard
                  key={idx}
                  shadow="xl"
                  position="bottom-start"
                  openDelay={0}
                  closeDelay={150}
                  withinPortal
                >
                  <HoverCard.Target>
                    <span
                      className={isResolved ? classes.varResolved : classes.varUnresolved}
                      onMouseDown={(e) => handlePlaceholderMouseDown(e, start)}
                      onClick={() => inputRef.current?.focus()}
                    >
                      {seg.text}
                    </span>
                  </HoverCard.Target>

                  <HoverCard.Dropdown className={classes.hoverCardDropdown}>
                    {isResolved ? (
                      <>
                        <div className={classes.hoverValueBox}>
                          {seg.resolvedValue || "(empty string)"}
                        </div>
                        <div className={classes.hoverFooter}>
                          <div className={classes.envSection}>
                            <span className={classes.envBadge}>E</span>
                            <span className={classes.envText}>
                              {activeEnvironmentName === "global"
                                ? "Global"
                                : activeEnvironmentName || "Global"}
                            </span>
                          </div>
                          <span className={classes.varsRequest} onClick={handleOpenEnvEditor}>
                            Open Environment Editor →
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={classes.hoverValueBoxUnresolved}>
                          Unresolved variable: {seg.varName}
                        </div>
                        <div className={classes.hoverFooter}>
                          <div className={classes.envSection}>
                            <span className={classes.envBadgeUnresolved}>!</span>
                            <span className={classes.envText}>
                              Not defined in{" "}
                              {activeEnvironmentName === "global"
                                ? "Global"
                                : activeEnvironmentName || "Global"}
                            </span>
                          </div>
                          <span className={classes.varsRequest} onClick={handleOpenEnvEditor}>
                            Open Environment Editor →
                          </span>
                        </div>
                      </>
                    )}
                  </HoverCard.Dropdown>
                </HoverCard>
              );
            }

            return (
              <span
                key={idx}
                className={classes.normalText}
                onMouseDown={(e) => handlePlaceholderMouseDown(e, start)}
              >
                {seg.text}
              </span>
            );
          })}
        </div>

        {/* Native Input Layer (z-index: 1) */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleUndoableKeyDown}
          onPaste={handlePaste}
          onScroll={handleScroll}
          onSelect={handleScroll}
          onKeyUp={handleScroll}
          onClick={handleScroll}
          placeholder={placeholder}
          className={`${classes.nativeInput} ${className || ""}`}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </Box>
  );
}
