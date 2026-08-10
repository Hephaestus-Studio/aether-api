import { useRef, useEffect } from "react";
import { Box, HoverCard } from "@mantine/core";
import { useEnvStore } from "@/stores/envStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { parseUrlPlaceholders } from "@/utils/placeholder";
import classes from "./UrlInput.module.css";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function UrlInput({
  value,
  onChange,
  placeholder = "Enter URL or paste text",
  className,
}: Readonly<UrlInputProps>) {
  const activeVariables = useEnvStore((s) => s.activeVariables);
  const activeEnvironmentName = useEnvStore((s) => s.activeEnvironmentName);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  return (
    <Box className={classes.wrapper}>
      <div className={classes.inputContainer}>
        {/* Synchronized Overlay Layer (z-index: 2, pointer-events: none) */}
        <div ref={overlayRef} className={classes.overlay}>
          {segments.map((seg, idx) => {
            if (!seg.isPlaceholder) {
              return <span key={idx}>{seg.text}</span>;
            }

            const isResolved = seg.isResolved;

            return (
              <HoverCard
                key={idx}
                shadow="xl"
                position="bottom-start"
                openDelay={0}
                closeDelay={150}
                zIndex={3000}
                withinPortal
              >
                <HoverCard.Target>
                  <span
                    className={isResolved ? classes.pillResolved : classes.pillUnresolved}
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
          })}
        </div>

        {/* Native Input Layer (z-index: 1) */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          className={`${classes.nativeInput} ${className || ""}`}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </Box>
  );
}
