import React, { useEffect, useRef, useState } from "react";

export interface ScrollableTextProps {
  text: string;
  className?: string;
  containerClassName?: string;
  title?: string;
}

/**
 * Componente que renderiza texto con detección automática de desbordamiento horizontal.
 * Si el texto excede el ancho disponible de su contenedor padre, activa una animación
 * lineal de desplazamiento (marquee): espera ~1s al inicio, avanza de forma constante hasta
 * el final y vuelve de golpe sin animación antes de repetir el ciclo.
 */
export const ScrollableText: React.FC<ScrollableTextProps> = ({
  text,
  className = "",
  containerClassName = "",
  title,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    const calculateOverflow = () => {
      if (containerRef.current && textRef.current) {
        const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
        setOverflowDistance(diff > 4 ? diff : 0);
      }
    };

    calculateOverflow();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(() => {
        calculateOverflow();
      });
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", calculateOverflow);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener("resize", calculateOverflow);
    };
  }, [text]);

  const duration = Math.max(3.5, overflowDistance / 35 + 1.2);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden whitespace-nowrap min-w-0 ${containerClassName}`}
      title={title || text}
    >
      <span
        ref={textRef}
        className={`inline-block ${
          overflowDistance > 0 ? "animate-marquee-scroll" : ""
        } ${className}`}
        style={
          overflowDistance > 0
            ? ({
                "--marquee-shift": `-${overflowDistance}px`,
                "--marquee-duration": `${duration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
};
