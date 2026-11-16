import type { Track } from "@/types/models";

/**
 * Propiedades estándar inyectadas en cualquier componente de visualización de audio.
 * Esta interfaz sirve como contrato público (API de exportación) para permitir
 * que desarrolladores externos o módulos futuros implementen sus propios efectos visuales.
 */
export interface VisualizerProps {
  /** Metadatos de la pista en reproducción actual */
  track: Track | null;
  /** Estado de reproducción (true si está sonando el audio) */
  isPlaying: boolean;
  /** Tiempo actual de reproducción en segundos */
  currentTime: number;
  /** Duración total de la canción en segundos */
  duration: number;
  /** Nivel de volumen actual calibrado de 0.0 a 1.0 */
  volume: number;
  /** Indicador de si el audio está silenciado */
  isMuted: boolean;
  /** Elemento HTMLAudioElement opcional para análisis de frecuencia y Web Audio API */
  audioElement?: HTMLAudioElement | null;
  /** Indicador de si la vista está en modo pantalla completa expandida */
  isExpanded?: boolean;
  /** Clase CSS adicional para maquetado personalizado */
  className?: string;
}

/**
 * Metadatos descriptivos de un módulo de visualización.
 */
export interface VisualizerMetadata {
  /** Identificador único (ej. "vinyl", "spectrum", "ambient-aura") */
  id: string;
  /** Nombre visible para el usuario en la interfaz */
  name: string;
  /** Descripción concisa de la animación */
  description: string;
  /** Autor del visualizador */
  author?: string;
  /** Versión del visualizador */
  version?: string;
  /** Etiquetas temáticas opcionales */
  tags?: string[];
}

/**
 * Módulo de visualización registrable en el sistema.
 */
export interface VisualizerModule {
  metadata: VisualizerMetadata;
  /** Componente principal de visualización */
  Component: React.ComponentType<VisualizerProps>;
  /** Componente compacto de previsualización para la sección de Ajustes (hover) */
  PreviewComponent?: React.ComponentType<VisualizerProps>;
}
