# Auditoría Funcional Completa del Motor de Reglas D&D 3.5

Este documento es la fuente oficial del estado funcional del motor táctico.
Refleja la auditoría del código real (no de intenciones o documentación previa).

**Estados:**
- 🟢 Completa: La regla está implementada fielmente.
- 🟡 Parcial: La regla existe pero faltan casos o restricciones.
- 🔴 No implementada: La regla no existe en el motor.
- ⚪ Simplificada: La regla fue abstraída o simplificada deliberadamente por el alcance actual.

---

## Movimiento

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| 🟢 | Movimiento básico | Validación de distancia y obstáculos, consumiendo la acción de movimiento o usando movimiento restado. | `movementCommands.ts`, `rules.ts (calculatePathStepCostsFeet)` | - |
| 🟢 | Movimiento diagonal | Regla 5-10-5-10. | `rules.ts (calculatePathStepCostsFeet)` | - |
| 🟢 | Paso de 5 pies | Acción explícita. No genera AdO, consume 5 ft pero preserva acción de movimiento. Bloqueada por/bloquea movimiento normal. | `tacticalCommands.ts`, `rules.ts (canUseFiveFootStep)` | - |
| 🟢 | Atravesar aliados | Se permite pasar por aliados, pero no terminar el turno en la misma casilla. | `rules.ts (isPathClear)` | - |
| ⚪ | Atravesar enemigos | Bloqueado para conscientes, permitido si están *Helpless* (dying/dead/stable). No existen tiradas de Tumble/Overrun. | `rules.ts (isPathClear)` | Habilidades (Tumble) |
| 🟡 | Carga | Mueve y ataca (+2 ataque, -2 CA). Falta requerir línea recta sin terreno difícil/aliados y restricciones avanzadas. | `tacticalCommands.ts (handleCharge)` | Terreno difícil, Línea de Visión |
| 🔴 | Terreno difícil | Costo doble de movimiento, bloquea pasos de 5 pies. | No implementado | Datos del tablero |
| 🔴 | Correr | Mover x3 o x4 (x5 con dotes), perder bono de Destreza. | No implementado | Sistema de acciones |
| 🔴 | Retirada | Salir sin provocar AdO en el primer cuadro. | No implementado | Sistema de acciones, AdOs avanzados |
| 🔴 | Movimiento con grandes | Desplazamiento y compresión (Squeezing) de tokens > 5ft. | No implementado | Tamaños múltiples |

---

## Ataques

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| 🟢 | Ataque simple | Resolución d20 manual o auto contra CA, 1 y 20 natural, aplicación manual de daño. | `attackCommands.ts`, `attackResolver.ts` | - |
| 🟢 | Críticos | Amenaza según rango, confirmación contra CA, multiplicador de daño. Natural 20 amenaza siempre. Aplica normal si falla. | `attackResolver.ts (resolveAttack)`, flujo en `roomState` | - |
| 🟡 | Ataques de oportunidad | Generados por salir de amenaza o usar rango. Falta por levantarse, conjurar, beber poción, etc. | `movementCommands.ts`, `tacticalCommands.ts` | Sistema de acciones avanzado |
| 🟢 | Ataque completo | Acción de asalto completo explícita. Permite ataques iterativos. Bloquea movimiento normal, pero permite paso de 5 pies. | `tacticalCommands.ts`, `attackCommands.ts` | - |
| ⚪ | Reach | Alcance predefinido (5 ft melee) y rangos máximos. Faltan armas con reach dinámico (polearms) o por tamaño. | `rules.ts (threatensTarget)` | Tamaños múltiples |
| 🟢 | Ataques iterativos | +6/+1, +11/+6/+1, etc. Implementado pura base a BAB de hasta 4 ataques. | `rules.ts (getAttackRoutine)` | - |
| 🔴 | Dos armas | Ataque con mano torpe, penalizadores según armas ligeras y dotes. | No implementado | UI de manos/inventario |
| 🔴 | Combat Reflexes | Más de un AdO por ronda según Destreza. (El límite de 1 por ronda tampoco está formalizado aún). | No implementado | Dotes, Tracking por ronda |
| 🔴 | Touch attack | Ataque de toque cuerpo a cuerpo o a distancia. | No implementado | CA Desglosada (Touch AC) |
| 🔴 | Coup de Grace | Ataque automático crítico contra objetivo *Helpless*. | No implementado | Sistema de Condiciones Formales |

