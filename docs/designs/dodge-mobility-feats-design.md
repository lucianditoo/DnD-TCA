# Sprint Arquitectónico 035 — Defensas Contextuales: Esquiva (Dodge) y Movilidad (Mobility)

## Estado

Diseño en revisión. **A la espera de aprobación `Proceed` específica para este sprint.** No se ha modificado ningún archivo ejecutable.

## Nota sobre la instrucción recibida

La instrucción de Fase 5 recibida contenía varias referencias que no coinciden con el código real del repositorio, y este NDD las corrige antes de proponer una arquitectura:

- `AttackContext` no vive en `types.ts`; vive en `rules.ts` (línea 167), y **ya declara `attackerId`** — no hace falta agregarlo.
- No existe un `totalArmorClass` exportado como función suelta; es un método del `RuleEvaluator` (`Rules.totalArmorClass`, dentro de `createRuleEvaluator` en `rules.ts`).
- `EffectStat` (el vocabulario cerrado de estadísticas numéricas) usa la clave `"AC"`, no `"ARMOR_CLASS"`.
- `featCatalog.ts` (`FeatCatalog`) **no soporta `conditionalModifiers`** — esa estructura pertenece a `EffectDefinition` (`packages/shared/src/effects/contracts.ts`), un sistema distinto pensado para instancias temporales de efectos, no para rasgos permanentes del personaje.

Este último punto es la decisión arquitectónica central del sprint (ver sección 2).

## Objetivo

Implementar las dotes Esquiva (Dodge, +1 CA circunstancial contra un enemigo designado) y Movilidad (Mobility, +4 CA circunstancial contra AdO provocados específicamente por movimiento), respetando que el bono de esquiva se anula por completo ante Flat-Footed / `NO_DEX_TO_AC`, igual que la Destreza.

## 1. Decisión arquitectónica: ¿EffectInstance o FeatCatalog?

La instrucción original sugiere modelar Dodge/Mobility como `conditionalModifiers` dentro de `EffectDefinition` (el sistema de `ActiveEffects`, pensado para instancias **temporales**: buffs, condiciones, hazards). Se evaluó y se descarta por dos motivos concretos:

1. **Esquiva no es un dato estático de catálogo.** El objetivo designado de Esquiva se elige y puede redeclararse en cada turno — es **estado del combatiente**, no una propiedad fija del efecto. Forzarlo dentro de `EffectDefinition` (100% declarativo, sin acceso al estado del combate) obligaría a inventar un mecanismo paralelo para mutar "a quién apunta" dentro de una instancia inmutable — complejidad accidental que el propio catálogo prohíbe explícitamente ("Nunca puede consultar el estado del combate").
2. **Movilidad no necesita ningún estado persistente.** Su condición (`isOpportunityAttack && isMovementProvoked`) es 100% derivable del `attackContext` transitorio de la resolución de ataque puntual. No hay nada que instanciar, activar ni expirar.

**Decisión:** Dodge y Mobility se modelan igual que Sneak Attack Dice, `avoidsOpportunity`, `lifeRules` y `tacticalActionRules` — como reglas derivadas **directamente de `combatant.featIds`**, evaluadas en línea dentro de `Rules.totalArmorClass`, sin pasar por `EffectInstance`/`ConditionalModifier`. Esto reutiliza el patrón ya establecido en `FeatCatalog` en lugar de forzar un patrón ajeno (Matriz de Reutilización, sección 3).

Dodge sí necesita una pieza de estado nueva y mínima: **a quién designó el combatiente**. Se modela como un campo plano en el snapshot (`dodgeTargetId`), exactamente igual que `initiative` o `isStable` — estado autoritativo del combatiente, no un efecto.

## 2. Arquitectura Propuesta

### A. Catálogo declarativo (`packages/shared/src/featCatalog.ts`)
Se agregan dos entradas `FeatDefinition` mínimas (documentación/listado; no cargan lógica):
```typescript
{ id: "srd_dodge", name: "Esquiva (Dodge)", avoidsOpportunityOn: [] },
{ id: "srd_mobility", name: "Movilidad (Mobility)", avoidsOpportunityOn: [] }
```
Se agrega `FeatCatalog.hasFeat(featIds, id)` como helper trivial para evitar `.includes(...)` disperso en `rules.ts`.

### B. Estado del combatiente (`packages/shared/src/types.ts`)
`CombatantSnapshot` gana `dodgeTargetId?: string | null` (opcional, por compatibilidad con snapshots/perfiles existentes — ausencia equivale a "sin objetivo designado").

