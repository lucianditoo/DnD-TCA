# V1_LAUNCH_MANIFESTO — Filosofía de Cobertura Total PHB 3.5

**Tipo de documento**: Manifiesto arquitectónico de gobernanza. No es una NDD de sprint ni un plan de implementación puntual — es el marco de principios contra el que se evaluará cada NDD futura que amplíe cobertura de dotes, conjuros o equipo hacia la Versión de Lanzamiento 1.0. No autoriza ningún cambio de código por sí mismo.

**Decreto de producto**: la V1.0 del motor táctico debe dar soporte fiel, taxativo y completo a las reglas de combate, movimiento, dotes, conjuros y equipamiento del Manual del Jugador 3.5. Este manifiesto formaliza *cómo* se debe crecer hacia esa meta sin degradar la arquitectura ya consolidada.

---

## 1. Principio rector: Contenido Declarativo vs. Core Duro

El 100% de las dotes, armas y conjuros del PHB que se añadan de aquí en adelante deben modelarse como **datos puros e inmutables** (catálogos `Object.freeze`, sin funciones ni callbacks) que alimenten las **tuberías de funciones puras ya consolidadas** en `packages/shared/src/rules.ts` y sus módulos satélite. El contenido nuevo describe *qué* modifica; el motor ya sabe *cómo* aplicarlo.

Tuberías consolidadas que todo contenido nuevo debe reutilizar, sin excepción, antes de considerar una nueva:

| Tubería | Función/mecanismo | Consume |
|---|---|---|
| **AC Split** (CA normal vs. de toque) | `Rules.totalArmorClass` + `AttackContext.targetAcType: "normal" \| "touch"` (`rules.ts:169,185`) | Conjuros de rayo/toque (`SpellDefinition.resolution.kind === "attack-roll"`), armas con reglas de toque. |
| **Daño de Precisión** | Pipeline de `SNEAK_ATTACK_DICE` (`EffectStat`, `effects/contracts.ts:49`) | Dotes/condiciones que añaden dados de precisión bajo condiciones de flanqueo/objetivo desprevenido. |
| **Intervalos de Alcance** | `EquipmentCatalog.toWeaponProfile` (`rangeIncrementFeet`, `maxRangeIncrements`, `equipmentCatalog.ts:90-110`) | Armas a distancia nuevas; ninguna dota debe recalcular alcance por su cuenta. |
| **Terreno Difícil y Oposición Geométrica** | `validateMovePath`, `isCornerAnchorBlockedByTerrain` (Sprint 037), `getCellsIntersectedByAoE` (`geometry/aoe.ts:12`) | Conjuros de área (`cone`/`line`/`burst`), maniobras que dependen de geometría de celdas. |
| **Rutina de Ataques Iterativos** | `getEffectiveAttackRoutine`, `FeatCatalog.attackRoutineContribution` (Sprint 036) | Dotes/efectos que añaden ataques extra o modifican la rutina base (Disparo Rápido, Pericia con Dos Armas, Prisa). |
| **Reglas de Vida y Estabilización** | `FeatCatalog.lifeRules` | Dotes que alteran el comportamiento en PG negativos (Duro de Pelar y análogas). |
| **Reducer de Efectos Activos** | `EffectDefinition.modifiers` / `conditionalModifiers` / `traits` / `ruleOverrides` (`effects/contracts.ts`) | Condiciones, conjuros de buff/debuff, peligros ambientales. |

## 2. Prohibición explícita

Queda **estrictamente prohibido** introducir una rama condicional imperativa (`if (combatant.featIds.includes("srd_x")) { ... }` o equivalente `switch`/`else if`) por cada dota, conjuro o pieza de equipo que se incorpore. Toda regla nueva se expresa como una entrada de catálogo (`FeatDefinition`, `EffectDefinition`, `SpellDefinition`, `WeaponEntry`/`ArmorEntry`/`ShieldEntry`) consumida por un selector o fold genérico ya existente (`FeatCatalog.hasFeat`, `.avoidsOpportunity`, `.lifeRules`, `.tacticalActionRule`, `.attackRoutineContribution`; el Reducer de `ActiveEffects`). Si el fold genérico no soporta la forma de la regla nueva, la extensión correcta es **ampliar el fold** (nuevo campo opcional en la interfaz de contribución), no bifurcar el flujo con una condición ad-hoc.

## 3. Deuda ya detectada que NO debe replicarse

La auditoría de `.ai/coverage/FEATS_PHB_CHECKLIST.md` identificó dos desviaciones del principio anterior, ya presentes en el motor **antes** de este manifiesto:

- `srd_combat_reflexes` se resuelve mediante un chequeo inline (`combatant.featIds.includes("srd_combat_reflexes")`, `rules.ts:516`) en vez de una entrada de `FeatCatalog.definitions` con un campo de contribución dedicado.
- `srd_dodge` y `srd_mobility` aplican su bono de CA mediante lógica ad-hoc dentro de `Rules.totalArmorClass` (`rules.ts:388-403`), fuera del Reducer de `ActiveEffects` y sin pasar por un `ConditionalModifier` declarativo.

Ambas quedan **documentadas como deuda aceptada**, no como bloqueo del lanzamiento — funcionan correctamente y están cubiertas por tests. Cualquier sprint futuro que las toque debe converger hacia el patrón declarativo descrito en la Sección 1, pero migrarlas no es, por sí solo, un requisito de la V1.0.

## 4. Qué NO resuelve este manifiesto

- No decide el orden de sprints para cerrar la brecha de cobertura (eso corresponde a `PROJECT_STATUS.md`/`TODO.md`, actualizados con la referencia al Master Plan).
- No aprueba ninguna implementación concreta — cada dota/conjuro/objeto que pase de `[ ]` a `[x]` en los checklists de `.ai/coverage/` requiere su propia NDD, Design Review Checklist y `Proceed` explícito, exactamente igual que cualquier otro cambio de código en este proyecto.
- No introduce un cuarto tipo de `EquipmentCatalogItem` (`"consumable"`) ni ningún otro cambio de esquema — la brecha de objetos consumibles señalada en `EQUIPMENT_PHB_CHECKLIST.md` queda registrada como candidata a una NDD futura, no resuelta aquí.

## 5. Vínculo con los checklists de control

Este manifiesto es el marco; `.ai/coverage/FEATS_PHB_CHECKLIST.md`, `.ai/coverage/SPELLS_PHB_CHECKLIST.md` y `.ai/coverage/EQUIPMENT_PHB_CHECKLIST.md` son el inventario taxativo de brechas contra el que se planificará cada sprint de la V1.0. Toda fila marcada `[ ]` en esos tres archivos es, por definición, trabajo pendiente que debe entrar al pipeline Diseño → NDD → Implementation Plan → Revisión → `Proceed` → Implementación → Validación → Documentación → Auditoría antes de tocar código.
