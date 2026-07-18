import { useMemo } from "react";
import { distanceBetweenFootprintsFeet, lifeStatus, calculatePathCostFeet, calculatePathStepCostsFeet, createCombatRulesSnapshot, validateSpecialManeuver, type CombatRoom, type Combatant, type Participant, type Position } from "@dnd-tactical/shared";
import { getAbilityTargets, getActiveCombatant, getChargePreviewPath, getGmMoveHighlightedCells, getHighlightedCells, getRangePreview, type ActionMode, type TacticMode } from "../viewModel";

export function useBoardSelection({ room, snapshot, selectedId, participant, actionMode, tacticMode, selectedAbilityId, movementPath, gmMoveMode, gmMoveTargetId, targetId, withdrawArmed = false, runArmed = false }: { room: CombatRoom | null; snapshot: import("@dnd-tactical/shared").CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId> | null; selectedId: string | null; participant: Participant | null; actionMode: ActionMode; tacticMode: TacticMode; selectedAbilityId: string; movementPath: Position[]; gmMoveMode: boolean; gmMoveTargetId: string; targetId: string; withdrawArmed?: boolean; runArmed?: boolean }) {
  const active = useMemo(() => getActiveCombatant(room), [room]);
  const effectiveSelectedId = room?.phase === "active" ? active?.id ?? selectedId : selectedId;
  const selected = room?.combatants.find((combatant) => combatant.id === effectiveSelectedId) ?? active ?? room?.combatants[0] ?? null;
  const targets = room?.combatants.filter((combatant) => combatant.id !== selected?.id && lifeStatus(combatant) !== "dead") ?? [];
  const enemyTargets = room?.combatants.filter((combatant) => selected && combatant.type !== selected.type && lifeStatus(combatant) !== "dead") ?? [];
  const aidAllies = room?.combatants.filter((combatant) => selected && combatant.id !== selected.id && combatant.type === selected.type && lifeStatus(combatant) !== "dead") ?? [];
  const pendingAidBuffs = selected?.buffs.filter((buff) => buff.aidChoice === "pending") ?? [];
  const selectedTarget = targets.find((target) => target.id === targetId) ?? null;
  const gmMoveTarget = room?.combatants.find((combatant) => combatant.id === gmMoveTargetId) ?? selected;
  const selectedAbility = selected?.abilities.find((ability) => ability.id === selectedAbilityId) ?? selected?.abilities[0] ?? null;
  const abilityTargets = room && selected && selectedAbility ? getAbilityTargets(room, selected, selectedAbility.target) : [];
  const targetDistanceFeet = snapshot && selected && selectedTarget ? distanceBetweenFootprintsFeet(snapshot, selected, selectedTarget) : null;
  const rangePreview = selected && targetDistanceFeet !== null ? getRangePreview(selected, targetDistanceFeet) : null;
  const pendingOpportunities = room?.pendingOpportunityAttacks ?? [];
  const hasPendingOpportunities = pendingOpportunities.length > 0;
  const chargePreviewPath = useMemo(() => getChargePreviewPath(room, snapshot, selected, actionMode, tacticMode, selectedTarget), [room, snapshot, selected, actionMode, tacticMode, selectedTarget]);
  const bullRushPreviewPath = useMemo(() => {
    if (!snapshot || !selected || !selectedTarget || actionMode !== "tactics" || tacticMode !== "bull-rush") return null;
    const preview = validateSpecialManeuver(snapshot, selected, selectedTarget, "bull_rush");
    return preview.ok && preview.value?.maneuverId === "bull_rush" ? [...preview.value.projectedPath] : null;
  }, [snapshot, selected, selectedTarget, actionMode, tacticMode]);
  const displayedPath = chargePreviewPath ?? bullRushPreviewPath ?? movementPath;
  const activeSnapshot = snapshot ?? (room ? createCombatRulesSnapshot(room) : null);
  const movementPathCost = activeSnapshot && selected ? calculatePathCostFeet(selected.position, movementPath, activeSnapshot) : 0;
  const displayedPathCosts = activeSnapshot && selected ? calculatePathStepCostsFeet(selected.position, displayedPath, activeSnapshot) : [];
  const highlightedCells = useMemo(() => gmMoveMode && participant?.role === "gm" ? getGmMoveHighlightedCells(room, snapshot, gmMoveTarget) : getHighlightedCells(room, snapshot, selected, actionMode, selectedAbilityId, movementPath, withdrawArmed, runArmed), [room, snapshot, selected, actionMode, selectedAbilityId, movementPath, withdrawArmed, runArmed, gmMoveMode, gmMoveTarget, participant?.role]);

  return { active, selected, targets, enemyTargets, aidAllies, pendingAidBuffs, gmMoveTarget, selectedAbility, abilityTargets, targetDistanceFeet, rangePreview, pendingOpportunities, hasPendingOpportunities, chargePreviewPath, bullRushPreviewPath, displayedPath, movementPathCost, displayedPathCosts, highlightedCells };
}
