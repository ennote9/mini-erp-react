import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { I18nProvider } from "./shared/i18n";
import { SettingsProvider } from "./shared/settings/SettingsContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { startMarkingAutoSyncScheduler } from "./modules/items/markingAutoSyncScheduler";
import "./App.css";

function MarkingAutoSyncSchedulerHost() {
  useEffect(() => {
    return startMarkingAutoSyncScheduler();
  }, []);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <I18nProvider>
          <TooltipProvider>
            <MarkingAutoSyncSchedulerHost />
            <AppRoutes />
          </TooltipProvider>
        </I18nProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
