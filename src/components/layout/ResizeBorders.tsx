import { getCurrentWindow } from "@tauri-apps/api/window";
import classes from "./ResizeBorders.module.css";

type ResizeDirection =
  "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

export default function ResizeBorders() {
  const appWindow = getCurrentWindow();

  const handleResize = (direction: ResizeDirection) => (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      appWindow.startResizeDragging(direction);
    } catch (err) {
      console.error("Failed to start resize dragging:", err);
    }
  };

  return (
    <>
      {/* Edges */}
      <div className={classes.borderN} onMouseDown={handleResize("North")} />
      <div className={classes.borderS} onMouseDown={handleResize("South")} />
      <div className={classes.borderE} onMouseDown={handleResize("East")} />
      <div className={classes.borderW} onMouseDown={handleResize("West")} />

      {/* Corners */}
      <div className={classes.cornerNW} onMouseDown={handleResize("NorthWest")} />
      <div className={classes.cornerNE} onMouseDown={handleResize("NorthEast")} />
      <div className={classes.cornerSW} onMouseDown={handleResize("SouthWest")} />
      <div className={classes.cornerSE} onMouseDown={handleResize("SouthEast")} />
    </>
  );
}
