# Plan de Implementación: Sprint 050 — Panel de Estados del GM

## Meta y Resumen

Este sprint es exclusivamente de auditoría y diseño (ver
`docs/designs/gm-condition-panel.md`). No se implementa código. Este plan
describe el trabajo que un sprint *futuro* debería ejecutar para construir el
panel administrativo de condiciones, condicionado a aprobación explícita antes
de tocar cualquier archivo de producción.

## Cambios propuestos (para el sprint futuro de implementación, NO para este)

### 1. `packages/shared/src/types.ts`
- **[MODIFY]** Agregar la variante de comando `{ type: "gm-remove-effect";
  roomCode: string; actorId: string; instanceId: string }` a `ClientCommand`.
  No se toca `gm-apply-effect` — ya es genérico y suficiente.

### 2. `packages/shared/src/schemas/commands/gmCommands.ts` + `index.ts`
- **[MODIFY]** Nuevo `gmRemoveEffectSchema` (mismo patrón que
  `gmApplyEffectSchema`), registrado en el mapa de esquemas de
  `schemas/commands/index.ts`.

### 3. `apps/server/src/commands/gmCommands.ts`
- **[MODIFY]** Nuevo `handleGmRemoveEffect(room, command)`: `requireGM`, busca
  la instancia por `instanceId` (error explícito si no existe), llama
  `EffectManager.removeMany(room, [instanceId])`, loguea y `broadcast`. Sin
  ninguna rama por `effectId` — el handler no decide reglas, solo remueve la
  instancia indicada.

### 4. `apps/server/src/commands/dispatcher.ts`
- **[MODIFY]** `case "gm-remove-effect": handleGmRemoveEffect(room, command); return;`

### 5. UI (fuera de alcance de este sprint de diseño; a definir en el sprint de implementación)
- Panel que, por combatiente seleccionado, liste `EffectQueries.getByTarget` +
  `effectsCatalog[instance.effectId]` (nombre, duración, origen), con un botón
  "Remover" por instancia (`gm-remove-effect`) y un selector para "Aplicar" que
  envíe `gm-apply-effect` con el `effectId` elegido del catálogo. Sin
  previsualización de `onStack`/`severityChain` en cliente.

### 6. Tests (fuera de alcance de este sprint; a escribir junto con la
implementación futura)
- `tests/gm-condition-panel-server.test.mjs` (nombre tentativo): `gm-remove-effect`
  remueve por `instanceId`, rechaza `instanceId` inexistente, no-GM rechazado,
  `gm-apply-effect` seguido de reaplicación ejercita `onStack` end-to-end
  (Fatigued→Exhausted, Prone duplicado ignorado) para confirmar que el panel no
  necesita lógica propia.

## Verification Plan (para el sprint de implementación futuro)

### Automated Tests
```powershell
npm run build
npm test
npm run typecheck
node scripts/e2e-websocket.mjs
npm run test:ui
```

### Manual Verification
1. GM abre el panel sobre un combatiente, aplica Fatigado dos veces y confirma
   que el segundo `room-update` refleja Exhausted (no dos instancias).
2. GM remueve una instancia específica por `instanceId` y confirma que solo esa
   desaparece del listado.
3. Jugador (no-GM) no puede ver ni accionar los controles del panel.

## Estado de este documento

Este plan describe trabajo **no autorizado para ejecutarse todavía**. Sprint
050 (el sprint actual) es de diseño/auditoría únicamente; ver
`docs/designs/gm-condition-panel.md` para la justificación completa de cada
punto. Ningún cambio de este plan se implementa hasta un `Proceed` explícito en
un sprint posterior.
