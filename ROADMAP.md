# Roadmap del Motor Táctico (D&D 3.5)

> **Reescrito en Sprint 043** (2026-07-18). La versión anterior de este documento describía "Fases" pre-Sprint-005 (2026, era temprana del proyecto) y llevaba desde el 2026-07-17 marcada como histórica/no vigente en su propia nota de cabecera. Casi todo su contenido (ActiveEffects, Rule Engine Integration, Conditions V1-V3, AC Split, Cover, Round Tracking/Tick Layer, tamaños/reach, gran parte de Spells) ya está implementado bajo sprints numerados. Este documento es un roadmap nuevo, construido desde el estado real del proyecto (auditoría Sprint 043), no una continuación automática del anterior. La versión anterior queda preservada en el historial de git (ver `git log -- ROADMAP.md`) por si hace falta consultarla.

## Estado de base (Sprint 044.2, arquitectura en revisión)

- 42 sprints numerados completados + Sprint 042.5 (recuperación de baseline). `npm test` 430/430, typecheck/build/E2E/Playwright en verde, CI de GitHub Actions en verde.
- Cobertura del Master Plan V1.0 (`.ai/coverage/`): Equipment ~86%, Rules (PHB core) ~64%, Feats ~11%, Spells ~10%. Los dos últimos son el hueco más grande antes de poder llamar "V1.0" al proyecto.
- Infraestructura arquitectónica considerada **completa y no debe reinventarse**: ActiveEffects (`effects/manager.ts`, `effects/catalog.ts`, `effects/reducer.ts`), Tick Layer (`effects/tick.ts` + `events/bus.ts`), sistema de Traits, `CombatRulesSnapshot`/`combatSnapshot.ts`, Rule Engine (`rules.ts`), Cover/flanqueo/amenaza, ataques iterativos por BAB, salvaciones automáticas, AoE de conjuros, huellas multicasilla, Presa/Embestida/Derribo, inventario (`EQUIPMENT-INVENTORY`).
- 48 Rule IDs documentados en `docs/rules/registry.md` (Sprint 044/044.1) — única fuente de verdad sobre qué reglas existen y en qué estado. Cada Rule ID representa una regla oficial estable, no una versión ni un sprint (política fijada en Sprint 044.1 tras corregir la duplicación `ATTACK-FULL`/`ATTACK-FULL-V2`). Sprint 044.2 fija cómo esas reglas reciben contribuciones sin duplicarse; el Registry no se modifica.
- Arquitectura transversal canónica: `docs/designs/modifier-pipeline-architecture.md`. Toda vertical futura debe seguir Intención → Preflight → Operación base → Contribuciones estructurales → Contexto → Proyección efectiva → Resolver → Consecuencias → Commit, con contratos especializados y sin `UniversalModifier`.

## Próximos sprints propuestos

Ver el detalle completo (objetivo/dependencias/Rule IDs/deuda/tests/impacto) en el informe de auditoría de Sprint 043 (`walkthrough.md` de ese sprint y el mensaje de cierre correspondiente en el historial de la sesión). Resumen:

1. **Sprint 044.2 — Pipeline de Modificadores (diseño completado, en revisión)**: audita las rutas actuales, decide cuáles retirar/consolidar y fija el pipeline oficial. No abre Rule IDs ni implementación. Documento: `docs/designs/modifier-pipeline-architecture.md`.
2. **Clasificación y recorte previo (documentado como Sprint 045)**: la auditoría descarta “Condiciones Restantes” como lote. Recomienda una única vertical `DEFENSE-CONCEALMENT` antes de Blinded, con miss chance autoritativa y assessment compartido. Requiere su propio gate; no hay implementación funcional.
3. **Condiciones, una vertical por dependencia**: Blinded después de Concealment; Dazzled/Shaken después de decidir alcance de skills/checks; Entangled/Exhausted después de una tasa multiplicativa de movimiento; Stunned después de modelar caída real de objetos; Frightened/Panicked después de movimiento obligatorio y escalado de miedo; Helpless/Coup de Grace como vertical separada. Ver `docs/designs/rule-and-modifier-classification.md`.
4. **Vision/Línea de Efecto (base)**: cierra G-03 de `docs/audits/combat-rules-deviations.md`; habilita validar Cegado en Correr/Retirada (DT-018/DT-019 parcial).
5. **Modificadores de rutinas de ataque bajo Rule IDs independientes**: Rapid Shot, Haste, Two-Weapon Fighting, ataques naturales y Cleave/Great Cleave no son componentes intrínsecos de `ATTACK-FULL`. Deben consumir el compositor/proyección especializada definidos por Sprint 044.2.
6. **Feats Core (lotes pequeños)**: dotes que dependan de Conditions/Concealment o del futuro compositor de rutinas.
7. **Spells Core (lotes pequeños)**: concentración, componentes, resistencia a conjuros y migración fiel de Haste.
8. **Saneamiento de deuda arquitectónica** (sin número fijo, reordenable): DT-008 (middleware de ownership), DT-012 (buffs dinámicos de equipo), DT-013 (validación de stacking de buffs por tipo). Sin reglas de juego nuevas.

Power Attack (Sprint 039) permanece congelado por decreto de producto explícito (`docs/designs/power-attack-v6-declarative.md`) — no se reordena en este roadmap hasta nueva instrucción.

Este roadmap no es orden lineal obligatorio: cada sprint requiere su propio NDD, Design Review Checklist y `Proceed` explícito antes de implementarse, igual que todos los anteriores.
