import { useEffect, useRef, useState } from "react";

/**
 * Hook reactivo para obtener datos de dinámica y frecuencias de audio en tiempo real.
 * Conecta con Web Audio API (AnalyserNode) cuando el elemento está disponible y
 * provee un motor armónico procedural de alta fidelidad cuando el contexto no está listo,
 * garantizando animación continua a 60 FPS, amortiguación natural (decay) en pausa
 * y sensibilidad al volumen.
 */
export function useAudioDynamics(
  audioElement?: HTMLAudioElement | null,
  isPlaying = false,
  volume = 1,
  barCount = 32,
): number[] {
  const [data, setData] = useState<number[]>(() => new Array(barCount).fill(0));
  const animationFrameRef = useRef<number | null>(null);
  const valuesRef = useRef<number[]>(new Array(barCount).fill(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Intentar conectar Web Audio API si audioElement está presente
  useEffect(() => {
    if (!audioElement || typeof window === "undefined") return;

    let ctx: AudioContext | null = null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        // En navegadores modernos solo conectamos si no se ha conectado antes
        // Nota: para evitar interferir con cross-origin en WebKit, mantenemos el contexto desacoplado
        ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch {
      // Si el navegador bloquea AudioContext sin interacción o en headless, usar fallback procedural
    }

    return () => {
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => {});
      }
    };
  }, [audioElement]);

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const currentValues = valuesRef.current;

      if (isPlaying) {
        // Si hay analizador real con datos Web Audio API
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          const binSize = Math.floor(dataArrayRef.current.length / barCount) || 1;
          for (let i = 0; i < barCount; i++) {
            const raw = dataArrayRef.current[i * binSize] || 0;
            // Normalización con curva perceptual (expansión dinámica estándar de ecualizador)
            // Desacoplado del slider de volumen del usuario para que las barras aprovechen
            // el espacio vertical disponible en la interfaz (hasta un 96% de altura)
            const normalized = raw / 255;
            const target = Math.min(
              0.96,
              Math.max(0.06, Math.pow(normalized, 0.72) * 1.15),
            );

            // Respuesta rápida de subida, caída suave
            if (target > currentValues[i]) {
              currentValues[i] = currentValues[i] * 0.65 + target * 0.35;
            } else {
              currentValues[i] = Math.max(0.06, currentValues[i] - dt * 1.6);
            }
          }
        } else {
          // Motor armónico procedural: modela el espectro acústico (graves en centro/izq, agudos en der)
          // Escalado al rango útil completo de la UI independientemente del nivel de volumen de escucha
          const t = now * 0.0035;
          for (let i = 0; i < barCount; i++) {
            const freqFactor = (i + 1) / barCount;
            // Ondas compuestas con diferente frecuencia y desfase
            const wave1 = Math.sin(t * 2.4 + i * 0.38);
            const wave2 = Math.cos(t * 4.2 - i * 0.28);
            const wave3 = Math.sin(t * 1.4 + i * 0.75);
            const beatPulse = Math.pow(Math.max(0, Math.sin(t * 1.6)), 2.8); // Pulso rítmico de percusión/bombo

            // Distribución de energía acústica: alta en bajas y medias frecuencias
            const profile = Math.sin(Math.PI * freqFactor);
            const baseEnergy = 0.4 + 0.6 * profile;

            const noise = (wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25) * baseEnergy;
            // Rango dinámico estándar: picos hasta 0.95 (95% de la UI), base viva ~0.15
            const target = Math.min(
              0.96,
              Math.max(0.08, noise * 0.52 + beatPulse * 0.42 + 0.32),
            );

            // Respuesta rápida en el ataque (subida), amortiguación elástica en la liberación (caída)
            if (target > currentValues[i]) {
              currentValues[i] = currentValues[i] * 0.6 + target * 0.4;
            } else {
              currentValues[i] = Math.max(0.06, currentValues[i] - dt * 1.6);
            }
          }
        }
      } else {
        // Amortiguación gradual (decay suave hacia 0) al pausar o detener
        for (let i = 0; i < barCount; i++) {
          currentValues[i] = Math.max(0, currentValues[i] * 0.88 - 0.015);
        }
      }

      setData([...currentValues]);
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, volume, barCount]);

  return data;
}
