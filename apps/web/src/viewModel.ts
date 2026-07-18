import {
  calculatePathCostFeet,
  calculatePathStepCostsFeet,
  createCombatRulesSnapshot,
  distanceBetweenFootprintsFeet,
  distanceFeet,
  getCombatantOccupiedCells,
  lifeStatus,
  Rules,
  validateMovePath,
  averageWeaponDamageForCombatant,
  resolveEquippedWeaponProfile,
  type Buff,
  type CombatRoom,
  type CombatRulesSnapshot,
  type Combatant,
  type Participant,
  type Position,
  type ProductionEffectId
} from "@dnd-tactical/shared";


export type ActionMode = "inspect" | "move" | "attack" | "ability" | "tactics";
export type TacticMode = "total-defense" | "charge" | "aid-another" | "trip" | "bull-rush" | "grapple" | "grapple-escape" | "stand-up";

export function phaseLabel(phase: CombatRoom["phase"]): string {
  if (phase === "preparation") return "Preparacion";
  if (phase === "active") return "En curso";
  return "Terminado";
}

export function cellKey(position: Pick<Position, "x" | "y">): string {
  return position.x + "," + position.y;
}

function occupiedCellKey(position: Pick<Position, "x" | "y" | "zFeet">): string {
  return `${position.x},${position.y},${position.zFeet ?? 0}`;
}

