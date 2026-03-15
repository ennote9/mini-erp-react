import type { ReactNode } from "react";

type Props = { title: string; children?: ReactNode };

export function SidebarGroup({ title, children }: Props) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-group__title">{title}</div>
      <div className="sidebar-group__links">{children}</div>
    </div>
  );
}
