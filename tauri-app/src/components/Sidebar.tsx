import {
  AlertTriangle,
  Download,
  FolderCog,
  Library,
  ListMusic,
  Radio,
} from "lucide-react";
import React, { useMemo } from "react";
import { Badge } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
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
    {
      id: "workspace",
      label: "Workspace",
      icon: FolderCog,
    },
  ];

  const isGoOnline = health?.status === "healthy";

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/75">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/20 text-red-500 ring-1 ring-red-500/30">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">
            ytms-player
          </h1>
          <p className="text-xs text-slate-400">YouTube Audio Desktop</p>
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
                  ? "bg-red-600/15 text-red-400 ring-1 ring-red-500/30"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
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
      </nav>

      <div className="space-y-2 border-t border-slate-800 p-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Microservicio Go</span>
          <Badge tone={isGoOnline ? "success" : "danger"}>
            {isGoOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Stream SSE</span>
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
              <span className="text-[11px] font-medium text-slate-400">
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
                className="h-8 w-full truncate rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
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
              className="truncate text-[11px] text-slate-500"
              title={workspace?.root_path}
            >
              {workspace
                ? `WS: ${workspace.root_path}`
                : "Sin Workspace seleccionado"}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
