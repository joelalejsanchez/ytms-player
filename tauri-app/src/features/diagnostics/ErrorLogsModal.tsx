import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  Copy,
  FolderOpen,
  Info,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Input } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import { type LogEntry, useLogStore } from "@/stores/useLogStore";

export const ErrorLogsModal: React.FC = React.memo(() => {
  const isOpen = useLogStore((s) => s.isOpenModal);
  const setOpenModal = useLogStore((s) => s.setOpenModal);
  const logs = useLogStore((s) => s.logs);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const filterLevel = useLogStore((s) => s.filterLevel);
  const setFilterLevel = useLogStore((s) => s.setFilterLevel);
  const searchQuery = useLogStore((s) => s.searchQuery);
  const setSearchQuery = useLogStore((s) => s.setSearchQuery);
  const exportLogsAsText = useLogStore((s) => s.exportLogsAsText);
  const openLogsFolder = useLogStore((s) => s.openLogsFolder);

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setOpenModal]);

  const handleCopyAll = useCallback(() => {
    const text = exportLogsAsText();
    void navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [exportLogsAsText]);

  const handleCopyEntry = useCallback((entry: LogEntry) => {
    const text = `[${entry.formattedTime}] [${entry.level.toUpperCase()}]${
      entry.context ? ` [${entry.context}]` : ""
    } ${entry.title}${entry.description ? ` - ${entry.description}` : ""}`;
    void navigator.clipboard.writeText(text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const errorCount = useMemo(
    () => logs.filter((l) => l.level === "error").length,
    [logs],
  );
  const warnCount = useMemo(
    () => logs.filter((l) => l.level === "warn").length,
    [logs],
  );

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (filterLevel !== "all" && log.level !== filterLevel) {
          return false;
        }
        if (searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase();
          const matchTitle = log.title.toLowerCase().includes(query);
          const matchDesc = log.description?.toLowerCase().includes(query);
          const matchCtx = log.context?.toLowerCase().includes(query);
          const matchTime = log.formattedTime.includes(query);
          return matchTitle || matchDesc || matchCtx || matchTime;
        }
        return true;
      })
      .reverse(); // Mostrar los más recientes primero
  }, [logs, filterLevel, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Registro de Errores de la Sesión"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setOpenModal(false);
        }
      }}
    >
      <div
        style={{ backgroundColor: "var(--card)" }}
        className="w-full max-w-3xl flex flex-col max-h-[85vh] rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
      >
        {/* Encabezado del Modal */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <Bug className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground truncate">
                  Registro de Errores y Diagnóstico
                </h3>
                {errorCount > 0 && <Badge tone="danger">{errorCount} errores</Badge>}
                {warnCount > 0 && <Badge tone="warning">{warnCount} avisos</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Historial cronológico con fecha y hora para auditar incidentes de la
                sesión
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpenModal(false)}
            title="Cerrar modal (Esc)"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        {/* Barra de herramientas: Búsqueda, Filtros y Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3 bg-muted/10">
          {/* Campo de Búsqueda */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el registro..."
              className="pl-8 h-8 text-xs font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filtros de Nivel */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "error", label: "Errores" },
                { id: "warn", label: "Avisos" },
                { id: "info", label: "Info" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterLevel(tab.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  filterLevel === tab.id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Acciones: Abrir /logs, Copiar Todo y Limpiar */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openLogsFolder()}
              title="Abrir carpeta física /logs del workspace en el explorador"
              className="h-8 text-xs gap-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Abrir /logs</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logs.length === 0}
              onClick={handleCopyAll}
              title="Copiar reporte al portapapeles"
              className="h-8 text-xs gap-1.5"
            >
              {copiedAll ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar reporte</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={logs.length === 0}
              onClick={clearLogs}
              title="Limpiar registro de la sesión"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Limpiar</span>
            </Button>
          </div>
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 select-text font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 text-emerald-500/60 mb-3" />
              <h4 className="text-sm font-semibold text-foreground mb-1">
                {logs.length === 0
                  ? "Sin errores registrados en esta sesión"
                  : "No hay eventos que coincidan con el filtro"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md">
                {logs.length === 0
                  ? "Todas las reproducciones, descargas y tareas de sincronización se han ejecutado con normalidad."
                  : "Prueba a cambiar el filtro de nivel o el término de búsqueda."}
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isErr = entry.level === "error";
              const isWarn = entry.level === "warn";
              const isCopied = copiedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-start justify-between gap-3 p-3 rounded-xl border transition-colors",
                    isErr
                      ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                      : isWarn
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : "border-border bg-muted/20 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {/* Icono de nivel */}
                    <div className="mt-0.5 shrink-0">
                      {isErr ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : isWarn ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Info className="h-4 w-4 text-sky-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Fecha y Meta etiquetas */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                          [{entry.formattedTime}]
                        </span>
                        <span
                          className={cn(
                            "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded",
                            isErr
                              ? "bg-destructive/20 text-destructive"
                              : isWarn
                                ? "bg-amber-500/20 text-amber-500"
                                : "bg-sky-500/20 text-sky-500",
                          )}
                        >
                          {entry.level}
                        </span>
                        {entry.context && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border">
                            {entry.context}
                          </span>
                        )}
                      </div>

                      {/* Título del Error */}
                      <p className="font-semibold text-xs text-foreground break-words">
                        {entry.title}
                      </p>

                      {/* Descripción opcional */}
                      {entry.description && (
                        <p className="text-[11px] text-muted-foreground break-words leading-relaxed whitespace-pre-wrap">
                          {entry.description}
                        </p>
                      )}

                      {/* Detalles técnicos serializados si existen */}
                      {Boolean(entry.details) && (
                        <pre className="text-[10px] p-2 rounded-lg bg-black/40 text-muted-foreground overflow-x-auto border border-border/40 mt-1">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Botón copiar línea individual */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyEntry(entry)}
                    title="Copiar entrada al portapapeles"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Pie del modal con estado */}
        <footer className="flex items-center justify-between border-t border-border px-6 py-3 bg-muted/20 text-[11px] text-muted-foreground">
          <span>
            Mostrando {filteredLogs.length} de {logs.length} eventos registrados en
            memoria
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpenModal(false)}
            className="h-7 text-xs"
          >
            Cerrar
          </Button>
        </footer>
      </div>
    </div>
  );
});

ErrorLogsModal.displayName = "ErrorLogsModal";
