# Plan de Implementación: Sprint 047 — Blinded Core

## Resumen del Plan
El objetivo de este Sprint es implementar la vertical oficial `Blinded` según el diseño aprobado en `docs/designs/blinded-condition.md`. Al adoptar la **Opción B (Blinded Core parcial)**, nos restringiremos exclusivamente al combate táctico.

El diseño arquitectónico muestra que **todas** las infraestructuras necesarias ya existen (Concealment 50% perspectivo, bloqueo de AdO, supresión de DEX, modificadores numéricos negativos y reducción multiplicativa de velocidad). Por lo tanto, la implementación será puramente declarativa en el catálogo y los tests verificarán el pipeline.

## Archivos a Modificar

### 1. `packages/shared/src/effects/catalog.ts`
- **[MODIFICAR]**
  - Agregar la nueva entrada `srd_blinded` con el siguiente esquema:
    ```typescript
    "srd_blinded": {
      name: "Cegado",
      description: "La criatura no puede ver. -2 a la CA, pierde su bono de Destreza a la CA, se mueve a media velocidad, otorga ocultación total (50%) a sus oponentes, y no amenaza casillas.",
      traits: ["NO_DEX_TO_AC", "NO_THREAT", "CANNOT_MAKE_AOO"],
      modifiers: [
        {
          type: "numeric",
          id: "blinded_ac_penalty",
          stat: "AC",
          stackingGroup: "condition",
          stackingPolicy: "lowest_value",
          value: -2
        }
      ],
      movementRateContributions: [
        {
          id: "blinded_half_speed",
          label: "Blinded ×1/2",
          stackingKey: "condition:blinded:half-speed",
          numerator: 1,
          denominator: 2
        }
      ],
      concealmentContributions: [
        {
          id: "blinded_total_concealment_given",
          label: "Cegado",
          stackingKey: "condition:blinded",
          perspective: "attacks_by_target",
          kind: "total",
          missChancePercent: 50
        }
      ],
      ruleOverrides: ["FORBID_RUN", "FORBID_CHARGE"],
      onStack: "ignore"
    }
    ```

### 2. Pruebas Unitarias
- **[NUEVO]** `packages/shared/src/rules/__tests__/blinded.test.ts`
  - *Test 1:* Verifica que `srd_blinded` emita `total concealment` (50% prob fallo) a cualquier ataque del portador y que NO aplique ocultación total a los ataques CONTRA él mismo.
  - *Test 2:* Verifica que la CA baje -2 y la destreza no aplique.
  - *Test 3:* Verifica que el movimiento se reduzca a la mitad.
  - *Test 4:* Verifica que no pueda correr ni cargar (chequeo de rule overrides sobre el reducer).
  - *Test 5:* Verifica que el Sneak Attack se inactive para los ataques producidos por el ciego (delegado en `canApplySneakAttack` con concealment efectivo).
  - *Test 6:* Verificación de stacking seguro con Entangled (velocidades un cuarto, etc).

### 3. `docs/rules/registry.md`
- **[MODIFICAR]**
  - Añadir la entrada `EFFECT-BLINDED` con su mapeo a la implementación en el catálogo de efectos.

### 4. `docs/testing/master-coverage.md`
- **[MODIFICAR]**
  - Marcar `Blinded` como cubierto mediante la Opción B (Core Táctico).

### 5. `docs/audits/combat-rules-deviations.md`
- **[MODIFICAR]**
  - Registrar la desviación de la omisión del Chequeo de Equilibrio DC 10 para movimiento acelerado, y la inhabilitación del chequeo de Spot/Search ya que dependen de infraestructura no desarrollada en el Sprint 047.

## Estrategia de Testing (Validación)
- Ejecutar `npm run test` localmente para las aserciones estáticas de Shared (EffectReducer).
- Ejecutar `node scripts/e2e-websocket.mjs` invocando `add-effect` de `srd_blinded` en una criatura y luego simular un `resolveAttack`, corroborando el d100 tirado por Concealment y las reducciones en CA.

## Preguntas Abiertas para el Usuario (Design Feedback)
1. **Opción Recomendada (B)**: ¿Estás de acuerdo en omitir los fallos automáticos en Avistar (Spot)/Buscar (Search) por ahora, priorizando la vertical de combate táctico que ya es mecánicamente soportada al 100%?
2. **Chequeo de Balance**: Se bloquearán las acciones de Correr y Cargar de plano debido a que no poseemos cheques de habilidades obligatorios (Balance DC 10) on-the-move. ¿Aceptas esta restricción directa vía `FORBID_RUN` y `FORBID_CHARGE`?

**Requiere aprobación (`Proceed`) para comenzar a ejecutar.**
