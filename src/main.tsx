import "@fontsource-variable/geist";
import "./globals.css";
import "react-day-picker/src/style.css";
import "./calendar-overrides.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
