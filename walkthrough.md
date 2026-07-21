# Walkthrough — Sprint 044.1: Normalización Semántica del Registry

## Estado final

Sprint puramente documental — **cero cambios de código, cero cambios de tests, cero reglas implementadas**. Corrige un error conceptual introducido en Sprint 044: `ATTACK-FULL` y `ATTACK-FULL-V2` habían sido creadas como si fueran dos reglas distintas, cuando "Ataque Completo" es una única regla oficial de D&D 3.5 (`combat/05_acciones.txt:189-192`) con varios componentes que maduran en sprints distintos. Consolidadas en una única fila `ATTACK-FULL`. De paso, se auditaron las 48 filas restantes buscando el mismo patrón y se encontró y corrigió un segundo caso de menor severidad (`EQUIPMENT-INVENTORY-V5` → `EQUIPMENT-INVENTORY`).

## Fase 0 — Verificación de git

Confirmado antes de tocar nada: rama `master`, working tree limpio, último commit `2777b0e` (cierre real de Sprint 044), sin cambios ajenos.

## Fase 1 — Auditoría de la regla oficial

`combat/05_acciones.txt:189-192` confirma que "Ataque Completo" es una única acción de asalto completo con varios componentes normativos: progresión de ataques por BAB, Combate con Dos Armas/arma doble, "alguna razón especial (una dote o un objeto mágico)" (cubre Disparo Rápido y Haste), selección de objetivo ataque-por-ataque sin declaración previa, compatibilidad con paso de 5', y la opción de Luchar a la Defensiva dentro del ataque completo.

Verificado contra código real, componente por componente:

| Componente | Estado verificado |
|---|---|
| Ataques iterativos por BAB | ✅ `getAttackRoutine`/`getEffectiveAttackRoutine` (Sprint 036) |
| Paso de 5' compatible | ✅ ya integrado en la UI/economía de turno |
| Bloqueo de movimiento normal | ✅ `attackMode === "full"` bloquea acción de movimiento |
| Luchar a la Defensiva dentro de ataque completo | ✅ flag `fightingDefensively`, -4/+2 |
| Selección de objetivo ataque-por-ataque | ✅ cada `resolve-attack` es independiente; nada fuerza declarar objetivos por adelantado |
| Combate con Dos Armas | ❌ no implementado (confirmado: sin mecánica de mano torpe/off-hand) |
| Disparo Rápido (dote) | ❌ no implementado (`srd_rapid_shot` no existe en `featCatalog.ts`) |
| Aceleración (Haste) real como ataque extra | ❌ no implementado (`Buff.grantsExtraAttack` no existe; Haste hoy solo otorga velocidad) |
| Ataques naturales múltiples (mordisco+garra+garra) en la rutina | ❌ no implementado (`naturalAttackId` es singular en el snapshot) |
| Hendedura/Gran Hendedura | ❌ no implementado (dote no catalogada) |

## Fase 2 — Consolidación de la Rule ID

`docs/rules/registry.md`: eliminada `ATTACK-FULL-V2` como fila independiente. `ATTACK-FULL` actualizada con estado global **Parcial**, desglose completo de componentes completos/pendientes, código y tests reales, y sprints de origen (`-`, `036`, `038` en gate). El documento de diseño de Rapid Shot/Haste conserva su título "V2" — es documentación de una etapa de diseño, no una Rule ID.

## Fase 3 — Auditoría de las 47 filas restantes

Revisadas todas buscando sufijos `V1`/`V2`/`V3`, nombres de sprint o implementación interna:

- **`EQUIPMENT-INVENTORY-V5` → `EQUIPMENT-INVENTORY`** (corregido): "V5" era el número de esquema interno de persistencia (`StoredProfile V5`), no una versión de la regla. Menor severidad que el caso `ATTACK-FULL` — una sola fila con nombre inconsistente, no una duplicación semántica entre dos filas. Renombrada; el detalle V5 se conserva como nota en la columna de implementación.
- **`ATK-RANGED-INTO-MELEE`** (reportado, sin cambios): usa el prefijo `ATK-` en vez de `ATTACK-` — inconsistencia de estilo, no duplicación semántica. No se corrige ahora: renombrar este ID tocaría referencias cruzadas en otros documentos, fuera del alcance de bajo riesgo de este sprint.
- **`EFFECTS-SYS-*`** (reportado, sin cambios): conserva "SYS" deliberadamente — son filas de infraestructura del motor, no reglas de D&D, así que nombrar el sistema interno es apropiado.
- Ninguna otra fila usa sufijos de versión ni nombres derivados de sprint. No se detectó ninguna otra duplicación semántica que ameritara una reorganización amplia.

## Fase 4 — Roadmap

`ROADMAP.md` renumerado (Sprint 044 y 044.1 ya consumieron dos números desde la última versión): Condiciones Restantes ahora es **Sprint 045**, Concealment **046**, Vision/Línea de Efecto **047**, y "Full Attack V2" pasa a ser **Sprint 048 — Completar `ATTACK-FULL`** (mismo Rule ID, no una regla nueva). Feats/Spells quedan como lotes abiertos (049+/050+). Two-Weapon Fighting ya no aparece como sprint separado — es uno de los componentes pendientes de `ATTACK-FULL`. `PROJECT_STATUS.md` y `TODO.md` actualizados para no contradecir la nueva terminología.

## Fase 5 — Política del Registry

Agregada sección "Política de identidad de Rule ID" al encabezado de `docs/rules/registry.md`: las Rule IDs representan reglas/capacidades estables, no versiones/sprints/etapas; los componentes pendientes se registran dentro de la misma fila cambiando su estado a Parcial. Documentada como recomendación futura (no aplicada): evaluar organización por dominios si el Registry supera ~100 filas.

## Fase 6-7 — Documentación afectada y validación

Archivos modificados: `docs/rules/registry.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`. No se tocó `combat/`, código ni tests.

Validación: `ATTACK-FULL-V2` ya no aparece como fila de tabla (solo en prosa explicativa histórica); `ATTACK-FULL` aparece una única vez como fila; los 43 enlaces `.md` y 32 archivos de test citados en el Registry siguen existiendo (verificado con `find`/`ls` reales); funciones citadas verificadas por grep directo. `git diff --check` sin errores. No se ejecutó la suite completa — no hubo cambios de código ni tests.

## Confirmación

No se implementó ninguna regla de D&D 3.5 en este sprint. No se inicia Sprint 045.
