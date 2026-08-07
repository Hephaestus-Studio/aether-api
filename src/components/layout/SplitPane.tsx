import { useState, ReactNode } from "react";
import { Box } from "@mantine/core";
import classes from "./SplitPane.module.css";

interface SplitPaneProps {
  topPanel: ReactNode;
  bottomPanel: ReactNode;
}

export default function SplitPane({ topPanel, bottomPanel }: Readonly<SplitPaneProps>) {
  const [splitRatio, setSplitRatio] = useState(0.5);

  const handleDoubleClick = () => {
    setSplitRatio(0.5);
  };

  return (
    <Box className={classes.container}>
      <Box style={{ height: `${splitRatio * 100}%` }} className={classes.panel}>
        {topPanel}
      </Box>
      <Box onDoubleClick={handleDoubleClick} className={classes.divider} />
      <Box style={{ height: `${(1 - splitRatio) * 100}%` }} className={classes.panel}>
        {bottomPanel}
      </Box>
    </Box>
  );
}
