import test from "node:test";
import assert from "node:assert/strict";
import { Rules, canRun, runSpeedMultiplier, runSpeedBudgetFeet, buildStraightPath, FeatCatalog, createCombatRulesSnapshot } from "../packages/shared/dist/index.js";
import { makeTestCombatant, makeTestRoom, inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// MOVE-RUN — capa pura compartida (NDD docs/designs/run-design.md).
// Decisiones cerradas por PROCEED (Sprint 041):
// D-1: sin AdO adicional artificial, se reutiliza la generacion normal por camino.
// D-2: resistencia multi-asalto fuera de alcance (sin estado persistente nuevo).
// D-3: se reutiliza NO_DEX_TO_AC (suprime Destreza Y Esquiva juntos, simplificacion documentada).
// D-4: vision/Cegado diferido (sin heuristicas parciales).
// D-5: dote de Correr en esta slice via FeatCatalog.runContribution.
// ─────────────────────────────────────────────────────────────────────────────

function turnState(patch = {}) {
  return {
    combatantId: "runner", movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false,
    usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false,
    usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false,
    ...patch
  };
}

function makeRunner(overrides = {}) {
  return makeTestCombatant({
    id: "runner", name: "Corredor", position: { x: 2, y: 2, zFeet: 0 },
    ...inventoryEquipment("longsword"),
    ...overrides
  });
}

function snapshotFor(combatants, roomOverrides = {}) {
  const room = makeTestRoom({ combatants, currentTurn: turnState(), ...roomOverrides });
  return createCombatRulesSnapshot(room);
}

// ── canRun: gate puro ───────────────────────────────────────────────────────

test("R-U1: canRun acepta un combatiente sin restricciones al inicio del turno", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner]);
  assert.equal(canRun(snapshot, runner).ok, true);
});

test("R-U2: canRun rechaza si ya hubo movimiento este turno (movementUsedFeet > 0)", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], { currentTurn: turnState({ movementUsedFeet: 5 }) });
  assert.equal(canRun(snapshot, runner).ok, false);
});

test("R-U3: canRun rechaza si ya se uso la accion de movimiento (usedMoveAction)", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], { currentTurn: turnState({ usedMoveAction: true }) });
  assert.equal(canRun(snapshot, runner).ok, false);
});

test("R-U4: canRun rechaza si ya se uso el paso de 5 pies este turno", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], { currentTurn: turnState({ usedFiveFootStep: true }) });
  assert.equal(canRun(snapshot, runner).ok, false);
});

test("R-U5: canRun rechaza si ya se uso la accion estandar este turno", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], { currentTurn: turnState({ usedStandardAction: true }) });
  assert.equal(canRun(snapshot, runner).ok, false);
});

test("R-U6: canRun rechaza si ya se consumio una accion de asalto completo este turno", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], { currentTurn: turnState({ usedFullAttack: true }) });
  assert.equal(canRun(snapshot, runner).ok, false);
});

test("R-U7: canRun rechaza a un combatiente Disabled (0 HP) — ninguna variante limitada existe para Correr", () => {
  const runner = makeRunner({ hpCurrent: 0 });
  const snapshot = snapshotFor([runner]);
  const result = canRun(snapshot, runner);
  assert.equal(result.ok, false);
  assert.match(result.error, /asalto completo/);
});

test("R-U8: canRun rechaza si el combatiente esta Fatigado (FORBID_RUN via ruleOverrides)", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], {
    effectInstances: [{
      instanceId: "fatigue-1", effectId: "srd_fatigued", source: { type: "system" },
      targets: ["runner"], appliedAtEvent: { type: "SystemInjected", round: 1 }
    }]
  });
  const result = canRun(snapshot, runner);
  assert.equal(result.ok, false);
  assert.match(result.error, /no puede correr/);
});

test("R-U9: canRun no se ve afectado por otros efectos sin FORBID_RUN (regresion: Desprevenido no bloquea Correr)", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner], {
    effectInstances: [{
      instanceId: "ff-1", effectId: "srd_flat_footed", source: { type: "system" },
      targets: ["runner"], appliedAtEvent: { type: "SystemInjected", round: 1 }
    }]
  });
  assert.equal(canRun(snapshot, runner).ok, true);
});

