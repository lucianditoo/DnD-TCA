# Documento de Diseño: Advanced AoO Limits & Reaction Triggers (Sprint 032)

## 1. Filtro de Irreversibilidad a 20 Sprints
**Pregunta:** Al estructurar los disparadores automáticos de AdO en el servidor, ¿cómo diseñamos el pipeline de interrupciones para que en el futuro dotes como "Disparo Defensivo" o la maniobra de "Conjurar a la Defensiva" (Concentración) cancelen la provocación sin alterar los controladores core?

**Respuesta:** Debemos diseñar un sistema de delegación de reglas (Rule Engine) puro que evalúe si la acción provoca AdO *antes* de efectuarla. En lugar de codificar la asunción de provocación directamente dentro de los controladores (`cast-spell`, `tactical-action`), delegaremos a un oráculo (por ejemplo, `Rules.actionProvokesOpportunityAttack(snapshot, combatant, action)`). Este oráculo será puro e interceptará modificadores o dotes (como "Combat Casting" o "Defensive Casting") reduciendo el "provokes" a `false` de manera transparente para el controlador. 
El servidor simplemente evaluará la provocación y, si es verdadera, suspenderá temporalmente (encolará) el commit original para inyectar la reacción en `room.pendingOpportunityAttacks`, interrumpiendo el flujo. De este modo, la lógica del trigger queda completamente desacoplada de la ejecución de la acción en sí, garantizando que el acoplamiento a reglas futuras se resuelva en `rules.ts` (estado puro) y no en el pipeline transaccional (mutación).

## 2. Complejidad Accidental
**Pregunta:** ¿De qué manera aseguramos que el frontend React (`apps/web`) comparta byte a byte la misma evaluación de peligro sin duplicar la lógica de amenazas del grid?

**Respuesta:** Manteniendo `Rules.actionProvokesOpportunityAttack(snapshot, combatant, action)` y `Rules.isThreatenedByConsciousEnemy(snapshot, combatant.position)` dentro del paquete isomorfo `shared/src/rules.ts`. El frontend (`ActionsPanel.tsx`) invocará estas mismas funciones pasando el `CombatRulesSnapshot` local al momento de seleccionar la acción (conjuro o ataque a distancia). Como las reglas son puras, devolverán el mismo booleano en React que en Node.js sin necesidad de duplicar cálculos espaciales ni sincronizaciones adicionales, resolviendo la advertencia preventiva visual ("⚠️ Esta acción provocará un Ataque de Oportunidad") con cero complejidad redundante y 100% de coherencia autoritativa.

## 3. La Regla de Tres
**Pregunta:** Nombra tres dotes o conjuros futuros que se beneficiarán directamente de este pipeline de interrupción reactiva.

**Respuesta:**
1. **Hold the Line (Dote):** Permite realizar un Ataque de Oportunidad cuando un enemigo *entra* en una casilla amenazada (no solo cuando sale). El oráculo puro de movimiento identificará la provocación y el pipeline de interrupción encolará la reacción en `pendingOpportunityAttacks`, resolviendo el ataque antes de que el enemigo finalice o consolide su carga.
2. **Combat Casting / Conjurar a la Defensiva (Mecánica/Concentración):** El jugador podrá enviar una bandera en el comando `cast-spell` (`defensive: true`). El oráculo de reglas puro simulará o procesará la mitigación por la tirada de Concentración (o bonos estáticos) y, si tiene éxito, evaluará `provokes = false`, saltándose la interrupción.
3. **Mago de Batalla / Disparo Defensivo (Dote):** Anulan la provocación natural de ataques a distancia o aptitudes sortílegas cuando se está bajo amenaza. El oráculo evaluará si el atacante posee el `featId` correspondiente ("srd_close_quarters_combat" o similar) y silenciará la bandera de AdO limpiamente sin tocar la mutación del comando en sí.

---

## 4. Impacto en Subsistemas

*   **Rule Engine (Cálculos y Validaciones):** Expansión de `canMakeOpportunityAttack` para soportar el límite dinámico (1 + DEX mod) de "Reflejos de Combate" y adición del oráculo de provocación `actionProvokesOpportunityAttack`.
*   **CombatRoom / State Schema:** Aprovecha `pendingOpportunityAttacks` ya existente en `room` y limpia variables `opportunityAttacksThisRound` en `roundTickListener`.
*   **WebSocket Contract:** No se modifica el payload; la reacción transcurre en el mismo flujo de interrupción que ya usa `Trip` o `Stand Up`.
*   **UI Presentation:** Se inyectará el aviso visual en el `ActionsPanel.tsx` o `WeaponAttackPanel.tsx` para indicar el peligro del ataque.
*   **Automatización de Tests:** Tests de unidad para `Combat Reflexes` (múltiples AdO permitidos en una ronda y resets de ronda) y tests E2E donde el `cast-spell` bajo amenaza encola un AdO y se interrumpe apropiadamente.
