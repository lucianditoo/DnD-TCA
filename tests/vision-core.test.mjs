import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getVisionAssessment, composeConcealmentAssessment, getConcealmentAssessment, createCombatRulesSnapshot } from "@dnd-tactical/shared";
import { makeTestCombatant, makeTestRoom, structuredSnapshotFields } from "./test-utils.mjs";

// Sprint 053B: primera vertical funcional de Vision — iluminacion estatica (dimLightCells/
// darknessCells), Darkvision (IntrinsicPerception.darkvisionFeet) y su composicion con
// Concealment existente (severidad maxima, nunca suma de porcentajes). Ver
// docs/designs/vision-and-line-of-effect-architecture.md §13.5/§13.8/§13.9.

function roomWith(originPos, targetPos, boardOverrides = {}, observerOverrides = {}, targetOverrides = {}) {
  const observer = makeTestCombatant({ id: "observer", position: originPos, ...observerOverrides });
  const target = makeTestCombatant({ id: "target", position: targetPos, ...targetOverrides });
  const room = makeTestRoom({
    combatants: [observer, target],
    board: { width: 30, height: 30, cellSizeFeet: 5, ...boardOverrides }
  });
  return { room, observer, target };
}

describe("Sprint 053B - Vision unitarios (getVisionAssessment)", () => {
  it("luz brillante: sin dimLightCells/darknessCells produce kind none y reason clear", () => {
    const { room, observer, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 });
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.canPerceiveVisually, true);
    assert.equal(result.kind, "none");
    assert.equal(result.missChancePercent, 0);
    assert.equal(result.directTargetingAllowed, true);
    assert.equal(result.requiresTargetSquare, false);
    assert.equal(result.dominantReason, "clear");
  });

  it("luz tenue sin Darkvision: kind partial 20%, reason dim-light, targeting directo permitido", () => {
    const { room, observer, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { dimLightCells: ["2,0"] });
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.canPerceiveVisually, true);
    assert.equal(result.kind, "partial");
    assert.equal(result.missChancePercent, 20);
    assert.equal(result.directTargetingAllowed, true);
    assert.equal(result.requiresTargetSquare, false);
    assert.equal(result.dominantReason, "dim-light");
  });

  it("oscuridad total sin Darkvision: kind total 50%, reason darkness, requiere casilla", () => {
    const { room, observer, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { darknessCells: ["2,0"] });
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.canPerceiveVisually, false);
    assert.equal(result.kind, "total");
    assert.equal(result.missChancePercent, 50);
    assert.equal(result.directTargetingAllowed, false);
    assert.equal(result.requiresTargetSquare, true);
    assert.equal(result.dominantReason, "darkness");
  });

  it("oscuridad total dentro del alcance de Darkvision: observador ve con normalidad (clear)", () => {
    const { room, observer, target } = roomWith(
      { x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { darknessCells: ["2,0"] },
      { intrinsicPerception: { darkvisionFeet: 60 } }
    );
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.canPerceiveVisually, true);
    assert.equal(result.kind, "none");
    assert.equal(result.dominantReason, "clear");
  });

  it("oscuridad total fuera del alcance de Darkvision: sigue siendo total, reason darkvision-out-of-range", () => {
    const { room, observer, target } = roomWith(
      { x: 0, y: 0, zFeet: 0 }, { x: 20, y: 0, zFeet: 0 }, { darknessCells: ["20,0"] },
      { intrinsicPerception: { darkvisionFeet: 10 } }
    );
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.canPerceiveVisually, false);
    assert.equal(result.kind, "total");
    assert.equal(result.missChancePercent, 50);
    assert.equal(result.dominantReason, "darkvision-out-of-range");
  });

  it("ruta visual bloqueada: kind total, reason blocked-visual-path, incluso con luz brillante", () => {
    const { room, observer, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0"] });
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.canPerceiveVisually, false);
    assert.equal(result.kind, "total");
    assert.equal(result.missChancePercent, 50);
    assert.equal(result.requiresTargetSquare, true);
    assert.equal(result.dominantReason, "blocked-visual-path");
  });

  it("precedencia: ruta visual bloqueada domina sobre luz tenue en la misma evaluación", () => {
    const { room, observer, target } = roomWith(
      { x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 },
      { lineOfEffectBlockingCells: ["1,0"], dimLightCells: ["2,0"] }
    );
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.dominantReason, "blocked-visual-path", "La ruta bloqueada se evalua primero; la luz tenue nunca se llega a considerar.");
    assert.equal(result.kind, "total");
  });

  it("precedencia de datos: darkness domina dim-light cuando la misma celda aparece en ambos campos", () => {
    const { room, observer, target } = roomWith(
      { x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 },
      { darknessCells: ["2,0"], dimLightCells: ["2,0"] }
    );
    const result = getVisionAssessment(room, observer, target);
    assert.equal(result.dominantReason, "darkness", "darkness debe consultarse antes que dimLight cuando ambas listan la misma celda.");
    assert.equal(result.kind, "total");
    assert.equal(result.missChancePercent, 50);
  });

  it("traces y dominantReason: Darkvision dentro de alcance conserva evidencia de por qué se anuló la oscuridad", () => {
    const { room, observer, target } = roomWith(
      { x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { darknessCells: ["2,0"] },
      { intrinsicPerception: { darkvisionFeet: 60 } }
    );
    const result = getVisionAssessment(room, observer, target);
    const boardLightTrace = result.traces.find((trace) => trace.source === "board-light");
    const perceptionTrace = result.traces.find((trace) => trace.source === "intrinsic-perception");
    assert.ok(boardLightTrace, "Debe existir una traza de board-light para la oscuridad detectada.");
    assert.equal(boardLightTrace.status, "suppressed", "La oscuridad queda suprimida por Darkvision suficiente.");
    assert.ok(perceptionTrace, "Debe existir una traza de intrinsic-perception explicando la supresión.");
    assert.equal(perceptionTrace.status, "applied");
    assert.equal(result.dominantReason, "clear");
  });

  it("Snapshot transporta las fuentes: dimLightCells/darknessCells/intrinsicPerception sobreviven a createCombatRulesSnapshot", () => {
    const { room, observer, target } = roomWith(
      { x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { darknessCells: ["2,0"], dimLightCells: ["5,5"] },
      { intrinsicPerception: { darkvisionFeet: 30 } }
    );
    const snapshot = createCombatRulesSnapshot(room);
    assert.deepEqual(snapshot.board.darknessCells, ["2,0"]);
    assert.deepEqual(snapshot.board.dimLightCells, ["5,5"]);
    const snapshotObserver = snapshot.combatants.find((c) => c.id === "observer");
    assert.deepEqual(snapshotObserver.intrinsicPerception, { darkvisionFeet: 30 });
    // El resultado debe ser identico usando el snapshot en vez del room crudo.
    const result = getVisionAssessment(snapshot, snapshotObserver, snapshot.combatants.find((c) => c.id === "target"));
    assert.equal(result.dominantReason, "clear");
  });
});

