# Walkthrough — Sprint 044: Consolidación del Registry

## Estado final

Sprint puramente documental/de gobernanza — **cero cambios de código de producción, cero cambios de tests**. `docs/rules/registry.md` pasa de 22 a 48 Rule IDs, todos verificados individualmente contra código/tests/documentación reales antes de agregarse. Dos entradas de deuda técnica (DT-011, DT-014) confirmadas resueltas y cerradas. Una contradicción documental real (Tumble/Piruetas) detectada y corregida en `docs/audits/combat-rules-deviations.md`.

## Contexto

Sprint 043.1 (auditoría de solo lectura) había detectado que `docs/rules/registry.md`, pese a declararse "el índice maestro de todas las reglas del motor", solo representaba 22 Rule IDs — menos de la mitad del motor real. Este sprint ejecuta la reconstrucción, con la restricción explícita de verificar cada fila contra el archivo/función/test citados antes de agregarla, y de no asumir que cada mecánica merece exactamente una fila por haber tenido un sprint propio.

## Fase 0 — Cierre formal de Sprint 043

Commit `45170ff` (`docs(governance): version walkthrough and refresh architectural roadmap`), 5 archivos (`.gitignore`, `PROJECT_STATUS.md`, `ROADMAP.md`, `TODO.md`, `walkthrough.md`), push exitoso a `origin/master`, working tree limpio confirmado antes de empezar Sprint 044.

## Fase 1-2 — Taxonomía y mecánicas huérfanas

Se verificó código/tests real (no solo el nombre de la mecánica) para cada una de las ~20 mecánicas huérfanas listadas en el prompt de Sprint 044, más las 3 filas existentes a corregir. Decisiones de granularidad relevantes:

- **Conditions V3** (Fatigued/Prone/Dazed/Paralyzed): 4 filas separadas (`EFFECT-FATIGUED`, `EFFECT-PRONE`, `EFFECT-DAZED`, `EFFECT-PARALYZED`), no una sola — cada condición es una capacidad de dominio independiente, mismo patrón que las filas ya existentes `EFFECT-STUNNED`/`EFFECT-FLAT-FOOTED`. Hallazgo: `docs/designs/conditions-v3-fatigued-prone.md` solo cubre Fatigued/Prone pese a que Sprint 014 shippeó las 4 juntas — Dazed/Paralyzed quedan sin NDD dedicado, documentado explícitamente en sus filas en vez de enlazar el documento equivocado.
- **Global Round Tracker + Bleeding** (Sprint 021): 2 filas (`ROUND-TRACKER`, `EFFECT-DYING-BLEED`) — son conceptualmente distintas (mecanismo de reloj de ronda vs. consecuencia de daño pasivo), aunque comparten sprint y ausencia de NDD dedicado (solo aparecen en el Apéndice A de `combat-rules-deviations.md`).
- **Grapple V1+V2, Bull Rush+Squeezing dinámico**: 1 fila cada una (`MANEUVER-GRAPPLE`, `MANEUVER-BULL-RUSH`) — V2 extiende V1 sobre la misma regla, no son reglas distintas.
- **Percentile Roller** (mencionado en el nombre de Sprint 022): verificado por grep — no existe ningún símbolo `percentile`/`Percentile` en el repositorio hoy. No se creó fila; se absorbió en su momento al roller de dados genérico sin dejar rastro nombrado.
- **Spell AoE Geometry** (Sprint 033): verificado que `geometry/aoe.ts`/`getCellsIntersectedByAoE` no aparecen en **ningún** archivo de `tests/` — cero cobertura directa o indirecta. Clasificado **Parcial**, no Completo, pese a que PROJECT_STATUS.md lo celebra como cerrado — es el hallazgo de mayor severidad de este sprint.
- **Total de filas**: 22 → **48**. Todos los enlaces `docs/*.md` citados (43 únicos) y archivos de test citados (32 únicos) fueron verificados con `find`/`ls` reales, no de memoria — cero enlaces rotos en la versión nueva (el único "roto" que aparece en el texto es la mención histórica intencional del link previo de `ATTACK-FULL`, dentro de su propia nota de corrección).

## Fase 3 — Filas existentes corregidas

