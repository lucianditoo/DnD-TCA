# Sprint Arquitectónico 034 — Salvaciones Pasivas Ambientales & Trampas

## Estado

Diseño en revisión. **A la espera de aprobación `Proceed`.** No se ha modificado ningún archivo ejecutable.

## Objetivo

Automatizar la detección y resolución de efectos de área persistentes anclados al grid (Muro de Fuego, trampas de pinchos fijas, nubes de gas) contra combatientes que ocupan sus celdas de peligro, disparando la salvación correspondiente (Reflejos/Fortaleza/Voluntad) de forma determinista al inicio de cada ronda global, reutilizando en su totalidad la infraestructura de geometría (Sprint 025/027/033) y de salvaciones automáticas (Sprint 024).

## 1. Baseline reutilizado

- **Sprint 004 (EFFECTS-SYS-TICK):** Event Bus síncrono, listeners puros `(room, event) => room`, sin estado global, sin captura de excepciones. `TurnManager.advanceTurn` es el Composition Root que despacha `RoundStarted`/`RoundEnded`/`TurnStarted`/`TurnEnded` y además ejecuta pasos "Legacy" imperativos intercalados (`expireEndOfTurnBuffs`, `expireStartOfTurnBuffs`) fuera del array de listeners.
- **Sprint 002/003 (EFFECTS-SYS-CATALOG/CORE):** `EffectDefinition` (Nivel 1, catálogo estático sin lógica) y `EffectInstance` (Nivel 2, estado vivo). `CombatRoom.effectInstances` es un array plano propiedad de la sala, no del combatiente — ya diseñado explícitamente para soportar áreas sin `targetId` biológico (`effects-system-architecture.md`, sección 2 y 8.2 "Peligros Ambientales").
- **Sprint 024/020 (Saving Throws):** `resolveSavingThrow(context, target, saveType, dc, d20Roll)` y `applySpellSaveToDamageBundle(bundle, saveEffect, success)` en `apps/server/src/combat/savingThrowResolver.ts` son genéricos — no dependen de que exista un "caster"; ya se usan hoy fuera del contexto puramente de conjuros.
- **Sprint 025-A/027 (Footprints):** `getCombatantOccupiedCells(combatant, snapshot)` deriva la huella multiposición real (incluye Large 2×2) y es la única fuente de verdad para intersección espacial.
- **Sprint 033 (Spell AoE):** ya resuelve exactamente el mismo problema de intersección — "celdas de un área" contra "huellas de combatientes" — dentro de `handleCastSpell` (`apps/server/src/commands/abilityCommands.ts`, líneas ~213-254), usando una clave de celda ad-hoc `` `${x},${y},${zFeet ?? 0}` ``. Este Sprint 034 formaliza y reutiliza ese mismo patrón, pero para efectos que persisten ronda tras ronda en vez de resolverse una sola vez en el momento del lanzamiento.

## 2. Arquitectura Propuesta

### A. Capa de Datos — Efectos de Área Persistentes

`EffectInstance` (`packages/shared/src/effects/types.ts`) se extiende con un campo opcional:

```typescript
export interface EffectInstance<TEffectId extends string = string> {
  readonly instanceId: string;
  readonly effectId: TEffectId;
  readonly source: Readonly<EffectSource>;
  readonly targets?: readonly string[];       // combatientes (biológico)
  readonly targetCells?: readonly string[];   // NUEVO: celdas de grid ancladas ("x,y,zFeet")
  readonly appliedAtEvent: Readonly<{ ... }>;
  readonly duration?: Readonly<DurationPolicy>;
  readonly stacks?: number;
}
```

`targetCells` y `targets` son mutuamente independientes (un efecto de área no requiere `targets`; `EffectManager.add` ya trata `targets` como opcional). Esto habilita anclar un `EffectInstance` a coordenadas fijas del tablero sin inventar un segundo tipo de instancia — es exactamente el modelo previsto en `effects-system-architecture.md` §8.2 desde el Sprint 002.

