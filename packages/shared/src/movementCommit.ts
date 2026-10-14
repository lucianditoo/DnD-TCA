import type {
  CombatRoom,
  Combatant,
  Position,
  MovementContext,
} from "./types.js";
import type { SpatialMode, SqueezingAxis } from "./movementGeometry.js";
import type { EffectInstance } from "./effects/types.js";
import type { ProductionEffectId } from "./effects/catalog.js";
import { EffectManager } from "./effects/manager.js";
import { cryptoId } from "./demo-data.js";
import {
  createMovementStateFingerprint,
  type MovementResolutionResult,
} from "./movementResolution.js";

/**
 * Authoritative Movement Commit (Sprint D-1B-I5/I5R1).
 *
 * Consume exclusivamente un `MovementResolutionResult` de kind "ready" ya producido por
 * `resolveMovementPipeline` (I4/I5R2). No vuelve a resolver Route Validation, Movement Cost
 * ni los Steps: esa evidencia viene en `resolution.steps`/`resolution.projectedContext`.
 * Reproyecta únicamente las dependencias actuales del fingerprint (huellas y movilidad)
 * para verificar su vigencia, sin sustituir la evidencia de la Route.
 *
 * Valida de forma estricta las precondiciones autoritativas:
 * - Correspondencia de actor y turno activo.
 * - Identidad temporal de la ronda.
 * - Origen y presupuesto previo.
 * - Contexto diagonal vinculado a `resolution.initialContext`.
 * - Vigencia del estado de reglas via `resolution.rulesStateFingerprint`.
 *
 * Aislado deliberadamente del flujo productivo legacy: ningún comando (`handleMoveCombatant`,
 * `handleWithdraw`, `handleRun`, `handleCharge`) ni `commitSpatialTransition` invoca todavía
 * este módulo.
 *
 * ODR-D1B-I5-1 (abierta): `squeezingAxis` se consume desde el último `MovementResolutionStep`
 * y se expone en el resultado del Commit, pero no se persiste en ninguna sede durable.
 */

export interface MovementCommitPreconditions {
  /** Identidad del combatiente activo del turno. */
  readonly expectedTurnCombatantId: string | null;
  /** Ronda del combate en la que se calculó la resolución. */
  readonly expectedRound: number;
  /** Posición del combatiente en el momento en que se calculó la Resolution. */
  readonly expectedOrigin: Readonly<Position>;
  /** `room.currentTurn.movementUsedFeet` vigente cuando se calculó la Resolution. */
  readonly expectedMovementUsedFeet: number;
  /** Contexto diagonal opcional para compatibilidad; la autoridad estricta es resolution.initialContext. */
  readonly expectedDiagonalContext?: Readonly<MovementContext>;
}

export interface MovementCommitInput {
  /** Mutado in-place si el Commit se acepta; sin cambios si se rechaza. */
  readonly room: CombatRoom;
  /** Debe ser la misma referencia viva que integra `room.combatants`. */
  readonly combatant: Combatant;
  readonly resolution: Extract<MovementResolutionResult, { kind: "ready" }>;
  readonly preconditions: MovementCommitPreconditions;
}

export type MovementCommitRejectionCode =
  | "invalid-actor"
  | "stale-turn"
  | "stale-round"
  | "stale-origin"
  | "stale-movement-used"
  | "stale-diagonal-context"
  | "stale-rules-state";

export type MovementCommitResult =
  | {
      readonly kind: "committed";
      readonly finalPosition: Readonly<Position>;
      readonly finalSpatialMode: SpatialMode;
      readonly squeezingAxis?: SqueezingAxis;
      readonly occupiedCells: ReadonlyArray<Readonly<Position>>;
      readonly distanceMovedFeet: number;
      readonly movementUsedFeetAfter: number;
      readonly resultingDiagonalCount: number;
    }
  | {
      readonly kind: "rejected";
      readonly reason: string;
      readonly rejectionCode: MovementCommitRejectionCode;
    };

function positionsMatch(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && (a.zFeet ?? 0) === (b.zFeet ?? 0);
}

/**
 * Aplica, de forma atómica, el resultado de una Resolution ya confirmada como "ready".
 * Verifica primero las precondiciones autoritativas contra el estado vigente de `room`/`combatant`;
 * si cualquiera falla, rechaza el Commit sin mutar nada. Solo si todas se sostienen aplica
 * todas las mutaciones juntas y devuelve el resultado confirmado. No publica eventos ni
 * realiza broadcast — Publication pertenece a una fase posterior y separada.
 */