---

## Posicionamiento

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| 🟢 | Amenaza | Depende de si está armado, consciente y a distancia de melee. Armas arrojadas a 5 ft amenazan. | `rules.ts (threatensTarget)` | - |
| 🟢 | Flanqueo | Oponentes en línea recta a través del enemigo. +2 al ataque. | `rules.ts (isFlanking)` | - |
| 🔴 | Cobertura | Obstáculos físicos o criaturas interpuestas (+4 CA). | No implementado | Línea de Visión / Tablero |
| 🔴 | Ocultación | Obstáculos visuales (20% o 50% probabilidad de fallo). | No implementado | Línea de Visión / Tablero |
| 🔴 | Línea de visión | Trazado desde esquinas para determinar visibilidad. | No implementado | Geometría del tablero |
| 🔴 | Línea de efecto | Determinación de si un efecto (físico/mágico) puede alcanzar el objetivo. | No implementado | Geometría del tablero |

---

## Condiciones

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| 🟢 | Disabled | 0 HP. Solo 1 acción estandar/movimiento. Recibir daño no letal/letal lo cambia. | `rules.ts (lifeStatus)` | - |
| 🟢 | Dying | -1 a -9 HP. Inconsciente. Tiradas de estabilización 10%. | `rules.ts (lifeStatus)` | - |
| 🟢 | Stable | -1 a -9 HP estabilizado. | `rules.ts (lifeStatus)` | - |
| 🟢 | Dead | <= -10 HP. Token gris, no actúa ni amenaza. | `rules.ts (lifeStatus)` | - |
| ⚪ | Helpless | Implementado implícitamente por Dying/Stable. No existe condición explícita para dormidos o paralizados. | `rules.ts` (implícito) | Sistema de Condiciones Formales |
| 🔴 | Prone | Tumbado. +4 CA contra rango, -4 CA contra melee, penalizador al ataque. Requiere acción para levantarse (provocando AdO). | No implementado | Sistema de Condiciones Formales |
| 🔴 | Stunned | Pierde bono Dex a la CA, -2 CA, suelta objetos. | No implementado | Sistema de Condiciones Formales |
| 🔴 | Flat-footed | No suma Dex a la CA. No puede realizar AdOs. Ocurre antes de actuar en primer combate. | No implementado | Sistema de Condiciones Formales |
| 🔴 | Entangled | Movimiento a la mitad, -2 ataque, -4 Dex. | No implementado | Sistema de Condiciones Formales |
| 🔴 | Grappled | No puede moverse, pierde Dex a la CA, no amenaza, restricciones de acciones. | No implementado | Sistema de Condiciones Formales |
| 🔴 | Invisible | +2 ataque, oponente pierde Dex a CA, 50% ocultación. | No implementado | Sistema de Condiciones Formales |
| 🔴 | Blinded | -2 CA, pierde Dex, -4 a mayoría de pruebas, 50% ocultación. | No implementado | Sistema de Condiciones Formales |

---

## Defensa

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| 🟡 | Armor Class | CA base derivada de equipo (armadura/escudo) + buffs temporales. Falta el cálculo disgregado (natural, desvío, esquiva, etc.). | `equipmentStats.ts`, `combatSnapshot.ts` | Desglose de Stats |
| 🔴 | Touch AC | CA sin contar armadura, escudo, ni natural. | No implementado | Desglose de Stats |
| 🔴 | Flat-Footed AC | CA sin contar Destreza o esquiva. | No implementado | Desglose de Stats |
| 🔴 | Cover | +4 CA por cobertura. | No implementado | Posicionamiento avanzado |
| 🔴 | Concealment | Fallo porcentual (20/50%). | No implementado | Posicionamiento avanzado |
| 🔴 | Damage Reduction | Ignorar daño físico (ej. DR 5/mágica). | No implementado | Tipos de daño, materiales |
| 🔴 | Resistencias | Reducción de daño por tipo elemental (fuego, frío). | No implementado | Sistema de Conjuros/Tipos |
| 🔴 | Inmunidades | Ignorar efectos completamente. | No implementado | Sistema de Conjuros/Tipos |

