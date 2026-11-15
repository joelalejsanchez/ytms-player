import {
  AlertTriangle,
  Download,
  Library,
  ListMusic,
  Moon,
  Radio,
  Settings,
  Sun,
} from "lucide-react";
import React, { useMemo } from "react";
import { CustomSelect, type SelectOption } from "@/components/ui/CustomSelect";
import { Badge } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
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

  const primaryNavItems: Array<{
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
  ];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      {/* Encabezado / Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary bg-primary/15 text-primary shadow-xs">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">
            ytms-player
          </h1>
          <p className="text-xs text-muted-foreground">YouTube Audio Desktop</p>
        </div>
      </div>

      {/* Funcionalidad Principal: Biblioteca, Playlists, Descargas */}
      <nav className="flex-1 space-y-1 p-3">
        {primaryNavItems.map((item) => {
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
                  ? "bg-primary/15 text-primary ring-1 ring-primary"
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
      </nav>

      {/* Funcionalidad Secundaria (Totalmente Abajo): Tema, Recuperación, Configuración */}
      <div className="mt-auto border-t border-border p-3 space-y-2">
        {/* Selector rápido de Tema y Modo */}
        <div className="flex items-center gap-2">
          <CustomSelect<ColorFamily>
            value={colorFamily}
            onChange={setColorFamily}
            options={COLOR_OPTIONS}
            direction="up"
            className="flex-1 min-w-0"
            triggerClassName="w-full h-8 text-xs bg-muted/40 hover:bg-muted/60"
            ariaLabel="Seleccionar tema visual"
          />

          <button
            type="button"
            title={mode === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            onClick={toggleMode}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted"
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
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === "recovery"
                ? "bg-primary/15 text-primary ring-1 ring-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-foreground" />
              Recuperación
            </span>
            {missingCount > 0 && <Badge tone="warning">{missingCount}</Badge>}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("workspace")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === "workspace"
                ? "bg-primary/15 text-primary ring-1 ring-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              Configuración
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
