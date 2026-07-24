import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  createEmptyRoom,
  getAttackLineInterception,
  getAttackContextModifiers,
  threatensTarget
} from "../packages/shared/dist/index.js";
import { resolveAttack } from "../apps/server/src/combat/attackResolver.ts";
import { inventoryEquipment } from "./test-utils.mjs";

const NO_COVER = { applies: false, acBonus: 0, kind: "none", blockerIds: [] };

function setupRoom() {
  const room = createEmptyRoom("COVER_REACH");
  const hero = {
    id: "hero-1",
    name: "hero-1",
    type: "player",
    hpCurrent: 10,
    hpMax: 10,
    isStable: false,
    position: { x: 0, y: 0, zFeet: 0 },
    ...inventoryEquipment(null, { armorCatalogId: "leather" }),
    baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    creatureTypeId: "humanoid",
    featureIds: [],
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    buffs: [],
    ruleTraits: [],
    // Sprint 042: campo requerido desde Sprint 035 (Dodge/Mobility) por FeatCatalog.hasFeat dentro
    // de totalArmorClass. Su ausencia aquí era la causa raíz del fallo pre-existente de este mismo
    // archivo ("Cobertura Viva", ver PROJECT_MEMORY.md / gate de Sprint 041, DT no numerada) —
    // corregido como parte de este sprint, no una regresión introducida por Cover.
    featIds: []
  };

  const ally = { ...hero, id: "ally-1", name: "ally-1" };
  const enemy = { ...hero, id: "enemy-1", name: "enemy-1", type: "monster" };

  room.combatants = [hero, ally, enemy];
  return { room, hero, ally, enemy };
}

test("Alcance (Longspear Reach) asegura amenaza a 10 ft pero no a 5 ft", () => {
  const { room, hero, enemy } = setupRoom();

  // Equip longspear (reach weapon for medium size: minReach: 5, maxReach: 10)
  Object.assign(hero, inventoryEquipment("longspear", { armorCatalogId: "leather" }));

  // Enemy at 5 ft (adjacent)
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 1, y: 0, zFeet: 0 }; // distance = 5

  assert.equal(threatensTarget(room, hero, enemy), false, "Longspear no debe amenazar a 5 pies");

  // Enemy at 10 ft
  enemy.position = { x: 2, y: 0, zFeet: 0 }; // distance = 10
  assert.equal(threatensTarget(room, hero, enemy), true, "Longspear debe amenazar a 10 pies");
});

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 042 — Cover (Cobertura). Geometría pura de intercepción.
// ─────────────────────────────────────────────────────────────────────────────

test("getAttackLineInterception: obstaculo inexistente no produce bloqueadores", () => {
  const { room, hero, enemy } = setupRoom();
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };
  // Sin combatientes interpuestos y sin board.impassableCells.
  room.combatants = [hero, enemy];

  const interception = getAttackLineInterception(room, hero, enemy);
  assert.deepEqual(interception.creatureBlockerIds, []);
});

test("getAttackLineInterception: criatura interpuesta produce creature-cover (Cobertura Viva, Sprint 013)", () => {
  const { room, hero, ally, enemy } = setupRoom();

  // hero at (0,0), ally at (1,0), enemy at (2,0)
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };

  const interception = getAttackLineInterception(room, hero, enemy);
  assert.deepEqual(interception.creatureBlockerIds, [ally.id]);

  const acWithoutCover = Rules.totalArmorClass(room, enemy, { attackType: "ranged" });
  const cover = getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.cover;
  assert.equal(cover.applies, true);
  assert.equal(cover.kind, "creature-cover");
  const acWithCover = Rules.totalArmorClass(room, enemy, { attackType: "ranged", cover });

  assert.equal(acWithCover.total, acWithoutCover.total + 4, "La cobertura debe dar +4 a la CA");
  assert.ok(acWithCover.parts.some((p) => p.includes("cobertura +4")), "Debe incluir 'cobertura +4' en las partes");
});

