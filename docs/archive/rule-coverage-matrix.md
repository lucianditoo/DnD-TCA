# Matriz de Cobertura de Reglas — D&D 3.5 Tactical Combat Engine

*Documento generado: 2026-07-07. Fuente: análisis directo del código fuente en `apps/server`, `packages/shared`, `tests/` y `scripts/e2e-websocket.mjs`.*

> **Guía de estados**
> - **Implementado**: Funciona correctamente en server y se valida contra las reglas del libro.
> - **Parcial**: Existe una versión simplificada que cubre el caso más común pero omite casos límite o sub-reglas importantes.
> - **No implementado**: No existe código para este sistema.
> - **Documentado solamente**: Existe documentación o plan de diseño pero sin código real.
> - **Legacy / necesita revisión**: Existe código pero hay dudas sobre su corrección o compatibilidad con el motor actual.

---

## 1. Turnos e Iniciativa

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Rondas y turnos | Implementado | `initiativeCommands.ts`, `turnManager.ts` | No | Sí (E2E main) | Bajo | — |
| Iniciativa manual | Implementado | `set-initiative`, `sort-initiative` | No | Sí | Bajo | Tirada automática 1d20+DEX |
| Ordenamiento descendente | Implementado | `sort-initiative` handler | No | Sí | Bajo | Empates de iniciativa |
| Avance de turno | Implementado | `end-turn`, `turnManager.ts` | No | Sí | Bajo | — |
| Muertos/estables no actúan | Parcial | Filtro en `turnManager.ts` | No | No | Medio | Test unitario de regresión |
| Sorpresa y desprevenido | No implementado | — | No | No | Medio | Diseñar antes de condiciones |
| Empates de iniciativa | No implementado | — | No | No | Bajo | — |
| Retrasar / preparar acción | No implementado | — | No | No | Bajo | — |

---

## 2. Movimiento

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Velocidad en pies | Implementado | `rules.ts`, `movementCommands.ts` | Sí (`rules.test.mjs`) | Sí | Bajo | — |
| Movimiento por ruta paso a paso | Implementado | `movementCommands.ts` | No | Sí | Bajo | — |
| Límite de velocidad disponible | Implementado | `movementCommands.ts` | No | Sí | Bajo | — |
| No terminar en casilla ocupada | Implementado | `movementCommands.ts` | No | Sí | Bajo | — |
| Paso de 5 ft sin AdO | Implementado | `movementCommands.ts` | No | Sí | Bajo | — |
| Ruta sin casillas repetidas | Implementado | `movementCommands.ts` | No | Sí | Bajo | — |
| Movimiento a través de aliados | No implementado | — | No | No | Medio | Diseñar con tamaños de criatura |
| Prohibición de atravesar enemigos | No implementado | — | No | No | Alto | Bloquear antes de flanqueo |
| Terreno difícil (coste doble) | No implementado | — | No | No | Medio | Requiere modelo de mapa |
| Retirarse (sin AdO inicial) | No implementado | — | No | No | Bajo | — |
| Correr | No implementado | — | No | No | Bajo | — |
| Levantarse (provoca AdO) | No implementado | — | No | No | Bajo | — |

---

## 3. Diagonales

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Alternancia 5/10/5/10 ft | Implementado | `calculatePathStepCostsFeet` en `rules.ts` | Sí (3 tests) | Sí | Bajo | — |
| Conteo global de diagonales en ruta | Implementado | `calculatePathStepCostsFeet` | Sí | Sí | Bajo | — |
| Diagonal de amenaza = 5 ft | Implementado | `opportunityAttackResolver.ts` | No | Sí | Bajo | — |
| Diagonal con terreno difícil | No implementado | — | No | No | Bajo | Requiere modelo de terreno |

---

## 4. Movimiento a través de Aliados/Enemigos

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Pasar por aliados (permitido) | No implementado | — | No | No | Medio | Diseñar como permiso de paso |
| Pasar por enemigos (bloqueado) | No implementado | Bloqueado implícito por "no terminar en casilla ocupada" | No | No | Alto | Bloquear explícitamente antes de flanqueo |
| Excepción por Tumble | No implementado | — | No | No | Bajo | Requiere Skills |

