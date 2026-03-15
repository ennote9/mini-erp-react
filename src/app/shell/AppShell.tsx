import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar/Sidebar";
import { PageTopBar } from "./PageTopBar/PageTopBar";

/**
 * App shell: sidebar (left) + main workspace (right).
 * Desktop-first. Page content renders via Outlet.
 */
export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-workspace">
        <PageTopBar />
        <div className="app-page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
