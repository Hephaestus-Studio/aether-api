import React, { useRef, useEffect, useMemo, useState } from "react";
import { Box, Popover } from "@mantine/core";
import { IconEye, IconEyeOff, IconKey, IconLock } from "@tabler/icons-react";
import { useEnvStore } from "@/stores/envStore";
import { useTabStore } from "@/stores/tabStore";
import {
  getMergedActiveVariables,
  parseVariablePlaceholders,
  type MergedEnvVariable,
} from "@/utils/placeholder";
import { useUndoableInput } from "@/hooks/useUndoableInput";
import { useVariableAutocomplete } from "@/hooks/useVariableAutocomplete";
import clsx from "clsx";
import classes from "./PlaceholderInput.module.css";

export interface PlaceholderInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  disabled?: boolean;
  spellCheck?: boolean;
  autoFocus?: boolean;
  rightSection?: React.ReactNode;
}

export default function PlaceholderInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
  placeholder = "",
  className,
  type = "text",
  disabled = false,
  spellCheck = false,
  autoFocus = false,
  rightSection,
}: Readonly<PlaceholderInputProps>) {
  const variablesByEnv = useEnvStore((s) => s.variablesByEnv);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);
  const setUnlockModalOpen = useEnvStore((s) => s.setUnlockModalOpen);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [openedPopoverIdx, setOpenedPopoverIdx] = useState<number | null>(null);

  const { handleChange: handleUndoableChange, handleKeyDown: handleUndoableKeyDown } =
    useUndoableInput(value, onChange);

  const mergedVariables: MergedEnvVariable[] = useMemo(
    () => getMergedActiveVariables(variablesByEnv, activeEnvironmentName),
    [variablesByEnv, activeEnvironmentName],
  );

  const segments = useMemo(
    () => parseVariablePlaceholders(value, mergedVariables),
    [value, mergedVariables],
  );

  const {
    isOpen: isAutocompleteOpen,
    selectedIndex,
    filteredVariables,
    checkTrigger,
    selectVariable,
    handleKeyDown: handleAutocompleteKeyDown,
  } = useVariableAutocomplete({
    value,
    onChange: handleUndoableChange,
    inputRef,
    variables: mergedVariables,
  });

  const handleScroll = () => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  const handleOpenEnvEditor = (sourceEnv?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenedPopoverIdx(null);
    setRevealedSecrets({});
    if (sourceEnv && sourceEnv.toLowerCase() !== "global") {
      useEnvStore.getState().setActiveEnvironment(sourceEnv);
    }
    useTabStore.getState().openBottomPanel("environment");
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    handleUndoableChange(val);
    checkTrigger(val);
  };

  const handleCombinedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (handleAutocompleteKeyDown(e)) {
      return;
    }
    handleUndoableKeyDown(e);
    onKeyDown?.(e);
  };

  const toggleRevealSecret = (varName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedSecrets((prev) => ({
      ...prev,
      [varName]: !prev[varName],
    }));
  };

  let charOffset = 0;
  const isPassword = type === "password";

  return (
    <Box className={clsx(classes.wrapper, className)}>
      <div className={classes.inputContainer}>
        {/* Synchronized Overlay Layer (pointer-events: none, text transparent behind) */}
        {!isPassword && (
          <div ref={overlayRef} className={classes.overlay}>
            {segments.map((seg, idx) => {
              const start = charOffset;
              charOffset += seg.text.length;

              if (seg.isPlaceholder) {
                const isLocked = seg.isLocked;
                const isResolved = seg.isResolved;
                const isSecret = seg.isSecret;
                const isRevealed = seg.varName ? !!revealedSecrets[seg.varName] : false;

                let targetClassName = classes.varUnresolved;
                if (isLocked) {
                  targetClassName = classes.varLocked;
                } else if (isResolved) {
                  targetClassName = classes.varResolved;
                }

                return (
                  <Popover
                    key={idx}
                    position="bottom-start"
                    shadow="xl"
                    withinPortal
                    opened={openedPopoverIdx === idx}
                    onChange={(opened) => {
                      setOpenedPopoverIdx(opened ? idx : null);
                      if (!opened) setRevealedSecrets({});
                    }}
                  >
                    <Popover.Target>
                      <span
                        className={targetClassName}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenedPopoverIdx((prev) => (prev === idx ? null : idx));
                        }}
                      >
                        {seg.text}
                      </span>
                    </Popover.Target>

                    <Popover.Dropdown className={classes.hoverCardDropdown}>
                      {isLocked ? (
                        <>
                          <div className={classes.hoverValueBoxLocked}>
                            <span>
                              🔒 Locked Secret Variable: <strong>{seg.varName}</strong>
                            </span>
                          </div>
                          <div className={classes.hoverFooter}>
                            <div className={classes.envSection}>
                              <span className={classes.envBadgeLocked}>🔒</span>
                              <span className={classes.envText}>
                                Encrypted in {seg.sourceEnv || "Global"}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={classes.unlockBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenedPopoverIdx(null);
                                setRevealedSecrets({});
                                setUnlockModalOpen(true);
                              }}
                            >
                              Unlock Secrets →
                            </button>
                          </div>
                        </>
                      ) : isResolved ? (
                        <>
                          <div
                            className={clsx(
                              classes.hoverValueBox,
                              isSecret && !isRevealed && classes.hoverValueBoxMasked,
                            )}
                          >
                            <span className={classes.hoverValueText}>
                              {isSecret && !isRevealed
                                ? "••••••••"
                                : seg.resolvedValue || "(empty string)"}
                            </span>
                            {isSecret && (
                              <button
                                type="button"
                                className={classes.eyeBtn}
                                onClick={(e) => toggleRevealSecret(seg.varName || "", e)}
                                title={isRevealed ? "Hide Secret" : "Show Secret"}
                              >
                                {isRevealed ? <IconEyeOff size={13} /> : <IconEye size={13} />}
                              </button>
                            )}
                          </div>
                          <div className={classes.hoverFooter}>
                            <div className={classes.envSection}>
                              <span className={classes.envBadge}>
                                {seg.sourceEnv ? seg.sourceEnv[0].toUpperCase() : "E"}
                              </span>
                              <span className={classes.envText}>
                                {seg.sourceEnv || "Global"}
                                {isSecret ? " (Secret)" : ""}
                              </span>
                            </div>
                            <span
                              className={classes.varsRequest}
                              onClick={(e) => handleOpenEnvEditor(seg.sourceEnv, e)}
                            >
                              Open Editor →
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={classes.hoverValueBoxUnresolved}>
                            Unresolved variable: <strong>{seg.varName}</strong>
                          </div>
                          <div className={classes.hoverFooter}>
                            <div className={classes.envSection}>
                              <span className={classes.envBadgeUnresolved}>!</span>
                              <span className={classes.envText}>
                                Not defined in {activeEnvironmentName || "Global"}
                              </span>
                            </div>
                            <span
                              className={classes.varsRequest}
                              onClick={(e) => handleOpenEnvEditor(seg.sourceEnv, e)}
                            >
                              Open Editor →
                            </span>
                          </div>
                        </>
                      )}
                    </Popover.Dropdown>
                  </Popover>
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
        )}

        {/* Native Input Layer */}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleCombinedKeyDown}
          onScroll={handleScroll}
          onSelect={handleScroll}
          onKeyUp={handleScroll}
          onClick={handleScroll}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={spellCheck}
          autoFocus={autoFocus}
          className={clsx(classes.nativeInput, isPassword && classes.nativeInputHidden)}
          autoComplete="off"
        />

        {rightSection && <div>{rightSection}</div>}
      </div>

      {/* Autocomplete Suggestion Dropdown */}
      {isAutocompleteOpen && (
        <div className={classes.autocompleteDropdown}>
          {filteredVariables.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const isSecret = item.type === "secret";

            return (
              <div
                key={item.key}
                className={clsx(
                  classes.autocompleteItem,
                  isSelected && classes.autocompleteItemSelected,
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectVariable(item);
                }}
              >
                <div className={classes.itemLeft}>
                  {isSecret ? <IconLock size={12} /> : <IconKey size={12} />}
                  <span className={classes.itemKey}>{item.key}</span>
                </div>
                <div className={classes.itemRight}>
                  <span className={classes.badgeEnv}>{item.sourceEnv}</span>
                  {isSecret && <span className={classes.badgeSecret}>secret</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Box>
  );
}
