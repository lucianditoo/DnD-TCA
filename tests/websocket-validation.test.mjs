import test from "node:test";
import assert from "node:assert/strict";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";

test("comando válido aceptado", () => {
  const cmd = {
    type: "create-room",
    name: "Sala de Prueba"
  };
  const result = validateClientCommand(cmd);
  assert.equal(result.success, true);
  assert.equal(result.data.name, "Sala de Prueba");
});

test("comando con type desconocido rechazado", () => {
  const cmd = {
    type: "hack-room",
    name: "Hack"
  };
  const result = validateClientCommand(cmd);
  assert.equal(result.success, false);
  assert.match(result.error, /Tipo de comando desconocido/i);
});

test("comando con campos faltantes rechazado", () => {
  const cmd = {
    type: "join-room",
    name: "Elaen"
    // Missing roomCode and role
  };
  const result = validateClientCommand(cmd);
  assert.equal(result.success, false);
  assert.match(result.error, /roomCode: Required/i);
  assert.match(result.error, /role: Required/i);
});

test("comando con tipos incorrectos rechazado", () => {
  const cmd = {
    type: "resolve-attack",
    roomCode: "XYZ",
    actorId: "elaen",
    attackerId: "elaen",
    targetId: "orco",
    d20Roll: "quince", // Should be number
    damage: 8,
    isFullAttack: false
  };
  const result = validateClientCommand(cmd);
  assert.equal(result.success, false);
  assert.match(result.error, /d20Roll: Expected number, received string/i);
});

test("comando malicioso/extraño con campos inyectados no llega al handler (se filtran campos sobrantes)", () => {
  const cmd = {
    type: "create-room",
    name: "Sala",
    maliciousField: "hack"
  };
  const result = validateClientCommand(cmd);
  assert.equal(result.success, true);
  // Zod strip removes unrecognized keys by default
  assert.equal(result.data.maliciousField, undefined);
});

test("resolve-special-maneuver acepta solo la intención y tiradas acotadas", () => {
  const valid = validateClientCommand({
    type: "resolve-special-maneuver",
    roomCode: "XYZ",
    actorId: "hero-owner",
    maneuver: { type: "trip", attackerId: "hero", targetId: "enemy", d20TouchRoll: 12, d20OpposedRoll: 17 }
  });
  assert.equal(valid.success, true);

  const injected = validateClientCommand({
    type: "resolve-special-maneuver",
    roomCode: "XYZ",
    actorId: "hero-owner",
    maneuver: {
      type: "trip",
      attackerId: "hero",
      targetId: "enemy",
      d20TouchRoll: 12,
      d20OpposedRoll: 17,
      targetAcType: "normal"
    }
  });
  assert.equal(injected.success, false, "El schema estricto debe rechazar conclusiones mecánicas inyectadas.");
});