---

## 5. Ataques Cuerpo a Cuerpo

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| d20 + modificador vs CA | Implementado | `attackResolver.ts` | Indirectamente en `critical-flow.test.mjs` | Sí | Bajo | — |
| Bonificadores de ataque con buffs | Implementado | `totalAttackBonus` en `rules.ts` | Sí | Sí | Bajo | — |
| Daño base o manual | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| Daño mínimo 1 | Implementado | `attackResolver.ts` | Sí (`critical-flow.test.mjs`) | No | Bajo | — |
| 1 natural siempre falla | Parcial | Reconocido en diseño, no en código | No | No | Medio | Agregar test unitario |
| 20 natural siempre impacta | Parcial | Implícito en amenaza de crítico | No | No | Medio | Agregar test unitario |
| Alcance de amenaza 5 ft | Implementado | `opportunityAttackResolver.ts` | No | Sí | Bajo | — |
| Ataques iterativos por BAB | No implementado | — | No | No | Medio | Diseñar antes de personajes nivel 6+ |
| Ataques naturales | No implementado | — | No | No | Bajo | — |
| Ataque sin arma | No implementado | — | No | No | Bajo | — |

---

## 6. Ataques a Distancia

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Incrementos de alcance | Implementado | `attackResolver.ts` | No | Sí (indirecto) | Bajo | — |
| Penalizador -2 por incremento | Implementado | `attackResolver.ts` | No | No | Bajo | Agregar test unitario |
| Bloqueo fuera de alcance máximo | Implementado | `attackResolver.ts` | No | No | Bajo | — |
| AdO por disparar amenazado | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| Daga arrojadiza como melee adyacente | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| Penalizador por enemigo en melee | No implementado | — | No | No | Medio | — |
| Arco compuesto y límite de FUE | No implementado | — | No | No | Bajo | — |

---

## 7. Ataque Completo

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Habilitado si movimiento ≤ 5 ft | Implementado | `attackCommands.ts` | No | Sí | Bajo | — |
| Bloqueado tras movimiento > 5 ft | Implementado | `attackCommands.ts` | No | Sí | Bajo | — |
| Incompatible con Defensa total | Implementado | `attackCommands.ts` | No | Sí | Bajo | — |
| Ataques iterativos reales | No implementado | Solo marca la acción como "fullAttack" | No | No | Medio | Requiere BAB iterativos |
| Combatir a la defensiva + ataque completo bloqueado | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |

---

## 8. Críticos

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Amenaza de crítico (rango configurable) | Implementado | `isCriticalThreat` en `rules.ts` | Sí | Sí (indirecto) | Bajo | — |
| Confirmación con modificador de ataque | Implementado | `isCriticalConfirmed` en `rules.ts` | Sí | Sí (indirecto) | Bajo | — |
| Natural 1 siempre falla confirmación | Implementado | `isCriticalConfirmed` | Sí | No | Bajo | — |
| Natural 20 confirma automáticamente | Implementado | `isCriticalConfirmed` | Sí | No | Bajo | — |
| Multiplicador de daño (×2, ×3, ×4) | Implementado | `attackResolver.ts` `resolveThreatOutcome` | No | No | Medio | Test unitario |
| Cancelar amenaza aplica daño normal | Implementado | `handleCancelAttackThreat` vía `resolveThreatOutcome` | Sí | No | Bajo | — |
| Bloqueo de flujo durante confirmación | Implementado | `activeAttackThreat` en room state | No | Sí (indirecto) | Medio | Formalizar como fase de sala |
| Inmunidad a críticos | No implementado | — | No | No | Bajo | Preparado arquitecturalmente |
| Improved Critical / Keen | No implementado | Documentado en diseño | No | No | Bajo | Preparado por `criticalThreatFrom` |

---

