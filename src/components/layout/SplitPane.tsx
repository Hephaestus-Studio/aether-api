import { useState, ReactNode, useRef, useEffect } from "react";
import { Box } from "@mantine/core";
import classes from "./SplitPane.module.css";

interface SplitPaneProps {
  topPanel: ReactNode;
  bottomPanel: ReactNode;
  orientation?: "horizontal" | "vertical";
  collapsed?: boolean;
  minTopSize?: number;
  minBottomSize?: number;
}

export default function SplitPane({
  topPanel,
  bottomPanel,
  orientation = "horizontal",
  collapsed = false,
  minTopSize,
  minBottomSize,
}: Readonly<SplitPaneProps>) {
  const [splitRatio, setSplitRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const splitRatioRef = useRef(splitRatio);

  const isVertical = orientation === "vertical";
  const defaultMinTop = isVertical ? 150 : 320;
  const defaultMinBottom = isVertical ? 100 : 280;

  const minTop = minTopSize ?? defaultMinTop;
  const minBottom = minBottomSize ?? defaultMinBottom;

  useEffect(() => {
    splitRatioRef.current = splitRatio;
  }, [splitRatio]);

  const handleDoubleClick = () => {
    setSplitRatio(0.5);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const boundingClientRect = containerRef.current.getBoundingClientRect();
    const containerSize = isVertical ? boundingClientRect.height : boundingClientRect.width;
    const startPos = isVertical ? e.clientY : e.clientX;
    const startRatio = splitRatioRef.current;

    const minRatio = containerSize > minTop + minBottom ? minTop / containerSize : 0.15;
    const maxRatio =
      containerSize > minTop + minBottom ? (containerSize - minBottom) / containerSize : 0.85;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = isVertical ? moveEvent.clientY : moveEvent.clientX;
      const delta = currentPos - startPos;
      const ratioDelta = delta / containerSize;
      const newRatio = Math.max(minRatio, Math.min(maxRatio, startRatio + ratioDelta));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <Box
      ref={containerRef}
      className={classes.container}
      style={{ flexDirection: isVertical ? "column" : "row" }}
    >
      <Box
        style={{
          height: collapsed ? "100%" : isVertical ? `calc(${splitRatio * 100}% - 2px)` : "100%",
          width: collapsed ? "100%" : isVertical ? "100%" : `calc(${splitRatio * 100}% - 2px)`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
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
          display: collapsed ? "none" : isVertical ? "block" : "block",
          cursor: isVertical ? "row-resize" : "col-resize",
          height: isVertical ? "4px" : "100%",
          width: isVertical ? "100%" : "4px",
          flexShrink: 0,
        }}
      />
      <Box
        style={{
          display: collapsed ? "none" : "flex",
          height: isVertical ? `calc(${(1 - splitRatio) * 100}% - 2px)` : "100%",
          width: isVertical ? "100%" : `calc(${(1 - splitRatio) * 100}% - 2px)`,
          overflow: "hidden",
          flexDirection: "column",
          flexShrink: 0,
        }}
        className={classes.panel}
      >
        {bottomPanel}
      </Box>
    </Box>
  );
}
