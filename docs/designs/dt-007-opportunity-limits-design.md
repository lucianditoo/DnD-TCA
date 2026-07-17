# Documento de Diseño: DT-007 (Límite de Acciones de Oportunidad por Ronda)

## 1. Objetivo y Contexto
Actualmente, el motor sufre una brecha reglamentaria crítica (DT-007): no hay un límite inmutable en la cantidad de Ataques de Oportunidad (AdO) que un combatiente puede hacer por ronda. Según las reglas de D&D 3.5, un combatiente normal está limitado a **un (1) ataque de oportunidad por asalto**, a menos que posea la dote Reflejos de Combate (Combat Reflexes).

El objetivo de este diseño es establecer un contador de reacciones consumidas por asalto (AdOs realizados) e integrarlo en la capa pura `rules.ts` para que el servidor rechace ataques de oportunidad adicionales, preparando el terreno para el trait `"COMBAT_REFLEXES"`.

## 2. Especificación Arquitectónica

### A. Tracking de Reacciones en la Capa de Datos
De acuerdo con las instrucciones, el tracking se implementará utilizando el espacio de estado del combatiente. Actualmente existe `opportunityAttacksMade` en `CombatantStats`.

Si utilizamos `combatant.stats.opportunityAttacksMade` como el **contador de la ronda actual** (lo que significa que la capa de reglas cortará el ataque si es `>= 1`), esto obliga a que en el evento de "Cambio de Ronda" global este valor se **reseteé a 0**.

### B. Validación Autoritativa (rules.ts)
El predicado `canMakeOpportunityAttack(context, combatant)` se modificará de la siguiente forma:

1. **Extracción de Modificadores (Combat Reflexes)**:
   Si el combatiente tiene el trait `"COMBAT_REFLEXES"`, su límite máximo de AdOs es `1 + getEffectiveAbilityModifier(..., "dexterity")`. Si no lo tiene, el límite es estricto a `1`.
2. **Evaluación de Límite**:
   Si `combatant.stats.opportunityAttacksThisRound >= limiteAdo`, el predicado retornará `false` de forma pura e isomorfa.

## 3. Respuestas al Design Review Checklist (.ai/DESIGN_REVIEW_CHECKLIST.md)

### 1. Filtro de Irreversibilidad a 20 Sprints
**Pregunta:** *Al estructurar el acumulador de reacciones consumidas, ¿cómo garantizamos que cuando implementemos el reinicio cíclico del asalto global (Tick Layer de cambio de Ronda), el contador de AdOs realizados se restablezca a 0 de forma determinista para todos los combatientes sin corromper el histórico de estadísticas finales de la sala?*

**Respuesta y Mitigación de Riesgo:**
Si empleamos directamente `combatant.stats.opportunityAttacksMade` (el cual actualmente sirve para sumar totales estadísticos de todo el combate) como el contador efímero del asalto, **corromperíamos** los datos históricos de MVP del combate al resetearlo a `0` cada nueva ronda.
Para garantizar irreversibilidad a 20 sprints y mantener la limpieza arquitectónica:
1. Incorporaremos un **nuevo campo explícito** para la mecánica efímera: `stats.opportunityAttacksThisRound: number`.
2. Mantenemos `stats.opportunityAttacksMade` estrictamente como el acumulador histórico global, y modificamos `CombatantStats` agregando este nuevo contador `opportunityAttacksThisRound`. (Se integrará en la inicialización estricta).
3. El predicado `canMakeOpportunityAttack` leerá de `opportunityAttacksThisRound`. 
4. El handler `resolve-opportunity-attack` incrementará de forma atómica **ambos** contadores.
5. Cuando se implemente el Tick de Cambio de Ronda, el servidor aplicará un `.map()` purificando únicamente `opportunityAttacksThisRound = 0` en todos los combatientes, dejando el `opportunityAttacksMade` intacto para las estadísticas finales.

### 2. Complejidad Accidental
**Pregunta:** *¿De qué manera aseguramos que el componente interactivo de la UI React lea el mismo predicado `canMakeOpportunityAttack` para renderizar overlays translúcidos o advertencias visuales en el grid al jugador antes de provocar una interrupción?*

**Respuesta:**
La función `canMakeOpportunityAttack` reside en `packages/shared/src/rules.ts`, que es completamente isomorfa y comparte el mismo contrato (Contexto + CombatantSnapshot). 
Cuando la UI evalúa una ruta de movimiento (`MovementOverlay` o simulación), el frontend invocará internamente este mismo predicado iterando sobre los enemigos adyacentes a la ruta. Si un enemigo devuelve `false` (porque ya gastó su AdO en la ronda, evidenciado por el snapshot inyectado por el servidor), la UI React lo descartará de forma predecible y no dibujará la advertencia roja de AdO para esa casilla. No hay duplicación de lógica ni llamadas a red adicionales; la fuente de la verdad viaja en cada actualización del WebSocket.

### 3. La Regla de Tres
**Pregunta:** *Nombra tres dotes o maniobras del manual que se beneficiarán directamente de este tracking estricto de reacciones por asalto.*

**Respuesta:**
1. **Reflejos de Combate (Combat Reflexes)**: Dote pasiva. Reemplaza el límite "1" por "1 + Modificador de Destreza", la cual ya vamos a dejar pre-cableada arquitectónicamente.
2. **Mantener la Posición (Hold the Line)**: Dote que permite hacer un AdO a un oponente que te realiza una carga antes de que el ataque se resuelva. Esta maniobra consumirá un ataque del límite por asalto usando el mismo tracking.
3. **Mantenimiento de AdOs Iterativos en Defensa Total o Castellano**: Maniobras avanzadas que fuerzan ataques adicionales o defienden contra AdOs requieren contabilizar qué combatientes adyacentes aún disponen de la "reacción" mecánica. Un tracking inmutable estricto nos asegura que nunca habrá interrupciones infinitas ni soft-locks en turnos simultáneos.
