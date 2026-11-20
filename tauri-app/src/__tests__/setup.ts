import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver =
  globalThis.ResizeObserver || (MockResizeObserver as unknown as typeof ResizeObserver);

export class MockMediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: Array<{ src: string; sizes?: string; type?: string }>;

  constructor(init?: {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: Array<{ src: string; sizes?: string; type?: string }>;
  }) {
    this.title = init?.title || "";
    this.artist = init?.artist || "";
    this.album = init?.album || "";
    this.artwork = init?.artwork || [];
  }
}

// MediaMetadata constructor mock en el entorno global de pruebas
if (typeof globalThis.MediaMetadata === "undefined") {
  (globalThis as unknown as { MediaMetadata: typeof MockMediaMetadata }).MediaMetadata =
    MockMediaMetadata;
}

// Mock de navigator.mediaSession
if (typeof navigator !== "undefined" && !("mediaSession" in navigator)) {
  const handlers = new Map<string, ((details?: unknown) => void) | null>();
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    writable: true,
    value: {
      metadata: null,
      playbackState: "none",
      setActionHandler: vi.fn(
        (action: string, handler: ((details?: unknown) => void) | null) => {
          handlers.set(action, handler);
        },
      ),
      setPositionState: vi.fn(),
      _handlers: handlers,
    },
  });
}