---

## Acciones

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| 🟢 | Move | Usada por moverse. | `movementCommands.ts` | - |
| 🟢 | Standard | Usada por ataques y habilidades. | `attackCommands.ts`, `tacticalCommands.ts` | - |
| 🟢 | Total Defense | Acción estándar que da +4 CA y evita AdO por movimiento. | `tacticalCommands.ts` | - |
| 🟢 | Full Round | Declarado y consumido explícitamente en ataques completos. | `attackCommands.ts`, `tacticalCommands.ts` | - |
| ⚪ | Swift | Variable presente (`usedSwiftAction`) pero casi sin uso. | `room.currentTurn` | - |
| 🔴 | Immediate | Reacciones en el turno ajeno. | No implementado | Cola de Interrupciones |
| 🔴 | Ready | Preparar una acción ante un trigger. | No implementado | Cola de Interrupciones |
| 🔴 | Delay | Cambiar el lugar en la iniciativa. | No implementado | Manipulación de Iniciativa |
| 🔴 | Withdraw | Moverse el doble sin provocar AdO en primera casilla. | No implementado | Retirada (Movimiento) |

---

## Conjuros

| Estado | Regla | Detalles | Implementación | Bloqueada por |
|--------|-------|----------|----------------|---------------|
| ⚪ | Duración | Tracked por turnos (`remainingTurns`) pero no existe el motor mágico. | `roomState.ts` (Buffs) | - |
| 🔴 | Concentración | Para castear bajo daño o amenaza. | No implementado | Skills (Concentración) |
| 🔴 | Spell Resistance | Prueba de nivel de lanzador contra SR. | No implementado | Motor de conjuros |
| 🔴 | Saving Throws | Tiradas para anular/mitigar efectos. | No implementado | Stats (Fort, Ref, Will) |
| 🔴 | Área | Efectos de radio, cono, línea o cubo. | No implementado | Geometría del Tablero |
| 🔴 | Touch Spells | Tirada de ataque de toque cuerpo a cuerpo. | No implementado | Touch AC |
| 🔴 | Ray Spells | Tirada de ataque de toque a distancia. | No implementado | Touch AC |

---

## Recomendación de Roadmap (Próximos Pasos)

Con base en la madurez del motor de ataque, amenaza y posicionamiento, las siguientes implementaciones ofrecerán el mayor impacto arquitectónico y funcional:

1. **Sistema Formal de Condiciones (Conditions System)** (Riesgo bajo, alto impacto)
   - *Por qué:* Reemplaza los chequeos dispersos de *helpless* o *disabled* y provee la base para *Stunned*, *Prone*, *Flat-footed* o *Blinded*.
   - *Impacto:* Introduce `room.combatants[].conditions`, y mutaciones normalizadas en CA y reglas.

2. **Ataque Completo formal y Ataques Iterativos** (Riesgo medio, alto valor) ✅ Completado
   - *Por qué:* La base de full attack existe pero falta la UI y la capacidad de rodar 2 o 3 veces si el BAB es alto o se combate a dos armas.
   - *Impacto:* Rediseño de `attackCommands` para admitir múltiples rolls en un mismo payload o en secuencia, desglosando el BAB.

3. **Clase de Armadura Desglosada (Touch AC / Flat-Footed)** (Riesgo bajo)
   - *Por qué:* Necesario para conjuros de toque y condiciones como *Flat-footed*.
   - *Impacto:* Cambia `combatSnapshot` para calcular las tres CA (Base, Toque, Desprevenido).

4. **Cobertura y Línea de Visión Estática** (Riesgo alto)
   - *Por qué:* Posicionamiento sin cobertura está incompleto.
   - *Impacto:* Exige cambiar el `Board` para soportar esquinas/paredes y un algoritmo de raycasting de esquinas a esquinas.
