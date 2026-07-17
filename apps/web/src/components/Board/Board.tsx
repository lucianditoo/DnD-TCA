import { getCombatantOccupiedCells, lifeStatus, type CombatRoom, type CombatRulesSnapshot, type Combatant, type Position, type ProductionEffectId, type Ability, SpellsCatalog, getCellsIntersectedByAoE, parseCellKey } from "@dnd-tactical/shared";
import { getCardinalDirection, type ActionMode } from "../../viewModel";
import { useState, useMemo } from "react";
import { cellKey } from "../../viewModel";

export function Board({ room, snapshot, selected, targetId, displayedPath, displayedPathCosts, highlightedCells, chargePreviewPath, routeFootprintCombatant, actionMode, selectedAbility, targetPosition, onCellClick }: { room: CombatRoom; snapshot: CombatRulesSnapshot<ProductionEffectId>; selected: Combatant | null; targetId: string; displayedPath: Position[]; displayedPathCosts: number[]; highlightedCells: Map<string, string>; chargePreviewPath: Position[] | null; routeFootprintCombatant?: Combatant | null; actionMode?: ActionMode; selectedAbility?: Ability | null; targetPosition?: Position | null; onCellClick: (position: Position, token: Combatant | undefined) => void }) {
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);
  const occupiedByCell = new Map<string, Combatant>();
  for (const combatant of room.combatants) {
    for (const cell of getCombatantOccupiedCells(combatant, snapshot)) {
      occupiedByCell.set(cellKey(cell), combatant);
    }
  }
  const routeFinal = chargePreviewPath?.at(-1);
  const routeFootprintKeys = new Set(routeFinal && routeFootprintCombatant
    ? getCombatantOccupiedCells({ ...routeFootprintCombatant, position: routeFinal }, snapshot).map(cellKey)
    : []);

  const aoePreviewKeys = useMemo(() => {
    if (actionMode !== "ability" || !selected || !selectedAbility) return new Set<string>();
    const spell = SpellsCatalog.get(selectedAbility.id);
    if (!spell || spell.target !== "area" || !spell.aoe) return new Set<string>();
    const targetCell = hoveredCell ?? targetPosition;
    if (!targetCell) return new Set<string>();
    const direction = getCardinalDirection(selected.position, targetCell);
    const origin = spell.aoe.type === "burst" ? targetCell : selected.position;
    const cells = getCellsIntersectedByAoE(origin, direction, spell.aoe, room.board.cellSizeFeet);
    return new Set(cells.map(cellKey));
  }, [actionMode, selected, selectedAbility, hoveredCell, targetPosition, room.board.cellSizeFeet]);

  const aoeAffectedKeys = useMemo(() => {
    if (aoePreviewKeys.size === 0) return new Set<string>();
    const affected = new Set<string>();
    for (const combatant of room.combatants) {
      if (lifeStatus(combatant) === "dead") continue;
      const footprint = getCombatantOccupiedCells(combatant, snapshot);
      if (footprint.some(cell => aoePreviewKeys.has(cellKey(cell)))) {
        footprint.forEach(cell => affected.add(cellKey(cell)));
      }
    }
    return affected;
  }, [aoePreviewKeys, room.combatants, snapshot]);

  // Sprint 034: overlay de peligro ambiental. Lee `targetCells` (formato canónico servidor
  // "x,y,zFeet") directamente de los efectos de área persistentes de la sala; decodifica con
  // el parser compartido y re-serializa con la clave local de grilla (sin lógica de reglas aquí).
  const hazardCellKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const instance of room.effectInstances) {
      if (!instance.targetCells) continue;
      for (const cellString of instance.targetCells) {
        keys.add(cellKey(parseCellKey(cellString)));
      }
    }
    return keys;
  }, [room.effectInstances]);

  return <section className="board-wrap">
    <div className="board" style={{ gridTemplateColumns: "repeat(" + room.board.width + ", minmax(32px, 1fr))", gridTemplateRows: "repeat(" + room.board.height + ", minmax(32px, 1fr))", aspectRatio: room.board.width + " / " + room.board.height }}>
      {Array.from({ length: room.board.width * room.board.height }).map((_, index) => {
        const x = index % room.board.width;
        const y = Math.floor(index / room.board.width);
        const position = { x, y, zFeet: 0 };
        const key = cellKey(position);
        const token = occupiedByCell.get(key);
        const highlight = highlightedCells.get(key) ?? "";
        const routeIndex = displayedPath.findIndex((step) => step.x === x && step.y === y);
        const isRouteFootprint = routeFootprintKeys.has(key);
        const isAoE = aoePreviewKeys.has(key);
        const isAoEAffected = aoeAffectedKeys.has(key);
        const isHazard = hazardCellKeys.has(key);
        const routeClass = routeIndex >= 0 || isRouteFootprint ? " route-cell" + (routeIndex === displayedPath.length - 1 || isRouteFootprint ? " route-end" : "") + (chargePreviewPath ? " charge-route" : "") : "";
        const aoeClass = isAoE ? " aoe-preview" : "";
        const aoeAffectedClass = isAoEAffected ? " aoe-affected" : "";
        const hazardClass = isHazard ? " hazard-cell" : "";
        return <button key={index} className={"cell" + highlight + routeClass + aoeClass + aoeAffectedClass + hazardClass} style={{ gridColumn: x + 1, gridRow: y + 1 }} data-testid={"cell-" + x + "-" + y} onPointerEnter={() => setHoveredCell(position)} onPointerLeave={() => setHoveredCell(current => current?.x === x && current?.y === y ? null : current)} onClick={() => onCellClick(position, token)}>{routeIndex >= 0 && <span className="route-step">{displayedPathCosts[routeIndex]}</span>}</button>;
      })}
      {room.combatants.map((token) => {
        const cells = getCombatantOccupiedCells(token, snapshot);
        const columns = Math.max(...cells.map((cell) => cell.x)) - token.position.x + 1;
        const rows = Math.max(...cells.map((cell) => cell.y)) - token.position.y + 1;
        const selectedClass = token.id === selected?.id ? " selected-token" : "";
        const targetClass = token.id === targetId ? " target-token" : "";
        return <span
          key={token.id}
          className={"board-token " + token.type + " " + lifeStatus(token) + selectedClass + targetClass}
          data-testid={"token-" + token.id}
          data-footprint-columns={columns}
          data-footprint-rows={rows}
          style={{ gridColumn: `${token.position.x + 1} / span ${columns}`, gridRow: `${token.position.y + 1} / span ${rows}` }}
        >{token.icon}</span>;
      })}
    </div>
  </section>;
}
