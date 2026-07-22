# Plan de Implementación: Sprint 048 — Helpless Combat

## Meta y Resumen
Implementar la resolución defensiva estandarizada para oponentes Indefensos (Helpless) y la acción de asalto completo Coup de Grace. 
Esto abarca: pérdida de la bonificación de Destreza a la CA (-5 de modificador neto al tener DEX 0), viabilidad de ataque furtivo, la acción táctica completa, daño crítico automático y muerte por falla en salvación de Fortaleza.

## Open Questions
- **Interfaz de Usuario**: ¿Deseas que agregue el botón "Coup de Grace" directamente a `ActionsPanel.tsx` o me enfoco únicamente en el motor backend para este sprint (ya que los tests lo validarán a nivel de API)?

## User Review Required
> [!IMPORTANT]
> **AdO para Coup de Grace**: El motor usa un patrón de interrupción estricto (como en spellcasting o movement). Si un Coup de Grace provoca AdO y hay enemigos amenazando, el comando poblará `pendingOpportunityAttacks` y retornará, sin realizar la acción. El usuario deberá sobrepasar los ataques y luego volver a enviar el comando. Esto es una consecuencia intencional y conocida del diseño del motor. ¿Estás de acuerdo con aplicar este mismo patrón?

> [!NOTE]
> **Discrepancia sobre Críticos y Golems**: Hemos constatado que no hay discrepancia en las reglas. La fuente `10_modificadores_de_combate.txt` y el SRD concuerdan en que un constructo es inmune al Coup de Grace. Por tanto, el pre-flight validation de `Coup de Grace` impedirá por completo la acción contra targets con `IMMUNE_TO_CRITICAL_HITS`.

## Cambios Propuestos

### 1. `packages/shared/src/rules.ts`
- **[MODIFY]** `rules.ts`
  - En `totalArmorClass`: Detectar `hasEffectTrait(reduced, "HELPLESS")`. Si aplica, forzar `suppressDexAndDodge = true` e incorporar un diferencial que asuma Destreza 0 (-5 mod) independiente de la destreza actual del blanco.
  - En `canApplySneakAttack`: Agregar verificación explícita `hasEffectTrait(targetEffects, "HELPLESS")` a la condición de éxito.

### 2. `apps/server/src/commands/tacticalCommands.ts`
- **[MODIFY]** `tacticalCommands.ts`
  - Agregar `handleCoupDeGrace(room, snapshot, command, combatant)`.
  - Validaciones: Turno activo, `HELPLESS` en el target, arma (melee o alcance = adyacente para ranged), inmunidad a crítico.
  - Generación de AdO: Verificar `actionProvokesOpportunityAttack(snapshot, combatant, "coup-de-grace")`.
  - Resolución: Invocar `resolveAttack` puenteando la tirada y forzando crítico o aplicando un DamageBundle que incorpore la lógica, y posteriormente hacer la tirada de salvación de Fortaleza (DC = 10 + Daño final).
  - Si falla Fortaleza: Invocar `logStatusChange` cambiando `hpCurrent` y estado a `dead`.

### 3. `packages/shared/src/types.ts`
- **[MODIFY]** `types.ts`
  - Extender `ClientCommand` en `type UseTacticalActionCommand` añadiendo `action: "coup-de-grace"`.
  - En `CombatActionType`, añadir `"coup-de-grace"`.

### 4. `apps/server/src/combat/attackResolver.ts`
- **[MODIFY]** `attackResolver.ts`
  - Reestructurar el `AttackResolutionOptions` para poder aceptar `isAutomaticCritical: true`, que fuerce un `hit` e invoque `resolveCriticalConfirmation` o directamente aplique el multiplicador sin d20 nativo.
  - Actualmente, `helplessBonus` (+4 a ataques melee) está, pero podríamos requerir ajustes para que aplique también a las variaciones del Coup de Grace.

### 5. `tests/helpless-combat.test.mjs`
- **[NEW]** `helpless-combat.test.mjs`
  - Test: Un objetivo `HELPLESS` tiene DEX=0 y pierde Dodge a la CA.
  - Test: Ataque cuerpo a cuerpo recibe +4 contra objetivo `HELPLESS`.
  - Test: Pícaro aplica Sneak Attack contra objetivo `HELPLESS` incluso sin flanquear.
  - Test: Coup de Grace funciona (full-round action, hit y crit auto).
  - Test: Salvación de Fortaleza en Coup de Grace (éxito = sobrevive con daño, fallo = estado Dead).
  - Test: Inmunidad (Constructo/No-muerto) rechaza pre-flight de Coup de Grace.

## Verification Plan

### Automated Tests
```powershell
npm run build
npm test -- tests/helpless-combat.test.mjs
npm run typecheck
node scripts/e2e-websocket.mjs
```

### Manual Verification
1. Generar mock en `tests/helpless-combat.test.mjs`.
2. Observar el output exacto y verificar el log de acciones, especialmente el fallo letal a la salvación de Fortaleza que provoca `status = "dead"`.
