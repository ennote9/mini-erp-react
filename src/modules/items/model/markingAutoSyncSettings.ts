/**
 * App-driven automatic marking sync (foreground scheduler while the app is open).
 * Stored separately from {@link MarkingProviderSettings}.
 */

export type MarkingAutoSyncScope = "problem_only" | "printed_and_reserved" | "recent_activity" | "custom";

export interface MarkingAutoSyncSettings {
  isEnabled: boolean;
  /** Minimum 1 minute for the interval timer. */
  intervalMinutes: number;
  scope: MarkingAutoSyncScope;
  maxRecordsPerRun: number;
  runOnAppStart: boolean;
  /** Skip when provider integration toggle is off. */
  runOnlyWhenProviderEnabled: boolean;
  /** When true, auto-sync does not run in mock mode (shows a clear scheduler message). */
  runOnlyInRealMode: boolean;
  updatedAt: string;
}

export const DEFAULT_MARKING_AUTO_SYNC_SETTINGS: Omit<MarkingAutoSyncSettings, "updatedAt"> = {
  isEnabled: false,
  intervalMinutes: 15,
  scope: "problem_only",
  maxRecordsPerRun: 50,
  runOnAppStart: false,
  runOnlyWhenProviderEnabled: true,
  runOnlyInRealMode: true,
};
