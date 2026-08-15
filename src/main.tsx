import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const SPLASH_START_TIME = performance.now();
const MIN_SPLASH_DURATION_MS = 1000;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

function dismissSplashScreen() {
  const elapsed = performance.now() - SPLASH_START_TIME;
  const remaining = Math.max(0, MIN_SPLASH_DURATION_MS - elapsed);

  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) {
      splash.style.opacity = "0";
      splash.style.pointerEvents = "none";
      setTimeout(() => {
        splash.remove();
      }, 400);
    }
  }, remaining);
}

if (document.readyState === "complete") {
  dismissSplashScreen();
} else {
  window.addEventListener("load", dismissSplashScreen);
}
