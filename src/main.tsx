import React, { StrictMode, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import Settings from "./components/Settings";
import Dashboard from "./components/Dashboard";
import Splashscreen from "./components/SplashScreen";

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

  const handleSplashComplete = async () => {
    console.log("Splash screen complete, transitioning to dashboard...");
    try {
      // Transform the current splashscreen window into a dashboard window
      await invoke('transform_splash_to_dashboard');
      console.log("Window transformed to dashboard");
      
      // Update the React state to show dashboard content
      setCurrentWindow("dashboard");
    } catch (error) {
      console.error("Failed to transform window:", error);
      // Fallback: just update the React state
      setCurrentWindow("dashboard");
    }
  };

  // Show splash screen for splashscreen window
  if (currentWindow === "splashscreen") {
    console.log("Rendering splashscreen component");
    return <Splashscreen onComplete={handleSplashComplete} />;
  }

  // Route to appropriate component based on window label
  if (currentWindow === "settings") {
    console.log("Rendering settings component");
    return <Settings />;
  } else if (currentWindow === "dashboard") {
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
