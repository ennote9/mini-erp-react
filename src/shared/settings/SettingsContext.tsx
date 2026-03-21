import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadAppSettingsFromDisk } from "./persistence";
import { applyThemeToDocument } from "./themeApply";
import type { AppSettings, SettingsSectionId } from "./types";
import type { SettingsPersistenceState } from "./persistenceState";
import {
  getAppSettings,
  hydrateAppSettings,
  patchAppSettings,
  resetSettingsSection,
  subscribeAppSettings,
  getSettingsPersistenceState,
  setSettingsPersistenceState,
  subscribePersistenceState,
  type DeepPartialAppSettings,
} from "./store";

export type SettingsContextValue = {
  settings: AppSettings;
  /** True after first load from disk (or fallback) completes. */
  hydrated: boolean;
  persistenceState: SettingsPersistenceState;
  /** True if the main settings file was corrupt and replaced on last load. */
  corruptRestoredOnLoad: boolean;
  /** Optional raw message for dev / expandable details only. */
  persistenceTechnicalDetail: string | null;
  patch: (partial: DeepPartialAppSettings) => void;
  resetSection: (section: SettingsSectionId) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [hydrated, setHydrated] = useState(false);
  const [persistenceState, setPersistenceState] = useState<SettingsPersistenceState>(() =>
    getSettingsPersistenceState(),
  );
  const [corruptRestoredOnLoad, setCorruptRestoredOnLoad] = useState(false);
  const [persistenceTechnicalDetail, setPersistenceTechnicalDetail] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAppSettings(() => {
      setSettings(getAppSettings());
    });
  }, []);

  useEffect(() => {
    return subscribePersistenceState(() => {
      setPersistenceState(getSettingsPersistenceState());
    });
  }, []);

  useEffect(() => {
    if (persistenceState !== "defaults_only") {
      setPersistenceTechnicalDetail(null);
    }
  }, [persistenceState]);

  useEffect(() => {
    void loadAppSettingsFromDisk().then((r) => {
      hydrateAppSettings(r.settings);
      setSettings(getAppSettings());
      setSettingsPersistenceState(r.persistenceState);
      applyThemeToDocument(r.settings.general.theme);
      setCorruptRestoredOnLoad(r.corruptRestored);
      setPersistenceTechnicalDetail(
        r.persistenceState === "defaults_only" && r.lastFilesystemError ? r.lastFilesystemError : null,
      );
      setHydrated(true);
    });
  }, []);

  const patch = useCallback((partial: DeepPartialAppSettings) => {
    patchAppSettings(partial);
    if (partial.general?.theme !== undefined) {
      applyThemeToDocument(getAppSettings().general.theme);
    }
  }, []);

  const resetSectionCb = useCallback((section: SettingsSectionId) => {
    resetSettingsSection(section);
    applyThemeToDocument(getAppSettings().general.theme);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      hydrated,
      persistenceState,
      corruptRestoredOnLoad,
      persistenceTechnicalDetail,
      patch,
      resetSection: resetSectionCb,
    }),
    [
      settings,
      hydrated,
      persistenceState,
      corruptRestoredOnLoad,
      persistenceTechnicalDetail,
      patch,
      resetSectionCb,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
