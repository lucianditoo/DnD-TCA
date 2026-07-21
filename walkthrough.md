# Walkthrough — Sprint 043: Planning & Roadmap

## Estado final

Sprint puramente de planificación/gobernanza/auditoría — **cero cambios de código, cero reglas nuevas**. Termina con: gobernanza de `walkthrough.md` resuelta, auditoría real de todo el estado documental/código/tests/CI, un roadmap nuevo (`ROADMAP.md` reescrito), y una recomendación justificada del próximo sprint. Pendiente de aprobación explícita antes de iniciar cualquier sprint funcional.

## Fase 1 — Gobernanza de `walkthrough.md`

`docs/designs/document-architecture-cleanup.md` §3 (Sprint 040) había dejado la naturaleza "efímera/no versionada" de `walkthrough.md` explícitamente como **propuesta pendiente de aprobación**, no como decisión ratificada — citando textualmente: *"Se mantiene ignorado en esta fase, sin cambios"*. Esa aprobación llegó en este sprint. Se quitó `walkthrough.md` de `.gitignore` (línea 52), se documentó la nueva política directamente en el comentario del `.gitignore`, y se verificó con `git check-ignore -v walkthrough.md` (exit 1, no ignorado) que el archivo ya puede versionarse. A partir de ahora cada cierre de sprint que sobrescribe este archivo queda en el historial de git, igual que ya ocurre con `implementation_plan.md` desde Sprint 040.

## Fase 2 — Auditoría real (documentación ↔ código ↔ tests ↔ CI)

### Sprints completamente cerrados
Los 42 sprints numerados listados en `PROJECT_STATUS.md`/`TODO.md` bajo "Hecho"/"Sprints Completados", más Sprint 042.5 (recuperación de baseline, cierre formal de Sprint 042). `npm test` 430/430, typecheck/build en verde en los 3 workspaces, E2E WebSocket 87/87, Playwright 5/5, GitHub Actions verde (confirmado por API pública, run del commit `d3c02ba`). Únicos sprints funcionales **no cerrados**: Sprint 038 (Full Attack V2 — Rapid Shot/Haste, NDD aprobado pero esperando `Proceed`, confirmado por código: no existe `srd_rapid_shot` en `featCatalog.ts` ni `Buff.grantsExtraAttack`, y `attackCommands.ts` sigue gateando contra `getAttackRoutine` crudo) y Sprint 039 (Power Attack, congelado por decreto de producto explícito).

### Rule IDs — estado
- **Completos** (ver `docs/rules/registry.md`): movimiento básico, 5-foot step, ataque básico/completo/iterativo real, críticos, flanqueo, amenaza, Cover (criatura + obstáculo), AC Split (Normal/Touch/Flat-Footed), ataques de toque autoritativos, esfuerzo Disabled, disparo a melé (-4), Retirada, Correr, ActiveEffects (core/catálogo/tick/reducer), Flat-Footed, salvaciones automáticas, huellas grandes, Presa V1/V2, Embestida/Squeezing, AdO avanzados, AoE de conjuros, salvaguardas ambientales/hazards (recién reparado en Sprint 042.5), inventario/munición V5, Esquiva/Movilidad.
- **Parciales**: `EFFECT-STUNNED` (falta "soltar objetos sostenidos" al quedar aturdido — inventario V5 ya existe, solo falta la integración puntual), Defensa Total (`DEFENSE-TOTAL`, marcada "Parcial" en registry sin detalle adicional encontrado).
- **Pendientes/no iniciados**: Concealment (el contrato `CONCEALMENT` con porcentaje ya existe en el tipo `Modifier` de `effects/contracts.ts` pero sin consumidor verificado en `rules.ts`), Ocultación Total, Cobertura Total (bloqueo de ataque, no solo bono de CA), Vision/Línea de Efecto formal (gap G-03 de `combat-rules-deviations.md`), Blinded/Entangled/Dazzled/Shaken-Frightened/Exhausted (condiciones citadas en las Tablas 8-5/8-6 del manual sin definición formal, gap G-05), Two-Weapon Fighting, Power Attack (congelado), Rapid Shot/Haste real (Sprint 038 gate), Piruetas/Tumble anti-AdO (gap G-02), Impedimenta/carga transportable (gap G-04), Feats (~89% del PHB sin cubrir), Spells (~90% del PHB sin cubrir, incluida concentración/componentes/resistencia a conjuros), Skills, editor de criaturas/mapas, persistencia real de salas, autenticación multiusuario.

