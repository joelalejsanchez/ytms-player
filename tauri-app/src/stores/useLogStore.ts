import { create } from "zustand";
import { isTauriEnvironment } from "@/lib/utils";
import { tauriApi } from "@/services/tauriIpc";

export type LogLevel = "error" | "warn" | "info";

export interface LogEntry {
  id: string;
  timestamp: number;
  formattedTime: string;
  level: LogLevel;
  title: string;
  description?: string;
  context?: string;
  details?: unknown;
}

const STORAGE_KEY = "ytms_error_logs_history";
const MAX_LOGS = 100;

export function formatLogTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function loadPersistedLogs(): LogEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(-MAX_LOGS);
    }
  } catch {
    // Si falla la lectura, retornar array vacío de forma segura
  }
  return [];
}

function persistLogs(logs: LogEntry[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch {
    // Si la cuota está llena, continuar en memoria
  }
}

export interface LogState {
  logs: LogEntry[];
  unreadCount: number;
  filterLevel: "all" | LogLevel;
  searchQuery: string;
  isOpenModal: boolean;

  addLog: (entry: {
    level: LogLevel;
    title: string;
    description?: string;
    context?: string;
    details?: unknown;
  }) => LogEntry;
  clearLogs: () => void;
  markAllRead: () => void;
  setFilterLevel: (level: "all" | LogLevel) => void;
  setSearchQuery: (query: string) => void;
  setOpenModal: (isOpen: boolean) => void;
  exportLogsAsText: () => string;
  openLogsFolder: () => Promise<string | null>;
}

const initialLogs = loadPersistedLogs();

export const useLogStore = create<LogState>((set, get) => ({
  logs: initialLogs,
  unreadCount: 0,
  filterLevel: "all",
  searchQuery: "",
  isOpenModal: false,

  addLog: ({ level, title, description, context, details }) => {
    const now = new Date();
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: LogEntry = {
      id,
      timestamp: now.getTime(),
      formattedTime: formatLogTimestamp(now),
      level,
      title,
      description,
      context,
      details,
    };

    set((state) => {
      const nextLogs = [...state.logs.slice(-(MAX_LOGS - 1)), newEntry];
      persistLogs(nextLogs);
      return {
        logs: nextLogs,
        unreadCount: state.isOpenModal
          ? 0
          : state.unreadCount + (level === "error" ? 1 : 0),
      };
    });

    if (isTauriEnvironment()) {
      let detailsStr: string | undefined;
      if (details !== undefined && details !== null) {
        try {
          detailsStr = typeof details === "string" ? details : JSON.stringify(details);
        } catch {
          detailsStr = String(details);
        }
      }
      tauriApi
        .appendLogEntry({
          formatted_time: newEntry.formattedTime,
          level,
          title,
          description,
          context,
          details: detailsStr,
        })
        .catch(() => {});
    }

    return newEntry;
  },

  clearLogs: () => {
    set({ logs: [], unreadCount: 0 });
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    if (isTauriEnvironment()) {
      tauriApi.clearLogFile().catch(() => {});
    }
  },

  openLogsFolder: async () => {
    if (isTauriEnvironment()) {
      try {
        return await tauriApi.openLogsFolder();
      } catch {
        return null;
      }
    }
    return null;
  },

  markAllRead: () => set({ unreadCount: 0 }),
  setFilterLevel: (filterLevel) => set({ filterLevel }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setOpenModal: (isOpenModal) =>
    set({
      isOpenModal,
      unreadCount: isOpenModal ? 0 : get().unreadCount,
    }),

  exportLogsAsText: () => {
    const { logs } = get();
    const now = formatLogTimestamp(new Date());
    if (logs.length === 0) {
      return `=== REPORTE DE ERRORES Y DIAGNÓSTICO (ytms-player) ===\nFecha del reporte: ${now}\n\nNo hay registros de errores en el historial.\n`;
    }

    const lines = [
      `=== REPORTE DE ERRORES Y DIAGNÓSTICO (ytms-player) ===`,
      `Fecha del reporte: ${now}`,
      `Total de eventos registrados: ${logs.length}`,
      `--------------------------------------------------------------------------------`,
      "",
    ];

    logs.forEach((log) => {
      const levelTag = log.level.toUpperCase().padEnd(5, " ");
      const ctxTag = log.context ? ` [${log.context}]` : "";
      lines.push(`[${log.formattedTime}] [${levelTag}]${ctxTag} ${log.title}`);
      if (log.description) {
        lines.push(`  Detalle: ${log.description}`);
      }
      if (log.details) {
        try {
          lines.push(`  Datos técnicos: ${JSON.stringify(log.details)}`);
        } catch {
          // Ignorar serialización cíclica
        }
      }
      lines.push("");
    });

    return lines.join("\n");
  },
}));

/**
 * API global de Logging para emitir errores, advertencias e información técnica.
 */
export const logger = {
  error: (title: string, description?: string, context?: string, details?: unknown) =>
    useLogStore
      .getState()
      .addLog({ level: "error", title, description, context, details }),
  warn: (title: string, description?: string, context?: string, details?: unknown) =>
    useLogStore
      .getState()
      .addLog({ level: "warn", title, description, context, details }),
  info: (title: string, description?: string, context?: string, details?: unknown) =>
    useLogStore
      .getState()
      .addLog({ level: "info", title, description, context, details }),
  open: () => useLogStore.getState().setOpenModal(true),
  close: () => useLogStore.getState().setOpenModal(false),
};