// ── Presupuesto de movimiento ×4/×3 ──────────────────────────────────────────

test("R-U10: runSpeedMultiplier es ×4 sin armadura o con armadura ligera/media", () => {
  const noArmor = makeRunner();
  assert.equal(runSpeedMultiplier(noArmor), 4);
  const light = makeRunner(inventoryEquipment("longsword", { armorCatalogId: "leather" }));
  assert.equal(runSpeedMultiplier(light), 4);
  const medium = makeRunner(inventoryEquipment("longsword", { armorCatalogId: "chainmail" }));
  assert.equal(runSpeedMultiplier(medium), 4);
});

test("R-U11: runSpeedMultiplier es ×3 con armadura pesada", () => {
  const heavy = makeRunner(inventoryEquipment("longsword", { armorCatalogId: "banded_mail" }));
  assert.equal(runSpeedMultiplier(heavy), 3);
});

test("R-U12: runSpeedBudgetFeet se calcula sobre la velocidad efectiva ya resuelta (no la base cruda)", () => {
  const runner = makeRunner();
  const snapshot = snapshotFor([runner]);
  assert.equal(Rules.totalSpeedFeet(snapshot, runner), 30, "Precondicion: velocidad base sin modificadores.");
  assert.equal(runSpeedBudgetFeet(snapshot, runner), 120, "30 x 4 = 120 pies.");
});

test("R-U13: runSpeedBudgetFeet con armadura pesada aplica ×3 sobre la velocidad ya reducida por la armadura", () => {
  const heavy = makeRunner(inventoryEquipment("longsword", { armorCatalogId: "banded_mail" }));
  const snapshot = snapshotFor([heavy]);
  assert.equal(Rules.totalSpeedFeet(snapshot, heavy), 20, "Precondicion: banded_mail reduce 30 -> 20.");
  assert.equal(runSpeedBudgetFeet(snapshot, heavy), 60, "20 x 3 = 60 pies (no 30 x 3 = 90).");
});

// ── Geometria de linea recta (reutilizada de Carga, ahora expuesta en shared) ─

test("R-U14: buildStraightPath construye una ruta horizontal valida", () => {
  const path = buildStraightPath({ x: 2, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 });
  assert.deepEqual(path, [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 }]);
});

test("R-U15: buildStraightPath construye una ruta diagonal valida (45 grados)", () => {
  const path = buildStraightPath({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 });
  assert.deepEqual(path, [{ x: 1, y: 1, zFeet: 0 }, { x: 2, y: 2, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 }]);
});

test("R-U16: buildStraightPath rechaza un destino que no esta en linea recta (ni ortogonal ni 45 grados)", () => {
  const path = buildStraightPath({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 });
  assert.equal(path, null, "dx=3, dy=1: no es horizontal, vertical ni diagonal de 45 grados.");
});

test("R-U17: buildStraightPath rechaza el mismo origen y destino (sin desplazamiento)", () => {
  const path = buildStraightPath({ x: 2, y: 2, zFeet: 0 }, { x: 2, y: 2, zFeet: 0 });
  assert.equal(path, null);
});

// ── Dote de Correr (D-5): FeatCatalog.runContribution ────────────────────────

test("R-U18: sin dotes, runContribution no conserva Destreza al correr", () => {
  assert.equal(FeatCatalog.runContribution([]).keepsDexBonusWhileRunning, false);
});

test("R-U19: con la dote de Correr (srd_run), runContribution conserva Destreza al correr", () => {
  assert.equal(FeatCatalog.runContribution(["srd_run"]).keepsDexBonusWhileRunning, true);
});

test("R-U20: dotes no relacionadas no activan la contribucion de Correr", () => {
  assert.equal(FeatCatalog.runContribution(["srd_dodge", "srd_mobility"]).keepsDexBonusWhileRunning, false);
});

test("R-U21: srd_run esta catalogado y es recuperable por id", () => {
  const def = FeatCatalog.get("srd_run");
  assert.ok(def, "La dote de Correr debe existir en el catalogo declarativo.");
  assert.equal(def.runRules?.keepsDexBonusWhileRunning, true);
});
