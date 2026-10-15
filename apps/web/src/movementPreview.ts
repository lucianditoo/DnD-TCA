import {
  Rules, canUseMoveAction, canDisabledCombatantTakeAction, footprintCellKey, getCombatantOccupiedCells, lifeStatus,
  resolveMovementPipeline, type ClientCommand, type Combatant, type CombatRoom,
  type CombatRulesSnapshot, type MovementContext, type MovementResolutionStep,
  type Position, type ProductionEffectId, type MovementResolutionResult
} from "@dnd-tactical/shared";

export type MovementPreviewKind = "ordinary-move" | "placement" | "gm-placement" |
  "withdraw" | "legacy-run" | "legacy-five-foot-step" | "legacy-charge" | "legacy-forced" | "none";
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
  | (PreviewDraft & { readonly status: "illegal"; readonly reason: string; readonly failedStepIndex: number; readonly reasonSource: "movement" | "withdraw-policy" })
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
      return projectResolution(draft, resolution, availableBudgetFeet, []);
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
    return projectResolution(draft, resolution, availableBudgetFeet, acrobaticsChecks);
  } catch (error) {
    return { ...draft, status: "unavailable", reason: error instanceof Error ? error.message : "Error de integridad espacial." };
  }
}

export function buildMovementCandidates(input: MovementPreviewInput): ReadonlyMap<string, MovementPreviewProjection> {
  const actor = input.snapshot?.combatants?.find(c => c.id === input.actorId);
  return adjacentCandidates(input.path, actor?.position, path => buildMovementPreview({ ...input, path }));
}

function adjacentCandidates(path: readonly Position[], actorPosition: Position | undefined, evaluate: (path: readonly Position[]) => MovementPreviewProjection): ReadonlyMap<string, MovementPreviewProjection> {
  const candidates = new Map<string, MovementPreviewProjection>();
  if (!actorPosition) return candidates;
  const origin = path.at(-1) ?? actorPosition;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const to = { x: origin.x + dx, y: origin.y + dy, zFeet: origin.zFeet ?? 0 };
    candidates.set(`${to.x},${to.y}`, evaluate([...path, to]));
  }
  return candidates;
}

function projectResolution(draft: PreviewDraft, resolution: MovementResolutionResult, availableBudgetFeet: number, acrobaticsChecks: readonly AcrobaticsContingency[]): MovementPreviewProjection {
  if (resolution.kind === "illegal-route") return { ...draft, status: "illegal", reasonSource: "movement", reason: resolution.reason, failedStepIndex: resolution.failedStepIndex };
  const totalCostFeet = resolution.kind === "ready" ? resolution.totalCostFeet : resolution.requiredCostFeet;
  const evaluated = { ...draft, steps: resolution.steps, availableBudgetFeet, totalCostFeet,
    remainingBudgetFeet: availableBudgetFeet - totalCostFeet, projectedContext: resolution.projectedContext, acrobaticsChecks };
  return resolution.kind === "ready" ? { ...evaluated, status: "legal" }
    : { ...evaluated, status: "over-budget", excessFeet: totalCostFeet - availableBudgetFeet };
}

export type WithdrawPreviewInput = Omit<MovementPreviewInput, "isAcrobatic">;
export type WithdrawPreviewAvailability =
  | { readonly status: "ready"; readonly variant: "normal" | "limited"; readonly actionLabel: string; readonly evaluationLimitFeet: number; readonly blockedReason: string | null }
  | { readonly status: "unavailable"; readonly reason: string; readonly blockedReason: string };

function prepareWithdraw(input: WithdrawPreviewInput) {
  const snapshot = input.snapshot;
  const actor = snapshot?.combatants?.find(c => c.id === input.actorId) as Combatant | undefined;
  if (!snapshot || !actor || !snapshot.currentTurn || snapshot.phase !== "active" || snapshot.currentTurn.combatantId !== actor.id) {
    throw new Error("La Retirada requiere el actor del turno activo.");
  }
  if (!Number.isFinite(snapshot.currentTurn.movementUsedFeet) || !Number.isFinite(snapshot.currentTurn.normalDiagonalStepsThisTurn)) {
    throw new Error("El contexto de movimiento recibido está incompleto.");
  }
  // Empty drafts must also detect corrupt current spatial state, before Board renders it.
  for (const combatant of snapshot.combatants) getCombatantOccupiedCells(combatant, snapshot);
  const limited = !canDisabledCombatantTakeAction(snapshot, actor, "full-round").ok;
  const availableBudgetFeet = Rules.totalSpeedFeet(snapshot, actor) * (limited ? 1 : 2);
  return { snapshot, actor, limited, availableBudgetFeet,
    initialContext: { normalDiagonalStepsThisTurn: snapshot.currentTurn.normalDiagonalStepsThisTurn } };
}
type PreparedWithdraw = ReturnType<typeof prepareWithdraw>;
const previewError = (error: unknown) => error instanceof Error ? error.message : "Error de integridad espacial.";