### C. Contexto de ataque (`packages/shared/src/rules.ts`)
`AttackContext` (línea 167) gana dos campos opcionales:
```typescript
export interface AttackContext {
  readonly attackType?: "melee" | "ranged";
  readonly targetAcType?: "normal" | "touch";
  readonly abilityForAttack?: "strength" | "dexterity";
  readonly isFlatFootedOverride?: boolean;
  readonly attackerId?: string;              // ya existente
  readonly hasObstacleInterception?: boolean;
  readonly isOpportunityAttack?: boolean;    // NUEVO
  readonly isMovementProvoked?: boolean;     // NUEVO
}
```

### D. Pipeline de CA (`Rules.totalArmorClass`, `rules.ts`)
Inmediatamente después de calcular `suppressDexAndDodge` (línea ~375, ya usado para purgar Destreza/Esquiva ante Flat-Footed/`NO_DEX_TO_AC`), se agregan dos bloques que **reutilizan la misma bandera** para la anulación por sorpresa — sin lógica nueva de supresión:
```typescript
let contextualDodgeBonus = 0;
if (!suppressDexAndDodge && attackContext) {
  if (FeatCatalog.hasFeat(combatant.featIds, "srd_dodge")
      && combatant.dodgeTargetId
      && attackContext.attackerId === combatant.dodgeTargetId) {
    contextualDodgeBonus += 1;
    parts.push("esquiva +1");
  }
  if (FeatCatalog.hasFeat(combatant.featIds, "srd_mobility")
      && attackContext.isOpportunityAttack === true
      && attackContext.isMovementProvoked === true) {
    contextualDodgeBonus += 4;
    parts.push("movilidad +4");
  }
}
```
Esto satisface directamente el requisito #3 del DoD ("Anulación por Sorpresa"): si `suppressDexAndDodge` es `true` (Flat-Footed o `NO_DEX_TO_AC`), ninguno de los dos bonos se evalúa siquiera.

### E. Comando de declaración (`declare-dodge-target`)
Nuevo comando WebSocket aditivo:
```typescript
{ type: "declare-dodge-target"; roomCode: string; actorId: string; combatantId: string; targetId: string | null }
```
Handler `handleDeclareDodgeTarget` (nuevo, en `tacticalCommands.ts`): valida `requireCombatantControl`, `ensureActiveTurn`, que el combatiente tenga `srd_dodge` en `featIds`, y que `targetId` (si no es `null`) exista y esté vivo. Asigna `combatant.dodgeTargetId = targetId`. `targetId: null` permite retirar la designación. No consume acción (RAW: es parte de moverse/actuar normalmente, se simplifica sin costo de acción explícito — ver "Fuera de alcance").

### F. Orquestación en Ataques de Oportunidad (`apps/server/src`)
`AttackResolutionOptions` (`attackResolver.ts`) gana un campo opcional:
```typescript
export interface AttackResolutionOptions {
  source?: ResolvedAttackSource;
  diceRoller?: (sides: number) => number;
  isOpportunityAttack?: boolean;      // NUEVO
  isMovementProvoked?: boolean;       // NUEVO
}
```
`resolveAttack` los propaga al construir el `AttackContext` interno (línea ~96) que ya arma para `Rules.totalArmorClass`.

`handleResolveOpportunityAttack` (`attackCommands.ts`) pasa `{ isOpportunityAttack: true, isMovementProvoked: opportunity.movementCostFeet !== undefined }` — **reutilizando** el campo `movementCostFeet` que `OpportunityAttack` ya declara (Sprint 015/032) para distinguir un AdO provocado por movimiento de otros triggers (ranged-en-amenaza, conjuro en área de amenaza, etc.), sin agregar ningún campo nuevo a `OpportunityAttack`.

### G. UI (`apps/web/src/components`)
- `SelectedInfo.tsx`: recibe un nuevo prop opcional `attackerId?: string` (el combatiente actualmente designado como objetivo de ataque en la UI) y lo agrega a las tres llamadas de preview de `Rules.totalArmorClass`, agregando una cuarta variante "CA vs. objetivo actual" quesolo se muestra cuando hay un `attackerId` activo.
- `App.tsx` pasa el `targetId` ya existente en su estado de UI hacia `SelectedInfo` como `attackerId`.
- Se agrega un control simple ("Declarar Esquiva") visible solo si `combatant.featIds` incluye `srd_dodge` y es su turno, que envía `declare-dodge-target` con el `targetId` actualmente seleccionado.
- Cero lógica de reglas en React: la UI solo llama a `Rules.totalArmorClass` (ya puro y compartido) y envía la intención declarativa al servidor.

## 3. Design Review Checklist

### Filtro de Irreversibilidad a 20 Sprints
La decisión más costosa sería acoplar Dodge/Mobility al sistema de `EffectInstance`/`ConditionalModifier`, que exigiría inventar mutación de instancias inmutables para modelar "a quién apunto esta ronda" — rompiendo la garantía de que el catálogo nunca consulta estado. Modelarlos como reglas derivadas de `featIds` (mismo patrón que Sneak Attack Dice) mantiene el catálogo de efectos limpio y dispone de un lugar natural para futuras dotes de CA contextual: Combate a la Defensiva Mejorado, Escudo Total, Esquiva Sobrenatural, todas evaluables de la misma forma dentro de `totalArmorClass` sin tocar `EffectDefinition`.

