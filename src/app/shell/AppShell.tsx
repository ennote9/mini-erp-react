import { Outlet } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./Sidebar/AppSidebar";
import { PageTopBar } from "./PageTopBar/PageTopBar";
import {
  flushAllPendingPersistence,
  hasPendingPersistence,
  listPendingPersistenceModules,
  PersistenceFlushError,
} from "@/shared/persistenceCoordinator";
import { useTranslation } from "@/shared/i18n";

/**
 * App shell: shadcn Sidebar (left) + main workspace (right).
 * Desktop-first. Page content renders via Outlet.
 */
export function AppShell() {
  const { t } = useTranslation();
  const [showSavingOverlay, setShowSavingOverlay] = useState(false);
  const isFlushingRef = useRef(false);
  const closeAfterFlushRef = useRef(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const w = getCurrentWindow();
        unlisten = await w.onCloseRequested(async (event) => {
          if (closeAfterFlushRef.current) return;
          event.preventDefault();
          if (isFlushingRef.current) return;

          isFlushingRef.current = true;
          const overlayTimer = window.setTimeout(() => {
            setShowSavingOverlay(true);
          }, 2000);

          try {
            if (hasPendingPersistence()) {
              await flushAllPendingPersistence();
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              if (e instanceof PersistenceFlushError) {
                console.error("[persistence] flush failures:", e.failures);
              } else {
                console.error("[persistence] flush failed:", e);
              }
              console.error(
                "[persistence] pending modules before close:",
                listPendingPersistenceModules(),
              );
            }
          } finally {
            window.clearTimeout(overlayTimer);
            setShowSavingOverlay(false);
            isFlushingRef.current = false;
          }

          closeAfterFlushRef.current = true;
          await w.close();
        });
      } catch {
        // Non-Tauri environment.
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="app-workspace flex min-h-svh flex-1 flex-col">
          <PageTopBar />
          <div className="app-page-content">
            <Outlet />
          </div>
          {showSavingOverlay ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55">
              <div className="rounded-md border border-white/15 bg-card px-4 py-3 text-sm text-card-foreground shadow-lg">
                {t("app.savingBeforeExit")}
              </div>
            </div>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
