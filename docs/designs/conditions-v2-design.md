# Diseño Funcional: Sprint 007 - Sistema de Condiciones V2 (Flat-Footed)

## 1. Resumen Ejecutivo
Tras validar la "vertical slice" de ActiveEffects mediante la condición `srd_stunned`, el Sprint 007 expandirá la plataforma para integrar condiciones cuyo ciclo de vida está entrelazado con el motor de iniciativa. Específicamente, se implementará la condición **Flat-Footed**, que impacta en la defensa y capacidad de reacción, reutilizando la infraestructura de Traits validada.

## 2. Definición del Problema
Actualmente, el sistema carece de un modelo automático para asignar estados que dependan de la secuencia de turnos, tales como Flat-Footed (Desprevenido), el cual ocurre al inicio del combate antes del primer turno de una criatura. Sin esto, ciertas reglas de ataques de oportunidad y armadura son aplicadas incorrectamente de forma manual.

## 3. Implementación Propuesta (Flat-Footed)

### 3.1. Declaración en el Catálogo (`srd_flat_footed`)
Se añadirá una nueva condición productiva en `effects/catalog.ts`:
- **ID**: `srd_flat_footed`
- **Traits**: `NO_DEX_TO_AC`, `CANNOT_MAKE_AOO`
- **Modificadores**: Ninguno numérico explícito.
- **OnStack**: `ignore` (no se puede estar doblemente desprevenido).

### 3.2. Ciclo de Vida Automático (Tick Layer)
- **Inyección**: Al momento de que el GM ejecute el inicio del combate (y asigne la iniciativa), el sistema de preparación de encuentro inyectará automáticamente `srd_flat_footed` a todos los combatientes, con duración condicional a su primer inicio de turno.
- **Expiración**: Cuando el `TickLayer` resuelva el evento `turn-start` para un combatiente determinado, eliminará la instancia de `srd_flat_footed` de ese objetivo de forma transparente.

### 3.3. Integración con el Evaluador
El `RulesEngine` ya interpreta de forma agnóstica `NO_DEX_TO_AC` y `CANNOT_MAKE_AOO`, por lo que **no se requiere añadir lógica nueva** en los métodos de CA o AdO.

## 4. DESIGN REVIEW CHECKLIST (Obligatorio)

### 4.1. ¿Qué decisión de este diseño de condiciones será difícil de cambiar en 20 sprints?
**Decisión Irreversible**: La total dependencia en una "Reducción Funcional Pura y Agnóstica" (`EffectReducer`) frente a mutaciones directas sobre el modelo de datos.
Al no guardar flags estáticas en el `Combatant` (ej. `isFlatFooted`), si el sistema requiere a futuro condiciones altamente contextuales o complejas (ej. "Penalizador a la CA, pero sólo contra ataques a distancia"), el reductor en sí mismo deberá ser extendido para soportar contextos de evaluación complejos, en lugar de poder parchearse localmente en la función de combate, manteniendo a toda costa la regla de "Cero ifs ad-hoc".

### 4.2. Regla de Tres
Para garantizar que la abstracción propuesta (`Traits` inyectables que el Evaluador respeta) soporta evolución, estas son tres condiciones futuras que podrán implementarse sin modificar el Core del Evaluador:
1. **Dazed (Aturdido levemente)**: Utilizará el trait `CANNOT_ACT`, pero sin penalizadores de CA y sin requerir tocar los comandos de servidor, ya que éstos sólo preguntan por la disponibilidad de acción.
2. **Paralyzed (Paralizado)**: Reutilizará `CANNOT_ACT`, `NO_DEX_TO_AC`, `CANNOT_MAKE_AOO`, y agregará posiblemente un futuro trait `AUTO_CRIT_THREAT` y modificadores drásticos de CA y Fuerza/Destreza.
3. **Entangled (Enredado)**: Introducirá `CANNOT_RUN` o `CANNOT_CHARGE` y penalizadores a modificadores de DEX, todos soportados directamente por el catálogo.
