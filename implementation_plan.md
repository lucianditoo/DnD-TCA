# Plan de Implementación: Sprint 048.1 — Helpless Combat (Patch)

## Meta y Resumen
Implementar la resolución defensiva estandarizada para oponentes Indefensos (Helpless) y la acción de asalto completo Coup de Grace.
Este rediseño corrige deudas de la arquitectura: establece una proyección defensiva canónica compartida (tratando la Destreza como 0), modela la acción Coup de Grace como suspendible ante AdO sin requerir re-declaraciones del usuario, calcula el crítico automáticamente sin fabricar tiradas de dados y delega la muerte por Fortaleza a un flujo canónico.

## Cambios Propuestos

### 1. `packages/shared/src/rules.ts`
- **[MODIFY]** `rules.ts`
  - Crear o extender una proyección defensiva (ej. `getDefensiveAbilityProjection` o similar) que estandarice la recepción del estado `HELPLESS`. Esta proyección devolverá explícitamente: modificador -5 (DEX tratada como 0) y supresión de bonos de Dodge.
  - En `totalArmorClass` y `armorClassBreakdown`: Consumir la nueva proyección en lugar de alterar aritmética localmente.
  - En `canApplySneakAttack`: Agregar verificación explícita `hasEffectTrait(targetEffects, "HELPLESS")` a la condición de éxito.
  - Crear un validador semántico explícito: `isValidCoupDeGraceTarget(target)`, que verifique que el objetivo sea `HELPLESS` y se encuentre con un `lifeStatus` válido para el combate (rechazando a objetivos ya `dead`).

### 2. `apps/server/src/commands/tacticalCommands.ts`
- **[MODIFY]** `tacticalCommands.ts`
  - Agregar `handleCoupDeGrace(room, snapshot, command, combatant)`.
  - **Preflight**: Validar turno activo, `isValidCoupDeGraceTarget`, arma melee (o a distancia si adyacente), y que el target NO tenga `IMMUNE_TO_CRITICAL_HITS` (usando el trait puro general).
  - **Suspensión por AdO**: Verificar `actionProvokesOpportunityAttack`. Si provoca, crear un estado `PendingCoupDeGrace` congelando: actor, objetivo, arma y etapa. Suspender la acción (sin consumo ni daño) hasta que se resuelva la cola de AdO.
  - Agregar handler para reanudar la acción (bien automático o mediante un sub-comando de resume específico si la infraestructura lo exige), revalidando únicamente las condiciones dinámicas antes de aplicar la resolución.
  - **Muerte Canónica**: Si el objetivo falla la salvación de Fortaleza (CD = 10 + Daño sufrido post-RD), invocar una operación canónica de transición a muerte (ej. en Mutation Layer o `roomState.ts`) que evite doble transición y loguee la muerte de forma unificada y segura, preservando la causalidad. No asignar `lifeStatus = "dead"` manualmente en el handler.

### 3. `packages/shared/src/types.ts`
- **[MODIFY]** `types.ts`
  - Extender `ClientCommand` en `type UseTacticalActionCommand` añadiendo `action: "coup-de-grace"`. (Si el sistema de AdO requiere reanudación explícita, prever el tipo de resume).
  - En `CombatActionType`, añadir `"coup-de-grace"`.
  - Definir la interface del estado suspendido (ej. `PendingCoupDeGrace`) para acoplar al estado de combate (room o turno).

### 4. `apps/server/src/combat/attackResolver.ts`
- **[MODIFY]** `attackResolver.ts`
  - Crear una ruta pura, helper o extensión del DamageBundle para procesar el multiplicador de crítico y el daño masivo en modo `"automatic"`. No se usarán tiradas de ataque (`d20Roll = 20`) ni falsas confirmaciones (`confirmD20Roll = 20`), asegurando que el daño de precisión no se multiplique y no se activen efectos vinculados a "sacar un natural 20".

### 5. `apps/frontend/src/.../ActionsPanel.tsx` (Ubicación aproximada)
- **[MODIFY]** Componentes de UI de Acciones
  - Añadir el botón de "Golpe de gracia" como acción de asalto completo.
  - Será visible únicamente cuando exista un objetivo seleccionado válido. Proveerá un preview de elegibilidad (arma correcta, no `dead`, no inmune).
  - Incluir advertencia visual de que provoca AdO y representación visual del estado suspendido durante la resolución del mismo. No se mezclará con el flujo normal de ataque.

### 6. `tests/helpless-combat.test.mjs`
- **[NEW]** `helpless-combat.test.mjs`
  - Implementar la Test Strategy documentada en `helpless-combat.md`, incluyendo:
    - Verificación matemática del daño crítico automático sin RNG.
    - Flujo de acción pendiente, congelación, AdO, reanudación y cancelación.
    - Proyección defensiva (DEX base ignorada y tratada como -5, sin duplicación de supresión).
    - Muerte canónica post-daño por fallo de Fortaleza.
    - Rechazo pre-flight de inmunidad a críticos pura y objetivos ya muertos.

## Verification Plan

### Automated Tests
```powershell
npm run build
npm test -- tests/helpless-combat.test.mjs
npm run typecheck
node scripts/e2e-websocket.mjs
```

### Manual Verification
1. En UI, preparar a un actor y un blanco `HELPLESS` vivo.
2. Hacer clic en "Golpe de gracia" y observar la aparición en el log de los AdO provocados.
3. Resolver los AdO con otro cliente y confirmar que la acción original se reanuda sola (o permite ser continuada), logrando impacto y crítico automático y provocando la salvación o muerte limpia sin crashes ni falsos RNG en la consola.
