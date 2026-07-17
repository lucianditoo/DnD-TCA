import {
  createCombatRulesSnapshot,
  getEnvironmentalHazardHits,
  effectsCatalog,
  averageDiceDamage,
  applyDamage,
  makeLog,
  lifeStatus,
  EffectManager,
  isProductionEffectId,
  cryptoId,
  type CombatRoom,
  type DamageComponent,
  type EffectDefinition
} from "@dnd-tactical/shared";
import { makeDamageBundle } from "./attackResolver.js";
import { resolveSavingThrow, applySpellSaveToDamageBundle } from "./savingThrowResolver.js";
import { rollDice } from "./diceRoller.js";
import { findCombatant, logStatusChange, checkCombatOutcome } from "../room/roomState.js";

/**
 * Resuelve, en una única pasada síncrona y acotada, las salvaciones pasivas de todos los
 * combatientes vivos atrapados en celdas de peligro (`targetCells`) de efectos de área
 * persistentes activos en la sala.
 *
 * Se invoca desde `advanceTurn` inmediatamente después de despachar `RoundStarted` —
 * deliberadamente FUERA del array de `CombatEventListener` puros del Event Bus, para no
 * fragmentar su contrato con una dependencia de dados (ver
 * `docs/designs/environmental-saves-automation-design.md`, Sprint 034, sección "Capa de
 * Orquestación").
 *
 * No introduce recursión ni re-despacho de eventos: los hits se calculan una única vez sobre
 * un snapshot congelado al inicio de la función; el bucle está acotado por `hits.length` y las
 * mutaciones posteriores de HP/efectos no vuelven a evaluar la intersección geométrica.
 */
export function resolveEnvironmentalHazards(
  room: CombatRoom,
  diceRoller: (sides: number) => number = rollDice
): void {
  const snapshot = createCombatRulesSnapshot(room);
  const hits = getEnvironmentalHazardHits(snapshot);
  if (hits.length === 0) return;

  for (const hit of hits) {
    const definition: EffectDefinition = effectsCatalog[hit.effectId];
    const hazard = definition.hazard;
    if (!hazard) continue;

    const target = findCombatant(room, hit.combatantId);
    if (lifeStatus(target) === "dead") continue;

    const d20Roll = diceRoller(20);
    const saveResult = resolveSavingThrow(snapshot, target, hazard.savingThrowType, hazard.dc, d20Roll);

    let damageApplied = 0;
    if (hazard.damageExpression) {
      const baseAmount = Math.max(0, Math.floor(averageDiceDamage(hazard.damageExpression)));
      const component: DamageComponent = {
        sourceId: hit.effectId,
        label: definition.name,
        category: "energy",
        amount: baseAmount,
        diceExpression: hazard.damageExpression,
        neverMultiply: true
      };
      const bundle = makeDamageBundle([component]);
      const mitigated = applySpellSaveToDamageBundle(bundle, hazard.saveEffect, saveResult.success);
      damageApplied = mitigated.total;
    }

    if (damageApplied > 0) {
      const damageResult = applyDamage(target, damageApplied);
      logStatusChange(room, target, damageResult.statusBefore, damageResult.statusAfter);
    }

    if (!saveResult.success && hazard.onFailEffectId && isProductionEffectId(hazard.onFailEffectId)) {
      const secondaryInstance = {
        instanceId: cryptoId("effect"),
        effectId: hazard.onFailEffectId,
        source: { type: "environment" as const },
        targets: [target.id],
        appliedAtEvent: { type: "SystemInjected" as const, round: room.round }
      };
      const nextRoom = EffectManager.add(room, secondaryInstance);
      Object.assign(room, nextRoom);
    }

    const naturalLabel = saveResult.isNatural1
      ? "fallo automático por 1 natural"
      : saveResult.isNatural20
        ? "éxito automático por 20 natural"
        : saveResult.success ? "éxito" : "fallo";
    const damageLabel = hazard.damageExpression ? ` Daño: ${damageApplied}.` : "";
    const effectLabel = !saveResult.success && hazard.onFailEffectId ? " Efecto adicional aplicado." : "";

    room.log.unshift(makeLog(
      "system",
      `${target.name} atrapado por ${definition.name}: salvación de ${hazard.savingThrowType} d20 ${d20Roll} + ${saveResult.modifier} = ${saveResult.total} contra CD ${hazard.dc}; ${naturalLabel}.${damageLabel}${effectLabel}`
    ));
  }

  checkCombatOutcome(room);
}