### Deuda técnica activa (`docs/technical-debt.md`)
Abiertas y vigentes tal como están escritas: DT-008 (ownership imperativo duplicado en cada handler, 34 sitios confirmados en auditoría previa), DT-009 (E2E frágil ante mecánica de dados), DT-010 (cero tests unitarios/componente en `apps/web`, confirmado de nuevo: 0 archivos `.test.tsx`, sin `vitest`/`@testing-library` en `package.json`), DT-012 (EquipmentCatalog estático, sin buffs dinámicos para armas mágicas), DT-013 (stack de buffs sin validación de tipo de bonificador), DT-015 (marcada abierta en la tabla resumen pese a que el Sprint 040 ya aplicó la separación de autoridades documentales que pedía — inconsistencia menor ya señalada en una auditoría anterior, no corregida todavía), DT-016 (DurationPolicy acoplado al número de ronda global), DT-018/DT-019 (Correr: resistencia multi-asalto y bloqueo por visión, diferidas explícitamente por decisión de diseño, no descuido).

**Hallazgo nuevo de esta auditoría — dos entradas de deuda técnica están obsoletas/incorrectas tal como están escritas hoy** (no se corrigieron en este sprint porque `docs/technical-debt.md` no está en la lista de documentos a sincronizar de la Fase 5; se deja registrado aquí para una corrección futura de una línea cada una):
- **DT-011** ("Ataque completo sin ataques iterativos reales") — desactualizada. Sprint 036 implementó `getAttackRoutine`/`getEffectiveAttackRoutine`, una progresión real por BAB (+6/+1, +11/+6/+1, etc.), confirmada en uso desde `attackCommands.ts`. La preocupación original de DT-011 ya no aplica; el único residuo real (Rapid Shot/Haste como fuentes de ataque extra) es exactamente el alcance de Sprint 038, ya rastreado por separado.
- **DT-014** ("Pérdida automática de 1 HP por ronda... sin implementar") — desactualizada. Sprint 021 (Global Round Tracker & Bleeding) implementó el desangrado pasivo automático; confirmado tanto en `PROJECT_STATUS.md`/`TODO.md` como en el Apéndice A de `docs/audits/combat-rules-deviations.md` (`COND-02`, marcada "Resuelta").

### Infraestructura existente que NO debe reinventarse
- **ActiveEffects** (`packages/shared/src/effects/`): `manager.ts` (mutación pura, `EffectManager.add/remove/removeMany`), `catalog.ts` (`effectsCatalog`, `EffectDefinition` declarativo con traits/`conditionalModifiers`/bloque `hazard`), `reducer.ts` (`EffectReducer.reduceEffectsForTarget`, resolución de stacking/traits/modificadores numéricos), `tick.ts` + `events/bus.ts` (Tick Layer basado en eventos, sin registro global). Maduro, en uso activo, confirmado sin bugs estructurales en la auditoría de clones de Sprint 042.5.
- **Traits**: unión de capacidades (`CANNOT_ACT`, `CANNOT_MOVE`, `CANNOT_MAKE_AOO`, `HELPLESS`, `NO_THREAT`, `NO_DEX_TO_AC`, `IMMUNE_TO_CRITICAL_HITS`, `IMMUNE_TO_PRECISION_DAMAGE`) — el punto de extensión correcto para condiciones nuevas es agregar traits/entradas de catálogo, no una arquitectura paralela.
- **Conditions**: evolución coherente en 3 iteraciones documentadas (Sprint 006 V1 `srd_stunned` → Sprint 007 V2 `srd_flat_footed` con expiración automática vía Tick Layer → Sprint 014 V3 Fatigued/Prone/Dazed/Paralyzed con `conditionalModifiers`/`attackContext` en `totalArmorClass`). Ninguna quedó abandonada; la V3 fue una reescritura deliberada ("Opción B") documentada en su propio NDD tras rechazar una "Opción A", no una migración silenciosa.
- **CombatRulesSnapshot** (`combatSnapshot.ts`): fuente-first, deep-freeze en desarrollo, recién auditado y reparado (Sprint 042.5, `targetCells`). El diseño original (`docs/designs/combat-room-snapshot.md`) sigue vigente en principio; solo se extendió con más campos a lo largo de 42 sprints.
- **Effect Manager**: única entidad autorizada para mutar la colección global de efectos; funciones puras, sin lógica de juego.

