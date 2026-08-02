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
import type { MovementResolutionResult } from "./movementResolution.js";

/**
 * Authoritative Movement Commit (Sprint D-1B-I5).
 *
 * Consume exclusivamente un `MovementResolutionResult` de kind "ready" ya producido por
 * `resolveMovementPipeline` (I4). No recalcula Route Validation, Movement Cost, footprints,
 * geometría, terreno difícil, `squeezingAxis` ni el contador diagonal — toda esa evidencia
 * ya viene resuelta en `resolution.steps`/`resolution.projectedContext`.
 *
 * Aislado deliberadamente del flujo productivo legacy: ningún comando (`handleMoveCombatant`,
 * `handleWithdraw`, `handleRun`, `handleCharge`) ni `commitSpatialTransition` invoca todavía
 * este módulo.
 *
 * ODR-D1B-I5-1 (abierta): `squeezingAxis` se consume desde el último `MovementResolutionStep`
 * y se expone en el resultado del Commit, pero no se persiste en ninguna sede durable
 * (`EffectInstance` ni `CombatantSnapshot`). El modelo actual no define dónde debería vivir
 * ese dato más allá del propio turno en que se calculó; esta limitación se registra aquí a
 * propósito, sin decidirla implícitamente. Solo la presencia/ausencia de Squeezing (el
 * `spatialMode`) tiene hoy una sede clara: la `EffectInstance` `srd_squeezing`, igual que en
 * `apps/server/src/combat/spatialTransition.ts::commitSpatialTransition`. Este módulo
 * reimplementa ese mismo patrón de forma autocontenida (no lo importa: `packages/shared` no
 * puede depender de `apps/server`) — una duplicación temporal y documentada, esperable
 * mientras la migración productiva (`CERO MIGRACIÓN PRODUCTIVA` en este sprint) no exista
 * todavía.
 */

export interface MovementCommitPreconditions {
  /** Posición del combatiente en el momento en que se calculó la Resolution. */
  readonly expectedOrigin: Readonly<Position>;
  /** `room.currentTurn.movementUsedFeet` vigente cuando se calculó la Resolution. */
  readonly expectedMovementUsedFeet: number;
  /** Contexto diagonal (`normalDiagonalStepsThisTurn`) vigente cuando se calculó la Resolution. */
  readonly expectedDiagonalContext: Readonly<MovementContext>;
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
  | "stale-origin"
  | "stale-movement-used"
  | "stale-diagonal-context";

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
 * Verifica primero las precondiciones autoritativas (posición inicial, presupuesto
 * consumido, contexto diagonal) contra el estado vigente de `room`/`combatant`; si
 * cualquiera falla, rechaza el Commit sin mutar nada. Solo si todas se sostienen aplica
 * todas las mutaciones juntas y devuelve el resultado confirmado. No publica eventos ni
 * realiza broadcast — Publication pertenece a una fase posterior y separada.
 */
export function commitMovementResolution(input: MovementCommitInput): MovementCommitResult {
  const { room, combatant, resolution, preconditions } = input;
  const { expectedOrigin, expectedMovementUsedFeet, expectedDiagonalContext } = preconditions;

  if (!positionsMatch(combatant.position, expectedOrigin)) {
    return {
      kind: "rejected",
      reason: `${combatant.name} ya no está en la posición sobre la que se calculó la Resolution; el estado autoritativo cambió.`,
      rejectionCode: "stale-origin"
    };
  }

  if (room.currentTurn.movementUsedFeet !== expectedMovementUsedFeet) {
    return {
      kind: "rejected",
      reason: "El presupuesto de movimiento consumido del turno cambió desde que se calculó la Resolution.",
      rejectionCode: "stale-movement-used"
    };
  }

  if (room.currentTurn.normalDiagonalStepsThisTurn !== expectedDiagonalContext.normalDiagonalStepsThisTurn) {
    return {
      kind: "rejected",
      reason: "El contexto diagonal del turno cambió desde que se calculó la Resolution.",
      rejectionCode: "stale-diagonal-context"
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
  combatant.stats.distanceMovedFeet += resolution.totalCostFeet;
  room.currentTurn.movementUsedFeet += resolution.totalCostFeet;
  room.currentTurn.normalDiagonalStepsThisTurn = resolution.projectedContext.normalDiagonalStepsThisTurn;

  return {
    kind: "committed",
    finalPosition: { ...lastStep.position },
    finalSpatialMode: lastStep.spatialMode,
    ...(lastStep.squeezingAxis ? { squeezingAxis: lastStep.squeezingAxis } : {}),
    occupiedCells: lastStep.occupiedCells.map((cell) => ({ ...cell })),
    distanceMovedFeet: resolution.totalCostFeet,
    movementUsedFeetAfter: room.currentTurn.movementUsedFeet,
    resultingDiagonalCount: room.currentTurn.normalDiagonalStepsThisTurn
  };
}
