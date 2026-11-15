import {
  AlertTriangle,
  Download,
  Library,
  ListMusic,
  Moon,
  Palette,
  Radio,
  Settings,
  Sun,
} from "lucide-react";
import React, { useMemo } from "react";
import { Badge } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { NavigationTab } from "@/types/models";

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Sidebar = React.memo(({ activeTab, onSelectTab }: SidebarProps) => {
  const workspace = useLibraryStore((s) => s.workspace);
  const appSettings = useLibraryStore((s) => s.appSettings);
  const selectWorkspace = useLibraryStore((s) => s.selectWorkspace);
  const missingCount = useLibraryStore((s) => s.missingTracks.length);
  const trackCount = useLibraryStore((s) => s.tracks.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  const health = useLibraryStore((s) => s.health);

  const mode = useThemeStore((s) => s.mode);
  const colorFamily = useThemeStore((s) => s.colorFamily);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const setColorFamily = useThemeStore((s) => s.setColorFamily);

  const connectionState = useDownloadStore((s) => s.connectionState);
  const tasks = useDownloadStore((s) => s.tasks);

  const activeDownloadsCount = useMemo(
    () =>
      Object.values(tasks).filter(
        (t) =>
          t.status === "queued" ||
          t.status === "downloading" ||
          t.status === "processing",
      ).length,
    [tasks],
  );

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeTone?: "default" | "warning" | "info";
  }> = [
    {
      id: "library",
      label: "Biblioteca",
      icon: Library,
      badge: trackCount,
      badgeTone: "default",
    },
    {
      id: "playlists",
      label: "Playlists",
      icon: ListMusic,
      badge: playlistCount,
      badgeTone: "default",
    },
    {
      id: "downloads",
      label: "Descargas",
      icon: Download,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
      badgeTone: "info",
    },
    {
      id: "recovery",
      label: "Recuperación",
      icon: AlertTriangle,
      badge: missingCount > 0 ? missingCount : undefined,
      badgeTone: "warning",
    },
  ];

  const isGoOnline = health?.status === "healthy";

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-primary bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary bg-primary/15 text-primary shadow-xs">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">ytms-player</h1>
          <p className="text-xs text-muted-foreground">YouTube Audio Desktop</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.badge !== undefined && (
                <Badge tone={item.badgeTone}>{item.badge}</Badge>
              )}
            </button>
          );
        })}

        <div className="pt-4">
          <button
            type="button"
            onClick={() => onSelectTab("workspace")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === "workspace"
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              Configuración
            </span>
          </button>
        </div>
      </nav>

      {/* Selector rápido de Tema y Modo */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">Tema:</span>
          <button
            type="button"
            title="Paleta Azul / Lavanda"
            onClick={() => setColorFamily("blue")}
            className={cn(
              "h-5 rounded px-1.5 text-[10px] font-semibold transition border",
              colorFamily === "blue"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-muted text-muted-foreground border-border hover:text-foreground",
            )}
          >
            Blue
          </button>
          <button
            type="button"
            title="Paleta Verde / Spruce"
            onClick={() => setColorFamily("teal")}
            className={cn(
              "h-5 rounded px-1.5 text-[10px] font-semibold transition border",
              colorFamily === "teal"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-muted text-muted-foreground border-border hover:text-foreground",
            )}
          >
            Teal
          </button>
          <button
            type="button"
            title="Paleta Ember / Fuego"
            onClick={() => setColorFamily("ember")}
            className={cn(
              "h-5 rounded px-1.5 text-[10px] font-semibold transition border",
              colorFamily === "ember"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-muted text-muted-foreground border-border hover:text-foreground",
            )}
          >
            Ember
          </button>
        </div>

        <button
          type="button"
          title={mode === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          onClick={toggleMode}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/80 text-foreground transition hover:bg-muted"
        >
          {mode === "dark" ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-primary" />
          )}
        </button>
      </div>

      <div className="space-y-2 border-t border-border p-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Microservicio Go</span>
          <Badge tone={isGoOnline ? "success" : "danger"}>
            {isGoOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Stream SSE</span>
          <Badge
            tone={
              connectionState === "connected"
                ? "info"
                : connectionState === "connecting"
                  ? "warning"
                  : "default"
            }
          >
            {connectionState}
          </Badge>
        </div>

        <div className="pt-1">
          {appSettings && appSettings.recent_workspaces.length > 0 ? (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Cambiar Workspace:
              </span>
              <select
                aria-label="Cambiar Workspace activo"
                value={workspace?.root_path ?? ""}
                onChange={(e) => {
                  if (e.target.value) {
                    void selectWorkspace(e.target.value);
                  }
                }}
                className="h-8 w-full truncate rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {!workspace && (
                  <option value="" disabled>
                    Seleccionar Workspace...
                  </option>
                )}
                {appSettings.recent_workspaces.map((ws) => (
                  <option key={ws.path} value={ws.path}>
                    {ws.name} ({ws.path})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p
              className="truncate text-[11px] text-muted-foreground"
              title={workspace?.root_path}
            >
              {workspace ? `WS: ${workspace.root_path}` : "Sin Workspace seleccionado"}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
