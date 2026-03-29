import { forwardRef } from "react";
import type { ReactNode } from "react";

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
    return (
      <div
        ref={ref}
        className={`ag-theme-quartz-dark ${themeClass} flex min-h-0 w-full flex-1 flex-col`.trim()}
      >
        {children}
      </div>
    );
  },
);
