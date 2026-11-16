import { useEffect, useState } from "react";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Hook reactivo para extraer de forma instantánea el color dominante y vibrante
 * de la portada de un álbum mediante un canvas offscreen de baja resolución.
 *
 * Aplica un filtro de contraste y saturación para descartar blancos puros,
 * negros profundos y grises apagados, seleccionando el tono cromático más representativo.
 */
export function useCoverDominantColor(imageUrl?: string | null): RGBColor | null {
  const [dominantColor, setDominantColor] = useState<RGBColor | null>(null);

  useEffect(() => {
    if (!imageUrl || typeof window === "undefined") {
      setDominantColor(null);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (!isMounted) return;

      try {
        const canvas = document.createElement("canvas");
        const size = 32; // Muestreo ligero de 32x32 para procesamiento ultra-rápido (< 2ms)
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          setDominantColor(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let bestScore = -1;
        let bestColor: RGBColor | null = null;
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let validPixels = 0;

        // Analizar píxeles en pasos de 4 para máxima eficiencia
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          totalR += r;
          totalG += g;
          totalB += b;
          validPixels++;

          // Luminancia percibida (fórmula estándar ITU-R BT.601)
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Descartar extremos muy oscuros o casi blancos
          if (lum < 25 || lum > 235) continue;

          // Saturación cromática (diferencia entre canales)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = (max - min) / 255;

          // Ponderar saturación y contraste armónico
          const score = sat * 3 + (1 - Math.abs(lum / 255 - 0.5));

          if (score > bestScore) {
            bestScore = score;
            bestColor = { r, g, b };
          }
        }

        if (bestColor) {
          setDominantColor(bestColor);
        } else if (validPixels > 0) {
          // Si es una imagen en blanco y negro o monocromática, usar el promedio
          setDominantColor({
            r: Math.round(totalR / validPixels),
            g: Math.round(totalG / validPixels),
            b: Math.round(totalB / validPixels),
          });
        } else {
          setDominantColor(null);
        }
      } catch {
        // En caso de restricciones CORS o error de decodificación, retornar null de forma segura
        setDominantColor(null);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setDominantColor(null);
      }
    };

    img.src = imageUrl;

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  return dominantColor;
}
