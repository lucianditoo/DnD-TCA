# Sprint 050 — Panel de Estados del GM (Diseño y Auditoría)

**Estado:** solo diseño/auditoría — sin código, sin tests, sin Registry, sin Rule IDs.

**Pregunta arquitectónica única:** ¿Cómo debería administrar estados un Director
de Juego sin romper el modelo declarativo del motor?

## 0. Método

Todo lo que sigue surge de leer el código real, no de preferencias. Archivos
auditados: `apps/server/src/commands/gmCommands.ts`, `dispatcher.ts`,
`auth/control.ts`, `apps/server/src/room/roomStore.ts`,
`packages/shared/src/effects/{manager,queries,tick,catalog,contracts}.ts`,
`packages/shared/src/types.ts`, `packages/shared/src/schemas/commands/*.ts`,
`apps/web/src/{App.tsx,viewModel.ts,components/Board/Board.tsx}`.

## 1. ¿Qué comandos administrativos existen hoy?

Nueve comandos GM, todos wireados en `dispatcher.ts` y protegidos por
`requireGM(actorId)` (`auth/control.ts`): un chequeo de rol plano
(`participant.role === "gm"`), sin restricción de ownership por combatiente (a
diferencia de `requireCombatantControl`, que sí exige control del combatiente para
acciones normales de jugador).

| Comando | Handler | Efecto |
|---|---|---|
| `heal-combatant` | `handleHealCombatant` | Cura HP |
| `gm-move-combatant` | `handleGmMoveCombatant` | Reposiciona |
| `gm-set-hp` | `handleGmSetHp` | Ajusta HP directo |
| `gm-set-status` | `handleGmSetStatus` | Cambia `LifeStatus` (`active/disabled/dying/stable/dead`) — **sistema separado de ActiveEffects, no lo tocamos** |
| `gm-clear-opportunities` | `handleGmClearOpportunities` | Limpia AdO pendientes |
| `gm-add-log` | `handleGmAddLog` | Nota de texto libre |
| `gm-force-outcome` | `handleGmForceOutcome` | Fuerza resultado de combate |
| **`gm-apply-effect`** | **`handleGmApplyEffect`** | **Ya inyecta cualquier `effectId` del catálogo sobre un combatiente vía `EffectManager.add`** |
| **`gm-apply-environmental-hazard`** | **`handleGmApplyEnvironmentalHazard`** | **Ya ancla un hazard sobre `targetCells` vía `EffectManager.add`** |

`gm-apply-effect` (`gmCommands.ts:79-109`) ya existe y ya es exactamente el
comando genérico que un panel de condiciones necesitaría para *aplicar*: valida
GM, valida `effectId` contra el catálogo (`isProductionEffectId`), construye un
`EffectInstance` con `source:{type:"system"}` y un `duration` opcional
(`until_target_turn_end` es hoy el único preset), delega en `EffectManager.add`,
loguea y hace `broadcast`. **No contiene ninguna regla de juego propia.**

No existe ningún comando `gm-remove-effect` ni equivalente. El único
`EffectManager.remove`/`removeMany` en producción fuera del Tick Layor
(expiración automática) es `specialManeuverCommands.ts:203`, una remoción
puramente de regla de juego (limpieza de un efecto de Squeezing al confirmar un
movimiento), no una acción administrativa del GM. **Esta es la única pieza de
infraestructura de comando que falta realmente** (ver §5).

## 2. ¿Cómo se agregan efectos hoy?

`grep` exhaustivo de `EffectManager.add/remove/removeMany` en `apps/server/src`
y `packages/shared/src`:

| Módulo | Llama | Naturaleza |
|---|---|---|
| `gmCommands.ts` (`handleGmApplyEffect`, `handleGmApplyEnvironmentalHazard`) | `add` | **Administrativa (GM)** |
| `abilityResolver.ts` | `add` | Regla de juego (aptitud con efecto) |
| `environmentalHazardResolver.ts` | `add` | Regla de juego (efecto secundario de hazard) |
| `spatialTransition.ts` | `remove Many` + `add` | Regla de juego (Squeezing al moverse) |
| `initiativeCommands.ts` | `add` | Regla de juego (Flat-Footed al iniciar combate) |
| `specialManeuverCommands.ts` | `remove`, `add` | Regla de juego (Prone/Grapple por maniobra) |
| `tacticalCommands.ts` | `add` | Regla de juego (ej. Squeezing por posición) |
| `tick.ts` | `removeMany` | Infraestructura (expiración automática) |

