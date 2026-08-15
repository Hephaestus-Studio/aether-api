import { useState, useCallback, useRef } from "react";
import type { MergedEnvVariable } from "@/utils/placeholder";

interface UseVariableAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  variables: MergedEnvVariable[];
}

export function useVariableAutocomplete({
  value,
  onChange,
  inputRef,
  variables,
}: UseVariableAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const triggerIndexRef = useRef<number>(-1);

  // Check if cursor is inside an unclosed {{ placeholder
  const checkTrigger = useCallback(
    (inputValue: string) => {
      const input = inputRef.current;
      if (!input) {
        setIsOpen(false);
        return;
      }

      const cursor = input.selectionStart ?? inputValue.length;
      const textBeforeCursor = inputValue.slice(0, cursor);

      // Find the last index of {{ before cursor
      const lastOpen = textBeforeCursor.lastIndexOf("{{");
      const lastClose = textBeforeCursor.lastIndexOf("}}");

      if (lastOpen !== -1 && lastOpen >= lastClose) {
        const queryText = textBeforeCursor.slice(lastOpen + 2).trim();
        triggerIndexRef.current = lastOpen;
        setQuery(queryText);
        setSelectedIndex(0);
        setIsOpen(true);
      } else {
        setIsOpen(false);
        triggerIndexRef.current = -1;
      }
    },
    [inputRef],
  );

  const filteredVariables = variables.filter((v) =>
    v.key.toLowerCase().includes(query.toLowerCase()),
  );

  const selectVariable = useCallback(
    (item: MergedEnvVariable) => {
      const input = inputRef.current;
      if (!input) return;

      const cursor = input.selectionStart ?? value.length;
      const triggerIndex =
        triggerIndexRef.current >= 0 ? triggerIndexRef.current : value.lastIndexOf("{{");
      if (triggerIndex === -1) return;

      const textAfterCursor = value.slice(cursor);
      // Check if there is already a closing }} immediately after cursor
      const hasClosing = textAfterCursor.startsWith("}}");
      const remainder = hasClosing ? textAfterCursor.slice(2) : textAfterCursor;

      const replacement = `{{${item.key}}}`;
      const newValue = value.slice(0, triggerIndex) + replacement + remainder;
      const newCursor = triggerIndex + replacement.length;

      onChange(newValue);
      setIsOpen(false);
      triggerIndexRef.current = -1;

      // Restore focus and cursor
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 0);
    },
    [inputRef, onChange, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || filteredVariables.length === 0) {
        if (e.key === "{" && e.currentTarget.value) {
          // Trigger check after change
          setTimeout(() => checkTrigger(inputRef.current?.value || ""), 0);
        }
        return false;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredVariables.length);
        return true;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredVariables.length) % filteredVariables.length,
        );
        return true;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredVariables[selectedIndex]) {
          selectVariable(filteredVariables[selectedIndex]);
        }
        return true;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return true;
      }

      return false;
    },
    [checkTrigger, filteredVariables, inputRef, isOpen, selectedIndex, selectVariable],
  );

  return {
    isOpen: isOpen && filteredVariables.length > 0,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    filteredVariables,
    checkTrigger,
    selectVariable,
    handleKeyDown,
  };
}