### Documentos obsoletos detectados
- **`ROADMAP.md` (ya corregido en este sprint)**: describía "Fases" pre-Sprint-005; casi todo su contenido ya está implementado bajo sprints numerados posteriores. Reescrito desde cero (ver más abajo).
- **`docs/testing-coverage-report.md`** (enlace en `PROJECT_STATUS.md`): apuntaba a un archivo que ya no existe — reemplazado por `docs/testing/master-coverage.md`. Corregido en Sprint 042.5.
- Los headers "Estado: Fase 2 — bloqueada hasta Proceed" que persisten en varios NDDs ya implementados (`cover-and-dynamic-reach-design.md`, `special-maneuvers-trip-design.md`, `grapple-core-v1-design.md`, `bull-rush-and-squeezing-design.md`) **no se tratan como bugs**: es el patrón establecido del proyecto — los NDDs quedan congelados en el momento de su aprobación; el estado vigente de una regla vive en `docs/rules/registry.md`, ya confirmado actualizado. No se tocaron estos NDDs.
- `docs/designs/flanking.md` ya se autodeclara superseded por `flanking-and-threatening-design.md` — correcto, sin acción necesaria.

## Fase 3 — Roadmap nuevo

Ver `ROADMAP.md` (reescrito completo en este sprint). Resumen de los 8 sprints propuestos: Condiciones Restantes (043) → Concealment (044) → Vision/Línea de Efecto (045) → Full Attack V2 (046) → Feats Core lote 1 (047) → Spells Core lote 1 (048) → Two-Weapon Fighting (049) → Saneamiento de deuda arquitectónica (050). Power Attack permanece fuera de la secuencia por decreto de producto.

## Fase 4 — Recomendación de próximo sprint

**Recomendado: Sprint 043 — Condiciones Restantes**, comparado explícitamente contra Concealment, Vision, Flat-Footed (ya completo, descartado), Grapple (ya V1/V2 completo, descartado), Spell infrastructure y Feats. Justificación completa (beneficio/riesgo/desbloqueos) entregada en el mensaje de cierre de esta sesión — resumen: mismo patrón ya usado 3 veces (V1→V2→V3) sobre infraestructura ya madura (riesgo bajo), desbloquea simultáneamente Feats y Spells (que referencian estas condiciones constantemente en el manual), y cierra deuda ya rastreada (Stunned parcial, Helpless Combat, gap G-05). Concealment quedó como alternativa fuerte de segundo lugar — comparte pipeline con Cover y es más rápido, pero desbloquea menos trabajo futuro.

## Deuda técnica

Ninguna nueva introducida por este sprint (puramente documental). Dos hallazgos de staleness en `docs/technical-debt.md` (DT-011, DT-014) quedaron documentados arriba para una corrección futura de una línea cada uno — no se tocó ese archivo porque no estaba en el alcance de sincronización de este sprint.

## Validación

Sin cambios de código de producción, tests ni build en este sprint — no aplica re-ejecutar la suite. Se verificó `git status`/`git diff` al cierre (ver mensaje de la sesión).
