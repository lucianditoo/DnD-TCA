# Sprint 025-R — Prone Eschewal & Diehard Integration

**Estado:** ✅ Implementado y validado (290/290 tests, 87/87 E2E, 3/3 Playwright).

## 1. Objetivo

Cerrar dos brechas de economía de acciones mediante reglas declarativas y compartidas:

- `srd_diehard` estabiliza automáticamente a su portador entre −1 y −9 HP y le permite actuar bajo la economía de `Disabled` aun con HP negativos.
- `srd_prone_eschewal` convierte `stand-up` en una acción de movimiento que cuesta 0 pies y no provoca Ataques de Oportunidad.

El servidor continúa siendo autoritativo. El cliente solo solicita `stand-up`; no envía coste, inmunidad a AdO, estado vital ni flags de dote.

### 1.1. Reconciliación de numeración

Large Footprints fue implementado y validado antes de recibirse esta repriorización. Para no borrar hechos auditables, se conserva como **Sprint 025-A** cerrado y esta prioridad se registra como **Sprint 025-R**. No se revierte código ni se declara pospuesta una capacidad que ya está operativa.

## 2. Estado actual verificado

### 2.1. Vida y sangrado

- `lifeStatus(combatant)` clasifica cualquier HP negativo como `stable` o `dying`; ambos estados son inconscientes para `canTakeTurn`.
- `isStable` representa cese de sangrado, pero hoy también determina indirectamente consciencia. Diehard demuestra que esas dos dimensiones no son equivalentes.
- `applyDamage` desestabiliza al recibir daño en negativos. `applyHealing`, comandos GM y estabilización también escriben HP/estabilidad.
- `roundTickListener` resta 1 HP a todo combatiente entre −1 y −9 con `isStable === false`.
- `canDisabledCombatantTakeAction` ya implementa la restricción de una única acción estándar o de movimiento, pero solo se activa cuando `lifeStatus` devuelve `disabled` a exactamente 0 HP.
- `applyDisabledExertion` recibe booleanos del handler y aplica 1 daño; los consumidores no comparten todavía una taxonomía declarativa de acciones extenuantes.

### 2.2. Levantarse

- `stand-up` no usa `validateMovePath`. `calculateStandUpCostFeet` devuelve `floor(baseSpeedFeet / 2)` y `validateStandUp` compara el coste acumulado contra `Rules.totalSpeedFeet`.
- `handleStandUp` elimina `PRONE`, consume acción de movimiento y genera AdO de cada enemigo que amenaza la posición actual.
- `ActionsPanel` describe estáticamente “mitad del movimiento” y “provoca AdO”; por tanto puede divergir de la resolución futura.
- El contrato WebSocket ya expresa únicamente la intención `action: "stand-up"` y no necesita ampliarse.

### 2.3. Catálogo de dotes

`FeatCatalog` ya es la frontera declarativa usada por Improved Trip y la validación de perfiles V3. La nueva mecánica debe ampliar esta frontera, no añadir búsquedas de strings en Tick Layer, handlers o React.

## 3. Decisiones arquitectónicas

### 3.1. Capacidades mecánicas tipadas de dotes

`FeatDefinition` incorporará capacidades declarativas opcionales:

```ts
interface LifeRuleContribution {
  readonly autoStabilizeNegativeHp?: boolean;
  readonly negativeHpActionState?: "disabled";
  readonly bleedsWhileNegative?: boolean;
}

interface TacticalActionRuleContribution {
  readonly actionId: "stand-up";
  readonly movementCost: "default" | "zero";
  readonly provokesOpportunityAttacks: boolean;
}
```

- `srd_diehard` declara estabilización automática, acción negativa como `disabled` y ausencia de sangrado.
- `srd_prone_eschewal` declara coste cero y no provocación para `stand-up`.
- Las definiciones son inmutables y `FeatCatalog` ofrece selectores agregados; ningún consumidor inspecciona IDs concretos.
- `featIds` permanece como fuente persistida. No se guardan `isDiehard`, `standUpCostFeet` ni otros derivados en el snapshot.

Los ActiveEffects no son el origen de estas dotes permanentes, pero una evolución podrá aportar las mismas contribuciones desde efectos temporales mediante un agregador de capacidades sin cambiar los consumidores.

### 3.2. Proyección vital canónica

Se introducirá una función pura compartida:

```ts
interface LifeStateProjection {
  readonly status: LifeStatus;
  readonly conscious: boolean;
  readonly canAct: boolean;
  readonly usesDisabledActionEconomy: boolean;
  readonly bleedsAtRoundStart: boolean;
  readonly mustBeStable: boolean;
}

getLifeStateProjection(combatant): LifeStateProjection
```

La proyección separa HP, estabilidad, consciencia, economía de acciones y sangrado. Para un portador de Diehard entre −1 y −9:

- `status` se proyecta como `disabled`;
- permanece consciente y puede conservar turno;
- usa exactamente la economía de una acción de `Disabled`;
- `mustBeStable` es verdadero y `bleedsAtRoundStart` es falso.

