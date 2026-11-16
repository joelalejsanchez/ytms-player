import { AmbientAuraPreview, AmbientAuraVisualizer } from "./components/AmbientAuraVisualizer";
import { CoverWavesPreview, CoverWavesVisualizer } from "./components/CoverWavesVisualizer";
import { SpectrumPreview, SpectrumVisualizer } from "./components/SpectrumVisualizer";
import { VinylPreview, VinylVisualizer } from "./components/VinylVisualizer";
import type { VisualizerModule } from "./types";

/**
 * Registro central de visualizadores de audio.
 * Proporciona una API modular y extensible para que cualquier módulo
 * (incluyendo extensiones o animaciones futuras) pueda registrarse en el sistema.
 */
class VisualizerRegistry {
  private modules = new Map<string, VisualizerModule>();

  constructor() {
    // 1. Disco de Vinilo (33 RPM)
    this.register({
      metadata: {
        id: "vinyl",
        name: "Disco de Vinilo (33 RPM)",
        description:
          "Clásico disco analógico de acetato con surcos reflexivos, carátula central giratoria y brazo de aguja móvil.",
        author: "ytms-player Core",
        version: "1.0.0",
        tags: ["retro", "analógico", "clásico"],
      },
      Component: VinylVisualizer,
      PreviewComponent: VinylPreview,
    });

    // 2. Barras Dinámicas de Espectro
    this.register({
      metadata: {
        id: "spectrum",
        name: "Barras Dinámicas de Espectro",
        description:
          "Ecualizador visual reactivo con barras verticales que responden en tiempo real al volumen, graves y agudos del audio.",
        author: "ytms-player Core",
        version: "1.0.0",
        tags: ["ecualizador", "frecuencia", "reactivo"],
      },
      Component: SpectrumVisualizer,
      PreviewComponent: SpectrumPreview,
    });

    // 3. Aura Líquida / Onda Resonante Ambiental
    this.register({
      metadata: {
        id: "ambient-aura",
        name: "Aura Líquida / Onda Resonante",
        description:
          "Anillos concéntricos fluidos y ondas de resplandor ambiental que respiran orgánicamente al ritmo de la música.",
        author: "ytms-player Core",
        version: "1.0.0",
        tags: ["aura", "ambiental", "ondas"],
      },
      Component: AmbientAuraVisualizer,
      PreviewComponent: AmbientAuraPreview,
    });

    // 4. Carátula con Ondas Sonoras
    this.register({
      metadata: {
        id: "cover-waves",
        name: "Carátula con Ondas Sonoras",
        description:
          "Portada estática enmarcada con ondas sonoras dinámicas directamente debajo que representan la vibración del sonido.",
        author: "ytms-player Core",
        version: "1.0.0",
        tags: ["caratula", "ondas", "minimalista"],
      },
      Component: CoverWavesVisualizer,
      PreviewComponent: CoverWavesPreview,
    });
  }

  /**
   * Registra un nuevo módulo de visualización en el sistema.
   */
  public register(module: VisualizerModule): void {
    this.modules.set(module.metadata.id, module);
  }

  /**
   * Desregistra un módulo por su ID.
   */
  public unregister(id: string): boolean {
    return this.modules.delete(id);
  }

  /**
   * Obtiene un módulo por su identificador.
   */
  public get(id: string): VisualizerModule | undefined {
    return this.modules.get(id);
  }

  /**
   * Obtiene la lista completa de todos los módulos registrados.
   */
  public getAll(): VisualizerModule[] {
    return Array.from(this.modules.values());
  }
}

export const visualizerRegistry = new VisualizerRegistry();

/**
 * API pública de exportación: registra un módulo de visualización personalizado.
 *
 * @example
 * ```ts
 * registerVisualizer({
 *   metadata: {
 *     id: "my-custom-wave",
 *     name: "Onda Neón",
 *     description: "Animación de ondas...",
 *   },
 *   Component: MyCustomWaveComponent,
 *   PreviewComponent: MyCustomWavePreview,
 * });
 * ```
 */
export function registerVisualizer(module: VisualizerModule): void {
  visualizerRegistry.register(module);
}

/**
 * API pública de exportación: obtiene un visualizador por ID.
 */
export function getVisualizer(id: string): VisualizerModule | undefined {
  return visualizerRegistry.get(id);
}

/**
 * API pública de exportación: retorna todos los visualizadores disponibles.
 */
export function getAllVisualizers(): VisualizerModule[] {
  return visualizerRegistry.getAll();
}