**Clave de celda canónica.** Hoy existen dos formateos independientes de clave de celda: `footprintCellKey` (privada, `packages/shared/src/rules.ts:1102`) y el literal ad-hoc `` `${x},${y},${zFeet ?? 0}` `` duplicado dos veces en `abilityCommands.ts` (líneas 221 y 226). Este sprint exporta `footprintCellKey` (y agrega `parseCellKey` inverso) como utilidad pública de `rules.ts`, y ambos consumidores (AoE de conjuros y el nuevo listener ambiental) se migran a la función exportada. Esto elimina la duplicación silenciosa y garantiza que servidor, listener ambiental y overlay de UI usen exactamente la misma serialización.

### B. Capa de Catálogo — Bloque `hazard` declarativo en `EffectDefinition`

En lugar de crear un catálogo paralelo tipo `SpellsCatalog`, se extiende `EffectDefinition` (`packages/shared/src/effects/contracts.ts`) con un bloque opcional, puramente declarativo y sin funciones:

```typescript
export interface EffectDefinition {
  // ...campos existentes (traits, modifiers, ruleOverrides, onStack)...
  readonly hazard?: {
    readonly savingThrowType: SavingThrowType;
    readonly saveEffect: SpellSaveEffect;      // "none" | "half" | "negates"
    readonly dc: number;                        // CD fija de la trampa/hazard (no depende de un lanzador)
    readonly damageExpression?: string;         // ej. "2d4"; ausente si el hazard solo aplica condición
    readonly onFailEffectId?: string;            // efecto adicional a inyectar si falla la salvación (ej. "srd_prone", "on_fire")
  };
}
```

Esto respeta la regla del catálogo ("exclusivamente datos declarativos, nunca lógica, nunca consulta el estado") y reutiliza `SavingThrowType`/`SpellSaveEffect` ya existentes en `types.ts`/`spells/contracts.ts`, evitando definir un tercer vocabulario de salvaciones.

Un `EffectInstance` de hazard referencia un `effectId` cuya definición en `effectsCatalog` tiene el bloque `hazard` poblado; el propio catálogo, no la instancia, es la fuente de verdad de CD/daño/tipo de salvación (igual que `SpellsCatalog` es la fuente de verdad de un conjuro).

### C. Capa de Reglas — Helper puro de intersección

Nuevo helper 100% puro en `rules.ts` (o `packages/shared/src/combat/environmentalHazards.ts` si se prefiere aislarlo):

```typescript
export interface EnvironmentalHazardHit {
  readonly instanceId: string;
  readonly effectId: string;
  readonly combatantId: string;
}

export function getEnvironmentalHazardHits(
  snapshot: CombatRulesSnapshot<ProductionEffectId>
): EnvironmentalHazardHit[]
```

Recorre `snapshot.effectInstances` filtrando por `targetCells` definido, construye un `Set` con las claves de peligro, y para cada combatiente vivo cruza `getCombatantOccupiedCells(combatant, snapshot)` contra ese `Set` usando `footprintCellKey`. Es una función pura, determinista, sin dados — exactamente igual en espíritu al bloque de intersección que ya existe inline en `handleCastSpell`, ahora factorizado y testeable en aislamiento.

### D. Capa de Orquestación — Por qué NO vive en el Tick Layer puro

**Decisión arquitectónica central de este sprint.** El contrato de `CombatEventListener` (`packages/shared/src/events/types.ts`) es `(room, event) => room`: determinista, sin dependencias externas, sin dados. `roundTickListener` y `effectsTickListener` cumplen esto estrictamente hoy. Resolver una salvación requiere una tirada de d20 — introducir un `diceRoller` dentro de la firma del listener rompería el contrato del Event Bus para *todos* los listeners existentes y a futuro, y further socavaría la garantía de reproducibilidad del `eventSequence` monotónico (ADR-0008).

