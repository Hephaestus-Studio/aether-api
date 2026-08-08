import { useState, ReactNode, useRef, useEffect } from "react";
import { Box } from "@mantine/core";
import classes from "./SplitPane.module.css";

interface SplitPaneProps {
  topPanel: ReactNode;
  bottomPanel: ReactNode;
  orientation?: "horizontal" | "vertical";
}

export default function SplitPane({
  topPanel,
  bottomPanel,
  orientation = "horizontal",
}: Readonly<SplitPaneProps>) {
  const [splitRatio, setSplitRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const splitRatioRef = useRef(splitRatio);

  useEffect(() => {
    splitRatioRef.current = splitRatio;
  }, [splitRatio]);

  const handleDoubleClick = () => {
    setSplitRatio(0.5);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const isVertical = orientation === "vertical";
    const boundingClientRect = containerRef.current.getBoundingClientRect();
    const containerSize = isVertical ? boundingClientRect.height : boundingClientRect.width;
    const startPos = isVertical ? e.clientY : e.clientX;
    const startRatio = splitRatioRef.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = isVertical ? moveEvent.clientY : moveEvent.clientX;
      const delta = currentPos - startPos;
      const ratioDelta = delta / containerSize;
      const newRatio = Math.max(0.15, Math.min(0.85, startRatio + ratioDelta));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const isVertical = orientation === "vertical";

  return (
    <Box
      ref={containerRef}
      className={classes.container}
      style={{ flexDirection: isVertical ? "column" : "row" }}
    >
      <Box
        style={{
          height: isVertical ? `calc(${splitRatio * 100}% - 2px)` : "100%",
          width: isVertical ? "100%" : `calc(${splitRatio * 100}% - 2px)`,
          overflow: "auto",
          flexShrink: 0,
        }}
        className={classes.panel}
      >
        {topPanel}
      </Box>
      <Box
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={classes.divider}
        style={{
          cursor: isVertical ? "row-resize" : "col-resize",
          height: isVertical ? "4px" : "100%",
          width: isVertical ? "100%" : "4px",
          flexShrink: 0,
        }}
      />
      <Box
        style={{
          height: isVertical ? `calc(${(1 - splitRatio) * 100}% - 2px)` : "100%",
          width: isVertical ? "100%" : `calc(${(1 - splitRatio) * 100}% - 2px)`,
          overflow: "auto",
          flexShrink: 0,
        }}
        className={classes.panel}
      >
        {bottomPanel}
      </Box>
    </Box>
  );
}