describe("Sprint 053B - Composición VisionAssessment + ConcealmentAssessment", () => {
  const noneReduced = { kind: "none", missChancePercent: 0, traces: [] };
  const noneVision = { canPerceiveVisually: true, kind: "none", missChancePercent: 0, directTargetingAllowed: true, requiresTargetSquare: false, dominantReason: "clear", traces: [] };
  const partialVision = { canPerceiveVisually: true, kind: "partial", missChancePercent: 20, directTargetingAllowed: true, requiresTargetSquare: false, dominantReason: "dim-light", traces: [{ source: "board-light", label: "Iluminación tenue", kind: "partial", missChancePercent: 20, status: "applied" }] };
  const totalVision = { canPerceiveVisually: false, kind: "total", missChancePercent: 50, directTargetingAllowed: false, requiresTargetSquare: true, dominantReason: "blocked-visual-path", traces: [{ source: "visual-path", label: "Ruta visual bloqueada", kind: "total", missChancePercent: 50, status: "applied" }] };
  const partialReduced = { kind: "partial", missChancePercent: 20, traces: [{ effectId: "x", effectInstanceId: "i1", contributionId: "c1", sourceType: "system", label: "Efecto parcial", stackingKey: "x", kind: "partial", missChancePercent: 20, status: "applied" }] };
  const totalReduced = { kind: "total", missChancePercent: 50, traces: [{ effectId: "srd_blinded", effectInstanceId: "i2", contributionId: "c2", sourceType: "system", label: "Blinded", stackingKey: "srd_blinded", kind: "total", missChancePercent: 50, status: "applied" }] };

  it("Vision none + efecto none -> compuesto none, sin aplicar", () => {
    const result = composeConcealmentAssessment(noneReduced, noneVision);
    assert.equal(result.applies, false);
    assert.equal(result.kind, "none");
    assert.equal(result.missChancePercent, 0);
  });

  it("Vision partial + efecto none -> compuesto partial 20% (valores de Vision)", () => {
    const result = composeConcealmentAssessment(noneReduced, partialVision);
    assert.equal(result.kind, "partial");
    assert.equal(result.missChancePercent, 20);
    assert.equal(result.directTargetingAllowed, true);
    assert.equal(result.requiresTargetSquare, false);
  });

  it("Vision total + efecto partial -> compuesto total (Vision domina, 50% no se suma al 20%)", () => {
    const result = composeConcealmentAssessment(partialReduced, totalVision);
    assert.equal(result.kind, "total");
    assert.equal(result.missChancePercent, 50);
    assert.equal(result.directTargetingAllowed, false);
    assert.equal(result.requiresTargetSquare, true);
  });

  it("Vision partial + Blinded total (efecto real) -> compuesto total, 50% (no 20+50=70)", () => {
    const attacker = { id: "c_attacker", name: "c_attacker", type: "player", controller: "player", hpCurrent: 10, hpMax: 10, position: { x: 0, y: 0, zFeet: 0 }, icon: "H", isStable: false, ...structuredSnapshotFields(13, 16), baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0, buffs: [], abilities: [], stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 } };
    const target = { id: "c_target", name: "c_target", type: "player", controller: "player", hpCurrent: 10, hpMax: 10, position: { x: 2, y: 0, zFeet: 0 }, icon: "H", isStable: false, ...structuredSnapshotFields(13, 16), baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0, buffs: [], abilities: [], stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 } };
    const room = {
      code: "TEST", board: { width: 10, height: 10, cellSizeFeet: 5, dimLightCells: ["2,0"] },
      combatants: [attacker, target], turnOrder: [attacker.id, target.id], activeTurnIndex: 0, round: 1,
      phase: "active", outcome: "ongoing", completedAt: null,
      currentTurn: { combatantId: attacker.id, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
      pendingOpportunityAttacks: [], log: [], activeAttackThreat: null,
      effectInstances: [{ effectId: "srd_blinded", targets: [attacker.id], source: { type: "system" }, instanceId: "eff-1", appliedAtEvent: { type: "SystemInjected", round: 1 } }],
      eventSequence: 0
    };
    const snapshot = createCombatRulesSnapshot(room);
    const snapAttacker = snapshot.combatants.find((c) => c.id === attacker.id);
    const snapTarget = snapshot.combatants.find((c) => c.id === target.id);
    const result = getConcealmentAssessment(snapshot, snapAttacker, snapTarget);
    assert.equal(result.kind, "total", "Blinded (total, incondicional) debe dominar sobre la ocultacion parcial de Vision por luz tenue.");
    assert.equal(result.missChancePercent, 50);
    assert.equal(result.directTargetingAllowed, false);
  });

  it("multiples fuentes total no suman 50%: Vision total + efecto total siguen dando 50%, no 100%", () => {
    const result = composeConcealmentAssessment(totalReduced, totalVision);
    assert.equal(result.kind, "total");
    assert.equal(result.missChancePercent, 50);
  });

  it("oportunidad de ataque bloqueada cuando la severidad compuesta es total (desde cualquier fuente)", () => {
    const fromVisionOnly = composeConcealmentAssessment(noneReduced, totalVision);
    const fromEffectOnly = composeConcealmentAssessment(totalReduced, noneVision);
    assert.equal(fromVisionOnly.opportunityAttackAllowed, false);
    assert.equal(fromEffectOnly.opportunityAttackAllowed, false);
    const fromNone = composeConcealmentAssessment(noneReduced, noneVision);
    assert.equal(fromNone.opportunityAttackAllowed, true);
  });

  it("trazas preservadas: el resultado final conserva ambos conjuntos por separado (traces de efectos y visionTraces)", () => {
    const result = composeConcealmentAssessment(partialReduced, totalVision);
    assert.equal(result.traces.length, 1);
    assert.equal(result.traces[0].effectId, "x");
    assert.equal(result.visionTraces.length, 1);
    assert.equal(result.visionTraces[0].source, "visual-path");
  });
});