En su lugar, se sigue el patrón que **ya existe** en `turnManager.advanceTurn`: pasos imperativos intercalados con el despacho de eventos puros (`expireEndOfTurnBuffs`/`expireStartOfTurnBuffs` ya son ejemplos de esto). Se agrega un paso nuevo, `resolveEnvironmentalHazards(room, diceRoller)`, invocado inmediatamente después de que `emitCombatEvent({ type: "RoundStarted", ... })` se resuelve dentro de `advanceTurn`:

1. Construye `snapshot = createCombatRulesSnapshot(room)`.
2. Obtiene `hits = getEnvironmentalHazardHits(snapshot)` (paso puro, Rule Engine).
3. Para cada `hit` (bucle único, acotado por la longitud de `hits`, sin recursión ni re-despacho de eventos):
   - Resuelve `hazard = effectsCatalog[hit.effectId].hazard` (si no existe, se ignora — invariante de catálogo).
   - Tira `diceRoller(20)` y llama `resolveSavingThrow(snapshot, target, hazard.savingThrowType, hazard.dc, d20)` — **reutilizado sin modificar** de `savingThrowResolver.ts` (Sprint 024).
   - Si `hazard.damageExpression`, arma un `DamageBundle` con `makeDamageBundle` y aplica `applySpellSaveToDamageBundle` + `applyDamage` sobre la copia de trabajo del combatiente dentro de `room`.
   - Si la salvación falla y `hazard.onFailEffectId` existe, `EffectManager.add(...)` inyecta el efecto secundario (ej. quedar `on_fire`).
   - Un único `makeLog` narrativo por combatiente afectado.
4. Todas las mutaciones ocurren sobre la misma referencia `room` en una sola pasada síncrona (mismo idiom que el resto de `advanceTurn`, que ya muta `room` directamente vía `Object.assign` en cada paso) — no se introduce un segundo estilo de transacción (`draft`/`commit`) en un archivo que ya tiene un idiom establecido.

`advanceTurn(room: CombatRoom, diceRoller: (sides: number) => number = rollDice)` gana un parámetro opcional con default al `rollDice` canónico (`apps/server/src/combat/diceRoller.js`, el mismo usado por `handleCastSpell`). El único call site actual (`handleEndTurn` en `initiativeCommands.ts`) sigue invocando `advanceTurn(room)` sin cambios; los tests pueden inyectar un roller determinista.

**No se persiste estado intermedio.** No hay `room.pendingEnvironmentalSaves` ni cambio al contrato WebSocket — exactamente la misma garantía que Sprint 024 documentó ("CombatRoom: no persiste estados intermedios de salvación"; "WebSocket: no cambia el payload"). La tirada ocurre y se resuelve enteramente en el servidor, en la misma transición de turno.

### E. Comando GM para crear hazards de área

Se agrega un comando aditivo (no se modifica `gm-apply-effect`, que exige `targetId` obligatorio y no admite área):

```typescript
{
  type: "gm-apply-environmental-hazard",
  roomCode: string,
  actorId: string,
  effectId: string,       // debe declarar bloque `hazard` en el catálogo
  targetCells: string[]   // claves canónicas "x,y,zFeet"
}
```

`handleGmApplyEnvironmentalHazard` (nuevo, en `gmCommands.ts`) espeja exactamente `handleGmApplyEffect`: valida `isProductionEffectId`, construye un `EffectInstance` con `targetCells` en vez de `targets`, `source: { type: "environment" }`, y lo agrega vía `EffectManager.add` (sin cambios a `EffectManager`, que ya copia `targets` opcionalmente — se le agrega el mismo tratamiento para `targetCells`).

### F. UI — Overlay de peligro en `Board.tsx`

React lee `room.effectInstances.filter(i => i.targetCells)`, decodifica cada clave con el mismo `parseCellKey` exportado (nunca reimplementado en el cliente) y pinta un overlay translúcido (color distintivo, ej. rojo-quemado) sobre esas celdas — mismo patrón ya usado para el preview de AoE de conjuros (Sprint 033). Cero lógica de reglas D&D en `.tsx`: React solo mapea datos que el servidor ya calculó y persiste.

