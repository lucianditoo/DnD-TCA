import {
  Rules, canUseMoveAction, footprintCellKey, getCombatantOccupiedCells, lifeStatus,
  resolveMovementPipeline, type ClientCommand, type Combatant, type CombatRoom,
  type CombatRulesSnapshot, type MovementContext, type MovementResolutionStep,
  type Position, type ProductionEffectId
} from "@dnd-tactical/shared";

export type MovementPreviewKind = "ordinary-move" | "placement" | "gm-placement" |
  "legacy-withdraw" | "legacy-run" | "legacy-five-foot-step" | "legacy-charge" | "legacy-forced" | "none";
export interface AcrobaticsContingency { readonly stepIndex: number; readonly enemyId: string; readonly enemyName: string; }
interface PreviewDraft { readonly path: readonly Position[]; readonly isAcrobatic: boolean; }
interface EvaluatedPreview extends PreviewDraft {
  readonly steps: readonly MovementResolutionStep[];
  readonly availableBudgetFeet: number;
  readonly totalCostFeet: number;
  readonly remainingBudgetFeet: number;
  readonly projectedContext: Readonly<MovementContext>;
  readonly acrobaticsChecks: readonly AcrobaticsContingency[];
}
export type MovementPreviewProjection =
  | (PreviewDraft & { readonly status: "empty"; readonly availableBudgetFeet: number })
  | (EvaluatedPreview & { readonly status: "legal" })
  | (EvaluatedPreview & { readonly status: "over-budget"; readonly excessFeet: number })
  | (PreviewDraft & { readonly status: "illegal"; readonly reason: string; readonly failedStepIndex: number })
  | (PreviewDraft & { readonly status: "unavailable"; readonly reason: string });
export interface MovementPreviewInput {
  readonly snapshot: CombatRulesSnapshot<ProductionEffectId> | null;
  readonly actorId: string | null;
  readonly path: readonly Position[];
  readonly isAcrobatic?: boolean;
}

/** Presentation adapter only: all route geometry/cost/context comes from shared Resolution. */
export function buildMovementPreview(input: MovementPreviewInput): MovementPreviewProjection {
  const { snapshot, actorId, isAcrobatic = false } = input;
  const draft = { path: input.path.map(p => ({ ...p })), isAcrobatic };
  const actor = snapshot?.combatants?.find(c => c.id === actorId);
  if (!snapshot || !actor || !snapshot.currentTurn || snapshot.phase !== "active" || snapshot.currentTurn.combatantId !== actor.id) {
    return { ...draft, status: "unavailable", reason: "El preview ordinario requiere el actor del turno activo." };
  }
  if (!Number.isFinite(snapshot.currentTurn.normalDiagonalStepsThisTurn) ||
      !Number.isFinite(snapshot.currentTurn.movementUsedFeet)) {
    return { ...draft, status: "unavailable", reason: "El contexto de movimiento recibido está incompleto." };
  }
  try {
    // Also validate current occupancy on empty drafts; never invent a missing axis.
    getCombatantOccupiedCells(actor, snapshot);
    const availableBudgetFeet = Math.max(0, Rules.totalSpeedFeet(snapshot, actor as Combatant) - snapshot.currentTurn.movementUsedFeet);
    if (draft.path.length === 0) return { ...draft, status: "empty", availableBudgetFeet };
    const resolution = resolveMovementPipeline({
      context: snapshot, combatant: actor as Combatant, path: draft.path,
      initialContext: { normalDiagonalStepsThisTurn: snapshot.currentTurn.normalDiagonalStepsThisTurn },
      availableBudgetFeet, isAcrobatic
    });
    if (resolution.kind === "illegal-route") {
      return { ...draft, status: "illegal", reason: resolution.reason, failedStepIndex: resolution.failedStepIndex };
    }
    const acrobaticsChecks: AcrobaticsContingency[] = [];
    if (isAcrobatic) {
      const enemies = snapshot.combatants.filter(c => c.id !== actor.id && c.type !== actor.type &&
        !["dead", "dying", "stable"].includes(lifeStatus(c as Combatant)));
      for (const step of resolution.steps) {
        const cells = new Set(step.occupiedCells.map(footprintCellKey));
        for (const enemy of enemies) {
          if (getCombatantOccupiedCells(enemy, snapshot).some(cell => cells.has(footprintCellKey(cell)))) {
            acrobaticsChecks.push({ stepIndex: step.stepIndex, enemyId: enemy.id, enemyName: enemy.name });
          }
        }
      }
    }
    const totalCostFeet = resolution.kind === "ready" ? resolution.totalCostFeet : resolution.requiredCostFeet;
    const evaluated = { ...draft, steps: resolution.steps, availableBudgetFeet, totalCostFeet,
      remainingBudgetFeet: availableBudgetFeet - totalCostFeet, projectedContext: resolution.projectedContext, acrobaticsChecks };
    return resolution.kind === "ready" ? { ...evaluated, status: "legal" }
      : { ...evaluated, status: "over-budget", excessFeet: totalCostFeet - availableBudgetFeet };
  } catch (error) {
    return { ...draft, status: "unavailable", reason: error instanceof Error ? error.message : "Error de integridad espacial." };
  }
}

