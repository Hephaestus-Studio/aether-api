import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Gracefully dismiss splash screen once initial React tree mounts
requestAnimationFrame(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    setTimeout(() => {
      splash.remove();
    }, 380);
  }
});
