# Reporte de Cobertura de Tests — D&D 3.5 Tactical Combat Engine

*Generado: 2026-07-07. Fuente: análisis directo de `tests/`, `scripts/e2e-websocket.mjs`, `package.json`.*

---

## Estructura Actual de Tests

El proyecto usa dos capas de tests complementarias:

| Capa | Archivo(s) | Runner | Velocidad aprox. |
|---|---|---|---|
| **Unit / Integration** | `tests/*.test.mjs` | Node Test Runner + `tsx` | ~300–700 ms |
| **E2E WebSocket** | `scripts/e2e-websocket.mjs` | Node + `ws` (WebSocket real) | ~5–10 s |

No hay cobertura de UI de navegador (Playwright / Vitest + Testing Library).

---

## Archivos de Test Existentes

### `tests/rules.test.mjs`
**¿Qué cubre?**
- Cálculo de costos de ruta rectilínea (`calculatePathStepCostsFeet`).
- Cálculo de diagonales alternando 5/10/5/10 ft.
- Cálculo de ruta mixta (rectilíneo + diagonal).
- Suma total del costo de ruta (`calculatePathCostFeet`).
- Ruta vacía devuelve 0.
- Stats totales con buffs: `totalSpeedFeet`, `totalArmorClass`, `totalAttackBonus`.
- `createCombatRulesSnapshot` genera objeto congelado que lanza `TypeError` al mutar.
- `isCriticalThreat`: natural 20, rango de amenaza, acierto requerido.
- `isCriticalConfirmed`: natural 1 siempre falla, natural 20 confirma, modificador + roll vs CA.

**Bugs históricos cubiertos:**
- Acumulación incorrecta de diagonales en rutas mixtas.
- Mutación accidental del snapshot de sala (deepFreeze).
- Confirmación de crítico usando `attackTotal` en lugar de solo `attackModifier`.

**Brechas:**
- No cubre 1 natural como fallo automático de ataque.
- No cubre 20 natural como impacto automático de ataque.
- No cubre multiplicador real de daño crítico.
- No cubre expiración de buffs por turno.

---

### `tests/equipment-stats.test.mjs`
**¿Qué cubre?**
- Persistencia de perfiles en localStorage simulado (campos base, equipo y habilidades).
- Recarga del editor recupera todos los campos guardados (round-trip).
- Velocidad derivada por armadura usa siempre `baseSpeedFeet`.
- Regresión: quitar armadura reductora restaura `baseSpeedFeet`.
- Cambiar de armadura varias veces no acumula penalizaciones.
- Equipamiento guarda y recarga arma, armadura, escudo correctamente.
- Cambiar arma no deja daño, crítico, alcance ni tipo del arma vieja.
- Cálculos derivados vienen del catálogo de equipo.
- Servidor puede recalcular desde IDs (no confiar en derivados del cliente).
- Helpers de cálculo son puros, inmutables e idempotentes.
- `CombatSnapshot` se crea desde perfil con estado temporal inicial.
- `CombatSnapshot` contiene estadísticas derivadas correctas desde `EquipmentCatalog`.
- `CombatSnapshot` mantiene HP actual separado de HP máximo.
- Modificar buffs/posición/iniciativa del snapshot no muta el perfil.
- `CombatSnapshot` asigna ownership desde servidor.
- `CombatSnapshot` ignora derivados del cliente (no muta perfil original).
- `Canocrock` conserva `damageBase` y `armorClass` sin equipo.
- Perfil con equipo válido deriva daño/CA desde `EquipmentCatalog`.

**Bugs históricos cubiertos:**
- `applyEquipmentDerivedStats` sobrescribía destructivamente stats manuales de monstruos sin equipo.
- Acumulación de penalizadores al cambiar armadura varias veces en el editor.
- Cliente podía enviar stats derivados falsos que el servidor aceptaba sin recalcular.

**Brechas:**
- No cubre modificador de velocidad con múltiples tipos de armadura exótica.
- No cubre límite de DES por armadura.
- No cubre schema de validación de perfiles guardados viejos (migraciones).

---

