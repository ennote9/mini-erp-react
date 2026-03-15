import type { ReactNode } from "react";

/** Placeholder form layout. Do not implement real UI yet. */
export function FormLayout({ children }: { children: ReactNode }) {
  return <div data-ui="form-layout">{children}</div>;
}