export function commitMovementResolution(input: MovementCommitInput): MovementCommitResult {
  const { room, combatant, resolution, preconditions } = input;
  const {
    expectedTurnCombatantId,
    expectedRound,
    expectedOrigin,
    expectedMovementUsedFeet
  } = preconditions;

  // 1. Actor y turno
  const authoritativeCombatant = room.combatants.find(c => c.id === resolution.combatantId);
  if (!authoritativeCombatant || authoritativeCombatant !== combatant ||
      resolution.combatantId !== combatant.id || expectedTurnCombatantId !== resolution.combatantId) {
    return {
      kind: "rejected",
      reason: "La resolución no corresponde a la entidad canónica viva del actor esperado.",
      rejectionCode: "invalid-actor"
    };
  }
  if (room.currentTurn.combatantId !== resolution.combatantId) {
    return {
      kind: "rejected",
      reason: `El combatiente ${combatant.name} (${combatant.id}) no coincide con el turno activo (${room.currentTurn.combatantId}) o con el actor esperado (${expectedTurnCombatantId}).`,
      rejectionCode: "stale-turn"
    };
  }

  // 2. Ronda
  if (expectedRound !== undefined && room.round !== expectedRound) {
    return {
      kind: "rejected",
      reason: `La ronda del combate cambió (esperada: ${expectedRound}, actual: ${room.round}); la resolución pertenece a un turno anterior.`,
      rejectionCode: "stale-round"
    };
  }

  // 3. Origen
  if (!positionsMatch(combatant.position, expectedOrigin)) {
    return {
      kind: "rejected",
      reason: `${combatant.name} ya no está en la posición sobre la que se calculó la Resolution; el estado autoritativo cambió.`,
      rejectionCode: "stale-origin"
    };
  }

  // 4. Presupuesto consumido previo
  if (room.currentTurn.movementUsedFeet !== expectedMovementUsedFeet) {
    return {
      kind: "rejected",
      reason: "El presupuesto de movimiento consumido del turno cambió desde que se calculó la Resolution.",
      rejectionCode: "stale-movement-used"
    };
  }

  // 5. Contexto diagonal vinculado estrictamente a resolution.initialContext
  if (room.currentTurn.normalDiagonalStepsThisTurn !== resolution.initialContext.normalDiagonalStepsThisTurn) {
    return {
      kind: "rejected",
      reason: "El contexto diagonal del turno cambió desde que se calculó la Resolution.",
      rejectionCode: "stale-diagonal-context"
    };
  }

  // 6. Fingerprint del estado de reglas del combate
  const currentFingerprint = createMovementStateFingerprint(room, authoritativeCombatant);
  if (currentFingerprint !== resolution.rulesStateFingerprint) {
    return {
      kind: "rejected",
      reason: "El estado espacial o las fuentes de movilidad/presupuesto cambiaron desde que se calculó la Resolution.",
      rejectionCode: "stale-rules-state"
    };
  }

  // Todas las precondiciones se sostienen: a partir de aquí se aplican todas las
  // mutaciones juntas, sin punto de retorno intermedio.
  const lastStep = resolution.steps[resolution.steps.length - 1];

  const squeezingInstances = room.effectInstances.filter(
    (instance) => instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id)
  );
  const wasSqueezing = squeezingInstances.length > 0;
  const isSqueezingNow = lastStep.spatialMode === "squeezing";

  if (wasSqueezing !== isSqueezingNow) {
    let nextRoom = EffectManager.removeMany(room, squeezingInstances.map((instance) => instance.instanceId));
    if (isSqueezingNow) {
      const instance: EffectInstance<ProductionEffectId> = {
        instanceId: cryptoId("effect"),
        effectId: "srd_squeezing",
        source: { type: "system" },
        targets: [combatant.id],
        appliedAtEvent: { type: "ActionResolved", combatantId: combatant.id, round: room.round },
        duration: { type: "permanent" }
      };
      nextRoom = EffectManager.add(nextRoom, instance);
    }
    Object.assign(room, nextRoom);
  }

  combatant.position = { ...lastStep.position };
  combatant.stats.distanceMovedFeet += resolution.totalBaseRouteCostFeet;
  room.currentTurn.movementUsedFeet += resolution.totalCostFeet;
  room.currentTurn.normalDiagonalStepsThisTurn = resolution.projectedContext.normalDiagonalStepsThisTurn;

  return {
    kind: "committed",
    finalPosition: { ...lastStep.position },
    finalSpatialMode: lastStep.spatialMode,
    ...(lastStep.squeezingAxis ? { squeezingAxis: lastStep.squeezingAxis } : {}),
    occupiedCells: lastStep.occupiedCells.map((cell) => ({ ...cell })),
    distanceMovedFeet: resolution.totalBaseRouteCostFeet,
    movementUsedFeetAfter: room.currentTurn.movementUsedFeet,
    resultingDiagonalCount: room.currentTurn.normalDiagonalStepsThisTurn
  };
}
