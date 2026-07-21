import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogCombatant, createEmptyRoom } from "../packages/shared/dist/index.js";
import { handleResolveAbilityAttack } from "../apps/server/src/commands/abilityCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";

const actorId = "player-sprint011";
const socket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(socket, { id: actorId, role: "player", name: "Flanking Tester", roomCode: "FLANK11" });

function createFlankingRoom(code) {
  const room = createEmptyRoom(code);
  const caster = createCatalogCombatant("bane", "heroes", 1, { type: "player", participantId: actorId });
  const ally = createCatalogCombatant("cedrick", "heroes", 1, { type: "gm" });
  const target = createCatalogCombatant("canocrock", "enemies", 1, { type: "gm" });
  caster.featureIds = [];
  caster.sneakAttackDice = 0;
  caster.position = { x: 1, y: 0, zFeet: 0 };
  target.position = { x: 1, y: 1, zFeet: 0 };
  ally.position = { x: 1, y: 2, zFeet: 0 };
  room.combatants.push(caster, ally, target);
  room.turnOrder.push(caster.id, ally.id, target.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = caster.id;
  room.phase = "active";
  return { room, caster, target };
}

test("Sprint 011: Shocking Grasp recibe el +2 de flanqueo en el pipeline autoritativo", () => {
  const { room, caster, target } = createFlankingRoom("FLANK11");

  handleResolveAbilityAttack(room, {
    type: "resolve-ability-attack",
    roomCode: room.code,
    actorId,
    casterId: caster.id,
    targetId: target.id,
    abilityId: "shocking-grasp",
    d20Roll: 2,
    damage: 2
  });

  assert.equal(target.hpCurrent, 57, "d20 2 + ataque 8 + flanqueo 2 = 12: impacta Touch 11");
  const attackLog = room.log.find((entry) => entry.kind === "attack")?.message ?? "";
  assert.match(attackLog, /\+ ataque 10/);
  assert.match(attackLog, /flanqueo \+2/);
  assert.doesNotMatch(attackLog, /defensiva \+2/);
});

test("Sprint 011: Ray of Frost nunca recibe el +2 aunque exista oposición geométrica", () => {
  const { room, caster, target } = createFlankingRoom("FLANK11-RAY");

  handleResolveAbilityAttack(room, {
    type: "resolve-ability-attack",
    roomCode: room.code,
    actorId,
    casterId: caster.id,
    targetId: target.id,
    abilityId: "ray-of-frost",
    d20Roll: 2,
    damage: 2
  });

  // Actualizado en Sprint 042.5: este escenario (aliado del lanzador adyacente al objetivo, ver
  // createFlankingRoom) hace que el objetivo esté enzarzado en cuerpo a cuerpo con ese aliado. Por
  // RAW (combat/06_ataques.txt:58, Rule ID ATK-RANGED-INTO-MELEE, agregado en un sprint posterior a
  // este test) un ataque de toque a distancia contra un blanco así sufre el mismo penalizador -4
  // "disparo a melé" que un arma arrojadiza/de proyectil — el helper compartido
  // getRangedIntoMeleeAssessment (vía getAttackContextModifiers) lo aplica sin código extra en el
  // pipeline de conjuros (docs/designs/ranged-into-melee-penalty.md, ver "Regla de Tres"). Esto es
  // ortogonal al flanqueo: el bono de flanqueo (+2) sigue sin aplicarse jamás a ranged, que es lo
  // que este test verifica. Con el penalizador, el ataque total pasa de 12 a 8 y falla contra Touch
  // CA 11 (antes impactaba); el test original (Sprint 011, previo a ATK-RANGED-INTO-MELEE) esperaba
  // los números de antes de que existiera ese penalizador.
  assert.equal(target.hpCurrent, 59, "d20 2 + BAB 6 + DEX 4 - 4 (disparo a melé) = 8: falla contra Touch 11, sin bono de flanqueo ni daño aplicado");
  const attackLog = room.log.find((entry) => entry.kind === "attack")?.message ?? "";
  assert.match(attackLog, /\+ ataque 6\b/);
  assert.match(attackLog, /disparo a mel.* -4/);
  assert.doesNotMatch(attackLog, /flanqueo/);
});