## 9. Ataques de Oportunidad

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| AdO por abandonar amenaza > 5 ft | Implementado | `opportunityAttackResolver.ts`, `movementCommands.ts` | No | Sí | Bajo | — |
| Paso de 5 ft sin AdO | Implementado | `movementCommands.ts` | No | Sí | Bajo | — |
| AdO por ataque a distancia amenazado | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| Múltiples AdO contra el mismo objetivo | Implementado | `pendingOpportunityAttacks` array | No | Sí | Bajo | — |
| Bloqueo de turno con AdO pendientes | Implementado | `opportunityAttackResolver.ts` | No | Sí | Bajo | — |
| Resolver AdO contra casilla abandonada | Implementado | `handleResolveOpportunityAttack` | Sí (`critical-flow.test.mjs`) | Sí | Bajo | — |
| AdO que amenaza crítico (flujo completo) | Implementado | `handleResolveOpportunityAttack` con `activeAttackThreat` | Sí | No | Bajo | — |
| Bloqueo por jugador ajeno en AdO | Implementado | `requireCombatantControl` | Sí | Sí | Bajo | — |
| AdO por lanzar conjuro | No implementado | — | No | No | Bajo | — |
| AdO por levantarse | No implementado | — | No | No | Bajo | — |
| Retirarse evita AdO inicial | No implementado | — | No | No | Bajo | — |
| Límite 1 AdO por criatura por ronda | Parcial | Sin límite actualmente | No | No | Medio | Agregar contador de AdO por ronda |

---

## 10. Carga

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Mínimo 10 ft en línea recta | Implementado | `chargeResolver.ts` | No | Sí | Bajo | — |
| Ataque con +2 al bonificador | Implementado | `chargeResolver.ts` | No | Sí | Bajo | — |
| Penalizador -2 a CA (buff negativo) | Implementado | `chargeResolver.ts` | No | Sí | Bajo | — |
| Ruta bloqueada por destino ocupado | Implementado | `chargeResolver.ts` | No | Sí (indirecto) | Bajo | — |
| Genera AdO al pasar por amenazas | No implementado | — | No | No | Medio | — |
| Preparar arma contra carga | No implementado | — | No | No | Bajo | — |

---

## 11. Defensa Total

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| +4 CA hasta próximo turno | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |
| Bloquea movimiento posterior | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |
| Bloquea AdO | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |
| Incompatible con ataque | Implementado | `attackCommands.ts` | No | Sí | Bajo | — |
| Expiración al inicio del propio turno | Implementado | `turnManager.ts` | No | Sí | Bajo | — |

---

## 12. Luchar a la Defensiva

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| +2 CA temporal | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |
| Solo para ataque estándar | Parcial | Documentado en UI, no en regla de servidor | No | Sí | Bajo | Extender a ataque completo con -4 |
| Incompatible con ataque completo | Implementado | `attackCommands.ts` | No | Sí | Bajo | — |

---

## 13. Prestar Ayuda

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Crea buff pendiente de elección | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |
| Aliado elige ataque o CA | Implementado | `chooseAidBonusSchema` handler | No | Sí | Bajo | — |
| Solo paso de 5 ft posterior | Implementado | `tacticalCommands.ts` | No | Sí | Bajo | — |
| Buff se consume al atacar | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |

---

## 14. Buffs / Debuffs

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Modelo de buff simple | Implementado | `types.ts`, `Buff` interface | Sí (indirecto) | Sí | Bajo | — |
| Expiración por duración de turno | Implementado | `turnManager.ts` | No | Sí | Bajo | Test de expiración |
| Buff negativo (penalizador) | Implementado | Carga usa acBonus negativo | No | Sí | Bajo | — |
| Stack de buffs del mismo tipo | Parcial | No hay validación de límite | No | No | Medio | Regla de no-stack |
| Sistema de condiciones formal | No implementado | — | No | No | Alto | Siguiente gran fase |

---

