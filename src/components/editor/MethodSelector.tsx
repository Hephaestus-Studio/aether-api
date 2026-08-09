import { useState, useRef, useEffect } from "react";
import { Popover, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";
import { HTTP_METHODS, getMethodColor } from "@/utils/httpMethods";
import classes from "./MethodSelector.module.css";

interface MethodSelectorProps {
  value: string;
  onChange: (method: string) => void;
  className?: string;
}

export default function MethodSelector({
  value,
  onChange,
  className,
}: Readonly<MethodSelectorProps>) {
  const [opened, setOpened] = useState(false);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customMethodValue, setCustomMethodValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMethod = (value || "GET").toUpperCase();
  const currentColor = getMethodColor(currentMethod);

  // Focus input when custom method typing is triggered
  useEffect(() => {
    if (isCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCustomInput]);

  const handleSelect = (method: string) => {
    onChange(method);
    setOpened(false);
    setIsCustomInput(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customMethodValue.trim().toUpperCase();
    if (trimmed) {
      onChange(trimmed);
      setCustomMethodValue("");
      setIsCustomInput(false);
      setOpened(false);
    }
  };

  const handleClose = () => {
    setOpened(false);
    setIsCustomInput(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      offset={4}
      shadow="lg"
      withinPortal
      onClose={handleClose}
    >
      <Popover.Target>
        <button
          type="button"
          onClick={() => setOpened((o) => !o)}
          className={`${classes.methodButton} ${opened ? classes.methodButtonOpen : ""} ${className || ""}`}
          title="Select HTTP Method"
        >
          <span className={classes.methodText} style={{ color: currentColor }}>
            {currentMethod}
          </span>
          <IconChevronDown
            size={14}
            className={`${classes.chevron} ${opened ? classes.chevronRotated : ""}`}
          />
        </button>
      </Popover.Target>

      <Popover.Dropdown className={classes.dropdown}>
        {HTTP_METHODS.map((method) => {
          const isSelected = method.name === currentMethod;
          return (
            <UnstyledButton
              key={method.name}
              className={`${classes.menuItem} ${isSelected ? classes.menuItemActive : ""}`}
              onClick={() => handleSelect(method.name)}
              style={{ color: method.color }}
            >
              <span>{method.name}</span>
            </UnstyledButton>
          );
        })}

        <div className={classes.divider} />

        {isCustomInput ? (
          <form onSubmit={handleCustomSubmit} className={classes.customInputForm}>
            <input
              ref={inputRef}
              type="text"
              value={customMethodValue}
              onChange={(e) => setCustomMethodValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsCustomInput(false);
                }
              }}
              placeholder="CUSTOM METHOD"
              className={classes.customMethodInput}
            />
            <button type="submit" className={classes.customSubmitBtn} title="Apply custom method">
              <IconCheck size={14} />
            </button>
          </form>
        ) : (
          <UnstyledButton
            className={classes.customMethodItem}
            onClick={() => {
              setIsCustomInput(true);
              setCustomMethodValue("");
            }}
          >
            Type a new method
          </UnstyledButton>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
