import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { SettingsProvider } from "./shared/settings/SettingsContext";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AppRoutes />
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
