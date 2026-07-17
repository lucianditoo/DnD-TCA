# Diseño: Esfuerzo y Economía de Acciones al estar Incapacitado (Disabled)

## Referencia Normativa
Según `combat/13_heridas_y_muerte.txt`:
> "INCAPACITADO (0 PUNTOS DE GOLPE)
> Cuando tus puntos de golpe actuales queden reducidos exactamente a 0, estarás incapacitado. Sólo podrás realizar una única acción de movimiento o acción estándar cada asalto (pero no ambas, ni tampoco acciones de asalto completo). Puedes realizar acciones de movimiento sin causarte más daño, pero si realizas cualquier acción estándar (o cualquier otra acción que el DM considere extenuante, incluyendo algunas acciones gratuitas como lanzar un conjuro apresurado) sufrirás 1 punto de daño después de completarla."

## Restricción de Economía de Acciones (El Problema del Movimiento + Ataque)
Actualmente, el motor controla si ya usaste una acción de movimiento o estándar de manera individual. Pero un combatiente a 0 HP **no puede usar ambas**.
- Si usó una acción de movimiento, no puede atacar ni usar acciones estándar.
- Si usó una acción estándar, no puede moverse ni usar acciones de movimiento.

### Función Pura de Validación
Se implementará una helper pura centralizada para evitar comprobaciones manuales en los handlers:
```ts
function canDisabledCombatantTakeAction(
  snapshot: CombatRulesSnapshot,
  combatant: Combatant,
  actionKind: "standard" | "move" | "full-round" | "non-action"
): RuleResult
```
*Lógica de consumo*: Identifica si el turno actual (`snapshot.currentTurn`) ya ha consumido su única acción permitida evaluando los flags: `usedMoveAction`, `usedStandardAction`, `usedFullAttack`, `usedTotalDefense`.
Si `actionKind` es `full-round`, siempre devolverá `false` para un incapacitado.

## Clasificación Explícita de Acciones
| Acción | Tipo de Acción | Permitida a 0 HP | Extenuante | Consume Acción Única | Daño por Esfuerzo |
|---|---|---|---|---|---|
| Movimiento normal | Move | Sí | No | Sí | 0 |
| Ataque estándar | Standard | Sí | Sí | Sí | 1 |
| Ataque completo | Full-Round | No | — | — | — |
| Carga | Standard* | Sí* | Sí | Sí | 1 |
| Defensa total | Standard | Sí | Sí | Sí | 1 |
| Prestar ayuda | Standard | Sí | Sí | Sí | 1 |
| Estabilizar | Standard | Sí | Sí | Sí | 1 |
| Paso de 5 pies | No-acción | Sí | No | No | 0 |
| Declarar modo | No-acción** | Sí | No | No | 0 |
| Cancelar modo | No-acción** | Sí | No | No | 0 |
| Comandos GM | Administrativa | Sí | No | No | 0 |

*\*Nota Carga: A 0 HP estás limitado a una única acción, lo que te permite hacer una "carga parcial" como acción estándar según el manual, pero moverse y atacar es extenuante.*
*\*\*Nota Modos: Las declaraciones de modo de ataque no representan consumo de acción en el mundo del juego; son pre-cálculos del UI y no bloquean el turno ni producen daño.*

## Interacción con el Paso de 5 Pies (5-foot step)
El manual establece que el paso de 5 pies **no es una acción**. "Si no llegas a moverte ninguna distancia real en un asalto... puedes realizar un paso de 5'".
Por lo tanto:
- Un combatiente a 0 HP **sí puede** usar una acción estándar y dar un paso de 5 pies en el mismo asalto.
- El paso en sí mismo NO cuenta como acción consumida y NO es extenuante.

## Reglas del Flujo de Exertion (Momento de Aplicación)
1. **Estado Inicial**: La comprobación de si el personaje estaba a 0 HP debe realizarse **antes** de resolver la acción.
2. **Éxito de la acción**: La pérdida de HP se aplica sólo si la acción es procesada válidamente por el servidor (no rechazada). Un ataque que falla su tirada (miss) se considera exitoso en su ejecución y sí causa esfuerzo.
3. **Curación durante la acción**: Si el personaje a 0 HP realiza una acción extenuante, pero el efecto de la propia acción cura al personaje dejándolo por encima de 0 HP, la condición de esfuerzo no se aplica, evitando desmayarlo retroactivamente.
4. **Consumo Único**: Validado por la helper pura.
5. **Sin efectos retroactivos ni prematuros**: `declare-attack-mode` no consume la acción ni aplica esfuerzo.

## Refactorización Arquitectónica
- Mover `applyDisabledExertion` a `apps/server/src/combat/lifeStatusEffects.ts`.
- **Es Helper Centralizada de Mutation Layer**: Determinista, sin logging, y debe retornar un resultado descriptivo para que el handler tome acción.
- **Nuevo Contrato**:
  ```ts
  interface ExertionOptions {
    wasDisabledAtActionStart: boolean;
    actionWasExerting: boolean;
  }
  
  interface ExertionResult {
    applied: boolean;
    previousHp: number;
    currentHp: number;
    statusBefore: LifeStatus;
    statusAfter: LifeStatus;
  }
  
  // Dentro verifica:
  // if (options.wasDisabledAtActionStart && options.actionWasExerting && combatant.hpCurrent <= 0)
  function applyDisabledExertion(combatant: Combatant, options: ExertionOptions): ExertionResult
  ```
- **Separación de Responsabilidades**: La helper sólo muta el estado delegando en `applyDamage` si se cumplen las condiciones. **No** escribe logs por sí misma. El handler de comando recibe el resultado y decide qué loguear. 