### `tests/critical-flow.test.mjs`
**¿Qué cubre?**
- `cancel-attack-threat` aplica `normalDamage` y limpia `activeAttackThreat`.
- Jugador ajeno no puede cancelar ni confirmar amenaza (ownership).
- Ataque de oportunidad que amenaza crítico no pierde daño y bloquea/resuelve movimiento.
- Iniciativa negativa no afecta ataque ni daño.
- Un ataque exitoso sin DR no aplica menos de 1 daño (mínimo de daño).

**Bugs históricos cubiertos:**
- `cancel-attack-threat` no aplicaba `normalDamage`, permitiendo que la cancelación evitara el daño del ataque original.
- AdO que amenazaba crítico perdía el daño al resolver.
- Iniciativa negativa afectaba incorrectamente el modificador de ataque.
- Ataque exitoso podía resultar en 0 daño (sin mínimo de 1).

**Brechas:**
- No cubre el flujo completo de confirmación de crítico con tirada real (requiere mock de sala).
- No cubre multiplicador ×2, ×3, ×4 de daño crítico.
- No cubre crítico en AdO con `opportunityAttackId`.

---

### `tests/websocket-validation.test.mjs`
**¿Qué cubre?**
- Comando válido (`create-room`) aceptado por `validateClientCommand`.
- Tipo de comando desconocido rechazado con mensaje claro.
- Campos requeridos faltantes (`join-room` sin `roomCode` ni `role`) reportados específicamente.
- Tipo incorrecto de campo (`d20Roll` como string) detectado y reportado.
- Campos extra/inyectados eliminados por Zod (strip mode).

**Bugs históricos cubiertos:**
- Servidor aceptaba payloads malformados sin validar, causando crashes en handlers.
- Campos inyectados por el cliente podían contaminar el estado del servidor.

**Brechas:**
- No cubre ataques de inyección en campos de tipo objeto anidado (ej. `profile.equipment`).
- No cubre comandos de todas las categorías (solo representative sampling).
- No cubre comportamiento con `null` y `undefined` explícitos en campos opcionales.

---

### `scripts/e2e-websocket.mjs`
**¿Qué cubre? (flujos WebSocket reales)**

| Flujo | Cobertura |
|---|---|
| Crear sala por WebSocket | ✅ |
| Catálogo llega al cliente | ✅ |
| Ownership: héroe creado por jugador | ✅ |
| Ownership: enemigo creado por GM | ✅ |
| Jugador no puede mover héroe ajeno | ✅ |
| Jugador no puede mover enemigos | ✅ |
| Jugador no puede cargar iniciativa ajena | ✅ |
| Jugador no puede iniciar combate | ✅ |
| GM puede iniciar combate con iniciativas mixtas | ✅ |
| Jugador puede terminar turno propio | ✅ |
| Jugador no puede terminar turno ajeno | ✅ |
| Jugador no puede atacar con enemigos | ✅ |
| Estabilización: 1 intento por turno | ✅ |
| Perfil guardado con derivación desde catálogo | ✅ |
| Spawn sin casillas duplicadas | ✅ |
| Combate pasa a EN CURSO | ✅ |
| Cedrick queda activo por iniciativa | ✅ |
| Haste no se puede usar sobre enemigos | ✅ |
| Cure Light Wounds cura 8 HP | ✅ |
| Bloquea mover a casilla ocupada | ✅ |
| Defensa total +4 CA y bloquea AdO | ✅ |
| Defensa total bloquea movimiento posterior | ✅ |
| Defensa total sigue activa hasta su turno | ✅ |
| Ataque completo + Luchar a la defensiva incompatibles | ✅ |
| Luchar a la defensiva agrega +2 CA temporal | ✅ |
| Ruta de movimiento no puede repetir casillas | ✅ |
| Movimiento diagonal cuesta 15 ft | ✅ |
| Defensa total expira al inicio del propio turno | ✅ |
| Jugador no puede agregar enemigos en combate activo | ✅ |
| Jugador no puede controlar enemigos | ✅ |
| GM puede reposicionar tokens fuera de turno | ✅ |
| Movimiento GM respeta casillas ocupadas | ✅ |
| Jugador no puede usar movimiento GM | ✅ |
| Haste sobre sí mismo | ✅ |
| Mover > 5 ft genera AdO pendiente | ✅ |
| AdO pendiente bloquea terminar turno | ✅ |
| AdO se resuelve contra casilla abandonada | ✅ |
| AdO diagonal cuenta como 5 ft | ✅ |
| Múltiples enemigos generan múltiples AdO | ✅ |
| Resolver un AdO no borra los otros | ✅ |
| Ataque melee diagonal impacta | ✅ |
| Carga en línea recta con -2 CA | ✅ |
| Prestar ayuda crea buff pendiente | ✅ |
| Prestar ayuda permite solo un paso de 5 ft | ✅ |
| No se encadenan pasos de 5 ft | ✅ |
| Aliado elige ayuda como +2 ataque | ✅ |
| Ayuda se consume al atacar | ✅ |

