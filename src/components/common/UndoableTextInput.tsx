import React from "react";
import { TextInput, type TextInputProps } from "@mantine/core";
import { useUndoableInput } from "@/hooks/useUndoableInput";

export interface UndoableTextInputProps extends Omit<TextInputProps, "onChange"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
}

export const UndoableTextInput = React.forwardRef<HTMLInputElement, UndoableTextInputProps>(
  ({ value = "", onChange, onValueChange, onKeyDown, ...props }, ref) => {
    const handleValChange = (newVal: string) => {
      onValueChange?.(newVal);
      if (onChange) {
        const syntheticEvent = {
          target: { value: newVal },
          currentTarget: { value: newVal },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const { handleChange, handleKeyDown } = useUndoableInput(value, handleValChange);

    return (
      <TextInput
        {...props}
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          handleKeyDown(e);
          onKeyDown?.(e);
        }}
      />
    );
  },
);

UndoableTextInput.displayName = "UndoableTextInput";
export default UndoableTextInput;
