import {
  CheckCircle2,
  Cookie,
  ExternalLink,
  FolderOpen,
  HardDrive,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Badge, Button, Input } from "@/components/ui/Primitives";
import { workspaceConfigSchema } from "@/schemas/validation";
import { tauriApi } from "@/services/tauriIpc";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";

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

  const [pathInput, setPathInput] = useState(workspace?.root_path ?? "");
  const [urlInput, setUrlInput] = useState(microserviceUrl);
  const [cookiesInput, setCookiesInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isLoggingOutOAuth, setIsLoggingOutOAuth] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCheckingOAuth, setIsCheckingOAuth] = useState(false);
  const [isImportingCookies, setIsImportingCookies] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string | null>(null);
  const [removingWorkspace, setRemovingWorkspace] = useState<string | null>(null);

  // Actualizar estado OAuth automáticamente al volver del navegador a la ventana de la app
  useEffect(() => {
    void checkOAuthStatus();
    const onFocus = () => {
      void checkOAuthStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkOAuthStatus]);

  const handleConnectOAuth = useCallback(async () => {
    setFormError(null);
    setStatusMessage(null);
    setIsConnectingOAuth(true);
    try {
      await openOAuthLogin();
      setStatusMessage(
        "Se abrió la pantalla de consentimiento de Google en tu navegador. Autoriza el acceso y vuelve a ytms-player.",
      );
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la autenticación OAuth 2.0",
      );
    } finally {
      setIsConnectingOAuth(false);
    }
  }, [openOAuthLogin]);

  const handleLogoutOAuth = useCallback(async () => {
    setFormError(null);
    setStatusMessage(null);
    setIsLoggingOutOAuth(true);
    try {
      await tauriApi.logoutOAuth();
      await checkOAuthStatus();
      setStatusMessage("Has cerrado la sesión de Google OAuth. Tu token local ha sido eliminado.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al cerrar sesión OAuth");
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

  const handleCheckHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      await checkHealth();
    } finally {
      setIsCheckingHealth(false);
    }
  }, [checkHealth]);

  const handleBrowseFolder = useCallback(async () => {
    const picked = await tauriApi.pickWorkspaceFolder();
    if (picked) {
      setPathInput(picked);
    }
  }, []);

  const handleBrowseCookies = useCallback(async () => {
    const picked = await tauriApi.pickCookiesFile();
    if (picked) {
      setCookiesInput(picked);
    }
  }, []);

  const handleImportCookies = useCallback(async () => {
    setFormError(null);
    setStatusMessage(null);
    if (!cookiesInput.trim()) {
      setFormError("Selecciona o escribe la ruta de tu archivo cookies.txt");
      return;
    }
    setIsImportingCookies(true);
    try {
      const updated = await importCookiesFile(cookiesInput.trim());
      setCookiesInput("");
      setStatusMessage(
        `Archivo cookies.txt actualizado en caliente (${updated.cookies_file_path ?? "config/cookies.txt"}). No requiere recompilar ni reiniciar el contenedor Docker.`,
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Error al importar el archivo cookies.txt",
      );
    } finally {
      setIsImportingCookies(false);
    }
  }, [cookiesInput, importCookiesFile]);

  const handleSaveConfig = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setStatusMessage(null);

      const parsed = workspaceConfigSchema.safeParse({
        rootPath: pathInput,
        microserviceUrl: urlInput,
      });

      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Configuración inválida");
        return;
      }

      setIsSavingConfig(true);
      try {
        await setMicroserviceUrl(parsed.data.microserviceUrl);
        await selectWorkspace(parsed.data.rootPath);
        await checkHealth();
        setStatusMessage(
          "Workspace inicializado, validado (.ytms-player-workspace) y guardado en la memoria de la app.",
        );
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Error al inicializar el Workspace",
        );
      } finally {
        setIsSavingConfig(false);
      }
    },
    [pathInput, urlInput, setMicroserviceUrl, selectWorkspace, checkHealth],
  );

  return (
    <section className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
      <header>
        <h2 className="text-xl font-bold text-white">
          Configuración General & Workspaces
        </h2>
        <p className="text-xs text-slate-400">
          Ajustes del sistema, autenticación de YouTube OAuth, cookies y gestión de directorios de música.
        </p>
      </header>

      <form
        onSubmit={(e) => void handleSaveConfig(e)}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/75 p-5"
      >
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Directorio Raíz del Workspace
          </label>
          <div className="flex gap-2">
            <Input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/home/usuario/Music/ytms-player-Workspace"
              aria-label="Ruta del Workspace"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleBrowseFolder()}
            >
              <FolderOpen className="h-4 w-4" />
              Examinar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            URL del Microservicio Go (Docker)
          </label>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://127.0.0.1:8080"
              aria-label="URL del Microservicio Go"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCheckHealth()}
              disabled={isCheckingHealth}
            >
              {isCheckingHealth ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              {isCheckingHealth ? "Comprobando..." : "Probar /api/health"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" variant="primary" disabled={isSavingConfig}>
            {isSavingConfig ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardDrive className="h-4 w-4" />
            )}
            {isSavingConfig ? "Guardando..." : "Inicializar y Guardar Workspace"}
          </Button>
        </div>

        {formError && (
          <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
            {formError}
          </div>
        )}

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {statusMessage}
          </div>
        )}
      </form>

      {/* Memoria Persistente de Workspaces (Cambio rápido con 1 clic) */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">
              Workspaces Guardados en Memoria de la Aplicación
            </h3>
          </div>
          {appSettings?.config_file_path && (
            <code
              className="rounded bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400"
              title="Ubicación del archivo settings.json en el SO"
            >
              {appSettings.config_file_path}
            </code>
          )}
        </div>

        {!appSettings || appSettings.recent_workspaces.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aún no hay Workspaces guardados. Al inicializar cualquier carpeta quedará
            registrada aquí para cambiar con un clic.
          </p>
        ) : (
          <div className="space-y-2">
            {appSettings.recent_workspaces.map((saved) => {
              const isCurrent = workspace?.root_path === saved.path;
              return (
                <div
                  key={saved.path}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs ${
                    isCurrent
                      ? "border-red-500/40 bg-red-950/20"
                      : "border-slate-800 bg-slate-950/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{saved.name}</span>
                      {isCurrent && <Badge tone="info">Activo</Badge>}
                      {!saved.is_available && (
                        <Badge tone="warning">No encontrado en disco</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-slate-400">
                      {saved.path}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCurrent && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!saved.is_available || switchingWorkspace === saved.path}
                        onClick={async () => {
                          setSwitchingWorkspace(saved.path);
                          setPathInput(saved.path);
                          try {
                            await selectWorkspace(saved.path);
                          } finally {
                            setSwitchingWorkspace(null);
                          }
                        }}
                      >
                        {switchingWorkspace === saved.path ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {switchingWorkspace === saved.path ? "Activando..." : "Activar"}
                      </Button>
                    )}
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
            })}
          </div>
        )}
      </div>

      {/* Actualización en caliente de cookies.txt desde UI Tauri */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Gestión de Cookies de YouTube (Sin Re-build)
            </h3>
          </div>
          <Badge tone={appSettings?.cookies_file_path ? "success" : "default"}>
            {appSettings?.cookies_file_path ? "Configurado (:ro)" : "Opcional"}
          </Badge>
        </div>

        <p className="text-xs text-slate-400">
          Importa o actualiza tu archivo{" "}
          <code className="text-slate-300">cookies.txt</code> directamente desde aquí.
          Rust lo copia de forma segura con permisos restringidos (
          <code className="text-slate-300">0600</code>) a la ruta montada por Docker en
          modo solo lectura (<code className="text-slate-300">:ro</code>), surtiendo
          efecto de inmediato en la siguiente descarga sin recompilar.
        </p>

        <div className="flex gap-2">
          <Input
            value={cookiesInput}
            onChange={(e) => setCookiesInput(e.target.value)}
            placeholder="Seleccionar archivo cookies.txt exportado del navegador..."
            aria-label="Ruta origen de cookies.txt"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleBrowseCookies()}
          >
            <FolderOpen className="h-4 w-4" />
            Buscar .txt
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isImportingCookies}
            onClick={() => void handleImportCookies()}
          >
            {isImportingCookies ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {isImportingCookies ? "Actualizando..." : "Actualizar Cookies"}
          </Button>
        </div>
      </div>

      {/* Conexión OAuth 2.0 con Google / YouTube (Redirección Navegador <-> App) */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">
              Cuenta de YouTube OAuth 2.0 (Sincronización de Likes)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {oauthStatus?.mock_mode && (
              <Badge tone="warning">Modo Simulado (OAUTH_MOCK_MODE=true)</Badge>
            )}
            <Badge tone={oauthStatus?.authenticated ? "success" : "default"}>
              {oauthStatus?.authenticated
                ? "Conectado con Google"
                : "Sin autorizar"}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Al pulsar <strong>Conectar con Google</strong>, se abrirá la pantalla de
          consentimiento oficial de Google en tu navegador y, tras autorizar el acceso
          de solo lectura (<code className="text-slate-300">youtube.readonly</code>),
          redirigirá automáticamente de vuelta al callback local (
          <code className="text-slate-300">
            {oauthStatus?.redirect_uri ?? "http://127.0.0.1:8080/api/oauth/callback"}
          </code>
          ) guardando el token de forma segura en el microservicio.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="primary"
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
                ? "Reconectar cuenta de Google en Navegador"
                : "Conectar con Google (OAuth 2.0)"}
          </Button>
          {oauthStatus?.authenticated && (
            <Button
              type="button"
              variant="danger"
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
            variant="secondary"
            disabled={isCheckingOAuth}
            onClick={() => void handleCheckOAuth()}
          >
            <RefreshCw className={`h-4 w-4 ${isCheckingOAuth ? "animate-spin" : ""}`} />
            {isCheckingOAuth ? "Verificando..." : "Verificar Estado OAuth"}
          </Button>
        </div>
      </div>

      {/* Estado actual del Workspace */}
      {workspace && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Estructura del Workspace Activo
            </h3>
            <Badge tone={workspace.is_valid ? "success" : "danger"}>
              {workspace.is_valid ? ".ytms-player-workspace Válido" : "Inválido"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs text-slate-300 md:grid-cols-2">
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">Workspace Root:</span>
              <p className="mt-1 font-mono text-slate-200">{workspace.root_path}</p>
            </div>
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">SQLite Database:</span>
              <p className="mt-1 font-mono text-slate-200">{workspace.database_path}</p>
            </div>
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">Carpeta de Audio (/tracks):</span>
              <p className="mt-1 font-mono text-slate-200">{workspace.tracks_dir}</p>
            </div>
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">
                Carpeta de Miniaturas (/thumbnails):
              </span>
              <p className="mt-1 font-mono text-slate-200">
                {workspace.thumbnails_dir}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Estado del Microservicio Go */}
      {health && (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">
              Estado de {health.service} (v{health.version})
            </span>
            <Badge tone={health.status === "healthy" ? "success" : "danger"}>
              {health.status}
            </Badge>
          </div>
          {health.dependencies && (
            <div className="flex gap-4 pt-2 text-slate-400">
              {Object.entries(health.dependencies).map(([dep, state]) => (
                <span key={dep}>
                  {dep}: <strong className="text-slate-200">{state}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
WorkspaceSettingsView.displayName = "WorkspaceSettingsView";
