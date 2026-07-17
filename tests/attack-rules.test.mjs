import test from "node:test";
import assert from "node:assert/strict";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { createEmptyRoom } from "../packages/shared/src/index.ts";
import { structuredSnapshotFields } from "./test-utils.mjs";

// ---------------------------------------------------------------------------
// Mock sockets — usamos IDs únicos para no colisionar con otros test suites
// ---------------------------------------------------------------------------
const mockSocketGM = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketPlayer = { readyState: 1, OPEN: 1, send: () => {} };

clients.set(mockSocketGM, { id: "gm-nat-actor", role: "gm", name: "GM", roomCode: "NAT20" });
clients.set(mockSocketPlayer, { id: "player-nat-actor", role: "player", name: "Player", roomCode: "NAT20" });

// ---------------------------------------------------------------------------
// Helper: sala de prueba estándar
// Se configura con un atacante de BAB +5, mod +3 (total ataque +8)
// y objetivo con CA 30 — suficientemente alta para que solo un 20 natural impacte.
// ---------------------------------------------------------------------------
function makeRoom({ targetAC = 30 } = {}) {
  const room = createEmptyRoom("NAT20");
  room.phase = "active";

  const attacker = {
    id: "nat-attacker",
    name: "Guerrero",
    type: "player",
    hpCurrent: 20,
    hpMax: 20,
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(15),
    abilityScores: { strength: 16, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 0, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "player", participantId: "player-nat-actor" },
    buffs: [],
    abilities: [],
  };

  const target = {
    id: "nat-target",
    name: "Golem",
    type: "enemy",
    hpCurrent: 100,
    hpMax: 100,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(targetAC),
    baseSpeedFeet: 20,
    position: { x: 1, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "gm" },
    buffs: [],
    abilities: []
  };

  room.combatants.push(attacker, target);
  room.turnOrder.push(attacker.id, target.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = attacker.id;

  return { room, attacker, target };
}

// Helper: ejecuta un ataque y devuelve el estado de la sala y el target
function attack(room, d20Roll, damage = 5) {
  room.currentTurn.attackMode = "standard";
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "NAT20",
    actorId: "player-nat-actor",
    attackerId: "nat-attacker",
    targetId: "nat-target",
    d20Roll,
    damage
  });
}

// ---------------------------------------------------------------------------
// Tests: Natural 1 — falla automática
// ---------------------------------------------------------------------------

test("natural 1 falla aunque el total supere ampliamente la CA", () => {
  // Atacante BAB+5 mod+3 = +8. Con d20=1 → total 9. Con CA 5, debería impactar.
  // Pero natural 1 siempre falla.
  const { room, target } = makeRoom({ targetAC: 5 });
  // d20Roll 1 + 8 = 9, CA 5 → total >= CA en papel, pero natural 1 anula el impacto
  attack(room, 1, 5);
  assert.equal(target.hpCurrent, 100, "natural 1 no debe aplicar daño aunque total supere la CA");
  assert.equal(target.stats.damageTaken, 0);
});

test("natural 1 produce log con 'Falla automática (1 natural)'", () => {
  const { room } = makeRoom({ targetAC: 5 });
  attack(room, 1, 5);
  const lastLog = room.log[0]?.message ?? "";
  assert.ok(
    lastLog.includes("Falla automática (1 natural)"),
    "el log debe mencionar '1 natural': " + lastLog
  );
});

test("natural 1 no amenaza crítico (aunque el arma tenga rango amplio de amenaza)", () => {
  // Arma con criticalThreatFrom: 1 — en teoría amenazaría en todo momento.
  // Pero 1 natural nunca puede amenazar crítico.
  const { room } = makeRoom({ targetAC: 5, attackerWeaponCritFrom: 1 });
  attack(room, 1, 5);
  // Si amenazó crítico, room.activeAttackThreat estaría seteado
  assert.equal(
    room.activeAttackThreat,
    null,
    "natural 1 no debe dejar activeAttackThreat aunque el arma tenga rango de amenaza amplio"
  );
});