function withdrawProjection(prepared: PreparedWithdraw, path: readonly Position[]): MovementPreviewProjection {
  const draft = { path: path.map(p => ({ ...p })), isAcrobatic: false };
  try {
    const { snapshot, actor, availableBudgetFeet, initialContext } = prepared;
    if (!draft.path.length) return { ...draft, status: "empty", availableBudgetFeet };
    const resolution = resolveMovementPipeline({ context: snapshot, combatant: actor, path: draft.path, initialContext, availableBudgetFeet, isAcrobatic: false });
    // Preserve I8 precedence: budget failure occurs before the consumer's V1 policy.
    if (resolution.kind === "ready") for (const step of resolution.steps) {
      const keys = new Set(step.occupiedCells.map(footprintCellKey));
      const final = step.stepIndex === resolution.steps.length - 1;
      const blocker = snapshot.combatants.find(other => other.id !== actor.id && lifeStatus(other as Combatant) !== "dead" &&
        (final || other.type !== actor.type) && getCombatantOccupiedCells(other, snapshot).some(cell => keys.has(footprintCellKey(cell))));
      if (blocker) return { ...draft, status: "illegal", reasonSource: "withdraw-policy", failedStepIndex: step.stepIndex,
        reason: final ? `No puede terminar la Retirada sobre la casilla de ${blocker.name}.` : `No puede retirarse a través de ${blocker.name} (la Retirada V1 no admite Acrobacias).` };
    }
    return projectResolution(draft, resolution, availableBudgetFeet, []);
  } catch (error) { return { ...draft, status: "unavailable", reason: previewError(error) }; }
}
export function buildWithdrawMovementPreview(input: WithdrawPreviewInput): MovementPreviewProjection {
  try { return withdrawProjection(prepareWithdraw(input), input.path); }
  catch (error) { return { path: input.path.map(p => ({ ...p })), isAcrobatic: false, status: "unavailable", reason: previewError(error) }; }
}
export function buildWithdrawCandidates(input: WithdrawPreviewInput): ReadonlyMap<string, MovementPreviewProjection> {
  try {
    const prepared = prepareWithdraw(input);
    return adjacentCandidates(input.path, prepared.actor.position, path => withdrawProjection(prepared, path));
  } catch { return new Map(); }
}
export function getWithdrawPreviewAvailability(snapshot: MovementPreviewInput["snapshot"], actorId: string | null, canControl: boolean): WithdrawPreviewAvailability {
  try {
    const prepared = prepareWithdraw({ snapshot, actorId, path: [] });
    const { actor, limited, availableBudgetFeet } = prepared;
    const current = prepared.snapshot;
    let blockedReason: string | null = null;
    const availability = Rules.evaluateActionAvailability(current, actor);
    const move = canUseMoveAction(current, actor);
    if (!canControl) blockedReason = "No controla este actor.";
    else if (!availability.ok) blockedReason = availability.error ?? "Acción no disponible.";
    else if (current.pendingOpportunityAttacks.length) blockedReason = "Hay ataques de oportunidad pendientes.";
    else if (!move.ok) blockedReason = move.error ?? "Acción de movimiento no disponible.";
    else if (current.currentTurn.attackMode !== "none") blockedReason = "Tiene un modo de ataque preparado.";
    else if (current.currentTurn.usedStandardAction) blockedReason = "Ya usó su acción estándar.";
    else if (current.currentTurn.usedFiveFootStep) blockedReason = "Ya usó paso de 5 pies.";
    else if (current.currentTurn.attacksMade > 0) blockedReason = "Ya atacó este turno.";
    else if (current.currentTurn.movementUsedFeet !== 0) blockedReason = "Ya se movió este turno; no puede retirarse.";
    else if (limited) {
      const standard = canDisabledCombatantTakeAction(current, actor, "standard");
      if (!standard.ok) blockedReason = standard.error ?? "Retirada limitada no disponible.";
    }
    return { status: "ready", variant: limited ? "limited" : "normal", evaluationLimitFeet: availableBudgetFeet, blockedReason,
      actionLabel: limited ? "Retirada limitada — hasta 1× velocidad — acción estándar" : "Retirada — hasta 2× velocidad — acción de asalto completo" };
  } catch (error) { const reason = previewError(error); return { status: "unavailable", reason, blockedReason: !canControl ? "No controla este actor." : reason }; }
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
  if (input.withdrawArmed) return "withdraw";
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
