import { z } from "zod";
import { positionSchema } from "./base.js";

/**
 * Sprint 053B: intención genérica de objetivo — por combatiente (targeting directo) o por
 * casilla (Ocultación Total / Blind Targeting, ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §13.7). Unión discriminada, no un
 * comando paralelo — `resolve-attack` sigue siendo la única ruta de resolución de ataque.
 */
export const attackTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("combatant"), combatantId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("square"), position: positionSchema }).strict()
]);

export const resolveAttackSchema = z.object({
  type: z.literal("resolve-attack"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  attackerId: z.string().min(1),
  // Sprint 053B: `targetId` se conserva por retrocompatibilidad (equivalente a
  // `target: { kind: "combatant", combatantId: targetId }`). `target` es la forma genérica nueva
  // y admite además `{ kind: "square", position }`. Debe enviarse exactamente uno de los dos.
  targetId: z.string().min(1).optional(),
  target: attackTargetSchema.optional(),
  d20Roll: z.number().int().nullable(),
  damage: z.number().int().nullable(),
  isAutoRoll: z.boolean().optional()
}).strict().refine((command) => (command.targetId !== undefined) !== (command.target !== undefined), {
  message: "Debe especificarse exactamente uno de targetId o target."
});

export const resolveAttackConfirmationSchema = z.object({
  type: z.literal("resolve-attack-confirmation"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  d20Roll: z.number().int().nullable(),
  damage: z.number().int().nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();

export const cancelAttackThreatSchema = z.object({
  type: z.literal("cancel-attack-threat"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1)
}).strict();

export const resolveOpportunityAttackSchema = z.object({
  type: z.literal("resolve-opportunity-attack"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  opportunityId: z.string().min(1),
  d20Roll: z.number().int().nullable(),
  damage: z.number().int().nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();