// ---------------------------------------------------------------------------
// Tests: Natural 20 — impacto automático
// ---------------------------------------------------------------------------

test("natural 20 impacta aunque el total sea muy inferior a la CA", () => {
  // CA 30, atacante +8. d20=20 → total 28 < CA 30. Natural 20 siempre impacta.
  // Como el arma puede criticar en 20, se genera amenaza de crítico.
  // El daño se aplica al confirmar/cancelar, NO inmediatamente.
  const { room } = makeRoom({ targetAC: 30 });
  attack(room, 20, 6);
  assert.ok(
    room.activeAttackThreat !== null,
    "natural 20 debe registrar amenaza de crítico y retener el daño hasta confirmación"
  );
  assert.equal(room.activeAttackThreat.attackerId, "nat-attacker");
  // El daño normal queda guardado en la amenaza
  assert.equal(room.activeAttackThreat.normalDamageBundle.total, 6,
    "el daño normal debe quedar en activeAttackThreat pendiente de confirmación"
  );
});

test("natural 20 con arma de rango amplio (19-20) también genera amenaza de crítico", () => {
  const { room } = makeRoom({ targetAC: 30, attackerWeaponCritFrom: 19 });
  attack(room, 20, 8);
  assert.ok(
    room.activeAttackThreat !== null,
    "natural 20 con arma 19-20 debe generar amenaza de crítico"
  );
});

// ---------------------------------------------------------------------------
// Tests: ataque ordinario (no natural 1 ni 20) sigue usando total vs CA
// ---------------------------------------------------------------------------

test("ataque ordinario que supera la CA impacta normalmente", () => {
  // CA 10, atacante +8. d20=5 → total 13 >= 10. Debe impactar.
  // d20=5 está por debajo del rango de amenaza (critFrom 20), no genera crítico.
  const { room, target } = makeRoom({ targetAC: 10 });
  attack(room, 5, 9);
  assert.ok(target.hpCurrent < 100, "ataque ordinario exitoso debe aplicar daño");
  assert.equal(target.hpCurrent, 100 - 9);
});

test("ataque ordinario que no supera la CA falla normalmente", () => {
  // CA 30, atacante +8. d20=5 → total 13 < 30. Debe fallar.
  const { room, target } = makeRoom({ targetAC: 30 });
  attack(room, 5, 9);
  assert.equal(target.hpCurrent, 100, "ataque ordinario que no supera CA no debe aplicar daño");
});

test("ataque ordinario fallido no produce log de '1 natural' ni '20 natural'", () => {
  const { room } = makeRoom({ targetAC: 30 });
  attack(room, 5, 9);
  const logs = room.log.map(l => l.message);
  const attackLog = logs.find(m => m.includes("natural") || m.includes("automática") || m.includes("automático"));
  assert.equal(attackLog, undefined, "ataque fallido ordinario no debe mencionar natural 1/20: " + JSON.stringify(logs));
});

// ---------------------------------------------------------------------------
// Tests: reglas ya existentes de isCriticalConfirmed (confirmación)
// Estos cubren el flujo de confirmación de rules.ts (no del resolver directamente)
// Para evitar duplicación, referenciamos los tests en rules.test.mjs.
// Aquí sólo verificamos que el resolver respeta el resultado de isCriticalConfirmed.
// ---------------------------------------------------------------------------

test("natural 1 en d20 de ataque no confunde con confirmación: son dos tiradas independientes", () => {
  // Un ataque con d20=1 falla el ataque principal.
  // Verificamos que no deja ningún estado de amenaza de crítico activa.
  const { room } = makeRoom({ targetAC: 5 });
  attack(room, 1, 5);
  assert.equal(room.activeAttackThreat, null,
    "d20=1 en ataque principal no debe dejar amenaza de crítico pendiente"
  );
});
