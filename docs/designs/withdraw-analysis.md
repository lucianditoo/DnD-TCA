# Análisis Pre-NDD — Retirada (Withdraw)

**Tipo de documento**: auditoría de diseño PASIVA (Fase 5 del gate de cierre de ATK-RANGED-INTO-MELEE). No es un NDD, no autoriza implementación, no fija nombres de helpers ni archivos. Se detiene en la recomendación.

## 1. Evidencia de brecha real

Búsqueda global `withdraw|retirada|retirarse` en `packages/shared/src`, `apps/server/src`, `apps/web/src`: **0 resultados**. No existe comando en el registro Zod (43 comandos verificados), ni handler, ni flag de intención. Confirmado también en `RULES_PHB_CHECKLIST.md` (fila `[ ]` "Retirada (Withdraw)").

## 2. Inventario de infraestructura existente (consumidores potenciales)

| Pieza | Estado verificado | Relevancia para Withdraw |
|---|---|---|
| `move-combatant` (`movementCommands.ts:9`) | Pipeline completo: control, fase, economía (`canUseMoveAction`), bloqueo por `attackMode` preparado, `validateMovePath` con presupuesto `totalSpeedFeet`, bucle por pasos con footprints proyectados, Acrobacias CD 25 (atravesar) y CD 15 (esquivar AdO), interrupción transaccional | Sede candidata: la Retirada es un movimiento con presupuesto y AdO modificados |
| Orquestación AdO por camino | `findTriggeredOpportunityAttacksForPath` + gating `Rules.canMakeOpportunityAttack` (límites AOO-03) | El corazón de la regla: la casilla inicial debe quedar exenta; el resto provoca normal |
| Economía de acciones (`TurnState`, `types.ts:240`) | `movementUsedFeet`, `usedMoveAction`, `usedStandardAction`, `usedFullAttack`, `usedFiveFootStep`, `attackMode` | Withdraw es acción de asalto completo: debe consumir estándar+movimiento y excluir el paso de 5' del mismo asalto |
| Paso de 5 pies | Comando dedicado `five-foot-step` + flag | Exclusión mutua RAW con Retirada en el mismo asalto |
| Correr | **No implementado** (solo el override declarativo `FORBID_RUN` en `contracts.ts:130`, consumido por 1 efecto del catálogo) | No bloquea Withdraw; el presupuesto ×2 de Retirada no depende de Correr |
| Movimiento doble | No implementado (no hay concepto de segunda acción de movimiento con presupuesto acumulado) | Withdraw introduce el primer presupuesto ×2 del motor — decisión de diseño relevante |
| Footprints multicelda | `validateMovePath` y el bucle de pasos ya proyectan huellas (Sprints 025-A/027/028) | La "casilla inicial" de una criatura Large son 4 celdas — decisión RAW abierta (ver §3) |
| Terreno difícil | En `validateMovePath` (coste doble; prohíbe correr/cargar, NO retirarse) | Compatible: Retirada a través de terreno difícil es legal RAW, con su coste |
| Restricciones de movimiento | `evaluateActionAvailability`, traits `IMMOBILIZED`/`CANNOT_MOVE`, `ruleOverrides` | Reutilizables tal cual; no existe `FORBID_WITHDRAW` (candidato natural si algún efecto lo exige) |
| Modelo de visión | **Inexistente** (sin invisibilidad efectiva en AdO, sin Blinded) | Dos cláusulas RAW quedan inmodelables en V1 (ver §3) |

## 3. Regla RAW exacta (corpus `combat/05` línea 196 / `combat/08` línea 134)

- **Acción**: asalto completo; mueve hasta el **doble** de la velocidad.
- **Protección**: la casilla en la que comienzas "no es considerada amenazada por ningún oponente **que puedas ver**"; salir de ella no provoca AdO de oponentes visibles.
- **Resto del camino**: salir de cualquier otra casilla amenazada provoca AdO de forma normal.
- **Enemigos no visibles**: los invisibles SÍ conservan su AdO contra la casilla inicial. **Inmodelable en V1** (sin modelo de visión); simplificación propuesta para el NDD: toda AdO por salir de la huella inicial queda suprimida — ligeramente pro-defensor respecto a RAW, documentada como deuda aceptada.
- **Cegado**: "no puedes retirarte si estás cegado". Inmodelable en V1 (Blinded no existe); registrar como precondición futura.
- **Actividad limitada** (solo acción estándar disponible): puede retirarse como acción estándar moviendo hasta 1× velocidad. El motor no modela "actividad limitada" — fuera de alcance del primer NDD.
- **Multicelda**: RAW habla de "la casilla en la que comienzas"; para huellas 2×2+ el NDD debe decidir si la protección cubre toda la huella inicial (lectura propuesta: sí — coherente con que el footprint ES la posición del combatiente en este motor) o solo la celda ancla.
- **Modos de movimiento**: no puedes retirarte con un modo de movimiento sin velocidad indicada — irrelevante en V1 (solo movimiento terrestre).
- **Paso de 5'**: prohibido en el mismo asalto de la retirada.