## 15. HP, Muerte y Estabilización

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| HP hasta -10 | Implementado | `attackResolver.ts` | No | Sí (indirecto) | Bajo | — |
| 0 HP = incapacitado | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| -1 a -9 = moribundo | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| -10 = muerto | Implementado | `attackResolver.ts` | No | Sí | Bajo | — |
| Estabilización manual (10%) | Implementado | `roll-stabilization` handler | No | Sí | Bajo | — |
| 1 intento por turno | Implementado | `currentTurn.usedStabilization` | No | Sí | Bajo | — |
| Curación devuelve a activo | Implementado | `gmCommands.ts`, `abilityResolver.ts` | No | Sí | Bajo | — |
| Muerto no revive con curación | Implementado | `gmCommands.ts` | No | Sí (indirecto) | Bajo | — |
| Daño masivo | No implementado | — | No | No | Bajo | — |
| Daño no letal | No implementado | — | No | No | Bajo | — |
| Pérdida automática 1 HP por ronda (moribundo) | No implementado | — | No | No | Medio | Requiere tick de turno |

---

## 16. Equipo

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| EquipmentCatalog como fuente única | Implementado | `equipmentCatalog.ts` | No | No | Bajo | — |
| IDs de equipo en perfiles (no objetos) | Implementado | `types.ts` `CreatureTemplate.equipment` | Sí | Sí | Bajo | — |
| Derivación de stats desde catálogo | Implementado | `applyEquipmentDerivedStats` | Sí | Sí | Bajo | — |
| Preservación de stats manuales sin equipo | Implementado | `applyEquipmentDerivedStats` | Sí | No | Bajo | — |
| Inventario real | No implementado | — | No | No | Bajo | — |
| Cambio de arma en combate | No implementado | — | No | No | Bajo | — |
| Munición y consumo | No implementado | — | No | No | Bajo | — |

---

## 17. Armas

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Catálogo de armas JSON | Implementado | `data/equipment/weapons.json` | No | No | Bajo | — |
| Perfil de arma con daño, rango, crítico | Implementado | `WeaponProfile` en `types.ts` | No | No | Bajo | — |
| Modificador de FUE / DES según tipo | Parcial | Aplicado en `combatSnapshot.ts` | Sí (indirecto) | No | Bajo | Desglosar por tipo de arma |
| Rango configurable de amenaza de crítico | Implementado | `criticalThreatFrom` en `WeaponProfile` | Sí | No | Bajo | — |
| Multiplicador de crítico | Implementado | `criticalMultiplier` en `WeaponProfile` | No | No | Bajo | Test unitario |
| Armas de dos manos y 1.5× FUE | Parcial | Calculado en `combatSnapshot.ts` | No | No | Bajo | — |
| Arco compuesto y FUE | No implementado | — | No | No | Bajo | — |
| Combate con dos armas | No implementado | — | No | No | Bajo | — |

---

## 18. Armaduras

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Catálogo de armaduras JSON | Implementado | `data/equipment/armors.json` | No | No | Bajo | — |
| Bonificador de armadura a CA | Implementado | `deriveEquipmentStats` | Sí | Sí (indirecto) | Bajo | — |
| Reducción de velocidad por armadura | Implementado | `deriveEquipmentStats` | Sí (3 tests) | Sí (indirecto) | Bajo | — |
| Penalizador de armadura a habilidades | No implementado | — | No | No | Bajo | — |
| Límite de DES por armadura | No implementado | — | No | No | Bajo | — |

---

## 19. Escudos

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Catálogo de escudos JSON | Implementado | `data/equipment/shields.json` | No | No | Bajo | — |
| Bonificador de escudo a CA | Implementado | `deriveEquipmentStats` | Sí (indirecto) | Sí (indirecto) | Bajo | — |
| Escudo de torre (cobertura) | No implementado | — | No | No | Bajo | — |

---

## 20. Perfiles

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Persistencia en localStorage | Implementado | `profileStorage.ts` | Sí | No | Bajo | — |
| Lectura/escritura de perfiles | Implementado | `readStoredProfiles`, `writeStoredProfiles` | Sí | No | Bajo | — |
| Agregar perfil al combate | Implementado | `add-profile-combatant` handler | Sí (indirecto) | Sí | Bajo | — |
| Derivación de stats al agregar | Implementado | `applyEquipmentDerivedStats` | Sí | Sí | Bajo | — |
| Migraciones de perfiles guardados | No implementado | — | No | No | Medio | Antes de cambios de schema |
| Import/export de perfiles | No implementado | — | No | No | Bajo | — |