- **`ATTACK-FULL`**: el link a `docs/designs/full-attack.md` (inexistente) se reemplazó por `docs/designs/iterative-attacks-core-design.md` (existe, y es la documentación real de `getAttackRoutine`/`getEffectiveAttackRoutine`). Se separó en dos filas: `ATTACK-FULL` (rutina iterativa base, Completo) y `ATTACK-FULL-V2` (Rapid Shot/Haste real, No iniciado, Sprint 038 en gate) — para no marcar como implementado lo que sigue pendiente.
- **`DEFENSE-TOTAL`**: se documentó explícitamente por qué sigue "Parcial" (no había justificación inline antes): el núcleo RAW está implementado (`handleTotalDefense`), pero no hay evidencia de la interacción con Pericia en Combate (Combat Expertise) que el manual describe como acumulable, ni test que la ejercite.
- **`MOVE-RUN`**: se agregó una nota explícita distinguiendo divergencia aprobada (DT-018/DT-019, decisiones deliberadas D-2/D-4 del propio NDD) de deuda real — no se presentan como bugs ocultos.

## Fase 4 — Deuda técnica actualizada

- **DT-011** ✅ RESUELTO: verificado que `getAttackRoutine`/`getEffectiveAttackRoutine` (Sprint 036) implementan progresión real por BAB. Se distinguió explícitamente del alcance pendiente de Rapid Shot/Haste (`ATTACK-FULL-V2`, Sprint 038), para no confundir "iterativos básicos ya resueltos" con "fuentes de ataque extra todavía pendientes".
- **DT-014** ✅ RESUELTO: verificado que `turnManager.ts::roundTickListener` (Sprint 021) desangra pasivamente a los moribundos, con test real (`global-round-tracker.test.mjs`) y confirmación cruzada en `combat-rules-deviations.md` (`COND-02`, "Resuelta").

## Fase 5 — Consistencia entre fuentes

Revisadas `PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md`, `docs/testing/master-coverage.md` — ninguna contradice el Registry nuevo (miden ejes distintos: estado de regla vs. planificación futura vs. evolución de tests), así que no se modificaron para evitar duplicar tablas. Único hallazgo real de contradicción: **`docs/audits/combat-rules-deviations.md`**, fila `MOVE-02` de su Apéndice A, afirmaba "sigue sin sistema de Habilidades/Tumble" — falso. `apps/server/src/commands/movementCommands.ts:53-95` implementa tiradas reales de Acrobacias (1d20+DES) contra CD 15/25 con logging. Corregida esa fila y agregada una nota aclaratoria en el gap G-02 (que sigue siendo válido, pero se refiere a que el *corpus normativo* no transcribe la regla de la habilidad — no a que el motor no la implemente; son cosas distintas y la redacción original prestaba a confusión).

## Fase 6-7 — Validación documental

- Todos los enlaces `.md` citados en el registry nuevo: verificados con `find`/existencia real de archivo (43/43 vigentes, salvo la mención histórica intencional).
- Todos los archivos de test citados: verificados (32/32 existen en `tests/`).
- Funciones citadas: verificadas por grep directo contra `packages/shared/src` (`getAttackRoutine`, `getEffectiveAttackRoutine`, `isAcrobatic`, `srd_dazed`, `srd_paralyzed`, `getGrappleAttackEligibility`, `validateBullRushManeuver`, `maxAooAllowed`, `getCellsIntersectedByAoE`, etc.) — todas confirmadas presentes.
- `git status`/`git diff` revisados antes de comitear (ver resumen de cierre de la sesión).
- No se ejecutó la suite completa de tests — no hubo cambios de código ni de tests en este sprint.

## Archivos modificados

`docs/rules/registry.md` (reconstrucción completa, 22→48 filas), `docs/technical-debt.md` (DT-011, DT-014 cerradas), `docs/audits/combat-rules-deviations.md` (fila `MOVE-02` corregida + nota en G-02), `walkthrough.md`.

## Deuda técnica

Ninguna nueva introducida. Se cerraron DT-011 y DT-014. Se documentó (no se corrigió, por ser código) que `SPELL-AOE` (Sprint 033) tiene cero cobertura de test — candidato a deuda técnica nueva si se decide abrir una entrada formal en un sprint futuro (no se hizo en este, por ser puramente documental).

## Próximo sprint funcional recomendado

Sin cambios respecto de Sprint 043: **Condiciones Restantes** (Blinded, Entangled, Dazzled, Shaken/Frightened, Exhausted), con Concealment como alternativa fuerte de segundo lugar. No se inicia en este sprint.
