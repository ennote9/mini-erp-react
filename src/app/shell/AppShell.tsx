import { Outlet } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./Sidebar/AppSidebar";
import { PageTopBar } from "./PageTopBar/PageTopBar";

/**
 * App shell: shadcn Sidebar (left) + main workspace (right).
 * Desktop-first. Page content renders via Outlet.
 */
export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="app-workspace flex min-h-svh flex-1 flex-col">
          <PageTopBar />
          <div className="app-page-content">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
