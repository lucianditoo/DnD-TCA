# Sprint 006: Sistema Formal de Condiciones V1 (NDD)

## Objetivo
El objetivo del Sprint 006 se reduce a una "vertical slice" mínima, end-to-end, probando la plataforma de **ActiveEffects** a través de la implementación de la primera condición formal: **Stunned V1**.
Este enfoque permite asentar la infraestructura mecánica (Traits, helpers, UI y validación de comandos) sin introducir complejidad de ciclos de vida automáticos (Flat-Footed) ni dependencias inexistentes (Fatigued, Prone contextual).

## Alcance y Reglas

### 1. Stunned (Aturdido) - V1
- **Mecánica Oficial**: No puede tomar acciones, suelta lo que sostiene, pierde bono de Destreza a la CA, -2 penalizador a la CA.
- **Implementación Parcial V1**:
  - Implementa: no puede actuar, pierde bono positivo de DEX a CA, penalizador -2 a CA, no realiza AoO.
  - Pendiente (Divergencia registrada): Soltar objetos sostenidos (requiere sistema de inventario avanzado).
- **Mapeo a ActiveEffects (`srd_stunned`)**:
  - Traits: `NO_DEX_TO_AC`, `CANNOT_ACT`, `CANNOT_MAKE_AOO`.
  - Modifiers: `AC` -2 (stackingPolicy: lowest_value).
  - onStack: `ignore`.

### Reglas Postpuestas y Bloqueadas
- **Flat-Footed**: Pospuesto. Requiere diseñar su ciclo de vida real (aplicación al inicio del combate, expiración automática post-primer turno) antes de ser implementado, para evitar microgestión manual del GM.
- **Fatigued / Exhausted**: Bloqueadas hasta implementar el *Attribute Modifier Pipeline* (que resuelva STR y DEX globales de forma limpia sin aproximaciones parche).
- **Prone**: Bloqueada hasta disponer de *AttackContext Modifiers* que permitan aplicar modificadores a la CA distintos según si el ataque entrante es Melee o Ranged.

## Arquitectura y Cambios Estructurales Requeridos

### 1. Extensión del Contrato de Efectos (`contracts.ts`)
- **Nuevos Traits**: 
  - `CANNOT_ACT` (Bloquea acciones voluntarias, pero no avanza ni cancela turnos en el Turn Manager).
  - `NO_DEX_TO_AC` (Suprime el bono positivo de destreza a la CA).
  - `CANNOT_MAKE_AOO` (Inhabilita realizar ataques de oportunidad).
- No se añaden estadísticas nuevas especulativas. Aplicaremos el *Minimal API Principle*.

### 2. Catálogo Productivo (`catalog.ts`)
- Eliminar el efecto `__INFRASTRUCTURE_SAMPLE__` bajo la *Zero Orphan Policy*.
- Definir `srd_stunned`.

### 3. Helpers Puros
- Crear un helper puro en el motor: `hasEffectTrait(reducedEffects, trait)` para evitar reducciones duplicadas y abstraer `includes(...)`.

### 4. Motor de Reglas (`rules.ts` e interacciones)
- **Cálculo de Armor Class (`totalArmorClass`)**: 
  Se debe aislar el componente de Destreza. 
  `const dexBonus = Math.floor((dexterity - 10) / 2);`
  Si `dexBonus > 0` y se posee el trait `NO_DEX_TO_AC`, se suprime explícitamente y se refleja en `acParts` (ej. "Bono Dex suprimido").
  Si `dexBonus <= 0`, no se suprime.
- **Validación de Acciones**: 
  Las funciones de validación como `canStandardAttack`, `canFullAttack`, `canUseMoveAction`, `canFiveFootStep`, `canCharge` evaluarán el trait `CANNOT_ACT`.
  `canTakeTurn` no debe bloquearse. El combatiente retiene su turno (permitiendo expiración de efectos) pero fracasa al intentar enviar comandos.
- **Validación de Ataques de Oportunidad**:
  La función `findTriggeredOpportunityAttacksForPath` o similares deberán descartar a cualquier combatiente con el trait `CANNOT_MAKE_AOO`.

### 5. UI y UX
- El cliente reaccionará mostrando alertas al intentar realizar acciones no válidas y visualizando los errores provenientes del WebSocket de manera autoritativa.
- Idealmente, los botones de acción se presentarán deshabilitados si el frontend determina que el combatiente tiene `CANNOT_ACT` o similar (opcional pero deseable).

## Compatibilidad e Impacto

| Subsistema | Impacto | Riesgo | Mitigación |
| --- | --- | --- | --- |
| **Rule Engine** | **Bajo/Medio**. CA y validación de comandos. | Acoplamiento repetitivo. | Uso de helpers como `hasEffectTrait`. |
| **Turn Manager** | **Nulo**. El ciclo de vida sigue idéntico. | Alteración de turnos. | Validar acciones por separado de inicio/fin de turno. |
| **ActiveEffects** | **Bajo**. Adición de condición real. | N/A | |

## Estrategia de Testing (Tests Mínimos para Stunned V1)

### Unit Tests
- Efecto ausente conserva el comportamiento previo.
- `NO_DEX_TO_AC`: Validación con DEX 18 (se suprime el +4), DEX 10 (+0 conservado), DEX 8 (-1 conservado), buffs legacy, y el AC -2 inherente a Stunned.
- `CANNOT_ACT`: Bloquea movimiento, bloquea ataque estándar, bloquea ataque completo, bloquea carga, bloquea paso de 5 pies.
- El turno sigue comenzando y terminando.
- `CANNOT_MAKE_AOO`: Impide originar Ataques de Oportunidad.
- La eliminación del efecto restaura exactamente el estado anterior.
- Expiración a nivel Tick Layer (una duración temporal expira naturalmente).

### E2E Tests
- GM o setup autoritativo aplica Stunned.
- Intento de movimiento es rechazado.
- Intento de ataque es rechazado.
- Avance del turno continúa normalmente vía `end-turn`.
- El efecto expira en el evento correcto.
- El combatiente vuelve a actuar exitosamente tras la expiración.

## Divergencias Normativas
- *EFFECT-STUNNED*: Registrada como Parcial V1. No incluye soltar objetos sostenidos.