## 3. Design Review Checklist (`.ai/DESIGN_REVIEW_CHECKLIST.md`)

### 1. Filtro de Irreversibilidad a 20 Sprints

La decisión más costosa de revertir sería mezclar la tirada de dados dentro del Tick Layer puro. Este diseño evita eso deliberadamente: el listener/helper que decide "qué celdas son peligrosas y quién está parado en ellas" es puro y reutiliza `getCombatantOccupiedCells`; la tirada y mutación ocurren en un paso de orquestación separado dentro de `advanceTurn`, igual que los pasos "Legacy" ya existentes. Esto significa que:

- Un hazard **móvil** (Nube Apestosa desplazándose 10 ft/asalto) solo necesita una mutación que reescriba `targetCells` de su `EffectInstance` entre rondas (ej. desde un resolver de conjuro con duración); el listener de intersección y el paso de resolución de salvación no cambian en absoluto.
- Una dote de resistencia ambiental (ej. Resistencia al Fuego) se resuelve como un trait adicional consultado justo antes de aplicar el `DamageBundle` (`hasEffectTrait(reduced, "FIRE_RESISTANCE")`), sin tocar el pipeline de detección ni el Event Bus.
- El Event Bus (`CombatEventListener`) permanece con su firma `(room, event) => room` sin excepciones ni parámetros nuevos — ninguna extensión futura de hazards requerirá jamás fragmentarlo con eventos específicos de efectos (`EffectExpired`, `HazardTriggered`), que la arquitectura ya prohíbe explícitamente.

### 2. Complejidad Accidental

La clave de celda (`` `${x},${y},${zFeet}` ``) ya está duplicada hoy entre `rules.ts` (privada) y `abilityCommands.ts` (inline, dos veces). Este sprint no introduce una tercera variante: exporta la única función existente (`footprintCellKey`) y agrega su inversa (`parseCellKey`), y migra el bloque de AoE de conjuros a usarla en vez del literal ad-hoc. La UI de `Board.tsx` consume `targetCells` tal cual llega del servidor — sin recalcular geometría, sin duplicar el mapeo de coordenadas, igual que el overlay de AoE de Sprint 033 reutiliza `getCellsIntersectedByAoE` en el cliente.

### 3. Matriz de Reutilización de Infraestructura

1. **ActiveEffects (Capa de Datos):** Sí, en su totalidad. Un hazard es un `EffectInstance` con `targetCells` en vez de `targets`, y su mecánica (CD, tipo de salvación, daño, efecto secundario) vive en un bloque `hazard` puramente declarativo dentro de `EffectDefinition` — ninguna función nueva en el catálogo.
2. **Pure Helpers (`rules.ts`):** se reutiliza íntegramente `getCombatantOccupiedCells` (Sprint 025/027); solo se agrega el cruce liviano `getEnvironmentalHazardHits`, que no reimplementa nada de geometría, solo intersecta huellas ya derivadas contra un `Set` de claves.
3. **Resolvers:** `resolveSavingThrow` y `applySpellSaveToDamageBundle` (`savingThrowResolver.ts`, Sprint 024) se reutilizan sin ninguna modificación de firma — ya eran genéricos, no atados a un "caster". El nuevo paso de orquestación solo los invoca dentro de un bucle acotado.

### 4. La Regla de Tres

1. **Muro de Fuego (Wall of Fire):** `targetCells` formando una línea o burst; `hazard.savingThrowType = "reflex"`, `saveEffect = "half"`, `damageExpression = "2d4"` (fuego), evaluado cada `RoundStarted`.
2. **Nube Apestosa / Nube de gas venenoso persistente:** el mismo pipeline de intersección se reutiliza sin cambios; solo se agrega, en un sprint futuro, una mutación que reescribe `targetCells` cada ronda para simular el desplazamiento de la nube. `hazard.savingThrowType = "fortitude"`, con `onFailEffectId` apuntando a una condición de náusea ya catalogable.
3. **Zona de terreno sagrado/profano o trampa de pinchos fija:** hazard pasivo o de un solo disparo, `savingThrowType = "will"` o `"reflex"` respectivamente, ambos delegando en el mismo bloque `hazard` declarativo — sin necesidad de lógica especial por tipo de trampa.