### Complejidad Accidental
Se evita crear un segundo vocabulario de condiciones (`ModifierCondition`) solo para Dodge/Mobility cuando el `attackContext` transitorio ya es suficiente. `dodgeTargetId` reutiliza el mismo patrón de campo plano de estado que `initiative`/`isStable`; `isMovementProvoked` reutiliza `movementCostFeet` ya existente en `OpportunityAttack` en lugar de introducir un campo redundante.

### Matriz de Reutilización de Infraestructura
1. **ActiveEffects:** deliberadamente NO se usa — ver sección 1.
2. **Pure Helpers:** se extiende `Rules.totalArmorClass`, ya el único punto de cálculo de CA consumido por servidor y UI; se reutiliza `suppressDexAndDodge`, ya calculado, para la anulación por sorpresa.
3. **Resolvers:** `resolveAttack` ya construye el `AttackContext`; solo se le agregan dos banderas opcionales que pasa sin alterar su lógica existente.

### La Regla de Tres
1. **Combate a la Defensiva Mejorado / Escudo Total (Total Defense):** mismo patrón — bono de CA condicionado a `combatant.featIds` + estado de la acción actual, evaluado en `totalArmorClass`.
2. **Esquiva Sobrenatural (Uncanny Dodge):** condición sobre `attackContext` (¿el atacante está flanqueando o es invisible?) que decide si el combatiente conserva Destreza pese a estar desprevenido — mismo punto de extensión (`suppressDexAndDodge`).
3. **Combate Montado / Vigilante:** bonos de CA circunstanciales condicionados a un flag de `attackContext` (`isMounted`, `isCharging`), sin tocar el catálogo de efectos.

### Matriz de Impacto de Subsistemas
- [x] **Rule Engine:** `Rules.totalArmorClass` gana dos bloques condicionales; `AttackContext` gana 2 campos opcionales; `FeatCatalog` gana 2 entradas + `hasFeat`.
- [x] **CombatRoom / State Schema:** `CombatantSnapshot.dodgeTargetId?: string | null` (opcional, retrocompatible).
- [x] **WebSocket Contract:** nuevo comando aditivo `declare-dodge-target`; `AttackResolutionOptions` gana 2 campos opcionales internos al servidor (no viajan por red, se derivan de `OpportunityAttack.movementCostFeet`).
- [x] **UI Presentation:** `SelectedInfo.tsx` proyecta CA "vs. objetivo actual"; nuevo control de declaración de Esquiva.
- [x] **Tests:** `tests/dodge-mobility.test.mjs` (foco de esquiva, bono de movilidad en AdO por movimiento, anulación por Flat-Footed).

## 4. Qué NO resuelve este sprint
- **Economía de acción de Dodge:** RAW exige declarar el objetivo al inicio del turno; este sprint permite redeclarar en cualquier momento del turno propio, sin costo de acción explícito ni bloqueo de "una vez por turno". Deuda aceptada, documentada.
- **Reseteo automático de `dodgeTargetId`** al cambiar de ronda/turno (RAW: la designación se mantiene hasta que decidas cambiarla, así que no expira sola — se deja tal cual, sin Tick Layer).
- Esquiva Sobrenatural, Combate a la Defensiva Mejorado, Escudo Total: quedan fuera, solo se documentan como extensión futura (Regla de Tres).
- Validación de que `srd_mobility` también debería aplicar a AdO provocados por Acrobacias/Movimiento Acrobático (Sprint 023): se limita a AdO de movimiento estándar; ampliar el alcance de `isMovementProvoked` a esos casos queda para un sprint futuro si se detecta que `movementCostFeet` no cubre todos los triggers de movimiento.

## Riesgos y Mitigaciones
- **Falso positivo de Esquiva:** se exige coincidencia exacta de `combatant.dodgeTargetId === attackContext.attackerId`; si `attackerId` no se provee (ej. daño automático sin atacante), el bono no se activa nunca por defecto.
- **Fuga de +4 Movilidad fuera de AdO por movimiento:** ambas banderas (`isOpportunityAttack` y `isMovementProvoked`) deben ser `true` simultáneamente; ningún otro resolver las setea salvo `handleResolveOpportunityAttack`.
- **Regresión de Flat-Footed:** ambos bonos están estrictamente dentro del `if (!suppressDexAndDodge)`, la misma condición ya usada y testeada para Destreza.

## Validación Planeada
- `tests/dodge-mobility.test.mjs`: foco de esquiva (bono solo contra el atacante designado), bono de movilidad en AdO por movimiento, anulación total ante `srd_flat_footed`.
- `npm test`, `npm run typecheck`, `npm run build`.
