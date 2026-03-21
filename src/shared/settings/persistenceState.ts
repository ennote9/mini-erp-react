/**
 * Where durable settings are actually being stored. Drives calm vs warning UX on the Settings page.
 */
export type SettingsPersistenceState =
  /** AppLocalData file path is available; settings load/save via JSON file. */
  | "file_persisted"
  /** File path unavailable or failed; durable saves use localStorage (or equivalent). */
  | "fallback_persisted"
  /** Neither file nor localStorage persistence is working; in-memory defaults only for this run. */
  | "defaults_only";
