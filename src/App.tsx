import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { I18nProvider } from "./shared/i18n";
import { SettingsProvider } from "./shared/settings/SettingsContext";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <I18nProvider>
          <AppRoutes />
        </I18nProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
