import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cookie,
  Download,
  Edit2,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  HardDrive,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Music,
  Palette,
  RefreshCw,
  Server,
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
    description: "Luminosidad alta con fondo claro Platinum",
    icon: Sun,
  },
  {
    id: "dark",
    label: "Modo Oscuro",
    description: "Luminosidad baja con fondo profundo Onyx",
    icon: Moon,
  },
  {
    id: "system",
    label: "Modo Sistema",
    description: "Sincronizar automáticamente con la preferencia del sistema operativo",
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
        "Se abrió la pantalla de consentimiento de Google en tu navegador. Autoriza el acceso y vuelve a ytms-player.",
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
      setStatusMessage("Has cerrado la sesión de Google OAuth. Tu token local ha sido eliminado.");
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Error al cerrar sesión OAuth");
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
      setStatusMessage(
        `Archivo cookies.txt actualizado en caliente (${updated.cookies_file_path ?? "config/cookies.txt"}).`,
      );
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
    isHealthy && Boolean(ytDlpDep && ytDlpDep !== "missing" && ytDlpDep !== "unavailable");
  const ffmpegDep = health?.dependencies?.["ffmpeg"];
  const isFfmpegReady =
    isHealthy && Boolean(ffmpegDep && ffmpegDep !== "missing" && ffmpegDep !== "unavailable");

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
                Configuración del tema visual y esquema de luminosidad de la aplicación
              </p>
            </div>
          </div>
          <Badge tone="info">v1.1.0</Badge>
        </div>

        {/* Subsección A: Colores (Cards organizadas en vertical, ancho constante, con RadioButton) */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paleta de Colores
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Selecciona la familia cromática aplicada a los controles, acentos y bordes
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
              Modo de Luminosidad
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Elige la apariencia base para contrastes claros u oscuros
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
      </div>

      {/* ============================================================== */}
      {/* 2. SECCIÓN: CUENTA DE YOUTUBE                                 */}
      {/* ============================================================== */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Cuenta de YouTube
              </h3>
              <p className="text-xs text-muted-foreground">
                Autenticación OAuth 2.0 y cookies para sincronización de me gusta y acceso a contenido
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {oauthStatus?.mock_mode && (
              <Badge tone="warning">Modo Simulado</Badge>
            )}
            <Badge tone={oauthStatus?.authenticated ? "success" : "default"}>
              {oauthStatus?.authenticated ? "Conectado con Google" : "Sin autorizar"}
            </Badge>
          </div>
        </div>

        {/* OAuth 2.0 */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Autenticación OAuth 2.0
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permite registrar tus Me gusta y sincronizar canciones favoritas directamente con tu
              cuenta de YouTube.
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
                  ? "Reconectar cuenta de Google"
                  : "Conectar con Google (OAuth 2.0)"}
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
                {isLoggingOutOAuth ? "Cerrando..." : "Cerrar Sesión OAuth"}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={isCheckingOAuth}
              onClick={() => void handleCheckOAuth()}
            >
              <RefreshCw className={cn("h-4 w-4", isCheckingOAuth && "animate-spin")} />
              {isCheckingOAuth ? "Verificando..." : "Verificar Estado"}
            </Button>
          </div>
        </div>

        {/* Cookies.txt */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Archivo Cookies.txt
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Copia segura del archivo a la ruta de Docker para descargar videos restringidos o con edad
              </p>
            </div>
            <Badge tone={appSettings?.cookies_file_path ? "success" : "default"}>
              {appSettings?.cookies_file_path ? "Configurado (:ro)" : "Opcional"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 w-full">
            <Input
              value={cookiesInput}
              onChange={(e) => setCookiesInput(e.target.value)}
              readOnly={!isEditingCookies}
              disabled={!isEditingCookies}
              placeholder="Ruta del archivo cookies.txt exportado del navegador..."
              aria-label="Ruta origen de cookies.txt"
              className={cn(
                "flex-1 w-full font-mono text-xs",
                !isEditingCookies && "bg-muted/40 cursor-not-allowed opacity-80 text-foreground",
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
                  title="Examinar archivo cookies.txt"
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
                  <span>{isImportingCookies ? "Actualizando..." : "Actualizar Cookies"}</span>
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

      {/* ============================================================== */}
      {/* 3. SECCIÓN: WORKSPACES                                         */}
      {/* ============================================================== */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <HardDrive className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Workspaces
              </h3>
              <p className="text-xs text-muted-foreground">
                Directorios de almacenamiento con base de datos SQLite y archivos de audio
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
          >
            {isAddingWorkspace ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            <span>Agregar Workspace</span>
          </Button>
        </div>

        {/* Lista inferior de Workspaces con cards y RadioButton */}
        <div className="space-y-2.5">
          {!appSettings || appSettings.recent_workspaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Aún no tienes ningún Workspace registrado.
              </p>
              <p className="mt-1">
                Pulsa en <strong>"Agregar Workspace"</strong> para seleccionar una carpeta y comenzar.
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
                      disabled={!saved.is_available || switchingWorkspace === saved.path}
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
                        {isCurrent && <Badge tone="info">Activo</Badge>}
                        {!saved.is_available && (
                          <Badge tone="warning">No encontrado en disco</Badge>
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
                      title="Opciones de workspace"
                      items={[
                        {
                          label: "Olvidar de la lista",
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

      {/* ============================================================== */}
      {/* 4. SECCIÓN: MICROSERVICIO                                      */}
      {/* ============================================================== */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Microservicio Go
              </h3>
              <p className="text-xs text-muted-foreground">
                Endpoint de comunicación HTTP y estado de los motores yt-dlp y FFmpeg
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isCheckingHealth}
            onClick={() => void handleCheckHealth()}
            title="Refrescar estado de salud"
          >
            <RefreshCw className={cn("h-4 w-4", isCheckingHealth && "animate-spin text-primary")} />
            <span>Refrescar</span>
          </Button>
        </div>

        {/* Subsección A: Input de ruta con bloqueo y botón editar */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dirección del Microservicio (URL)
          </label>
          <div className="flex items-center gap-2 w-full">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              readOnly={!isEditingUrl}
              disabled={!isEditingUrl}
              placeholder="http://127.0.0.1:8080"
              aria-label="URL del Microservicio Go"
              className={cn(
                "flex-1 w-full font-mono text-xs",
                !isEditingUrl && "bg-muted/40 cursor-not-allowed opacity-80 text-foreground",
              )}
            />

            {!isEditingUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setIsEditingUrl(true)}
                title="Editar URL del microservicio"
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
              Indicadores de Estado
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Disponibilidad en tiempo real de los servicios locales y herramientas CLI
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
                    {health?.service || "Backend Go"}
                  </span>
                  <Badge tone={isHealthy ? "success" : "danger"}>
                    {isHealthy ? "Online" : "Offline"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {isHealthy ? `Versión ${health?.version || "1.0.0"}` : "Sin conexión con Docker"}
                </p>
              </div>
            </div>

            {/* Card 2: yt-dlp */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Download className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    yt-dlp
                  </span>
                  <Badge tone={isYtDlpReady ? "success" : "danger"}>
                    {isYtDlpReady ? "Disponible" : "No detectado"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {isYtDlpReady
                    ? health?.dependencies?.["yt-dlp"] || "Listo para descargas"
                    : "Requiere instalación"}
                </p>
              </div>
            </div>

            {/* Card 3: FFmpeg */}
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                <Music className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs text-foreground truncate">
                    FFmpeg
                  </span>
                  <Badge tone={isFfmpegReady ? "success" : "danger"}>
                    {isFfmpegReady ? "Disponible" : "No detectado"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {isFfmpegReady
                    ? health?.dependencies?.["ffmpeg"] || "Transcodificación activa"
                    : "No detectado en contenedor"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de error al agregar workspace */}
      <ConfirmationModal
        isOpen={workspaceErrorModal.isOpen}
        title="Error al Inicializar Workspace"
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
