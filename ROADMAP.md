# Roadmap del Motor Táctico (D&D 3.5)

> **Reescrito en Sprint 043** (2026-07-18). La versión anterior de este documento describía "Fases" pre-Sprint-005 (2026, era temprana del proyecto) y llevaba desde el 2026-07-17 marcada como histórica/no vigente en su propia nota de cabecera. Casi todo su contenido (ActiveEffects, Rule Engine Integration, Conditions V1-V3, AC Split, Cover, Round Tracking/Tick Layer, tamaños/reach, gran parte de Spells) ya está implementado bajo sprints numerados. Este documento es un roadmap nuevo, construido desde el estado real del proyecto (auditoría Sprint 043), no una continuación automática del anterior. La versión anterior queda preservada en el historial de git (ver `git log -- ROADMAP.md`) por si hace falta consultarla.

## Estado de base (Sprint 043)

- 42 sprints numerados completados + Sprint 042.5 (recuperación de baseline). `npm test` 430/430, typecheck/build/E2E/Playwright en verde, CI de GitHub Actions en verde.
- Cobertura del Master Plan V1.0 (`.ai/coverage/`): Equipment ~86%, Rules (PHB core) ~64%, Feats ~11%, Spells ~10%. Los dos últimos son el hueco más grande antes de poder llamar "V1.0" al proyecto.
- Infraestructura arquitectónica considerada **completa y no debe reinventarse**: ActiveEffects (`effects/manager.ts`, `effects/catalog.ts`, `effects/reducer.ts`), Tick Layer (`effects/tick.ts` + `events/bus.ts`), sistema de Traits, `CombatRulesSnapshot`/`combatSnapshot.ts`, Rule Engine (`rules.ts`), Cover/flanqueo/amenaza, ataques iterativos por BAB, salvaciones automáticas, AoE de conjuros, huellas multicasilla, Presa/Embestida/Derribo, inventario V5.

## Próximos sprints propuestos

Ver el detalle completo (objetivo/dependencias/Rule IDs/deuda/tests/impacto) en el informe de auditoría de Sprint 043 (`walkthrough.md` de ese sprint y el mensaje de cierre correspondiente en el historial de la sesión). Resumen:

1. **Sprint 043 — Condiciones Restantes (V4)**: Blinded, Entangled, Dazzled, Shaken/Frightened, Exhausted; cierre de gaps parciales (Stunned suelta objetos al quedar aturdido, Helpless Combat). Reutiliza ActiveEffects sin cambios arquitectónicos. **Recomendado como próximo sprint — ver justificación en el informe de auditoría.**
2. **Sprint 044 — Concealment (Ocultación)**: miss chance %, mismo pipeline de `getAttackContextModifiers` que Cover. El contrato `CONCEALMENT` ya existe en el tipo `Modifier` sin consumidor.
3. **Sprint 045 — Vision/Línea de Efecto (base)**: cierra G-03 de `docs/audits/combat-rules-deviations.md`; habilita validar Cegado en Correr/Retirada (DT-018/DT-019 parcial).
4. **Sprint 046 — Full Attack V2 (Rapid Shot + Haste real)**: ya diseñado y aprobado en NDD (`docs/designs/full-attack-v2-haste-rapid-shot-design.md`), solo pendiente de `Proceed` explícito.
5. **Sprint 047 — Feats Core (lote 1)**: primer lote de dotes que dependían de Conditions/Concealment para tener sentido mecánico.
6. **Sprint 048 — Spells Core (lote 1)**: concentración, componentes, resistencia a conjuros — desbloqueado por Conditions/Concealment.
7. **Sprint 049 — Combate con Dos Armas (Two-Weapon Fighting)**: aislado, reordenable con lo anterior.
8. **Sprint 050 — Saneamiento de deuda arquitectónica**: DT-008 (middleware de ownership), DT-012 (buffs dinámicos de equipo), DT-013 (validación de stacking de buffs por tipo). Sin reglas de juego nuevas.

Power Attack (Sprint 039) permanece congelado por decreto de producto explícito (`docs/designs/power-attack-v6-declarative.md`) — no se reordena en este roadmap hasta nueva instrucción.

Este roadmap no es orden lineal obligatorio: cada sprint requiere su propio NDD, Design Review Checklist y `Proceed` explícito antes de implementarse, igual que todos los anteriores.