**Brechas del E2E:**
- No cubre confirmación/cancelación de crítico en flujo completo.
- No cubre AdO de oportunidad que resulta en crítico.
- No cubre Victoria / TPK automático al morir el último combatiente.
- No cubre curación desde estado moribundo.
- No cubre gm-force-outcome.
- No cubre tiradas de ataque con natural 1 y natural 20.
- No cubre validación de WebSocket con payload JSON inválido (se maneja en test unitario).

---

## Áreas sin Cobertura Actual

### Críticas (sin cobertura de regresión)
1. **Multiplicador de daño crítico** — cálculo de ×2/×3/×4 sin test unitario.
2. **Natural 1 como fallo automático** — regla sin código ni test.
3. **Natural 20 como impacto automático** — solo implícito en amenaza de crítico.
4. **Pérdida automática de 1 HP por ronda (moribundo)** — no implementado.
5. **Límite de 1 AdO por criatura por ronda** — sin validación ni test.

### Importantes (cobertura débil)
6. **Expiración de buffs por turno** — flujo implementado pero sin test unitario dedicado.
7. **Confirmación de crítico con AdO** (`opportunityAttackId`) — test parcial.
8. **Penalizador -2 por incremento de alcance** — implementado sin test unitario.
9. **Stack de buffs del mismo tipo** — sin regla ni test.
10. **CombatSnapshot vs CombatRoom auto-verificación** — mapeo manual sin test de sincronización.

### Menores
11. Migraciones de perfiles guardados viejos.
12. Stats de UI (pantalla de Victoria/TPK).
13. Interacción de múltiples buffs (Haste + Bless simultáneos).
14. Cambio de arma en combate.

---

## Tests Prioritarios a Agregar

Los siguientes tests deben añadirse **antes** de implementar flanqueo, condiciones o cobertura:

| # | Descripción | Tipo | Módulo |
|---|---|---|---|
| 1 | Multiplicador de daño crítico ×2 aplica correctamente | Unitario | `attackResolver.ts` |
| 2 | Natural 1 siempre falla el ataque (sin importar CA) | Unitario | `attackResolver.ts` / `rules.ts` |
| 3 | Natural 20 siempre impacta (sin importar CA) | Unitario | `attackResolver.ts` / `rules.ts` |
| 4 | Buff del mismo tipo no se acumula (stack limit) | Unitario | `buffRules.ts` |
| 5 | Expiración de buff después de N turnos | Unitario | `turnManager.ts` |
| 6 | Confirmación de crítico aplica daño ×multiplicador en E2E | E2E | `e2e-websocket.mjs` |
| 7 | Cancelar crítico aplica exactamente `normalDamage` | Unitario | `attackCommands.ts` |
| 8 | Límite 1 AdO por criatura por ronda | Unitario | `opportunityAttackResolver.ts` |
| 9 | CombatRulesSnapshot tiene todas las claves de CombatRoom | Unitario | `combatSnapshot.ts` |
| 10 | Penalizador -2 acumulativo por incremento de alcance | Unitario | `attackResolver.ts` |

---

## Referencia de Documentos Relacionados

- [docs/designs/rule-coverage-matrix.md](./designs/rule-coverage-matrix.md): Matriz completa de cobertura por sistema.
- [docs/testing-checklist.md](./testing-checklist.md): Checklist manual de flujos a probar.
- [docs/rules-coverage-checklist.md](./rules-coverage-checklist.md): Estado de cobertura de reglas D&D 3.5.
- [docs/technical-debt.md](./technical-debt.md): Deuda técnica consolidada con prioridades.