`lifeStatus`, `canTakeTurn`, `canDisabledCombatantTakeAction`, selección de iniciativa, amenaza y UI delegarán en esa proyección o en helpers derivados. Así se evita que cada subsistema invente su propia lectura de HP negativos.

### 3.3. Normalización inmediata tras mutaciones de HP

Se añadirá una única normalización pura/mutadora acotada, invocada al terminar cualquier transición de HP:

```ts
normalizeLifeStateAfterHpChange(combatant): void
```

Reglas:

1. HP `<= -10`: muerto; `isStable = false`.
2. HP `>= 0`: se conserva la semántica actual y se limpia estabilidad residual.
3. HP entre −1 y −9 con `mustBeStable`: `isStable = true` inmediatamente.
4. En el resto se mantiene la consecuencia explícita de la operación (daño desestabiliza, curación estabiliza).

`applyDamage`, `applyHealing`, estabilización y mutaciones GM deberán pasar por esta frontera. Esto garantiza que caer a negativos por ataque, conjuro, AdO, sangrado o esfuerzo produzca el mismo resultado. No se acepta esperar al siguiente `RoundStarted` para estabilizar Diehard.

Si una acción extenuante lleva de −9 a −10, la muerte prevalece; la estabilización nunca rescata el umbral fatal.

### 3.4. Economía Disabled en negativos

`canDisabledCombatantTakeAction` consultará `usesDisabledActionEconomy`, no `hpCurrent === 0`. Un Diehard negativo:

- puede realizar una acción de movimiento o una estándar;
- no puede realizar acciones de asalto completo;
- conserva las restricciones existentes después de consumir una de ellas.

La aplicación de esfuerzo dejará de recibir un booleano ambiguo por handler. Se diseñará un contexto tipado (`actionKind` y `isExerting`) y la decisión consultará la proyección vital al inicio de la acción. En este sprint se preserva la regla solicitada: el daño por esfuerzo corresponde a acciones estándar calificadas como extenuantes; una acción de movimiento, incluido levantarse, no causa daño por sí misma.

El daño se aplica después de completar la acción y vuelve a pasar por la normalización vital. No se introduce estado intermedio persistido.

### 3.5. Perfil compartido de `stand-up`

Se reemplazará el retorno mínimo de `validateStandUp` por una proyección completa:

```ts
interface StandUpActionProfile {
  readonly costFeet: number;
  readonly consumesMoveAction: true;
  readonly provokesOpportunityAttacks: boolean;
  readonly labelParts: readonly string[];
}
```

`getStandUpActionProfile(snapshot, combatant)` combina el default del Sprint 022 con las contribuciones catalogadas. `validateStandUp` reutiliza el perfil para comprobar `PRONE`, economía de turno y movimiento disponible.

El handler:

1. obtiene y valida el perfil en servidor;
2. elimina `PRONE`;
3. suma `costFeet` y marca `usedMoveAction = true`;
4. solo consulta amenazas y encola AdO si `provokesOpportunityAttacks` es verdadero;
5. registra el desglose derivado.

No cambia `ClientCommand`. Un cliente manipulado no puede forzar coste cero ni seguridad.

### 3.6. UI isomorfa

`ActionsPanel` consumirá `validateStandUp`/`getStandUpActionProfile` con el snapshot local:

- personaje normal: muestra coste y advertencia de AdO;
- `srd_prone_eschewal`: muestra `0 pies` y un indicador verde `SEGURO (Sin AdO)`;
- el botón respeta la misma validación de estado y economía.

React no consultará `featIds.includes(...)` ni duplicará fórmulas. El servidor recalcula siempre el perfil antes de mutar la sala.

## 4. Secuencia de datos

### Daño y Diehard

1. Un resolver aplica daño mediante la frontera común.
2. La transición limita HP a −10 y normaliza el estado según capacidades catalogadas.
3. La proyección vital decide consciencia, turno, economía y sangrado.
4. `roundTickListener` consulta `bleedsAtRoundStart`; no conoce `srd_diehard`.

### Levantarse

1. React proyecta el perfil compartido y lo presenta.
2. El cliente envía la intención `stand-up` existente.
3. El servidor reconstruye el perfil desde el snapshot autoritativo.
4. Aplica coste, acción de movimiento, retirada de `PRONE` y AdO según el perfil.

## 5. Matriz de impacto

| Subsistema | Impacto |
| --- | --- |
| Rule Engine | nueva proyección vital, normalización post-HP y perfil declarativo de `stand-up` |
| CombatRoom / Snapshot | sin campos persistidos nuevos; `featIds` sigue siendo la fuente |
| FeatCatalog | registra ambas dotes y sus contribuciones tipadas |
| Tick Layer | consulta `bleedsAtRoundStart`; elimina la decisión ad-hoc basada solo en `isStable` |
| Resolvers/handlers | usan transición vital común y perfil `stand-up`; sin búsquedas por ID |
| WebSocket | sin cambios de contrato ni flags confiados al cliente |
| UI | preview compartido de coste/seguridad y estado vital efectivo |
| Persistencia | el validador V3 acepta los nuevos IDs por `FeatCatalog`; sin migración de versión |
| Tests | unitarios de proyección/acción/tick, integración de handlers, E2E y Playwright |

