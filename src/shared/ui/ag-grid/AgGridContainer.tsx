import { forwardRef } from "react";
import type { ReactNode } from "react";
import { useSettings } from "@/shared/settings/SettingsContext";

type AgGridContainerProps = {
  /** Theme/scoping class for dark styling (e.g. "stock-movements-grid"). Must match a block in App.css. */
  themeClass: string;
  children: ReactNode;
};

/**
 * Shared wrapper for list-page AG Grids. Fills available height in the list-page
 * content area so the grid stretches. Use with AgGridReact as child. Dark theme
 * is applied via themeClass in App.css.
 */
export const AgGridContainer = forwardRef<HTMLDivElement, AgGridContainerProps>(
  function AgGridContainer({ themeClass, children }, ref) {
    const { settings } = useSettings();
    const isLight =
      settings.general.theme !== "dark" &&
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("light");

    return (
      <div
        ref={ref}
        className={`${isLight ? "ag-theme-quartz" : "ag-theme-quartz-dark"} erp-ag-grid ${themeClass} flex min-h-0 w-full flex-1 flex-col`.trim()}
      >
        {children}
      </div>
    );
  },
);
