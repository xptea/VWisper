import React, { StrictMode, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import Dashboard from "./components/Dashboard";

// Main App Router Component
const AppRouter: React.FC = () => {
  const [currentWindow, setCurrentWindow] = useState<string>("");

  // Initialize window detection
  useEffect(() => {
    const initWindow = async () => {
      const window = getCurrentWindow();
      const label = window.label;
      console.log("Current window label:", label);
      setCurrentWindow(label);
    };
    initWindow();
  }, []);

  // Route to appropriate component based on window label
  if (currentWindow === "dashboard") {
    console.log("Rendering dashboard component");
    return <Dashboard />;
  } else if (currentWindow === "wave-window" || currentWindow === "main") {
    console.log("Rendering wave window component");
    return <App />;
  }
  
  console.log("No matching window found, currentWindow:", currentWindow);
  return null;
};

// Initialize the app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
