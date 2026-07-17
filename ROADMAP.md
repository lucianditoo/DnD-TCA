# Roadmap del Motor Táctico (D&D 3.5)

> **Nota de vigencia (2026-07-17, cierre ATK-RANGED-INTO-MELEE):** las "Fases" listadas abajo son históricas (era pre-Sprint 005) y no reflejan la secuencia actual. La hoja de ruta viva es: Master Plan de Cobertura Total PHB 3.5 (`.ai/coverage/`, `V1_LAUNCH_MANIFESTO.md`) + plan de saneamiento del Core (`docs/designs/core-rules-consolidation.md`). Secuencia reciente real: 036 → 037 → ATK-RANGED-INTO-MELEE (completado) · 038 Full Attack V2 (gate `Proceed`) · 039 Power Attack (congelado) · siguiente candidata en análisis. Estado por sprint: `PROJECT_STATUS.md`.

Este documento define el orden de implementación de las mecánicas futuras, priorizando la resolución de deudas técnicas y dependencias arquitectónicas por sobre el orden lineal del manual de reglas.

## Fase 6: Sistema Base de Efectos Activos (ActiveEffects) - FINALIZADA (Sprints 002-004)
- **Capas Afectadas:** `effects/`, `turnManager.ts`, `bus.ts`.
- **Reglas Desbloqueadas:** Buffs, Debuffs, infraestructura temporal de efectos.
- **Riesgos:** Ninguno. (Resuelto y sellado en Sprint 004).

## Fase 6.5: Rule Engine Integration (Sprint 005 - Próximo)
- **Capas Afectadas:** `rules/`, `effects/`, `CombatSnapshot`.
- **Reglas Desbloqueadas:** Extracción automática de modificadores del Rule Registry para su evaluación matemática contra los stats derivados.
- **Dependencias:** Sistema Base de Efectos Activos.
- **Riesgos:** Alto. Reducer debe mantenerse performante e inmutable.

## Fase 7: Sistema Formal de Condiciones (Pausado)
- **Capas Afectadas:** `rules.ts` (Validaciones), `types.ts`, `CombatSnapshot`.
- **Reglas Desbloqueadas:** Stunned, Helpless (Formalizado), Prone, Flat-footed, Blinded, Coup de Grace.
- **Dependencias:** Integración completa de ActiveEffects (Fase 6.5).
- **Riesgos:** Acoplamiento temporal con `lifeStatus`.
- **Valor Visible:** Posibilidad de que criaturas queden aturdidas, pierdan turno, o caigan al piso, viéndose reflejado en el bloqueo real del flujo táctico.

## Fase 7: Clase de Armadura Desglosada (AC Split)
- **Capas Afectadas:** `equipmentStats.ts`, `combatSnapshot.ts`.
- **Reglas Desbloqueadas:** Touch AC, Flat-Footed AC, Ataques Furtivos básicos.
- **Dependencias:** Requiere Fase 6 (para saber mecánicamente cuándo aplicar Flat-footed).
- **Riesgos:** Complejidad en la agregación de buffs (+Armor, +Shield, +Deflection, +Natural, +Dodge).
- **Valor Visible:** Distinción crítica para reglas posteriores como conjuros o emboscadas.

## Fase 8: Cobertura, Línea de Visión y Geometría Espacial
- **Capas Afectadas:** `board.ts`, `rules.ts`, Motor de Raycasting.
- **Reglas Desbloqueadas:** +4 CA por Cover, 20% Miss Chance por Concealment, bloqueos de ruta efectivos, Carga (Charge) estricta, Ataques a distancia bloqueados.
- **Dependencias:** Refactor de la matriz del tablero para aceptar paredes/obstáculos.
- **Riesgos:** Alto riesgo de impacto en performance si el algoritmo de Bresenham o raycasting es costoso al evaluar amenazas de N a M combatientes.
- **Valor Visible:** Mapas tácticos reales, no solo recintos vacíos.

## Fase 9: Tracking de Ronda e Iniciativa Especial
- **Capas Afectadas:** `turnManager.ts`, `roomState.ts`.
- **Reglas Desbloqueadas:** Límite de 1 AdO por combatiente por ronda, Expiración precisa de Buffs/Condiciones (Tick Layer), Retrasar Turno, Preparar Acción.
- **Dependencias:** Refactor del iterador de iniciativa actual para reconocer el ciclo completo del "Round".
- **Riesgos:** Corrupción del estado si se cambia el orden de la cola en pleno ciclo de oportunidades.
- **Valor Visible:** Duración de conjuros (ej. "dura 1 ronda") y control estricto de la economía de acciones (AdOs limitados).

## Fase 10: Tamaños de Criatura y Reach Dinámico
- **Capas Afectadas:** `rules.ts (isAdjacent, distanceFeet, threatensTarget)`, Rendering UI.
- **Reglas Desbloqueadas:** Amenaza a 10ft+, Ocupación de 2x2, Squeezing, Penalizadores/Bonificadores por Tamaño, Armas con Reach.
- **Dependencias:** Ninguna mayor que el modelo de datos, pero impacta masivamente las matemáticas espaciales.
- **Riesgos:** Colisiones 2x2. Resolver si las rutas consideran "bounding boxes" o centros.
- **Valor Visible:** Integración de monstruos icónicos (Dragones, Ogros) con su comportamiento táctico real (golpear de lejos).

## Fase 11: Combate con Dos Armas y Manos (Dual Wield)
- **Capas Afectadas:** `equipmentCatalog.ts`, `Combatant`, `getAttackRoutine`.
- **Reglas Desbloqueadas:** Ataque con mano torpe, Penalizadores de Two-Weapon Fighting.
- **Dependencias:** UI de inventario (designación de main-hand / off-hand) y Fase 5 (Rutinas de asalto completo).
- **Riesgos:** Complicar el catálogo.
- **Valor Visible:** Arquetipos de pícaros y exploradores viables.

## Fase 12: Conjuros y Sistema de Concentración
- **Capas Afectadas:** `tacticalCommands.ts`, `skills.ts`, `spellCatalog`.
- **Reglas Desbloqueadas:** Castear conjuros de toque (aprovechando Fase 7), áreas de efecto (aprovechando Fase 8), AdO por conjurar (Fase 9), Concentración.
- **Dependencias:** Requiere casi todas las fases de infraestructura anteriores para funcionar bajo las reglas estrictas (Touch AC, LOS, AdO, Conditions).
- **Valor Visible:** Magia táctica real (Bolas de fuego con LOS, misiles mágicos precisos, curaciones).