Todo constructor de `EffectInstance` vive en el servidor (nunca en React) y pasa
siempre por `EffectManager.add`/`remove`/`removeMany` — no hay una segunda vía de
mutación de `effectInstances`. El panel no necesitaría inventar nada aquí: ya es
"una fuente más" que construye una `EffectInstance` y llama `EffectManager.add`,
exactamente igual que las siete fuentes de regla de juego ya existentes.

## 3. ¿Cómo debería integrarse el panel?

**Reutilizar `gm-apply-effect` para aplicar. Crear un `gm-remove-effect` nuevo,
simétrico, para remover.** No se justifica un comando específico por condición
(`gm-apply-fatigued`, etc.) — el comando ya es genérico por `effectId` y el
catálogo ya es la única fuente de verdad sobre qué efectos existen
(`isProductionEffectId`). Crear un comando por condición violaría exactamente el
principio que Sprint 044.1 ya estableció para el Registry ("una regla, no una
fila por variante") trasladado a comandos.

Justificación por evidencia, no por preferencia: `handleGmApplyEffect` ya es
100% genérico, ya delega el 100% de la decisión de stacking a
`EffectManager.add` (Sprint 049), y ya no contiene ninguna rama por `effectId`.
Es el comando correcto para que un panel simplemente ofrezca una lista del
catálogo y un selector de objetivo/duración.

## 4. ¿Qué debe mostrar la UI? (solo campos que ya existen)

El cliente ya reconstruye `createCombatRulesSnapshot(room)` localmente
(`App.tsx:57`, `viewModel.ts`, `useBoardSelection.ts` — función compartida, pura,
la misma que usa el servidor) y `broadcast()` (`roomStore.ts:17-21`) envía el
`CombatRoom` completo a **todos** los clientes sin redacción por rol — no existe
hoy ninguna vista "solo GM" a nivel de payload; el recorte es puramente de UI.
Esto significa que el panel no necesita ninguna infraestructura nueva de
lectura: los datos ya viajan.

Por instancia (`EffectInstance`, ver `effects/types.ts`), ya disponible:

- `instanceId`, `effectId`
- `source.type` (`creature|object|spell|aura|terrain|environment|system`) y
  `source.id` opcional — **hoy solo poblado por fuentes de regla de juego**
  (`abilityResolver.ts`, `specialManeuverCommands.ts`, `tacticalCommands.ts`);
  `gm-apply-effect` y los hazards usan siempre `system`/`environment` sin `id`.
- `targets` (creaturas) o `targetCells` (hazards) — mutuamente excluyentes en la
  práctica actual.
- `duration` (opcional; ausente equivale a permanente — confirmado en
  `tick.ts:13`, que ignora cualquier instancia sin `duration`).
- `stacks` (declarado en el tipo, sin ningún consumidor localizado en
  `reducer.ts`/`manager.ts` hoy — no inventar semántica para un campo inerte).

Por definición (`EffectDefinition`, catálogo), ya disponible: `name`,
`description`, `traits`, `modifiers` (con `stackingGroup`/`stackingPolicy`),
`ruleOverrides`, `onStack`/`upgradeTo`, `movementRateContributions`,
`concealmentContributions`, `hazard`. Todo esto ya es 100% legible desde
`effectsCatalog[instance.effectId]` (exportado desde `@dnd-tactical/shared`), sin
red ni servidor de por medio.

`EffectQueries.getByTarget(room, targetId)` (`effects/queries.ts`) ya es la
única vía autorizada para listar los efectos de un combatiente — el panel debe
reutilizarla, no reimplementar el filtro.

**No existe hoy** ningún componente que liste condiciones activas por
combatiente (`grep` de `effectInstances`/`effectsCatalog`/`getByTarget` en
`apps/web/src/components` no arroja ningún consumidor de listado; el único uso
de `effectInstances` en UI es `Board.tsx:49` para el overlay de `targetCells` de
hazards). El panel sería la primera superficie de lectura general de
condiciones — no una extensión de algo parcial.

## 5. ¿Cómo debería funcionar la remoción?

Opciones auditadas contra la arquitectura real:

| Criterio | Preserva la arquitectura | Motivo |
|---|---|---|
| **Por `instanceId`** | ✅ Sí — recomendado | Es la única clave que `EffectManager.remove`/`removeMany` ya acepta hoy; cero ambigüedad; simétrico con cómo el Tick Layer ya expira instancias. |
| Por `effectId` | ⚠️ Parcial | Ambiguo si el objetivo tiene múltiples instancias del mismo efecto de fuentes distintas (ej. Squeezing por maniobra + Squeezing por posición); requeriría que el panel decida "cuál", lógica que hoy no existe en ningún lado. |
| Por `sourceId` | ❌ No, hoy | `source.id` no está poblado por las fuentes administrativas (`gm-apply-effect`/hazards usan `system`/`environment` sin `id`) ni por todas las fuentes de regla; filtrar por él dejaría fuera exactamente los casos que el panel más necesita remover. |
| Por categoría | ❌ No existe | No hay ningún campo de "categoría" en `EffectDefinition`/`EffectInstance` hoy; inventarlo sería agregar un contrato nuevo no pedido por este sprint. |

**Recomendación**: remoción exclusivamente por `instanceId`, vía un nuevo
comando `gm-remove-effect` que llame `EffectManager.removeMany` (ya inmutable,
ya usado por el Tick Layer) — la UI lista instancias (no solo nombres de efecto)
precisamente porque `instanceId` es la clave real.

## 6. Comportamiento con `onStack`

Verificado con el trabajo de Sprint 049: `EffectManager.add` es el único punto
que consulta `onStack`, vía `severityChain`. El panel no necesita (ni debe)
replicar esa lógica:

- **Aplicar Fatigued dos veces** vía dos llamadas a `gm-apply-effect`: la
  segunda instancia colisiona en `EffectManager.add`, que resuelve
  `onStack:"upgrade_to"` y escala a Exhausted automáticamente. El panel solo
  emitió la intención "Fatigued"; el motor decidió el resultado real.
- **Aplicar Exhausted sobre Fatigued**: `EffectManager.add` detecta que lo
  existente es más débil en la misma cadena de severidad y lo reemplaza.
- **Aplicar Prone repetidamente**: `onStack:"ignore"` en `srd_prone` descarta la
  segunda instancia sin acumular penalizador — el bug de DT-022 (Sprint 049) ya
  está cerrado en el motor.

En los tres casos, el panel solo necesita enviar `gm-apply-effect` con el
`effectId` "declarado" por el GM (ej. "Fatigado"); nunca debe pre-calcular ni
mostrar "esto en realidad aplicará Exhausted" antes de que el servidor
responda — hacerlo requeriría duplicar `severityChain` en el cliente, exactamente
lo que el principio de este sprint prohíbe. El resultado real se ve en el
próximo `room-update` (el mismo mecanismo ya usado por cualquier otro comando).

## 7. Impacto sobre Snapshot

`createCombatRulesSnapshot` ya congela `effectInstances` (con deep-freeze en
dev) sin derivar nada adicional para el panel — el panel lee directamente
`room.effectInstances`/`snapshot.effectInstances` (ambos son la misma
colección; el snapshot no la transforma, ver `combatSnapshot.ts`). No hace falta
ningún campo derivado nuevo en el Snapshot: nombre, duración, stacks y origen ya
viajan tal cual, y el panel los cruza contra `effectsCatalog` en el cliente (el
mismo patrón que ya usa cada componente que consume el catálogo hoy, ej.
`ActionsPanel.tsx` con `EquipmentCatalog`/`SpellsCatalog`). No se propone
duplicar lógica de reglas en el Snapshot ni en la UI.

## Respuestas explícitas

**1. ¿Qué reutiliza exactamente del motor?**
`gm-apply-effect` (comando, validación, `EffectManager.add`, `onStack`/
`severityChain`), `EffectQueries.getByTarget`, `effectsCatalog`,
`createCombatRulesSnapshot`, `requireGM`, el mecanismo de `broadcast` ya
existente, y el patrón de duración (`until_target_turn_end` u omitida =
permanente).

**2. ¿Qué infraestructura falta realmente?**
Únicamente un comando de remoción (`gm-remove-effect` por `instanceId`, síncrono
con `EffectManager.removeMany`) y su schema Zod correspondiente. Nada en
`EffectManager`, `EffectReducer`, `Snapshot` ni en el catálogo — todo lo demás ya
existe y ya funciona.

**3. ¿Qué comandos nuevos hacen falta?**
Uno: `gm-remove-effect { roomCode, actorId, instanceId }`. `gm-apply-effect` ya
cubre la aplicación sin cambios.

**4. ¿Qué datos debe mostrar la UI?**
Por instancia activa de un combatiente (vía `EffectQueries.getByTarget` +
`effectsCatalog`): nombre y descripción (catálogo), `instanceId` (clave de
remoción), origen (`source.type`/`source.id` si existe), duración (o
"permanente" si ausente), y opcionalmente traits/`ruleOverrides` activos como
resumen de lo que la condición hace — todo ya presente, nada inventado. `stacks`
no debe mostrarse como si tuviera semántica (no tiene consumidor real hoy).

**5. ¿Cómo interactúa correctamente con `onStack`?**
No interactúa: delega. El panel emite la intención (`effectId`) y espera el
`room-update` resultante; nunca decide ni previsualiza el resultado de
`severityChain` client-side.

**6. ¿Cómo mantiene "el GM expresa una intención; las reglas las decide el
motor"?**
Reutilizando exactamente el mismo `gm-apply-effect` que ya no tiene ninguna
rama por `effectId`, y modelando la remoción como una operación igual de
genérica (por `instanceId`, sin lógica de cuál-instancia-elegir en el cliente).
El panel nunca calcula stacking, nunca replica `severityChain`, nunca decide si
algo "debería" convertirse en otra cosa.

**7. ¿Qué riesgos arquitectónicos existen?**

| Riesgo | Mitigación |
|---|---|
| Que la UI intente prever/mostrar el resultado de `onStack` antes de que el servidor responda (duplicando `severityChain` en React) | Prohibir explícitamente esa previsualización; el panel solo refleja `room-update` |
| Que se remueva por `effectId`/`sourceId` "para simplificar" y se generen ambigüedades silenciosas | Remoción exclusivamente por `instanceId`, ya la única clave soportada por `EffectManager` |
| Que se le agregue "categoría" u otro campo nuevo a `EffectDefinition` solo para el panel | No crear contratos nuevos en el catálogo; el panel se adapta a los campos existentes |
| Que `gm-apply-effect` empiece a acumular parámetros específicos por condición (ej. flags por efecto) | Mantenerlo genérico; cualquier necesidad de parametrización pertenece a una fuente futura (spell, trampa), no al panel |
| Que el panel intente exponer hazards (`targetCells`) con la misma UI que condiciones de criatura (`targets`) sin distinguir el modelo | Documentar la distinción; este sprint no diseña la UI de hazards, solo dejar la separación explícita para el diseño de interacción futuro |

**8. ¿Cuál es la recomendación final?**
Implementar el panel en un sprint futuro sobre exactamente dos piezas: (a) el
comando ya existente `gm-apply-effect` sin modificaciones, y (b) un nuevo
comando simétrico `gm-remove-effect` por `instanceId`. Toda la lectura (nombre,
duración, origen, traits) se resuelve en el cliente cruzando
`EffectQueries.getByTarget` + `effectsCatalog`, sin nuevos campos de Snapshot.
El panel jamás debe contener una rama de código por `effectId` ni replicar
`onStack`/`severityChain`.

## Alcance explícitamente excluido de este sprint y del panel futuro

Lesser Restoration, Restoration, descanso/recuperación tras 1 hora, conjuros,
clima, viajes, fuentes automáticas nuevas, reglas nuevas, implementación de
código, tests, cambios de Registry/Rule IDs, cambios de UI.

## Plan ejecutado y cierre histórico

El plan de implementación que acompañó este diseño se ejecutó posteriormente
en Sprint 050.1. Se conserva aquí, en forma resumida, para evitar que un
`implementation_plan.md` raíz obsoleto parezca trabajo aún autorizado:

1. ampliar `ClientCommand` y los esquemas Zod con `gm-remove-effect`;
2. implementar el handler administrativo con autorización GM y remoción
   exclusiva por `instanceId` mediante `EffectManager.removeMany`;
3. registrar el comando en el dispatcher;
4. añadir el panel React para listar, aplicar y remover instancias sin duplicar
   `onStack` ni `severityChain`;
5. validar permisos, instancia inexistente, reaplicación y escalado de
   severidad en unitarias, WebSocket y UI.

El resultado integrado respeta el diseño: `gm-apply-effect` continúa siendo la
entrada genérica de aplicación, `gm-remove-effect` remueve una instancia
concreta y la UI refleja el `room-update` autoritativo. El estado permanente de
la implementación se consulta en `../rules/registry.md`; este NDD conserva las
decisiones y el historial, no el estado operativo actual.
