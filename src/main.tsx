import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import Settings from "./Settings";

// Determine which component to render based on window label
const getAppComponent = async () => {
  const currentWindow = getCurrentWindow();
  const label = currentWindow.label;
  
  if (label === "settings") {
    return <Settings />;
  } else if (label === "wave-window" || label === "main") {
    return <App />;
  }
  return null;
};

// Initialize the app
const initApp = async () => {
  const AppComponent = await getAppComponent();
  
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      {AppComponent}
    </StrictMode>,
  );
};

initApp();
