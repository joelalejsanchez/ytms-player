import { CheckCircle2, FolderOpen, HardDrive, Server } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Badge, Button, Input } from "@/components/ui/Primitives";
import { workspaceConfigSchema } from "@/schemas/validation";
import { tauriApi } from "@/services/tauriIpc";
import { useDownloadStore } from "@/stores/useDownloadStore";
import { useLibraryStore } from "@/stores/useLibraryStore";

export const WorkspaceSettingsView = React.memo(() => {
  const workspace = useLibraryStore((s) => s.workspace);
  const health = useLibraryStore((s) => s.health);
  const selectWorkspace = useLibraryStore((s) => s.selectWorkspace);
  const checkHealth = useLibraryStore((s) => s.checkHealth);

  const microserviceUrl = useDownloadStore((s) => s.microserviceUrl);
  const setMicroserviceUrl = useDownloadStore((s) => s.setMicroserviceUrl);

  const [pathInput, setPathInput] = useState(workspace?.root_path ?? "");
  const [urlInput, setUrlInput] = useState(microserviceUrl);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleBrowseFolder = useCallback(async () => {
    const picked = await tauriApi.pickWorkspaceFolder();
    if (picked) {
      setPathInput(picked);
    }
  }, []);

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
        setFormError(
          parsed.error.issues[0]?.message ?? "Configuración inválida",
        );
        return;
      }

      try {
        await setMicroserviceUrl(parsed.data.microserviceUrl);
        await selectWorkspace(parsed.data.rootPath);
        await checkHealth();
        setStatusMessage(
          "Workspace inicializado y validado (.localstream-workspace verificado).",
        );
      } catch (err) {
        setFormError(
          err instanceof Error
            ? err.message
            : "Error al inicializar el Workspace",
        );
      }
    },
    [pathInput, urlInput, setMicroserviceUrl, selectWorkspace, checkHealth],
  );

  return (
    <section className="flex h-full flex-col gap-5 overflow-y-auto">
      <header>
        <h2 className="text-xl font-bold text-white">
          Configuración de Workspaces y Microservicio
        </h2>
        <p className="text-xs text-slate-400">
          Cada Workspace mantiene su propio archivo de control <code className="text-slate-300">.localstream-workspace</code>, base de datos SQLite y carpetas <code className="text-slate-300">/tracks</code> y <code className="text-slate-300">/thumbnails</code> (SDD Sección 3)
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
              placeholder="/home/usuario/Music/LocalStream-Workspace"
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
              onClick={() => void checkHealth()}
            >
              <Server className="h-4 w-4" />
              Probar /api/health
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" variant="primary">
            <HardDrive className="h-4 w-4" />
            Inicializar / Cargar Workspace
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

      {/* Estado actual del Workspace */}
      {workspace && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Estructura del Workspace Activo
            </h3>
            <Badge tone={workspace.is_valid ? "success" : "danger"}>
              {workspace.is_valid
                ? ".localstream-workspace Válido"
                : "Inválido"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs text-slate-300 md:grid-cols-2">
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">Workspace Root:</span>
              <p className="mt-1 font-mono text-slate-200">
                {workspace.root_path}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">SQLite Database:</span>
              <p className="mt-1 font-mono text-slate-200">
                {workspace.database_path}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/70 p-3">
              <span className="text-slate-500">Carpeta de Audio (/tracks):</span>
              <p className="mt-1 font-mono text-slate-200">
                {workspace.tracks_dir}
              </p>
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
                  {dep}:{" "}
                  <strong className="text-slate-200">{state}</strong>
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