export function buildMovementCandidates(input: MovementPreviewInput): ReadonlyMap<string, MovementPreviewProjection> {
  const actor = input.snapshot?.combatants?.find(c => c.id === input.actorId);
  const candidates = new Map<string, MovementPreviewProjection>();
  if (!actor) return candidates;
  const origin = input.path.at(-1) ?? actor.position;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const to = { x: origin.x + dx, y: origin.y + dy, zFeet: origin.zFeet ?? 0 };
    candidates.set(`${to.x},${to.y}`, buildMovementPreview({ ...input, path: [...input.path, to] }));
  }
  return candidates;
}

export function getMovementPreviewKind(input: { phase?: CombatRoom["phase"]; actionMode: string; tacticMode: string;
  gmMoveMode: boolean; withdrawArmed: boolean; runArmed: boolean; fiveFootStepArmed: boolean; isDemoActive?: boolean; isMapEditing?: boolean }): MovementPreviewKind {
  if (input.isDemoActive || input.isMapEditing) return "none";
  if (input.gmMoveMode) return "gm-placement";
  if (input.actionMode === "tactics" && input.tacticMode === "charge") return "legacy-charge";
  if (input.actionMode === "tactics" && input.tacticMode === "bull-rush") return "legacy-forced";
  if (input.actionMode !== "move") return "none";
  if (input.phase === "preparation") return "placement";
  if (input.phase !== "active") return "none";
  if (input.withdrawArmed) return "legacy-withdraw";
  if (input.runArmed) return "legacy-run";
  if (input.fiveFootStepArmed) return "legacy-five-foot-step";
  return "ordinary-move";
}

/** Action availability is separate from route prediction. */
export function getOrdinaryMoveBlockedReason(snapshot: CombatRulesSnapshot<ProductionEffectId> | null, actorId: string | null, canControl: boolean): string | null {
  const actor = snapshot?.combatants?.find(c => c.id === actorId);
  if (!canControl) return "No controla este actor.";
  if (!snapshot || !actor || !snapshot.currentTurn || snapshot.phase !== "active" || snapshot.currentTurn.combatantId !== actor.id) return "No es el turno activo de este actor.";
  const availability = Rules.evaluateActionAvailability(snapshot, actor as Combatant);
  if (!availability.ok) return availability.error ?? "Acción no disponible.";
  const move = canUseMoveAction(snapshot, actor as Combatant);
  if (!move.ok) return move.error ?? "Acción de movimiento no disponible.";
  if (snapshot.currentTurn.usedFiveFootStep) return "Ya usó paso de 5 pies este turno.";
  if (snapshot.pendingOpportunityAttacks.length) return "Hay ataques de oportunidad pendientes.";
  if (snapshot.currentTurn.attackMode === "full" || (snapshot.currentTurn.attackMode === "standard" && !snapshot.currentTurn.usedStandardAction)) return "Tiene un modo de ataque preparado.";
  return null;
}

export function ordinaryGridPosition(path: readonly Position[], actor: Pick<Combatant, "position">, cell: Pick<Position, "x" | "y">): Position {
  return { x: cell.x, y: cell.y, zFeet: (path.at(-1) ?? actor.position).zFeet ?? 0 };
}

export function createOrdinaryMoveIntent(roomCode: string, actorId: string, combatantId: string, path: readonly Position[], isAcrobatic: boolean): Extract<ClientCommand, { type: "move-combatant" }> {
  if (path.length === 0) throw new Error("La intención requiere una ruta.");
  return { type: "move-combatant", roomCode, actorId, combatantId, to: { ...path[path.length - 1] }, path: path.map(p => ({ ...p })), isAcrobatic };
}