## 4. Respuestas al Design Review Checklist (nivel análisis)

- **Irreversibilidad a 20 sprints**: la decisión dura es dónde vive la intención (comando nuevo vs flag). Un flag opcional en el payload existente es aditivo y reversible; un comando nuevo crea superficie de red permanente.
- **Reutilización**: pipeline de movimiento completo, orquestación AdO con límites AOO-03, footprints, economía de turno. Nada geométrico nuevo.
- **Complejidad accidental**: el riesgo es duplicar `handleMoveCombatant`; la mitigación es no crear un segundo pipeline de validación de caminos.
- **Impacto por subsistema**: shared (`validateMovePath` presupuesto ×2 + filtro de exención en el disparo de AdO), servidor (economía en el handler), esquema Zod (campo aditivo), UI (toggle + preview que ya hereda de `validateMovePath`), tests.
- **Regla de Tres**: (1) Correr reutilizaría el mismo mecanismo de presupuesto multiplicado con gate de acción completa; (2) Movimiento doble ídem (×2 sin protección de casilla); (3) Actividad limitada (retirada como estándar a 1×) reutiliza el mismo flag con presupuesto reducido.
- **Fuera de alcance del primer NDD**: visión/invisibilidad, Cegado, actividad limitada, monturas, modos de movimiento alternativos.

## 5. Alternativas arquitectónicas

**A. Comando `withdraw` explícito** (nuevo tipo en el registro Zod + handler dedicado).
- Pros: intención explícita en el log y en la red; economía de asalto completo autocontenida; UX clara.
- Contras: duplica (o re-envuelve) todo `handleMoveCombatant` — validación, Acrobacias, interrupciones, spatial transition; segunda superficie de red que mantener; el preview de UI necesitaría una ruta paralela.

**B. Intención semántica dentro de `move-combatant`** (campo opcional declarativo en el payload, estilo del precedente `isAcrobatic` que ya viaja en ese mismo comando).
- Pros: reutiliza el pipeline íntegro; el cambio real se concentra en dos puntos — presupuesto (×2 con gate de asalto completo en la economía del handler) y el filtro de AdO disparadas (exención de las originadas en la huella inicial); `isAcrobatic` demuestra que el comando ya acepta modos declarativos; preview de UI hereda por `validateMovePath` como en Sprint 037.
- Contras: el handler de movimiento gana una rama de economía condicional; el log necesita etiquetar la retirada explícitamente para trazabilidad.

## 6. Riesgos y decisiones difíciles de revertir

- Primer presupuesto ×2 del motor: definir si `movementUsedFeet` escala o si el presupuesto pasa como parámetro (contrato de `validateMovePath`) — decisión con eco en Correr/movimiento doble futuros.
- Interacción con `attackMode` preparado y `usedStandardAction`/`usedMoveAction`: la retirada debe consumir el asalto completo de forma atómica (sin estados intermedios si el movimiento se interrumpe por Acrobacias fallidas — ¿qué economía queda consumida tras una interrupción a mitad de camino? El NDD debe fijarlo).
- Simplificación de visibilidad (pro-defensor) queda cementada hasta que exista modelo de visión.

## 7. Casos RAW que el NDD debe convertir en tests

1. Salir de la huella inicial adyacente a un enemigo → sin AdO.
2. Segunda casilla amenazada en el camino → AdO normal (con límites AOO-03).
3. Presupuesto exactamente 2× velocidad; rechazo al excederlo.
4. Economía: consume el asalto completo; sin paso de 5' en el mismo asalto; sin ataque posterior.
5. Terreno difícil: permitido, con coste doble contra el presupuesto ×2.
6. Huella Large: protección de las 4 celdas iniciales (o la decisión que tome el NDD), AdO en celdas posteriores.
7. Enemigo con arma de alcance amenazando la casilla inicial desde 10 ft → también suprimido (la protección es de la casilla, no del tipo de amenaza).
8. Interrupción a mitad de camino (Acrobacias/regla vigente) → economía resultante consistente.
9. Determinismo e independencia del orden del snapshot.

## 8. Recomendación

**Opción B — intención semántica dentro del comando de movimiento existente**, por reutilización total del pipeline (incluida la orquestación de AdO recién blindada por AOO-03) y por el precedente directo de `isAcrobatic` como modo declarativo del mismo comando. El comando explícito (A) solo se justificaría si la economía de asalto completo resultara inexpresable de forma atómica dentro del handler actual — cuestión que el NDD debe verificar antes de fijar la sede. Sin nombres de helpers ni archivos impuestos.

---

**Detención**: análisis completo. Sin código, sin NDD definitivo, sin PROCEED emitido. Concealment no se abre.
