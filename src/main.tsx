import "@fontsource-variable/geist";
import "./globals.css";
import "react-day-picker/src/style.css";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ModuleRegistry.registerModules([AllCommunityModule]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
