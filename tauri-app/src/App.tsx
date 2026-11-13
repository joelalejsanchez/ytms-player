import { AlertCircle, FolderCog, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/Primitives";
import { DownloadsView } from "@/features/downloads/DownloadsView";
import { LibraryView } from "@/features/library/LibraryView";
import { PlaylistsView } from "@/features/playlists/PlaylistsView";
import { MissingFilesView } from "@/features/recovery/MissingFilesView";
import { WorkspaceSettingsView } from "@/features/workspace/WorkspaceSettingsView";
import { useSseProgress } from "@/hooks/useSseProgress";
import { useLibraryStore } from "@/stores/useLibraryStore";
import type { NavigationTab } from "@/types/models";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("library");

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

  const handleSelectTab = useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onSelectTab={handleSelectTab} />

        <main className="flex flex-1 flex-col overflow-hidden p-6">
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-800/80 bg-rose-950/60 px-4 py-2.5 text-xs text-rose-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-rose-400 hover:text-white"
                aria-label="Cerrar alerta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!workspace && activeTab !== "workspace" && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
              <span>
                No has seleccionado un directorio Workspace activo. Configura uno para
                almacenar tus pistas y base de datos SQLite.
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab("workspace")}
              >
                <FolderCog className="h-4 w-4" />
                Configurar Workspace
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {activeTab === "library" && <LibraryView />}
            {activeTab === "playlists" && <PlaylistsView />}
            {activeTab === "downloads" && <DownloadsView />}
            {activeTab === "recovery" && <MissingFilesView />}
            {activeTab === "workspace" && <WorkspaceSettingsView />}
          </div>
        </main>
      </div>

      <PersistentPlayer />
    </div>
  );
};

export default App;