function isFootprintInsideBoard(snapshot: CombatRulesSnapshot<ProductionEffectId>, combatant: Combatant, position: Position): boolean {
  return getCombatantOccupiedCells({ ...combatant, position: { ...position } }, snapshot)
    .every((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < snapshot.board.width && cell.y < snapshot.board.height);
}

export function isCombatantDestinationOccupied(
  room: CombatRoom,
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  position: Position
): boolean {
  const candidateKeys = new Set(getCombatantOccupiedCells({ ...combatant, position: { ...position } }, snapshot).map(occupiedCellKey));
  return room.combatants.some((other) =>
    other.id !== combatant.id &&
    lifeStatus(other) !== "dead" &&
    getCombatantOccupiedCells(other, snapshot).some((cell) => candidateKeys.has(occupiedCellKey(cell)))
  );
}

function isFootprintPreviewLegal(
  room: CombatRoom,
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  position: Position
): boolean {
  if (!isFootprintInsideBoard(snapshot, combatant, position)) return false;
  const cells = getCombatantOccupiedCells({ ...combatant, position: { ...position } }, snapshot);
  if (cells.some((cell) => snapshot.board.impassableCells?.includes(`${cell.x},${cell.y}`))) return false;
  return !isCombatantDestinationOccupied(room, snapshot, combatant, position);
}

export function getHighlightedCells(room: CombatRoom | null, snapshot: import("@dnd-tactical/shared").CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId> | null, selected: Combatant | null, mode: ActionMode, abilityId: string, movementPath: Position[], withdrawArmed: boolean = false): Map<string, string> {
  const cells = new Map<string, string>();
  if (!room || !selected || mode === "inspect" || mode === "tactics") return cells;
  const activeSnapshot = snapshot ?? createCombatRulesSnapshot(room);

  const selectedAbility = selected.abilities.find((ability) => ability.id === abilityId) ?? selected.abilities[0] ?? null;
  const weapon = resolveEquippedWeaponProfile(selected).profile;
  // MOVE-WITHDRAW: preview presentacional con presupuesto 2x (1x si Disabled — retirada
  // limitada RAW). La legalidad final la decide siempre el servidor autoritativo.
  const withdrawFactor = withdrawArmed && room.phase === "active" ? (lifeStatus(selected) === "disabled" ? 1 : 2) : 1;
  const maxDistance =
    mode === "move"
      ? room.phase === "preparation" ? Number.POSITIVE_INFINITY : Math.max(0, Rules.totalSpeedFeet(snapshot!, selected) * withdrawFactor - room.currentTurn.movementUsedFeet)
      : mode === "attack"
        ? weapon.maxRangeFeet || room.board.cellSizeFeet
        : selectedAbility?.rangeFeet ?? 0;

  for (let y = 0; y < room.board.height; y += 1) {
    for (let x = 0; x < room.board.width; x += 1) {
      const position = { x, y, zFeet: selected.position.zFeet };
      const distance = Math.min(...getCombatantOccupiedCells(selected, activeSnapshot).map((origin) => distanceFeet(origin, position, room.board.cellSizeFeet)));

      if (mode === "move") {
        if (room.phase === "preparation") {
          if (isFootprintPreviewLegal(room, activeSnapshot, selected, position)) cells.set(cellKey(position), " move-highlight");
        } else if (isLegalNextPathStep(room, selected, movementPath, position, maxDistance)) {
          cells.set(cellKey(position), " move-highlight");
        }
        continue;
      }

      if (mode === "attack") {
        const meleeReach = weapon.meleeReachFeet || room.board.cellSizeFeet;
        if (distance > 0 && distance <= meleeReach) cells.set(cellKey(position), " attack-highlight");
        else if (distance > meleeReach && distance <= maxDistance) cells.set(cellKey(position), " ranged-highlight");
        continue;
      }

      if (mode === "ability" && selectedAbility) {
        if (selectedAbility.target === "self" && distance === 0) cells.set(cellKey(position), " ability-highlight");
        else if (distance > 0 && distance <= maxDistance) cells.set(cellKey(position), " ability-highlight");
      }
    }
  }

  return cells;
}

export function getGmMoveHighlightedCells(room: CombatRoom | null, snapshot: CombatRulesSnapshot<ProductionEffectId> | null, target: Combatant | null): Map<string, string> {
  const cells = new Map<string, string>();
  if (!room || !target) return cells;
  const activeSnapshot = snapshot ?? createCombatRulesSnapshot(room);
  for (let y = 0; y < room.board.height; y += 1) {
    for (let x = 0; x < room.board.width; x += 1) {
      const position = { x, y, zFeet: target.position.zFeet };
      if (isFootprintPreviewLegal(room, activeSnapshot, target, position)) cells.set(cellKey(position), " move-highlight");
    }
  }
  return cells;
}

export function getChargePreviewPath(room: CombatRoom | null, snapshot: import("@dnd-tactical/shared").CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId> | null, charger: Combatant | null, mode: ActionMode, tacticMode: TacticMode, target: Combatant | null): Position[] | null {
  if (!room || !snapshot || !charger || !target || mode !== "tactics" || tacticMode !== "charge") return null;
  if (room.phase !== "active" || target.type === charger.type || lifeStatus(target) === "dead") return null;
  const reachFeet = resolveEquippedWeaponProfile(charger).profile.meleeReachFeet || room.board.cellSizeFeet;
  const maxDistance = Rules.totalSpeedFeet(snapshot!, charger) * 2;
  const candidates: Array<{ path: Position[]; distance: number }> = [];

  for (let y = 0; y < room.board.height; y += 1) {
    for (let x = 0; x < room.board.width; x += 1) {
      const destination = { x, y, zFeet: charger.position.zFeet };
      if (sameCell(destination, charger.position)) continue;
      if (!isFootprintPreviewLegal(room, snapshot, charger, destination)) continue;
      const chargerAtDestination: Combatant = { ...charger, position: { ...destination } };
      if (distanceBetweenFootprintsFeet(snapshot, chargerAtDestination, target) > reachFeet) continue;
      const path = buildStraightPath(charger.position, destination);
      if (!path) continue;
      const distance = calculatePathCostFeet(charger.position, path, snapshot!);
      if (distance < 10 || distance > maxDistance) continue;
      if (path.some((step) => !isFootprintPreviewLegal(room, snapshot, charger, step))) continue;
      candidates.push({ path, distance });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.path ?? null;
}

export function buildStraightPath(origin: Position, destination: Position): Position[] | null {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return null;
  const path: Position[] = [];
  for (let index = 1; index <= steps; index += 1) path.push({ x: origin.x + stepX * index, y: origin.y + stepY * index, zFeet: origin.zFeet });
  return path;
}

export function isCellOccupied(room: CombatRoom, position: Pick<Position, "x" | "y">, exceptId?: string): boolean {
  const snapshot = createCombatRulesSnapshot(room);
  return room.combatants.some((combatant) =>
    combatant.id !== exceptId &&
    lifeStatus(combatant) !== "dead" &&
    getCombatantOccupiedCells(combatant, snapshot).some((cell) => sameCell(cell, position))
  );
}

export function sameCell(a: Pick<Position, "x" | "y">, b: Pick<Position, "x" | "y">): boolean {
  return a.x === b.x && a.y === b.y;
}


export function getAbilityTargets(room: CombatRoom, caster: Combatant, targetType: "self" | "ally" | "enemy" | "creature" | "area"): Combatant[] {
  return room.combatants.filter((combatant) => {
    if (lifeStatus(combatant) === "dead") return false;
    if (targetType === "self") return combatant.id === caster.id;
    if (targetType === "ally") return combatant.type === caster.type;
    if (targetType === "enemy") return combatant.type !== caster.type;
    return true;
  });
}

export function formatBuff(buff: Buff): string {
  const parts = [buff.name];
  if (buff.acBonus) parts.push("CA " + signedNumber(buff.acBonus));
  if (buff.attackBonus) parts.push("ataque " + signedNumber(buff.attackBonus));
  if (buff.speedBonusFeet) parts.push("vel. " + signedNumber(buff.speedBonusFeet) + " ft");
  if (buff.aidChoice === "pending") parts.push("elegir +2 contra " + (buff.aidTargetName ?? "objetivo"));
  if (buff.aidChoice === "attack") parts.push("+2 ataque contra " + (buff.aidTargetName ?? "objetivo"));
  if (buff.aidChoice === "ac") parts.push("+2 CA contra " + (buff.aidTargetName ?? "objetivo"));
  if (buff.preventsOpportunityAttacks) parts.push("sin AdO");
  if (buff.expiresAtStartOfTurnOf) parts.push("hasta proximo turno");
  else if (buff.expiresAfterTurnOf) parts.push("hasta fin de turno");
  else if (buff.remainingTurns) parts.push(buff.remainingTurns + " turno(s)");
  return parts.join(" - ");
}

export function signedNumber(value: number): string {
  return (value >= 0 ? "+" : "") + value;
}


/**
 * Calcula si el siguiente paso de movimiento es legal desde el frontend.
 * IMPORTANTE: Esto es puramente una ayuda visual (preview) para evitar que el usuario haga clicks obvios inválidos.
 * El servidor NO confía en este valor y reevaluará toda la ruta con `validateMovePath`.
 */
export function isLegalNextPathStep(room: CombatRoom, selected: Combatant, path: Position[], position: Position, maxDistance: number): boolean {
  if (sameCell(selected.position, position)) return false;
  if (path.some((step) => sameCell(step, position))) return false;
  const origin = path[path.length - 1] ?? selected.position;
  const dx = Math.abs(origin.x - position.x);
  const dy = Math.abs(origin.y - position.y);
  if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) return false;
  const snapshot = createCombatRulesSnapshot(room);
  return validateMovePath(snapshot, selected, [...path, position], maxDistance + room.currentTurn.movementUsedFeet).ok;
}

/**
 * Genera un texto de ayuda sobre el penalizador de distancia.
 * IMPORTANTE: Esto es solo un feedback visual para la interfaz.
 */
export function getRangePreview(combatant: Combatant, rangeFeet: number): string {
  const weapon = resolveEquippedWeaponProfile(combatant).profile;
  if (!weapon.rangeIncrementFeet || rangeFeet <= weapon.meleeReachFeet) return "Penalizador por alcance: +0.";
  const increment = Math.max(1, weapon.rangeIncrementFeet);
  const incrementNumber = Math.max(1, Math.ceil(rangeFeet / increment));
  const maxIncrements = weapon.maxRangeIncrements ?? Math.ceil(weapon.maxRangeFeet / increment);
  const penalty = -2 * Math.max(0, incrementNumber - 1);
  if (rangeFeet > weapon.maxRangeFeet) return "Fuera de alcance maximo.";
  return "Incremento " + incrementNumber + " de " + maxIncrements + ": " + penalty + " al ataque.";
}

/**
 * Realiza una sugerencia de tirada de daño basada en los dados del arma.
 * IMPORTANTE: Es una ayuda visual (pre-roll) para facilitar la vida del jugador físico que usa el UI.
 * Nunca debe considerarse autoritativa, ya que el servidor solo confía en el valor final enviado (y de forma futura validará).
 */
export function rollWeaponDamage(combatant: Combatant): number {
  const dice = resolveEquippedWeaponProfile(combatant).profile.damageDice;
  if (!dice) return averageWeaponDamageForCombatant(combatant);
  const match = /^(\d+)d(\d+)$/i.exec(dice.trim());
  if (!match) return averageWeaponDamageForCombatant(combatant);
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return averageWeaponDamageForCombatant(combatant);
  let total = 0;
  for (let index = 0; index < count; index += 1) total += Math.floor(Math.random() * sides) + 1;
  return Math.max(0, total + weaponDamageModifier(combatant));
}

export function weaponDamageModifier(combatant: Combatant): number {
  const weapon = resolveEquippedWeaponProfile(combatant).profile;
  if (weapon.abilityForDamage === "none") return 0;
  const score = combatant.abilityScores?.[weapon.abilityForDamage];
  if (score === undefined) throw new Error(`${combatant.name} no posee la característica requerida por ${weapon.name}.`);
  return Math.trunc(abilityModifier(score) * weapon.damageAbilityMultiplier);
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function averageDiceDamage(dice: string): number {
  const match = /^(\d+)d(\d+)$/i.exec(dice.trim());
  if (!match) return 0;
  return Number(match[1]) * ((Number(match[2]) + 1) / 2);
}

export function getActiveCombatant(room: CombatRoom | null): Combatant | null {
  if (!room) return null;
  const id = room.turnOrder[room.activeTurnIndex];
  return room.combatants.find((combatant) => combatant.id === id) ?? null;
}

export function canParticipantControlCombatant(participant: Participant | null, combatant: Combatant | null): boolean {
  if (!participant || !combatant) return false;
  const control = combatant.controlledBy ?? { type: combatant.controller };
  if (participant.role === "gm") return control.type === "gm";
  return control.type === "player" && control.participantId === participant.id;
}

export function canParticipantEditInitiative(participant: Participant | null, combatant: Combatant): boolean {
  if (!participant) return false;
  if (participant.role === "gm") return true;
  return canParticipantControlCombatant(participant, combatant);
}

export function getCardinalDirection(from: import('@dnd-tactical/shared').Position, to: import('@dnd-tactical/shared').Position): import('@dnd-tactical/shared').CardinalDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 'N';
  if (Math.abs(dx) > Math.abs(dy) * 2) return dx > 0 ? 'E' : 'W';
  if (Math.abs(dy) > Math.abs(dx) * 2) return dy > 0 ? 'S' : 'N';
  if (dx > 0 && dy > 0) return 'SE';
  if (dx > 0 && dy < 0) return 'NE';
  if (dx < 0 && dy > 0) return 'SW';
  return 'NW';
}
