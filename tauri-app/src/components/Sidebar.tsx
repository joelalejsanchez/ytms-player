import {
  AlertTriangle,
  Bug,
  Download,
  Home,
  Library,
  ListMusic,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { APP_VERSION } from "@/config/version";
import { CustomSelect, type SelectOption } from "@/components/ui/CustomSelect";
import { Badge } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useLogStore } from "@/stores/useLogStore";
import { type ColorFamily, useThemeStore } from "@/stores/useThemeStore";
import type { NavigationTab } from "@/types/models";

const COLOR_OPTIONS: SelectOption<ColorFamily>[] = [
  {
    value: "blue",
    label: "Blue",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#4c4c9d" }}
      />
    ),
  },
  {
    value: "teal",
    label: "Teal",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#0a8754" }}
      />
    ),
  },
  {
    value: "ember",
    label: "Ember",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#d00000" }}
      />
    ),
  },
  {
    value: "midnight",
    label: "Midnight",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#010736" }}
      />
    ),
  },
  {
    value: "denim",
    label: "Denim",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#253C6D" }}
      />
    ),
  },
  {
    value: "pine",
    label: "Pine",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#123F36" }}
      />
    ),
  },
  {
    value: "burgundy",
    label: "Burgundy",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#800020" }}
      />
    ),
  },
  {
    value: "amber",
    label: "Amber",
    icon: (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
        style={{ backgroundColor: "#FFBF00" }}
      />
    ),
  },
];

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Sidebar = React.memo(({ activeTab, onSelectTab }: SidebarProps) => {
  const missingCount = useLibraryStore((s) => s.missingTracks.length);
  const trackCount = useLibraryStore((s) => s.tracks.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);

  const errorLogs = useLogStore((s) => s.logs);
  const setOpenLogModal = useLogStore((s) => s.setOpenModal);
  const errorCount = useMemo(
    () => errorLogs.filter((l) => l.level === "error").length,
    [errorLogs],
  );

  const mode = useThemeStore((s) => s.mode);
  const colorFamily = useThemeStore((s) => s.colorFamily);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const setColorFamily = useThemeStore((s) => s.setColorFamily);

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

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("yt_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("yt_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  const primaryNavItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeTone?: "default" | "warning" | "info";
  }> = [
    {
      id: "home",
      label: "Inicio",
      icon: Home,
    },
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
  ];

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-card transition-all duration-200 select-none",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Encabezado / Logo con acción de colapso */}
      <div
        className={cn(
          "flex items-center border-b border-border py-4 transition-all",
          isCollapsed ? "justify-center px-2" : "gap-3 px-5",
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          title={
            isCollapsed
              ? `Expandir barra lateral (v${APP_VERSION})`
              : `Contraer barra lateral (v${APP_VERSION})`
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary/15 text-primary shadow-xs transition hover:bg-primary/25 cursor-pointer"
        >
          <AppLogo className="h-5 w-5" />
        </button>

        {!isCollapsed && (
          <div className="min-w-0 overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight text-foreground truncate">
              Your Tracks Music Server
            </h1>
            <p className="text-[11px] text-muted-foreground truncate font-mono">
              v{APP_VERSION}
            </p>
          </div>
        )}
      </div>

      {/* Funcionalidad Principal: Biblioteca, Playlists, Descargas */}
      <nav className={cn("flex-1 space-y-1", isCollapsed ? "p-2" : "p-3")}>
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              title={`${item.label}${item.badge !== undefined ? ` (${item.badge})` : ""}`}
              className={cn(
                "relative flex items-center rounded-lg transition-colors",
                isCollapsed
                  ? "h-10 w-10 mx-auto justify-center p-0"
                  : "w-full justify-between px-3 py-2.5 text-sm font-medium",
                isActive
                  ? "bg-primary/15 text-primary ring-1 ring-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {isCollapsed ? (
                <Icon className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <Badge tone={item.badgeTone}>{item.badge}</Badge>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Funcionalidad Secundaria (Totalmente Abajo): Tema, Recuperación, Configuración */}
      <div
        className={cn(
          "mt-auto border-t border-border space-y-2",
          isCollapsed ? "p-2" : "p-3",
        )}
      >
        {/* Selector rápido de Tema y Modo */}
        <div
          className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}
        >
          {!isCollapsed && (
            <CustomSelect<ColorFamily>
              value={colorFamily}
              onChange={setColorFamily}
              options={COLOR_OPTIONS}
              direction="up"
              className="flex-1 min-w-0"
              triggerClassName="w-full h-8 text-xs bg-muted/40 hover:bg-muted/60"
              ariaLabel="Seleccionar tema visual"
            />
          )}

          <button
            type="button"
            title={mode === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            onClick={toggleMode}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted cursor-pointer"
          >
            {mode === "dark" ? (
              <Sun className="h-4 w-4 text-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-primary" />
            )}
          </button>
        </div>

        {/* Navegación secundaria: Recuperación y Configuración */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectTab("recovery")}
            title={`Recuperación${missingCount > 0 ? ` (${missingCount})` : ""}`}
            className={cn(
              "relative flex items-center rounded-lg transition-colors",
              isCollapsed
                ? "h-10 w-10 mx-auto justify-center p-0"
                : "w-full justify-between px-3 py-2 text-sm font-medium",
              activeTab === "recovery"
                ? "bg-primary/15 text-primary ring-1 ring-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {isCollapsed ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <span className="flex items-center gap-3 min-w-0">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="truncate">Recuperación</span>
                </span>
                {missingCount > 0 && <Badge tone="warning">{missingCount}</Badge>}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("workspace")}
            title="Configuración"
            className={cn(
              "flex items-center rounded-lg transition-colors",
              isCollapsed
                ? "h-10 w-10 mx-auto justify-center p-0"
                : "w-full justify-start gap-3 px-3 py-2 text-sm font-medium",
              activeTab === "workspace"
                ? "bg-primary/15 text-primary ring-1 ring-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Configuración</span>}
          </button>

          <button
            type="button"
            onClick={() => setOpenLogModal(true)}
            title={`Registro de Errores${errorCount > 0 ? ` (${errorCount} errores)` : ""}`}
            className={cn(
              "flex items-center rounded-lg transition-colors",
              isCollapsed
                ? "h-10 w-10 mx-auto justify-center p-0"
                : "w-full justify-between px-3 py-2 text-sm font-medium",
              errorCount > 0
                ? "text-rose-500 hover:bg-rose-500/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {isCollapsed ? (
              <Bug className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <span className="flex items-center gap-3 min-w-0">
                  <Bug className="h-4 w-4 shrink-0" />
                  <span className="truncate">Logs de errores</span>
                </span>
                {errorCount > 0 && <Badge tone="danger">{errorCount}</Badge>}
              </>
            )}
          </button>
        </div>

        {!isCollapsed && (
          <div className="pt-2 text-center select-none">
            <span className="font-mono text-[10px] text-muted-foreground/60">
              ytms-player v{APP_VERSION}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