## 6. Design Review Checklist

### 6.1. Filtro de irreversibilidad a 20 sprints

La decisión peligrosa sería seguir usando `LifeStatus` como mezcla indivisible de HP, consciencia, sangrado y permiso para actuar. Diehard prueba que esas dimensiones divergen. La `LifeStateProjection` mantiene el enum público para presentación, pero expone capacidades ortogonales. Futuras reglas como inmunidad a muerte por daño, Frenesí sangriento o efectos que permiten actuar inconsciente aportarán contribuciones a esa proyección sin introducir ramas en cada resolver ni reinterpretar HP localmente.

La segunda decisión irreversible sería persistir resultados de dotes. El diseño persiste solo `featIds`; capacidades y perfiles se derivan siempre del catálogo.

### 6.2. Complejidad accidental

`roundTickListener` no contendrá `if (featIds.includes("srd_diehard"))`. Preguntará una única propiedad semántica: `getLifeStateProjection(combatant).bleedsAtRoundStart`. La decisión de por qué no sangra pertenece al catálogo/agregador. Igualmente, `handleStandUp` no ramifica por dote: ejecuta el perfil devuelto por reglas.

La auditoría detectó varias escrituras directas de HP/estabilidad. La implementación debe centralizarlas antes de declarar completada la estabilización inmediata; añadir Diehard solo a `applyDamage` dejaría rutas GM, curación o esfuerzo inconsistentes.

### 6.3. Matriz de reutilización

- **ActiveEffects:** `PRONE` sigue siendo el estado temporal y se elimina por catálogo; las capacidades permanentes nacen de `FeatCatalog`. El agregador queda preparado para contribuciones temporales posteriores.
- **Helpers puros:** se reutilizan `Rules.totalSpeedFeet`, `validateStandUp`, economía Disabled, amenaza y `Rules.canMakeOpportunityAttack`.
- **Resolvers:** no cambia matemática de ataque ni dados; reciben proyecciones vitales/de acción ya calculadas.

### 6.4. Regla de tres

1. **Helpless e inconsciencia:** podrán consultar `conscious`/`canAct` sin inferirlo de estabilidad.
2. **Levantarse de un salto / Tumble CD 20:** podrá aportar otra contribución al perfil `stand-up`, condicionada por una prueba, sin cambiar el comando base.
3. **Endurance y Frenesí sangriento:** podrán modificar sangrado, umbral funcional o economía en negativos mediante la misma proyección vital.

También se habilitan perfiles de acción para Kip Up y efectos temporales que supriman provocación.

## 7. Estrategia de pruebas

### Unitarias

- daño lleva a un Diehard de 1 a −1: `isStable = true`, estado efectivo `disabled`, puede actuar;
- Diehard entre −1 y −9 no pierde HP en `RoundStarted`;
- no-Diehard conserva sangrado actual;
- Diehard respeta una sola acción estándar o de movimiento y rechaza full-round;
- acción estándar extenuante aplica 1 daño después de resolverse y −9→−10 mata;
- `srd_prone_eschewal` produce coste 0, no provoca y sigue consumiendo move action;
- combatiente normal conserva mitad de velocidad y AdO;
- `FeatCatalog` y persistencia aceptan los IDs y rechazan desconocidos.

### Integración/E2E

- caída autoritativa a negativos, conservación en iniciativa y acción única;
- ronda siguiente sin sangrado para Diehard;
- `stand-up` seguro elimina `PRONE`, no encola AdO, no suma movimiento y consume `usedMoveAction`;
- cliente no puede enviar overrides de coste/provocación.

### UI

- preview verde `SEGURO (Sin AdO)` y `0 pies` para la dote;
- preview normal preservado para combatientes sin ella.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| estabilización inmediata omitida en una ruta de HP | inventario de escrituras y frontera única post-mutación |
| `stable` interpretado como inconsciente en consumidores viejos | migración a `LifeStateProjection` y tests de turnos/amenaza |
| dotes desconocidas bloquean perfiles | alta formal en `FeatCatalog` y pruebas V3 |
| preview y servidor divergen | ambos consumen el mismo perfil shared |
| Diehard recibe daño por una acción de movimiento | contexto tipado de esfuerzo; pruebas negativas específicas |

## 9. Fuera de alcance

- elección voluntaria de Diehard para actuar como moribundo en vez de Disabled;
- estabilización porcentual normal y reglas completas de recuperación prolongada;
- Tumble/Kip Up con tirada de habilidad;
- inmunidad a muerte, Frenesí sangriento y Endurance completos;
- cambios al contrato WebSocket;
- reversión o eliminación de Large Footprints ya implementado.

## 10. Criterios de aceptación del diseño

- no hay condicionales por ID de dote fuera de `FeatCatalog`/su agregador;
- consciencia, acción y sangrado no dependen exclusivamente de `isStable`;
- toda mutación de HP termina en una normalización vital común;
- `stand-up` tiene una única proyección consumida por servidor y React;
- no se persisten derivados ni se confían flags de red;
- no se modifica código ejecutable antes de `Proceed`.
