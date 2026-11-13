---
name: testing
description: Estrategias, herramientas y pautas para realizar pruebas unitarias, de integración y de contratos en el microservicio Go y la aplicación Tauri.
---

# Skill: Testing (Pruebas y Validación)

## 1. Backend en Go (Clean Architecture)

- **Pruebas Unitarias de Casos de Uso:** Aislar la lógica de negocio simulando (mocking) las interfaces de repositorios y adaptadores externos (como el ejecutor de `yt-dlp`).
- **Handlers HTTP & SSE:** Validar las respuestas de los endpoints REST utilizando `net/http/httptest` y comprobar el correcto flujo de eventos en tiempo real.
- **Mocks de Comandos:** Crear wrappers alrededor de la ejecución del sistema operativo para probar el comportamiento ante fallos de `yt-dlp` sin requerir descargas reales en los tests automatizados.

## 2. Frontend y Tauri

- **Vitest & Testing Library:** Escribir pruebas unitarias para hooks personalizados y componentes UI puros (_stateless_).
- **Pruebas de Stores Zustand:** Verificar que las acciones de los stores actualicen correctamente el estado local y sincronicen asíncronamente con los adaptadores.
- **Pruebas de Contrato IPC:** Validar la comunicación segura entre los comandos definidos en Rust (`#[tauri::command]`) y las interfaces de TypeScript en React.
