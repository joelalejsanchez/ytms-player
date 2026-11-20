import {
  Activity,
  AlertCircle,
  AudioWaveform,
  Bug,
  Check,
  CheckCircle2,
  Cookie,
  Disc3,
  Download,
  Edit2,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Info,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Music,
  Palette,
  RefreshCw,
  Server,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Badge, Button, Input, RadioButton } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useLogStore } from "@/stores/useLogStore";
import { getAllVisualizers, useVisualizerStore } from "@/features/visualizer";
import { usePlayerStore } from "@/stores/usePlayerStore";
import {
  type ColorFamily,
  type ThemeMode,
  useThemeStore,
} from "@/stores/useThemeStore";

interface ColorPaletteOption {
  id: ColorFamily;
  name: string;
  description: string;
  colors: Array<{ name: string; hex: string }>;
}

const COLOR_PALETTES: ColorPaletteOption[] = [
  {
    id: "blue",
    name: "Blue & Lavender",
    description: "Baltic Blue, Ocean Twilight & Vintage Lavender",
    colors: [
      { name: "Ocean Twilight", hex: "#4c4c9d" },
      { name: "Baltic Blue", hex: "#48639c" },
      { name: "Vintage Lavender", hex: "#976391" },
      { name: "Platinum", hex: "#eef0f2" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "teal",
    name: "Teal & Spruce",
    description: "Sea Green, Air Force Blue & Dark Spruce",
    colors: [
      { name: "Sea Green", hex: "#0a8754" },
      { name: "Air Force Blue", hex: "#508ca4" },
      { name: "Dark Spruce", hex: "#004f2d" },
      { name: "Platinum", hex: "#eef0f2" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "ember",
    name: "Ember & Flame",
    description: "Brick Ember, Amber Flame & Steel Blue",
    colors: [
      { name: "Brick Ember", hex: "#d00000" },
      { name: "Amber Flame", hex: "#ffba08" },
      { name: "Steel Blue", hex: "#3f88c5" },
      { name: "Platinum", hex: "#eef0f2" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "midnight",
    name: "Midnight Navy (#010736)",
    description: "Monocromático azul noche profundo de alta elegancia",
    colors: [
      { name: "Midnight", hex: "#010736" },
      { name: "Deep Navy", hex: "#1a2559" },
      { name: "Indigo", hex: "#2c3a7d" },
      { name: "Soft Blue", hex: "#4d62b5" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "denim",
    name: "Denim Navy (#253C6D)",
    description: "Monocromático azul denim clásico y equilibrado",
    colors: [
      { name: "Denim", hex: "#253C6D" },
      { name: "Royal", hex: "#3b5a96" },
      { name: "Steel", hex: "#5274b5" },
      { name: "Sky Mist", hex: "#5c82ca" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "pine",
    name: "Pine Green (#123F36)",
    description: "Monocromático verde pino bosque profundo y sereno",
    colors: [
      { name: "Pine", hex: "#123F36" },
      { name: "Forest", hex: "#1c574b" },
      { name: "Spruce", hex: "#297566" },
      { name: "Mint Tint", hex: "#38a390" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "burgundy",
    name: "Burgundy Wine (#800020)",
    description: "Monocromático burdeos vinotinto sobrio y refinado",
    colors: [
      { name: "Burgundy", hex: "#800020" },
      { name: "Crimson", hex: "#a31538" },
      { name: "Wine Rose", hex: "#c42951" },
      { name: "Berry", hex: "#dc3e66" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
  {
    id: "amber",
    name: "Amber Gold (#FFBF00)",
    description: "Monocromático ámbar dorado enérgico y cálido",
    colors: [
      { name: "Amber", hex: "#FFBF00" },
      { name: "Gold", hex: "#e6ac00" },
      { name: "Deep Amber", hex: "#d9a300" },
      { name: "Warm Ochre", hex: "#b38600" },
      { name: "Onyx", hex: "#0A0A0C" },
    ],
  },
];

interface ThemeModeOption {
  id: ThemeMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const THEME_MODES: ThemeModeOption[] = [
  {
    id: "light",
    label: "Modo Claro",
    description: "Fondo claro con alto contraste",
    icon: Sun,
  },
  {
    id: "dark",
    label: "Modo Oscuro",
    description: "Fondo oscuro para descansar la vista",
    icon: Moon,
  },
  {
    id: "system",
    label: "Modo Sistema",
    description: "Se adapta automáticamente al tema de tu equipo",
    icon: Monitor,
  },
];

export const WorkspaceSettingsView = React.memo(() => {
  const workspace = useLibraryStore((s) => s.workspace);
  const appSettings = useLibraryStore((s) => s.appSettings);
  const health = useLibraryStore((s) => s.health);
  const oauthStatus = useLibraryStore((s) => s.oauthStatus);
  const selectWorkspace = useLibraryStore((s) => s.selectWorkspace);
  const removeSavedWorkspace = useLibraryStore((s) => s.removeSavedWorkspace);
  const importCookiesFile = useLibraryStore((s) => s.importCookiesFile);
  const checkHealth = useLibraryStore((s) => s.checkHealth);
  const checkOAuthStatus = useLibraryStore((s) => s.checkOAuthStatus);
  const openOAuthLogin = useLibraryStore((s) => s.openOAuthLogin);

  const microserviceUrl = useDownloadStore((s) => s.microserviceUrl);
  const setMicroserviceUrl = useDownloadStore((s) => s.setMicroserviceUrl);

  const mode = useThemeStore((s) => s.mode);
  const colorFamily = useThemeStore((s) => s.colorFamily);
  const setMode = useThemeStore((s) => s.setMode);
  const setColorFamily = useThemeStore((s) => s.setColorFamily);

  const activeVisualizerId = useVisualizerStore((s) => s.activeVisualizerId);
  const setActiveVisualizer = useVisualizerStore((s) => s.setActiveVisualizer);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [hoveredVisualizerId, setHoveredVisualizerId] = useState<string | null>(null);

  // Estados para Microservicio
  const [urlInput, setUrlInput] = useState(microserviceUrl);
  const [isEditingUrl, setIsEditingUrl] = useState(!microserviceUrl);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Estados para Cookies y OAuth
  const [cookiesInput, setCookiesInput] = useState(
    appSettings?.cookies_file_path ?? "",
  );
  const [isEditingCookies, setIsEditingCookies] = useState(
    !appSettings?.cookies_file_path,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Estados para Registro de Errores (Error Logs)
  const errorLogs = useLogStore((s) => s.logs);
  const setOpenLogModal = useLogStore((s) => s.setOpenModal);
  const clearErrorLogs = useLogStore((s) => s.clearLogs);
  const openLogsFolder = useLogStore((s) => s.openLogsFolder);

  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isLoggingOutOAuth, setIsLoggingOutOAuth] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCheckingOAuth, setIsCheckingOAuth] = useState(false);
  const [isImportingCookies, setIsImportingCookies] = useState(false);

  // Estados para Workspaces
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string | null>(null);
  const [removingWorkspace, setRemovingWorkspace] = useState<string | null>(null);
  const [workspaceErrorModal, setWorkspaceErrorModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: "",
  });

  // Sincronizar input de URL si cambia en store
  useEffect(() => {
    setUrlInput(microserviceUrl);
    if (microserviceUrl) {
      setIsEditingUrl(false);
    }
  }, [microserviceUrl]);

  // Sincronizar input de cookies si cambia en store
  useEffect(() => {
    if (appSettings?.cookies_file_path) {
      setCookiesInput(appSettings.cookies_file_path);
      setIsEditingCookies(false);
    }
  }, [appSettings?.cookies_file_path]);

  // Actualizar estado OAuth automáticamente al enfocar la app
  useEffect(() => {
    void checkOAuthStatus();
    const onFocus = () => {
      void checkOAuthStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkOAuthStatus]);

  /* ================== HANDLERS: PERSONALIZACIÓN ================== */
  const handleSelectPalette = useCallback(
    (paletteId: ColorFamily) => {
      setColorFamily(paletteId);
    },
    [setColorFamily],
  );

  const handleSelectMode = useCallback(
    (modeId: ThemeMode) => {
      setMode(modeId);
    },
    [setMode],
  );

  /* ================== HANDLERS: WORKSPACES ================== */
  const handleAddWorkspace = useCallback(async () => {
    setIsAddingWorkspace(true);
    setGeneralError(null);
    try {
      const picked = await tauriApi.pickWorkspaceFolder();
      if (!picked) {
        return;
      }
      await selectWorkspace(picked);
      setStatusMessage(`Workspace agregado y activado correctamente.`);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "No se pudo inicializar la carpeta como Workspace.";
      setWorkspaceErrorModal({
        isOpen: true,
        message: errorMsg,
      });
    } finally {
      setIsAddingWorkspace(false);
    }
  }, [selectWorkspace]);

  const handleSwitchWorkspace = useCallback(
    async (path: string) => {
      if (workspace?.root_path === path) return;
      setSwitchingWorkspace(path);
      try {
        await selectWorkspace(path);
        setStatusMessage(`Cambiado a Workspace: ${path}`);
      } catch (err) {
        setGeneralError(
          err instanceof Error ? err.message : "Error al cambiar de Workspace",
        );
      } finally {
        setSwitchingWorkspace(null);
      }
    },
    [workspace?.root_path, selectWorkspace],
  );

  /* ================== HANDLERS: MICROSERVICIO ================== */
  const handleTestAndSaveUrl = useCallback(async () => {
    setUrlError(null);
    const cleaned = urlInput.trim();
    if (!cleaned) {
      setUrlError("Por favor introduce una URL válida");
      return;
    }
    setIsTestingUrl(true);
    try {
      await setMicroserviceUrl(cleaned);
      await checkHealth();
      setIsEditingUrl(false);
      setStatusMessage("URL del microservicio actualizada y verificada correctamente.");
    } catch (err) {
      setUrlError(
        err instanceof Error
          ? err.message
          : "No se pudo conectar con el microservicio en esa URL",
      );
    } finally {
      setIsTestingUrl(false);
    }
  }, [urlInput, setMicroserviceUrl, checkHealth]);

  const handleCheckHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      await checkHealth();
    } finally {
      setIsCheckingHealth(false);
    }
  }, [checkHealth]);

  /* ================== HANDLERS: YOUTUBE ACCOUNT ================== */
  const handleConnectOAuth = useCallback(async () => {
    setGeneralError(null);
    setStatusMessage(null);
    setIsConnectingOAuth(true);
    try {
      await openOAuthLogin();
      setStatusMessage(
        "Se abrió la pantalla de consentimiento de Google en tu navegador. Autoriza el acceso y vuelve a Your Tracks Music Server.",
      );
    } catch (err) {
      setGeneralError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la autenticación OAuth 2.0",
      );
    } finally {
      setIsConnectingOAuth(false);
    }
  }, [openOAuthLogin]);

  const handleLogoutOAuth = useCallback(async () => {
    setGeneralError(null);
    setStatusMessage(null);
    setIsLoggingOutOAuth(true);
    try {
      await tauriApi.logoutOAuth();
      await checkOAuthStatus();
      setStatusMessage("Has cerrado sesión en Google correctamente.");
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Error al cerrar sesión");
    } finally {
      setIsLoggingOutOAuth(false);
    }
  }, [checkOAuthStatus]);

  const handleCheckOAuth = useCallback(async () => {
    setIsCheckingOAuth(true);
    try {
      await checkOAuthStatus();
    } finally {
      setIsCheckingOAuth(false);
    }
  }, [checkOAuthStatus]);

  const handleBrowseCookies = useCallback(async () => {
    const picked = await tauriApi.pickCookiesFile();
    if (picked) {
      setCookiesInput(picked);
    }
  }, []);

  const handleImportCookies = useCallback(async () => {
    setGeneralError(null);
    setStatusMessage(null);
    if (!cookiesInput.trim()) {
      setGeneralError("Selecciona o escribe la ruta de tu archivo cookies.txt");
      return;
    }
    setIsImportingCookies(true);
    try {
      const updated = await importCookiesFile(cookiesInput.trim());
      setCookiesInput(updated.cookies_file_path ?? cookiesInput.trim());
      setIsEditingCookies(false);
      setStatusMessage("Archivo de cookies actualizado correctamente.");
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : "Error al importar el archivo cookies.txt",
      );
    } finally {
      setIsImportingCookies(false);
    }
  }, [cookiesInput, importCookiesFile]);

  // Estados calculados para dependencias del microservicio
  const isHealthy = health?.status === "healthy";
  const ytDlpDep = health?.dependencies?.["yt-dlp"] ?? health?.dependencies?.["ytDlp"];
  const isYtDlpReady =
    isHealthy &&
    Boolean(ytDlpDep && ytDlpDep !== "missing" && ytDlpDep !== "unavailable");
  const ffmpegDep = health?.dependencies?.["ffmpeg"];
  const isFfmpegReady =
    isHealthy &&
    Boolean(ffmpegDep && ffmpegDep !== "missing" && ffmpegDep !== "unavailable");

  return (
    <section className="flex h-full flex-col gap-6 overflow-y-auto pr-1 pb-8">
      {/* Mensajes globales de estado y error */}
      {statusMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {generalError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. SECCIÓN: PERSONALIZACIÓN (COLORES Y MODO)                   */}
      {/* ============================================================== */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <Palette className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Personalización
              </h3>
              <p className="text-xs text-muted-foreground">
                Elige los colores y el estilo visual de la aplicación
              </p>
            </div>
          </div>
          <Badge tone="info">v1.9.0</Badge>
        </div>

        {/* Subsección A: Colores (Cards organizadas en vertical, ancho constante, con RadioButton) */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paleta de Colores
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Color principal para botones, bordes y controles
            </p>
          </div>

          <div className="space-y-2 w-full">
            {COLOR_PALETTES.map((palette) => {
              const isSelected = colorFamily === palette.id;
              return (
                <div
                  key={palette.id}
                  onClick={() => handleSelectPalette(palette.id)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3.5 transition w-full select-none",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-card/60 hover:border-primary/50 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RadioButton
                      checked={isSelected}
                      onChange={() => handleSelectPalette(palette.id)}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-xs font-semibold truncate",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {palette.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {palette.description}
                      </p>
                    </div>
                  </div>

                  {/* Swatches de muestra */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {palette.colors.map((c) => (
                      <span
                        key={c.name}
                        className="h-3.5 w-3.5 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subsección B: Modo (3 cards en vertical: Claro, Oscuro, Sistema) */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Apariencia
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Selecciona el modo claro, oscuro o automático según el sistema
            </p>
          </div>

          <div className="space-y-2 w-full">
            {THEME_MODES.map((item) => {
              const isSelected = mode === item.id;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectMode(item.id)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3.5 transition w-full select-none",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-card/60 hover:border-primary/50 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RadioButton
                      checked={isSelected}
                      onChange={() => handleSelectMode(item.id)}
                    />
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                    {item.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subsección C: Visualizador de Reproducción (Now Playing) */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visualizador de Reproducción
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Elige el estilo visual al ampliar la reproducción a pantalla completa.
              Posa el cursor sobre una opción para ver la animación en vivo.
            </p>
          </div>

          {/* Cuadrícula paralela vertical con auto-fit */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 w-full">
            {getAllVisualizers().map((viz) => {
              const isSelected = activeVisualizerId === viz.metadata.id;
              const isHovered = hoveredVisualizerId === viz.metadata.id;
              const PreviewComp = viz.PreviewComponent;

              return (
                <div
                  key={viz.metadata.id}
                  onClick={() => setActiveVisualizer(viz.metadata.id)}
                  onMouseEnter={() => setHoveredVisualizerId(viz.metadata.id)}
                  onMouseLeave={() => setHoveredVisualizerId(null)}
                  className={cn(
                    "group flex flex-col cursor-pointer justify-between gap-3.5 rounded-xl border p-4 transition w-full select-none relative overflow-hidden",
                    isSelected
                      ? "border-primary bg-card ring-1 ring-primary shadow-xs"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {/* Encabezado: Icono, Título con Tooltip Info y RadioButton */}
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {viz.metadata.id === "vinyl" && (
                        <Disc3
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      {viz.metadata.id === "spectrum" && (
                        <Activity
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      {viz.metadata.id === "ambient-aura" && (
                        <Sparkles
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      {viz.metadata.id === "cover-waves" && (
                        <AudioWaveform
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "text-xs font-semibold truncate",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {viz.metadata.name}
                      </span>

                      {/* Tooltip con icono de información */}
                      <div
                        className="relative group/info inline-flex items-center shrink-0"
                        title={viz.metadata.description}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground transition-colors cursor-help" />
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden w-48 rounded-md bg-popover p-2 text-[11px] text-popover-foreground shadow-md border border-border group-hover/info:block z-30 text-center leading-tight">
                          {viz.metadata.description}
                        </div>
                      </div>
                    </div>

                    <RadioButton
                      checked={isSelected}
                      onChange={() => setActiveVisualizer(viz.metadata.id)}
                    />
                  </div>

                  {/* Previsualización en vivo centrada (activa exclusivamente al posar el cursor) */}
                  <div className="flex items-center justify-center py-2 w-full">
                    {PreviewComp && (
                      <div className="transition-transform duration-300 group-hover:scale-105">
                        <PreviewComp
                          track={currentTrack}
                          isPlaying={isHovered}
                          currentTime={0}
                          duration={100}
                          volume={1}
                          isMuted={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SECCIONES EN PARALELO: WORKSPACES Y CUENTA DE YOUTUBE       */}
      {/* ============================================================== */}
      <div
        className="grid gap-6 items-stretch w-full"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
        }}
      >
        {/* Sub-sección: Workspaces */}
        <div className="flex flex-col space-y-4 rounded-xl border border-border bg-card p-5 h-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <HardDrive className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">Workspaces</h3>
                <p className="text-xs text-muted-foreground truncate">
                  Carpetas donde se guardan tus canciones descargadas y listas
                </p>
              </div>
            </div>

            {/* Botón a la derecha en la zona header */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleAddWorkspace()}
              disabled={isAddingWorkspace}
              className="shrink-0"
            >
              {isAddingWorkspace ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              <span>Agregar carpeta</span>
            </Button>
          </div>

          {/* Lista inferior de Workspaces con cards y RadioButton */}
          <div className="space-y-2.5 flex-1">
            {!appSettings || appSettings.recent_workspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Aún no tienes ninguna carpeta agregada.
                </p>
                <p className="mt-1">
                  Pulsa en <strong>"Agregar carpeta"</strong> para seleccionar dónde
                  guardar tu música.
                </p>
              </div>
            ) : (
              appSettings.recent_workspaces.map((saved) => {
                const isCurrent = workspace?.root_path === saved.path;
                const folderName =
                  saved.name ||
                  saved.path.split(/[/\\]/).filter(Boolean).pop() ||
                  "Workspace";

                return (
                  <div
                    key={saved.path}
                    onClick={() => {
                      if (!isCurrent && saved.is_available) {
                        void handleSwitchWorkspace(saved.path);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition select-none",
                      isCurrent
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border bg-card/60 hover:border-primary/50 hover:bg-muted/40",
                      !saved.is_available && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3.5 flex-1">
                      <RadioButton
                        checked={isCurrent}
                        disabled={
                          !saved.is_available || switchingWorkspace === saved.path
                        }
                        onChange={() => {
                          if (!isCurrent && saved.is_available) {
                            void handleSwitchWorkspace(saved.path);
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {folderName}
                          </span>
                          {isCurrent && <Badge tone="info">En uso</Badge>}
                          {!saved.is_available && (
                            <Badge tone="warning">Carpeta no encontrada</Badge>
                          )}
                          {switchingWorkspace === saved.path && (
                            <span className="flex items-center gap-1 text-[11px] text-primary">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Activando...
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {saved.path}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex shrink-0 items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ActionMenu
                        isLoading={removingWorkspace === saved.path}
                        title="Opciones de carpeta"
                        items={[
                          {
                            label: "Quitar de la lista",
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            variant: "danger",
                            onClick: async () => {
                              setRemovingWorkspace(saved.path);
                              try {
                                await removeSavedWorkspace(saved.path);
                              } finally {
                                setRemovingWorkspace(null);
                              }
                            },
                          },
                        ]}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sub-sección: Cuenta de YouTube */}
        <div className="flex flex-col space-y-5 rounded-xl border border-border bg-card p-5 h-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <KeyRound className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  Cuenta de YouTube
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  Conecta tu cuenta para sincronizar favoritos y acceder a contenido
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {oauthStatus?.mock_mode && <Badge tone="warning">Modo Prueba</Badge>}
              <Badge tone={oauthStatus?.authenticated ? "success" : "default"}>
                {oauthStatus?.authenticated ? "Conectado" : "No conectado"}
              </Badge>
            </div>
          </div>

          {/* OAuth / Google Account */}
          <div className="space-y-3 flex-1">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sincronización con YouTube
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sincroniza tus canciones con Me gusta directamente con tu cuenta de
                YouTube.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                disabled={isConnectingOAuth || isLoggingOutOAuth}
                onClick={() => void handleConnectOAuth()}
              >
                {isConnectingOAuth ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isConnectingOAuth
                  ? "Conectando..."
                  : oauthStatus?.authenticated
                    ? "Reconectar cuenta"
                    : "Conectar con Google"}
              </Button>

              {oauthStatus?.authenticated && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={isLoggingOutOAuth || isConnectingOAuth}
                  onClick={() => void handleLogoutOAuth()}
                >
                  {isLoggingOutOAuth ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isLoggingOutOAuth ? "Cerrando..." : "Cerrar sesión"}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={isCheckingOAuth}
                onClick={() => void handleCheckOAuth()}
              >
                <RefreshCw
                  className={cn("h-4 w-4", isCheckingOAuth && "animate-spin")}
                />
                {isCheckingOAuth ? "Comprobando..." : "Comprobar estado"}
              </Button>
            </div>
          </div>

          {/* Cookies */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Archivo de cookies
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permite descargar canciones con restricción de edad o contenido
                  exclusivo
                </p>
              </div>
              <Badge tone={appSettings?.cookies_file_path ? "success" : "default"}>
                {appSettings?.cookies_file_path ? "Configurado" : "Opcional"}
              </Badge>
            </div>

            <div className="flex items-center gap-2 w-full">
              <Input
                value={cookiesInput}
                onChange={(e) => setCookiesInput(e.target.value)}
                readOnly={!isEditingCookies}
                disabled={!isEditingCookies}
                placeholder="Ruta de tu archivo de cookies..."
                aria-label="Ruta de archivo cookies"
                className={cn(
                  "flex-1 w-full font-mono text-xs",
                  !isEditingCookies &&
                    "bg-muted/40 cursor-not-allowed opacity-80 text-foreground",
                )}
              />

              {!isEditingCookies ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => setIsEditingCookies(true)}
                  title="Editar ruta de cookies"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleBrowseCookies()}
                    title="Examinar archivo de cookies"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>Buscar</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isImportingCookies}
                    onClick={() => void handleImportCookies()}
                  >
                    {isImportingCookies ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Cookie className="h-4 w-4" />
                    )}
                    <span>
                      {isImportingCookies ? "Guardando..." : "Guardar cookies"}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCookiesInput(appSettings?.cookies_file_path ?? "");
                      setIsEditingCookies(false);
                    }}
                    disabled={isImportingCookies}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. SECCIÓN: SERVICIO DE DESCARGAS                              */}
      {/* ============================================================== */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Servicio de Descargas
              </h3>
              <p className="text-xs text-muted-foreground">
                Estado del servidor interno encargado de procesar y descargar audio
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isCheckingHealth}
            onClick={() => void handleCheckHealth()}
            title="Comprobar estado del servicio"
          >
            <RefreshCw
              className={cn("h-4 w-4", isCheckingHealth && "animate-spin text-primary")}
            />
            <span>Comprobar</span>
          </Button>
        </div>

        {/* Subsección A: Input de ruta con bloqueo y botón editar */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dirección del servicio (URL)
          </label>
          <div className="flex items-center gap-2 w-full">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              readOnly={!isEditingUrl}
              disabled={!isEditingUrl}
              placeholder="http://127.0.0.1:8080"
              aria-label="URL del servicio de descargas"
              className={cn(
                "flex-1 w-full font-mono text-xs",
                !isEditingUrl &&
                  "bg-muted/40 cursor-not-allowed opacity-80 text-foreground",
              )}
            />

            {!isEditingUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setIsEditingUrl(true)}
                title="Editar dirección del servicio"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleTestAndSaveUrl()}
                  disabled={isTestingUrl}
                >
                  {isTestingUrl ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{isTestingUrl ? "Probando..." : "Probar y Guardar"}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setUrlInput(microserviceUrl);
                    setIsEditingUrl(false);
                    setUrlError(null);
                  }}
                  disabled={isTestingUrl}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
        </div>

        {/* Subsección B: 3 cards indicadoras de estado (Servicio en general, yt-dlp, FFmpeg) */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estado de las herramientas
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Disponibilidad del motor de descargas y procesamiento de audio
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Card 1: Servicio en General */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Server className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    Servidor local
                  </span>
                  <Badge tone={isHealthy ? "success" : "danger"}>
                    {isHealthy ? "En línea" : "Desconectado"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {isHealthy ? "Listo para descargar" : "Sin conexión con el servidor"}
                </p>
              </div>
            </div>

            {/* Card 2: Motor de descarga */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Download className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    Motor de descarga
                  </span>
                  <Badge tone={isYtDlpReady ? "success" : "danger"}>
                    {isYtDlpReady ? "Listo" : "No disponible"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {isYtDlpReady
                    ? "Listo para descargar canciones"
                    : "Herramienta no encontrada"}
                </p>
              </div>
            </div>

            {/* Card 3: Procesador de audio */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                <Music className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    Procesador de audio
                  </span>
                  <Badge tone={isFfmpegReady ? "success" : "danger"}>
                    {isFfmpegReady ? "Listo" : "No disponible"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {isFfmpegReady
                    ? "Listo para convertir formatos"
                    : "Herramienta no encontrada"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. SECCIÓN: DIAGNÓSTICO Y REGISTRO DE ERRORES (ERROR LOGS)     */}
      {/* ============================================================== */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bug className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                Diagnóstico y Registro de Errores (Error Logs)
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                Historial cronológico con fecha y hora de todos los fallos y avisos de
                la sesión
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {errorLogs.filter((l) => l.level === "error").length > 0 ? (
              <Badge tone="danger">
                {errorLogs.filter((l) => l.level === "error").length} errores
                registrados
              </Badge>
            ) : (
              <Badge tone="success">0 errores en sesión</Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openLogsFolder()}
              className="gap-1.5 text-xs"
              title="Abrir carpeta física /logs del workspace"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Abrir /logs</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenLogModal(true)}
              className="gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Ver registro completo</span>
            </Button>
          </div>
        </div>

        {/* Resumen interactivo de registros */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <span className="truncate">
              Archivo físico:{" "}
              <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
                /logs/app.log
              </code>{" "}
              (Límite optimizado: 1 MB con rotación automática)
            </span>
            {errorLogs.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearErrorLogs}
                className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpiar registro</span>
              </Button>
            )}
          </div>

          {errorLogs.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border text-muted-foreground text-xs bg-muted/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">
                  No hay incidentes ni errores registrados en esta sesión.
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Si ocurre algún error en segundo plano o se muestra un aviso toast, se
                  registrará aquí con su fecha, hora exacta y contexto.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {errorLogs
                .slice(-3)
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => setOpenLogModal(true)}
                    className="flex cursor-pointer items-start justify-between gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:border-primary/50 transition font-mono text-xs select-none"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                          [{entry.formattedTime}]
                        </span>
                        <span
                          className={cn(
                            "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                            entry.level === "error"
                              ? "bg-destructive/20 text-destructive"
                              : entry.level === "warn"
                                ? "bg-amber-500/20 text-amber-500"
                                : "bg-sky-500/20 text-sky-500",
                          )}
                        >
                          {entry.level}
                        </span>
                        {entry.context && (
                          <span className="text-[10px] text-muted-foreground">
                            [{entry.context}]
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-foreground truncate mt-1">
                        {entry.title}
                      </p>
                      {entry.description && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de error al agregar workspace */}
      <ConfirmationModal
        isOpen={workspaceErrorModal.isOpen}
        title="No se pudo agregar la carpeta"
        description={workspaceErrorModal.message}
        confirmLabel="Entendido"
        cancelLabel="Cerrar"
        tone="danger"
        onConfirm={() => {
          setWorkspaceErrorModal({ isOpen: false, message: "" });
        }}
        onCancel={() => {
          setWorkspaceErrorModal({ isOpen: false, message: "" });
        }}
      />
    </section>
  );
});

WorkspaceSettingsView.displayName = "WorkspaceSettingsView";
