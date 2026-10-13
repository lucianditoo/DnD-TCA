# Walkthrough — Demostración Táctica Automática y Guionada (`scripted_tactical_demo_v1`)

Responsabilidad: Resumen del último cierre ejecutado (motivos, archivos tocados, validaciones y estado final).
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [Diseño NDD](docs/designs/scripted-combat-demo.md), [Plan de Implementación](docs/designs/scripted-combat-demo/implementation-plan.md)
Consumidores: Architecture Reviewer y agentes que retoman el repositorio.

---

## 1. Objetivo del Cierre

Implementar la **Demostración Táctica Automática y Guionada** (`scripted_tactical_demo_v1`) conforme al NDD aprobado (`docs/designs/scripted-combat-demo.md`, commit `f8c0e9d`) y al Plan de Implementación R1 aprobado (`docs/designs/scripted-combat-demo/implementation-plan.md`, commit `20a10b9`), permitiendo al usuario pulsar **"Empezar demo"** desde la pantalla inicial, ingresar automáticamente a una sala efímera aislada y observar la ejecución autoritativa de las tres escenas tácticas con controles de reproducción (`Pausar`, `Continuar`, `Siguiente paso`, velocidad `0.5x`/`1x`/`2x`, `Reiniciar escena`, `Reiniciar demo` y `Salir de la demo`).

---

## 2. Cambios Implementados por Paquete

### 2.1 `@dnd-tactical/shared`
- [`packages/shared/src/types.ts`](packages/shared/src/types.ts):
  - Incorporados los contratos de red `DemoSpeedMultiplier`, `DemoClientCommand`, `DemoSessionState`, `DemoServerEvent` e integración de `DemoServerEvent` en `ServerEvent`.
- [`packages/shared/src/schemas/commands/demoCommands.ts`](packages/shared/src/schemas/commands/demoCommands.ts) y [`packages/shared/src/schemas/commands/index.ts`](packages/shared/src/schemas/commands/index.ts):
  - Schemas Zod estrictos (`.strict()`) para `start-demo`, `pause-demo`, `resume-demo`, `step-demo`, `set-demo-speed`, `restart-demo`, `exit-demo` y eventos `demo-session-state` / `demo-exited`.
- [`packages/shared/src/demo/types.ts`](packages/shared/src/demo/types.ts) y [`packages/shared/src/demo/catalog.ts`](packages/shared/src/demo/catalog.ts):
  - Tipos declarativos del guion (`DemoStepCheckpoint`, `DemoStepCommandSpec`, `DemoManeuverRolls`, `DemoStepDefinition`, `DemoSceneDefinition`, `DemoScriptDefinition`) y catálogo `scripted_tactical_demo_v1` con perfiles source-first y las tres escenas completas:
    - **Escena A — La Emboscada**: Iniciativa, `srd_flat_footed`, ataque melee, posicionamiento de flanqueo (+2), Ataque Furtivo (+2d6), amenaza y confirmación de crítico (multiplicando el daño del arma sin multiplicar los dados de precisión) y disparo con arco largo consumiendo munición.
    - **Escena B — Posición, Cobertura, AdO y Espacio Estrecho**: Cobertura por interposición de criatura (+4 CA), reposicionamiento aliado, Ataque de Oportunidad al salir de casilla amenazada, Apretujarse (`srd_squeezing`) de criatura Large (2×2) en corredor estrecho de 5 ft (`narrowCells`), terreno difícil (coste doble) y segundo disparo despejado tras transición a Ronda 2.
    - **Escena C — Maniobras y Magia**: Derribo (`trip`) sin *Improved Trip* provocando AdO defensivo interruptivo antes del toque y prueba opuesta aplicando `srd_prone`, conjuro de toque *Shocking Grasp* en casilla amenazada en 3 pasos (intento que provoca AdO y suspende en `opportunity-resolution`, resolución del AdO agotando la reacción de Ronda 1, segundo lanzamiento que impacta Touch AC y consume slot), transición a Ronda 2 restaurando reacciones (`opportunityAttacksThisRound = 0`), levantarse (`stand-up`) provocando AdO de Cedrick, y lanzamiento de *Hold Person* en Ronda 2 en 3 pasos con salvación de Voluntad fallida aplicando `srd_paralyzed`.

### 2.2 `@dnd-tactical/server`
- [`apps/server/src/commands/dispatcher.ts`](apps/server/src/commands/dispatcher.ts):
  - Extraído el núcleo compartido `dispatchCommandCore(socket, command, context?)` reutilizado tanto por `dispatchCommand` (entrada externa de WebSocket sin contexto RNG) como por `dispatchInternalDemoCommand` (entrada interna del runner que ejecuta `validateClientCommand` antes de invocar `dispatchCommandCore`).
  - Guardia autoritativa `isDemoRoom`: bloquea `join-room` manuales de terceros y rechaza cualquier comando manual de combate enviado desde clientes externos sobre salas de demostración.
