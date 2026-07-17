import { canFullAttack, distanceBetweenFootprintsFeet, getCombatantOccupiedCells, resolveEquippedWeaponProfile, Rules, EffectReducer, effectsCatalog, type CombatRulesSnapshot, type Combatant, type Position } from "@dnd-tactical/shared";

export function canCharge(
  room: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, combatant: Combatant): { ok: boolean; error?: string } {
  const turnCheck = canFullAttack(room, combatant);
  if (!turnCheck.ok) return { ok: false, error: turnCheck.error };
  if (room.currentTurn.movementUsedFeet > 0 || room.currentTurn.usedMoveAction || room.currentTurn.usedFiveFootStep) return { ok: false, error: "Carga requiere no haber movido antes en este turno." };
  // Verificar ruleOverrides del Effect System (FORBID_CHARGE = Fatigued, Entangled, etc.)
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  if (reduced.ruleOverrides.includes("FORBID_CHARGE")) {
    return { ok: false, error: combatant.name + " no puede cargar en su estado actual." };
  }
  return { ok: true };
}

export function findChargePath(
  context: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, charger: Combatant, target: Combatant): { ok: boolean; value?: Position[]; error?: string } {
  const candidates: Array<{ path: Position[]; distance: number }> = [];
  const reachFeet = resolveEquippedWeaponProfile(charger).profile.meleeReachFeet || context.board.cellSizeFeet;
  const maxDistance = Rules.totalSpeedFeet(context, charger) * 2;

  for (let y = 0; y < context.board.height; y += 1) {
    for (let x = 0; x < context.board.width; x += 1) {
      const destination = { x, y, zFeet: charger.position.zFeet };
      if (sameCell(destination, charger.position)) continue;
      if (!isFootprintInsideBoard(context, charger, destination)) continue;
      if (isFootprintOccupied(context, charger, destination)) continue;
      const chargerAtDestination: Combatant = { ...charger, position: { ...destination } };
      if (distanceBetweenFootprintsFeet(context, chargerAtDestination, target) > reachFeet) continue;
      const path = buildStraightPath(charger.position, destination);
      if (!path) continue;
      const distance = calculatePathDistanceFeet(charger.position, path, context.board.cellSizeFeet);
      if (distance < 10 || distance > maxDistance) continue;
      if (path.some((step) => isFootprintOccupied(context, charger, step))) continue;
      candidates.push({ path, distance });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const chosen = candidates[0];
  if (!chosen) return { ok: false, error: "No hay una ruta de carga recta, libre, de al menos 10 pies y dentro de la velocidad doble hacia ese objetivo." };
  return { ok: true, value: chosen.path };
}

function buildStraightPath(origin: Position, destination: Position): Position[] | null {
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

export function calculatePathDistanceFeet(origin: Pick<Position, "x" | "y">, path: Array<Pick<Position, "x" | "y">>, cellSizeFeet: number): number {
  let current = origin;
  let distance = 0;
  let diagonals = 0;
  for (const step of path) {
    const dx = Math.abs(current.x - step.x);
    const dy = Math.abs(current.y - step.y);
    if (dx === 1 && dy === 1) {
      diagonals += 1;
      distance += diagonals % 2 === 1 ? cellSizeFeet : cellSizeFeet * 2;
    } else if (dx + dy > 0) {
      distance += cellSizeFeet;
    }
    current = step;
  }
  return distance;
}

function isFootprintInsideBoard(context: CombatRulesSnapshot<string>, combatant: Combatant, position: Position): boolean {
  return getCombatantOccupiedCells({ ...combatant, position: { ...position } }, context)
    .every((cell) =>
      cell.x >= 0 && cell.y >= 0 && cell.x < context.board.width && cell.y < context.board.height &&
      !context.board.impassableCells?.includes(`${cell.x},${cell.y}`)
    );
}

function isFootprintOccupied(context: CombatRulesSnapshot<string>, combatant: Combatant, position: Position): boolean {
  const keys = new Set(getCombatantOccupiedCells({ ...combatant, position: { ...position } }, context).map(cellKey));
  return context.combatants.some((other) =>
    other.id !== combatant.id && getCombatantOccupiedCells(other, context).some((cell) => keys.has(cellKey(cell)))
  );
}

function cellKey(position: Pick<Position, "x" | "y" | "zFeet">): string {
  return `${position.x},${position.y},${position.zFeet ?? 0}`;
}

function sameCell(a: Pick<Position, "x" | "y">, b: Pick<Position, "x" | "y">): boolean {
  return a.x === b.x && a.y === b.y;
}