### 5. Matriz de Impacto de Subsistemas

- [x] **Rule Engine:** nuevo helper puro `getEnvironmentalHazardHits`; extensión de `EffectDefinition` (`hazard`) y `EffectInstance` (`targetCells`); exportación de `footprintCellKey`/`parseCellKey` canónicos.
- [x] **CombatRoom / State Schema:** `EffectInstance.targetCells` opcional. No se agregan campos de estado intermedio a `CombatRoom` (no hay "pending saves" persistido).
- [x] **WebSocket Contract:** un comando nuevo y aditivo, `gm-apply-environmental-hazard` (no modifica comandos existentes). `advanceTurn` gana un parámetro opcional interno al servidor (`diceRoller`), invisible a la red y con default que preserva el call site actual.
- [x] **UI Presentation:** overlay translúcido en `Board.tsx` leyendo `targetCells` con el parser compartido; cero reglas D&D en React.
- [x] **Automatización de Tests:** unitarios de intersección pura (sin dados), unitarios de resolución con `diceRoller` inyectado determinista (natural 1/20, half/negates), y un escenario E2E de una ronda completa con un hazard activo atrapando a un combatiente.

## 4. Qué NO resuelve este Sprint

**Fuera de alcance:**
- Line of Effect / oclusión de hazards por muros o cobertura (se hereda tal cual de Sprint 033; no se extiende aquí).
- Movimiento automático de hazards (una Nube Apestosa desplazándose sola cada ronda) — solo se dejan los datos preparados (`targetCells` reescribible); el desplazamiento real queda para un sprint futuro.
- Resistencia/inmunidad elemental específica (Resistencia al Fuego, Evasion) contra el daño ambiental — se deja como gate futuro sobre el `DamageBundle`, no se implementa ahora.
- Trampas con detección/desarme (Buscar/Inutilizar Mecanismo); este sprint solo automatiza el daño/salvación recurrente de un hazard ya activo en el mapa, no su descubrimiento.

**Decisiones postergadas:**
- Múltiples hazards distintos solapando la misma celda se resuelven secuencialmente en el orden del array `effectInstances`, sin fusión ni prioridad especial — deuda técnica aceptada y documentada, mitigable si aparece un caso real.
- El origen (`EffectSource`) de un hazard ambiental usa `type: "environment"`; no se modela todavía un vínculo a un "creador" (ej. el conjuro que invocó el Muro de Fuego) más allá de lo que el tipo `EffectSource` ya permite opcionalmente vía `id`.

## Riesgos y Mitigaciones

- **Recursión:** el paso de resolución de hazards nunca vuelve a despachar `RoundStarted`; es un bucle único y acotado por `hits.length`.
- **Mutación parcial:** se sigue el idiom ya establecido en `advanceTurn` (mutación directa y secuencial de `room`), evitando introducir un segundo patrón de transacción en el mismo archivo.
- **Determinismo en tests:** `diceRoller` inyectable con default `rollDice`, igual que `CastSpellExecutionOptions.diceRoller` en `handleCastSpell`.
- **Compatibilidad hacia atrás:** `targetCells`, el bloque `hazard` y el nuevo comando son todos aditivos y opcionales; ningún `EffectInstance`, `EffectDefinition` o flujo WebSocket existente cambia de comportamiento.

## Validación Planeada

- `npm test` (nuevos casos: intersección pura sin dados; resolución con `diceRoller` determinista cubriendo natural 1/20, `half`/`negates`, e inyección de `onFailEffectId`).
- `npm run typecheck`.
- `npm run build`.
- E2E WebSocket (`node scripts/e2e-websocket.mjs`): escenario de una ronda con un Muro de Fuego activo atrapando a un combatiente que ocupa una celda de peligro.
