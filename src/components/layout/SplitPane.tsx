import { useState, ReactNode, useRef, useEffect } from "react";
import { Box } from "@mantine/core";
import classes from "./SplitPane.module.css";

interface SplitPaneProps {
  topPanel: ReactNode;
  bottomPanel: ReactNode;
}

export default function SplitPane({ topPanel, bottomPanel }: Readonly<SplitPaneProps>) {
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

    const containerHeight = containerRef.current.getBoundingClientRect().height;
    const startY = e.clientY;
    const startRatio = splitRatioRef.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const ratioDelta = deltaY / containerHeight;
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

  return (
    <Box ref={containerRef} className={classes.container}>
      <Box style={{ height: `calc(${splitRatio * 100}% - 2px)` }} className={classes.panel}>
        {topPanel}
      </Box>
      <Box
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={classes.divider}
      />
      <Box style={{ height: `calc(${(1 - splitRatio) * 100}% - 2px)` }} className={classes.panel}>
        {bottomPanel}
      </Box>
    </Box>
  );
}
