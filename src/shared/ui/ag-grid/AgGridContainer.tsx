import type { ReactNode } from "react";

const DEFAULT_HEIGHT_PX = 500;

type AgGridContainerProps = {
  /** Theme/scoping class for dark styling (e.g. "stock-movements-grid"). Must match a block in App.css. */
  themeClass: string;
  children: ReactNode;
  /** Optional override for grid height in px. Default 500. */
  height?: number;
};

/**
 * Shared wrapper for list-page AG Grids. Applies theme container and stable height.
 * Use with AgGridReact as child. Dark theme is applied via themeClass in App.css.
 */
export function AgGridContainer({
  themeClass,
  children,
  height = DEFAULT_HEIGHT_PX,
}: AgGridContainerProps) {
  return (
    <div
      className={`ag-theme-quartz-dark ${themeClass}`.trim()}
      style={{
        width: "100%",
        height: `${height}px`,
      }}
    >
      {children}
    </div>
  );
}