test("getAttackLineInterception: impassableCells YA NO produce ningun bloqueador de Cover (Sprint 052B, corrige la contradiccion de Sprint 052A)", () => {
  const { room, hero, enemy } = setupRoom();
  room.combatants = [hero, enemy];
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };
  // "1,0" es geometricamente interior a la linea hero->enemy, pero impassableCells es
  // exclusivamente bloqueo de MOVIMIENTO desde Sprint 052B: Cover ya no lo consulta.
  room.board = { ...room.board, impassableCells: ["1,0"] };

  const interception = getAttackLineInterception(room, hero, enemy);
  assert.deepEqual(interception.creatureBlockerIds, [], "impassableCells no debe aparecer como bloqueador de Cover.");
  assert.deepEqual(getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.cover, NO_COVER);
});

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 042 — Cover consolidado en getAttackContextModifiers (única sede autorizada).
// ─────────────────────────────────────────────────────────────────────────────

test("Obstaculo de casilla completa (impassableCells) ya no aumenta la CA en ataques a distancia (Sprint 052B)", () => {
  const { room, hero, enemy } = setupRoom();
  room.combatants = [hero, enemy];
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };
  room.board = { ...room.board, impassableCells: ["1,0"] };

  const modifiers = getAttackContextModifiers(room, hero, enemy);
  const rangedCover = modifiers.byAttackType.ranged.cover;
  assert.deepEqual(rangedCover, NO_COVER, "impassableCells ya no produce Cover — esa obstruccion es responsabilidad de Line of Effect/Total Cover.");

  const acWithout = Rules.totalArmorClass(room, enemy, { attackType: "ranged" });
  const acWith = Rules.totalArmorClass(room, enemy, { attackType: "ranged", cover: rangedCover });
  assert.equal(acWith.total, acWithout.total);
});

test("Sin bloqueador, Cover no aplica y no cambia la CA", () => {
  const { room, hero, enemy } = setupRoom();
  room.combatants = [hero, enemy];
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };

  const modifiers = getAttackContextModifiers(room, hero, enemy);
  assert.deepEqual(modifiers.byAttackType.melee.cover, NO_COVER);
  assert.deepEqual(modifiers.byAttackType.ranged.cover, NO_COVER);

  const acWithout = Rules.totalArmorClass(room, enemy, { attackType: "ranged" });
  const acWithNoCover = Rules.totalArmorClass(room, enemy, { attackType: "ranged", cover: modifiers.byAttackType.ranged.cover });
  assert.equal(acWithNoCover.total, acWithout.total);
});

test("Obstaculo de casilla completa (impassableCells) ya no afecta melee con alcance (Sprint 052B)", () => {
  const { room, hero, enemy } = setupRoom();
  room.combatants = [hero, enemy];
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };
  room.board = { ...room.board, impassableCells: ["1,0"] };

  const meleeCover = getAttackContextModifiers(room, hero, enemy).byAttackType.melee.cover;
  assert.deepEqual(meleeCover, NO_COVER, "impassableCells ya no concede cobertura a ningun tipo de ataque.");
});

test("Cover por criatura interpuesta SI afecta ataques cuerpo a cuerpo (preserva comportamiento de Sprint 013)", () => {
  const { room, hero, ally, enemy } = setupRoom();
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };

  const meleeCover = getAttackContextModifiers(room, hero, enemy).byAttackType.melee.cover;
  assert.equal(meleeCover.applies, true, "Cobertura por criatura interpuesta no discrimina por tipo de ataque (comportamiento preexistente, sin cambios).");
  assert.equal(meleeCover.kind, "creature-cover");
});

test("Flanqueo sigue funcionando de forma independiente de Cover", () => {
  const { room, hero, ally, enemy } = setupRoom();
  // Flanqueo clasico: hero y ally en caras opuestas del enemigo.
  enemy.position = { x: 1, y: 1, zFeet: 0 };
  hero.position = { x: 1, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 2, zFeet: 0 };
  Object.assign(hero, inventoryEquipment("longsword", { armorCatalogId: "leather" }));
  Object.assign(ally, inventoryEquipment("longsword", { armorCatalogId: "leather" }));
  // Un obstaculo de mapa ajeno a la linea hero->enemy no debe interferir con el flanqueo.
  room.board = { ...room.board, impassableCells: ["5,5"] };

  const modifiers = getAttackContextModifiers(room, hero, enemy);
  assert.equal(modifiers.flanking, true);
  assert.equal(modifiers.byAttackType.melee.attackBonus, 2, "El flanqueo +2 no debe verse afectado por la infraestructura de Cover.");
  assert.deepEqual(modifiers.byAttackType.melee.cover, NO_COVER);
});

