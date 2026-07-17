# Evaluación de Testing E2E con Playwright

## 1. ¿Playwright encaja bien con la arquitectura actual?
Sí, de manera excelente. La arquitectura Vite (Frontend) + Express/WS (Backend) arranca muy rápido, lo cual es ideal para el `webServer` de Playwright. Además, Playwright permite instanciar múltiples contextos de navegador en el mismo test, lo que posibilitaría abrir una pestaña como GM y otra como Jugador para validar la sincronización real por WebSocket en tiempo real.

## 2. Cambios mínimos para testear la UI de forma estable
- Instalar dependencias: `@playwright/test` en el root del monorepo o en `apps/web`.
- Configurar un `playwright.config.ts`.
- **Aislamiento de Estado**: Actualmente el backend usa una única variable en memoria para la sala (`state` en `roomStore.ts`). Para ejecutar tests de Playwright confiables (incluso si se corren secuencialmente), se necesita un mecanismo para **limpiar** la sala entre pruebas. Un simple endpoint HTTP `POST /api/test/reset` habilitado solo si el server se lanza con una variable de entorno (`TEST_MODE=true`) solucionaría este punto.
- Forzar `workers: 1` en Playwright para evitar colisiones si se ataca al mismo backend en memoria.

## 3. Estrategia de Selectores (data-testid vs semánticos)
- **Selectores Semánticos (Recomendados):** Para interacciones generales, Playwright brilla usando `getByRole('button', { name: 'Terminar Turno' })` o `getByText('Hay ataques de oportunidad pendientes')`. Esto valida accesibilidad y lo que realmente ve el usuario.
- **`data-testid` (Necesarios para el Board):** Dado que el `CombatBoard` dibuja celdas iterando posiciones absolutas (X, Y), es crítico agregar algo como `data-testid="cell-2-4"` a los divs del tablero, y `data-testid="token-hero-123"` a los combatientes. Esto permite a Playwright hacer clics exactos y drag-and-drop sin depender de coordenadas de píxeles frágiles.

## 4. Levantamiento de Servidor y Web
Playwright tiene la funcionalidad nativa de [webServer](https://playwright.dev/docs/test-webserver). Se configuraría para ejecutar ambos servicios en paralelo y esperar a que estén listos antes de lanzar los tests:
```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev', // Levanta tanto dev:server como dev:web usando npm-run-all
  url: 'http://localhost:5173', // Espera a que Vite responda
  reuseExistingServer: !process.env.CI,
}
```

## 5. Integración con Scripts Actuales
- En `package.json` raíz se agregaría `"test:ui": "playwright test"`.
- El script de E2E por WebSocket actual no competiría, simplemente existirían ambos.
- Playwright reemplazaría a pruebas manuales pero complementaría a las de WS. Seguirían viviendo pacíficamente, siendo `npm test` la validación unitaria rápida.

## 6. Primer Escenario Recomendado ("Smoke Test Táctico Visual")
Validaría de extremo a extremo la funcionalidad más compleja del motor:
1. **Setup**: Abrir `http://localhost:5173`, crear sala.
2. **Preparación**: Agregar un aliado y un enemigo al tablero.
3. **Inicio**: Iniciar el combate.
4. **Interacción de Reglas**: Mover al aliado saliendo de una celda amenazada por el enemigo (requiere `data-testid` en las celdas).
5. **Validación Reactiva UI**: 
   - Verificar que la UI muestra que hay un Ataque de Oportunidad pendiente.
   - Hacer clic en "Terminar Turno" y validar visualmente que muestra error y no deja avanzar.
6. **Resolución**: Abrir Panel GM, limpiar AdO.
7. **Continuación**: Terminar turno exitosamente y validar que cambió el combatiente activo.

## 7. Riesgos del Enfoque
- **Flakiness por Asincronía WS:** La UI se actualiza asíncronamente cuando llega el mensaje de WebSocket. Las aserciones deben usar SIEMPRE `expect(locator).toBeVisible()` (que espera automáticamente) en lugar de verificar estado síncrono.
- **Tiempos de Ejecución:** Los tests e2e visuales son caros en tiempo. Abusar de ellos ralentizará el CI/desarrollo local.
- **Cambios Estéticos Rompiendo Tests:** Si se cambian las etiquetas de botones (ej. "Mover" a "Desplazar"), los tests fallarán. Usar selectores resilientes es clave.

## 8. Qué NO testear con Playwright
- **Toda la casuística de reglas de D&D 3.5**: Combinaciones de críticos, rangos de armas, cálculo de modificadores. Todo esto se ejecuta en milisegundos en `rules.test.mjs` o `attack-rules.test.mjs`. Playwright asume que el backend calcula bien y solo verifica que la UI reaccione correctamente.
- **Inyecciones o validaciones Zod maliciosas**: Enviar payloads con un ID falso o propiedades inyectadas para ver si el server las rechaza. Esto ya está y debe seguir estando en la suite unitaria o en `e2e-websocket.mjs`, ya que la UI ni siquiera permite generar esos escenarios.
- **Rendimiento puro de WebSocket**: Carga de 100 monstruos. Es mejor hacerlo de forma automatizada (WS o API). Playwright solo debe usarse para **Viajes Críticos del Usuario (CUJs)**.