---

## 21. Templates / Statblocks

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Templates demo en creatures.json | Implementado | `data/creatures.json` | No | Sí (demo spawns) | Bajo | — |
| Preservación de stats manuales | Implementado | `applyEquipmentDerivedStats` | Sí | No | Bajo | — |
| Creación de snapshot desde template | Implementado | `createCombatantSnapshotFromProfile` | Sí | Sí | Bajo | — |
| Statblocks completos (CR, feats, skills) | No implementado | — | No | No | Bajo | — |
| Editor de criaturas completo | No implementado | — | No | No | Bajo | — |

---

## 22. Ownership

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Jugador controla sólo sus héroes | Implementado | `requireCombatantControl` | Sí (`critical-flow.test.mjs`) | Sí | Bajo | — |
| GM controla todo | Implementado | `requireCombatantControl` (bypass GM) | Sí | Sí | Bajo | — |
| Jugador no puede mover enemigos | Implementado | `requireTurnControl` | No | Sí | Bajo | — |
| Jugador no puede iniciar combate | Implementado | `initiativeCommands.ts` | No | Sí | Bajo | — |
| Jugador no puede terminar turno ajeno | Implementado | Validación en `end-turn` | No | Sí | Bajo | — |
| Middleware declarativo de permisos | Documentado solamente | `core-engine-audit.md` recomendación | No | No | Medio | Refactor arquitectónico |

---

## 23. Validación WebSocket

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Validación Zod de payloads | Implementado | `validateClientCommand.ts` + `commandSchemasMap` | Sí (4 tests) | Sí (errores claros) | Bajo | — |
| Schemas por dominio | Implementado | `schemas/commands/*.ts` en shared | Sí | No | Bajo | — |
| Errores seguros sin stack trace | Implementado | `validateClientCommand.ts` | Sí | Sí | Bajo | — |
| Stripping de campos extra | Implementado | Zod por defecto (strip mode) | Sí | No | Bajo | — |
| Validación de respuestas del servidor | No implementado | — | No | No | Bajo | ServerEvent schemas opcionales |

---

## 24. CombatRulesSnapshot

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Snapshot inmutable de sala | Implementado | `createCombatRulesSnapshot` en `combatSnapshot.ts` | Sí | No | Bajo | — |
| deepFreeze en dev/test | Implementado | `combatSnapshot.ts` | Sí | No | Bajo | — |
| Mapeo manual de campos | Implementado (con riesgo) | `combatSnapshot.ts` | No | No | Medio | Test de auto-verificación |
| Consumido en Rule Engine | Parcial | Algunos resolvers lo usan, no todos | No | No | Medio | Migrar resolvers gradualmente |

---

## 25. Rule Engine

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Helpers puros de movimiento | Implementado | `rules.ts` | Sí | No | Bajo | — |
| Helpers de stats (speed, CA, ataque) | Implementado | `rules.ts` | Sí | No | Bajo | — |
| Lógica de críticos | Implementado | `rules.ts` `isCriticalThreat`, `isCriticalConfirmed` | Sí | No | Bajo | — |
| Mutaciones en resolver (impuro) | Parcial / Riesgo | `attackResolver.ts` muta sala | No | No | Alto | Refactorizar a ResultSet puro |
| Bloqueo de flujo en dispatcher | Parcial | Ad-hoc en dispatcher | No | No | Alto | Migrar a máquina de estados |
| Ownership en middleware | No implementado | Acoplado en handlers | No | No | Medio | Middleware declarativo |

---

## 26. Logs de Combate

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Log de mensajes en tiempo real | Implementado | `room.log` + broadcast | No | Sí (indirecto) | Bajo | — |
| Categorías de log (attack, damage, turn, etc.) | Implementado | `LogKind` en `types.ts` | No | No | Bajo | — |
| Filtros de log | No implementado | — | No | No | Bajo | UI enhancement |
| Historial de cálculos de ataque | No implementado | — | No | No | Bajo | — |