test("Criatura interpuesta y obstaculo de casilla (irrelevante desde Sprint 052B) conservan evidencia solo de la criatura", () => {
  const { room, hero, ally, enemy } = setupRoom();
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 3, y: 0, zFeet: 0 };
  // "2,0" ya no aporta nada a Cover (Sprint 052B) — se conserva aqui para probar que su
  // presencia simultanea con una criatura interpuesta no cambia el resultado.
  room.board = { ...room.board, impassableCells: ["2,0"] };

  const cover = getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.cover;
  assert.equal(cover.acBonus, 4, "Dos fuentes de Cover nunca deben sumar +8.");
  assert.deepEqual(cover.blockerIds, [ally.id]);
  const base = Rules.totalArmorClass(room, enemy, { attackType: "ranged" });
  const protectedAc = Rules.totalArmorClass(room, enemy, { attackType: "ranged", cover });
  assert.equal(protectedAc.total, base.total + 4);
  assert.equal(protectedAc.parts.filter((part) => part === "cobertura +4").length, 1);
});

test("Footprints Large y orden del snapshot producen la misma intercepcion determinista", () => {
  const { room, hero, ally, enemy } = setupRoom();
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 3, y: 0, zFeet: 0 };
  enemy.sizeCategory = "large";

  const first = getAttackLineInterception(room, hero, enemy);
  room.combatants = [enemy, ally, hero];
  const reordered = getAttackLineInterception(room, hero, enemy);
  assert.deepEqual(first, { creatureBlockerIds: [ally.id] });
  assert.deepEqual(reordered, first);
  assert.deepEqual(getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.cover.blockerIds, [ally.id]);
});

test("Touch ranged consume el mismo Cover y el resolver lo aplica exactamente una vez", () => {
  const { room, hero, ally, enemy } = setupRoom();
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };
  const cover = getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.cover;
  const concealment = getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.concealment;
  const source = {
    name: "rayo de prueba",
    attackType: "ranged",
    targetAcType: "touch",
    abilityForAttack: "dexterity",
    maxRangeFeet: 30,
    criticalThreatFrom: 20,
    criticalMultiplier: 2,
    defaultDamage: 1
  };

  const withoutCover = resolveAttack(room, hero, enemy, 10, 1, source.name, 0, { source, concealment });
  const withCover = resolveAttack(room, hero, enemy, 10, 1, source.name, 0, { source, cover, concealment });
  assert.equal(withCover.targetArmorClass, withoutCover.targetArmorClass + 4);
  assert.equal(withCover.acParts.filter((part) => part === "cobertura +4").length, 1);

  const weaponSource = { ...source, name: "arco de prueba", targetAcType: "normal" };
  const weaponWithoutCover = resolveAttack(room, hero, enemy, 10, 1, weaponSource.name, 0, { source: weaponSource, concealment });
  const weaponWithCover = resolveAttack(room, hero, enemy, 10, 1, weaponSource.name, 0, { source: weaponSource, cover, concealment });
  assert.equal(weaponWithCover.targetArmorClass, weaponWithoutCover.targetArmorClass + 4, "El ataque de arma ranged consume el mismo Cover.");
  assert.equal(weaponWithCover.acParts.filter((part) => part === "cobertura +4").length, 1);
  assert.deepEqual(getAttackContextModifiers(room, hero, enemy).byAttackType.ranged.cover, cover, "Preview y resolución comparten el mismo assessment.");
});

test("Cover se recalcula bajo demanda: no persiste en CombatRoom ni muta el snapshot", () => {
  const { room, hero, ally, enemy } = setupRoom();
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };

  const before = JSON.stringify(room);
  const first = getAttackContextModifiers(room, hero, enemy);
  const after = JSON.stringify(room);
  assert.equal(after, before, "getAttackContextModifiers no debe mutar CombatRoom.");
  assert.ok(!("cover" in room), "Cover jamas se persiste como campo de CombatRoom.");
  assert.ok(!room.combatants.some((c) => "cover" in c), "Cover jamas se persiste en un combatiente.");

  const second = getAttackContextModifiers(room, hero, enemy);
  assert.deepEqual(second, first, "Recalculada bajo demanda, la evaluacion es determinista para el mismo snapshot.");
});