- [`apps/server/src/commands/specialManeuverCommands.ts`](apps/server/src/commands/specialManeuverCommands.ts):
  - Extendido `ManeuverDiceSource` con `rollDie?(sides: number): number` opcional y propagado a `resolveInterruptingOpportunityAttack`.
- [`apps/server/src/demo/sessionStore.ts`](apps/server/src/demo/sessionStore.ts), [`apps/server/src/demo/runner.ts`](apps/server/src/demo/runner.ts) y [`apps/server/src/demo/demoCommands.ts`](apps/server/src/demo/demoCommands.ts):
  - Almacén efímero de sesiones de demo vinculadas a su `socket` propietario y sala clonada (`structuredClone(scene.board)`), con limpieza determinista al salir (`exit-demo`), reiniciar (`restart-demo`) o desconectar (`close`) sin tocar otras salas ni invocar `/api/test/reset`.
  - Runner autoritativo secuencial con bandera `commandInFlight`, inyección RNG determinista por paso (`createStepRngContext`) que verifica consumo exacto de todas las tiradas preparadas, y validador de checkpoints (`verifyStepCheckpoint`) que transiciona a `failed` ante cualquier desviación.
- [`apps/server/src/index.ts`](apps/server/src/index.ts):
  - Enrutamiento de `DemoClientCommand` hacia `validateDemoCommand` + `handleDemoCommand` y limpieza automática con `destroyDemoSessionBySocket(socket)` en `socket.on("close")`.

### 2.3 `@dnd-tactical/web`
- [`apps/web/src/components/DemoPanel/DemoPanel.tsx`](apps/web/src/components/DemoPanel/DemoPanel.tsx):
  - Panel de progreso de escena/paso, actor activo, resumen de acción, explicación pedagógica de la regla y controles de transporte (`Pausar`/`Continuar`, `Siguiente paso`, selector `0.5x`/`1x`/`2x`, `Reiniciar escena`, `Reiniciar demo`, `Salir de la demo`).
- [`apps/web/src/hooks/useWebSocketRoom.ts`](apps/web/src/hooks/useWebSocketRoom.ts), [`apps/web/src/components/ConnectionPanel/ConnectionPanel.tsx`](apps/web/src/components/ConnectionPanel/ConnectionPanel.tsx) y [`apps/web/src/App.tsx`](apps/web/src/App.tsx):
  - Botón **"Empezar demo"** en `ConnectionPanel`, suscripción a `demo-session-state` y `demo-exited`, e inspección pasiva de fichas/celdas durante la demo bloqueando la emisión de comandos manuales de combate.

---

## 3. Validaciones Ejecutadas

- `npm test`: **648/648 pruebas en verde** (incluyendo `tests/demo-contracts.test.mjs`, `tests/demo-isolation.test.mjs`, `tests/demo-rng.test.mjs` y `tests/demo-runner.test.mjs`).
- `npm run typecheck`: **0 errores** (`shared`, `web`, `server`).
- `npm run build`: **0 errores** (`shared`, `web`, `server`).
- `node scripts/e2e-websocket.mjs`: **106/106 aserciones en verde** (exit 0).
- `npm run test:ui`: **8/8 escenarios Playwright en verde** (incluyendo `tests-ui/demo.spec.ts`).

---

## 4. Gate Documental de Cierre (`AGENTS.md` §4.5.1)

1. **Enlaces**: Verificados los enlaces internos en `PROJECT_STATUS.md`, `docs/testing/master-coverage.md`, `docs/designs/scripted-combat-demo/implementation-plan.md` y este `walkthrough.md`.
2. **Responsabilidad única**: No se crearon documentos huérfanos ni duplicados; `INDEX.md` ya indexa `docs/designs/scripted-combat-demo.md` y `docs/designs/scripted-combat-demo/implementation-plan.md`.
3. **Registry consistente**: La demo reutiliza las reglas existentes sin alterar estados normativos en `docs/rules/registry.md` ni conectar D-1B-I4/I5/I6.
4. **Snapshots sincronizados**: `PROJECT_STATUS.md`, `docs/testing/master-coverage.md`, `docs/designs/scripted-combat-demo/implementation-plan.md` y `walkthrough.md` describen exactamente el sistema implementado.
5. **Preservación de archivos locales ajenos**: `.claude/settings.local.json`, `test.txt` e `implementation_plan.md` (raíz, correspondiente a D-1B-I5R1) permanecieron intactos y fuera del commit.