---

## 27. UI de Combate

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Tablero táctico con tokens | Implementado | `Board.tsx` | No | No | Medio | Vitest + Testing Library |
| Overlays de movimiento/amenaza/rango | Implementado | `Board.tsx` | No | No | Bajo | — |
| Panel de acciones | Implementado | `ActionsPanel.tsx` | No | No | Medio | Tests de componente |
| Panel GM colapsable | Implementado | `GmPanel.tsx` | No | No | Bajo | — |
| Log de combate | Implementado | UI component | No | No | Bajo | — |
| Pantalla de estadísticas (Victoria/TPK) | Implementado | `CombatEnd.tsx` | No | No | Bajo | — |
| Tests de interfaz de navegador | No implementado | — | No | No | Medio | Playwright o Vitest |

---

## 28. Editor de Perfiles

| Aspecto | Estado | Implementación | Tests unitarios | Tests E2E | Riesgo | Próximo paso |
|---|---|---|---|---|---|---|
| Editor en `/profiles` | Implementado | `ProfilesPage.tsx` | No | No | Bajo | — |
| Guardar/cargar en localStorage | Implementado | `profileStorage.ts` | Sí | No | Bajo | — |
| Selección de equipo de catálogo | Implementado | `profileEquipment.ts` | Sí | No | Bajo | — |
| Scores de habilidades (FUE, DES, etc.) | Implementado | `abilityScores` en perfil | Sí | No | Bajo | — |
| Tests de navegador para editor | No implementado | — | No | No | Medio | Playwright o Vitest |
| Migraciones de perfiles viejos | No implementado | — | No | No | Medio | Antes de cambios de schema |

---

## Tabla Resumen de Cobertura

| Sistema | Estado global | Riesgo | Prioridad |
|---|---|---|---|
| Turnos e iniciativa | ✅ Implementado | Bajo | Baja |
| Movimiento | ✅ Implementado (casos base) | Medio | Media (aliados/enemigos) |
| Diagonales | ✅ Implementado | Bajo | Baja |
| Movimiento aliados/enemigos | ❌ No implementado | Alto | Alta |
| Ataques cuerpo a cuerpo | ✅ Implementado | Bajo | Baja |
| Ataques a distancia | ✅ Implementado | Bajo | Baja |
| Ataque completo | ⚠️ Parcial | Medio | Media |
| Críticos | ✅ Implementado | Medio | Media (bloqueo formal) |
| Ataques de oportunidad | ✅ Implementado | Bajo | Baja |
| Carga | ✅ Implementado | Bajo | Baja |
| Defensa total | ✅ Implementado | Bajo | Baja |
| Luchar a la defensiva | ⚠️ Parcial | Bajo | Baja |
| Prestar ayuda | ✅ Implementado | Bajo | Baja |
| Buffs/Debuffs | ⚠️ Parcial | Medio | Media (condiciones) |
| HP, muerte y estabilización | ✅ Implementado | Bajo | Baja |
| Equipo | ✅ Implementado | Bajo | Baja |
| Armas | ⚠️ Parcial | Bajo | Media |
| Armaduras | ✅ Implementado | Bajo | Baja |
| Escudos | ✅ Implementado | Bajo | Baja |
| Perfiles | ✅ Implementado | Bajo | Baja |
| Templates/Statblocks | ⚠️ Parcial | Bajo | Baja |
| Ownership | ✅ Implementado | Bajo | Baja |
| Validación WebSocket | ✅ Implementado | Bajo | Baja |
| CombatRulesSnapshot | ⚠️ Parcial | Medio | Media |
| Rule Engine | ⚠️ Parcial (impuro en resolver) | Alto | Alta |
| Logs de combate | ✅ Implementado | Bajo | Baja |
| UI de combate | ✅ Sin tests | Medio | Media |
| Editor de perfiles | ✅ Sin tests | Bajo | Baja |
