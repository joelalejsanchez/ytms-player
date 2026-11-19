import { FolderCog } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/Primitives";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { DownloadsView } from "@/features/downloads/DownloadsView";
import { ErrorLogsModal } from "@/features/diagnostics/ErrorLogsModal";
import { HomeView } from "@/features/home/HomeView";
import { LibraryView } from "@/features/library/LibraryView";
import { PlaylistsView } from "@/features/playlists/PlaylistsView";
import { MissingFilesView } from "@/features/recovery/MissingFilesView";
import { NowPlayingView } from "@/features/visualizer";
import { WorkspaceSettingsView } from "@/features/workspace/WorkspaceSettingsView";
import { useSseProgress } from "@/hooks/useSseProgress";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { logger } from "@/stores/useLogStore";
import { toast } from "@/stores/useToastStore";
import type { NavigationTab } from "@/types/models";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("home");

  // Conectar stream SSE persistente (/api/progress/stream)
  useSseProgress();

  const workspace = useLibraryStore((s) => s.workspace);
  const error = useLibraryStore((s) => s.error);
  const clearError = useLibraryStore((s) => s.clearError);
  const loadInitialState = useLibraryStore((s) => s.loadInitialState);
  const checkHealth = useLibraryStore((s) => s.checkHealth);

  useEffect(() => {
    void loadInitialState();
    void checkHealth();
  }, [loadInitialState, checkHealth]);

  // Capturar errores no controlados y promesas rechazadas para la auditoría de la sesión
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      logger.error("Error de ejecución no controlado", event.message, "runtime", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error ? event.reason.message : String(event.reason);
      logger.error("Promesa rechazada no controlada", reason, "runtime");
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // Despachar errores globales como toasts no intrusivos sin empujar el layout
  useEffect(() => {
    if (error) {
      toast.error("Atención", error, 4000);
      clearError();
    }
  }, [error, clearError]);

  const handleSelectTab = useCallback(
    (tab: NavigationTab) => {
      if (tab === "playlists" && activeTab === "playlists") {
        void useLibraryStore.getState().selectPlaylist(null);
      }
      setActiveTab(tab);
    },
    [activeTab],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground transition-colors duration-200">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onSelectTab={handleSelectTab} />

        <main className="flex flex-1 flex-col overflow-hidden p-6">
          {!workspace && activeTab !== "workspace" && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
              <span>
                No has seleccionado una carpeta activa. Configura una para guardar tus
                canciones y listas de reproducción.
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab("workspace")}
              >
                <FolderCog className="h-4 w-4" />
                Configurar carpeta
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {activeTab === "home" && <HomeView onNavigate={handleSelectTab} />}
            {activeTab === "library" && <LibraryView />}
            {activeTab === "playlists" && <PlaylistsView />}
            {activeTab === "downloads" && <DownloadsView />}
            {activeTab === "recovery" && <MissingFilesView />}
            {activeTab === "workspace" && <WorkspaceSettingsView />}
          </div>
        </main>
      </div>

      <PersistentPlayer />
      <NowPlayingView />
      <ToastContainer />
      <ErrorLogsModal />
    </div>
  );
};

export default App;
