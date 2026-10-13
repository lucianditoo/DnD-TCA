import { z } from "zod";
import type { DemoClientCommand, DemoServerEvent } from "../../types.js";

export const demoSpeedMultiplierSchema = z.union([
  z.literal(0.5),
  z.literal(1),
  z.literal(2)
]);

export const startDemoSchema = z.object({
  type: z.literal("start-demo"),
  demoId: z.string().min(1),
  name: z.string().min(1).max(40).optional()
}).strict();

export const pauseDemoSchema = z.object({
  type: z.literal("pause-demo"),
  sessionId: z.string().min(1)
}).strict();

export const resumeDemoSchema = z.object({
  type: z.literal("resume-demo"),
  sessionId: z.string().min(1)
}).strict();

export const stepDemoSchema = z.object({
  type: z.literal("step-demo"),
  sessionId: z.string().min(1)
}).strict();

export const setDemoSpeedSchema = z.object({
  type: z.literal("set-demo-speed"),
  sessionId: z.string().min(1),
  speedMultiplier: demoSpeedMultiplierSchema
}).strict();

export const restartDemoSchema = z.object({
  type: z.literal("restart-demo"),
  sessionId: z.string().min(1),
  scope: z.enum(["scene", "all"])
}).strict();

export const exitDemoSchema = z.object({
  type: z.literal("exit-demo"),
  sessionId: z.string().min(1)
}).strict();

export const demoCommandSchemasMap = {
  "start-demo": startDemoSchema,
  "pause-demo": pauseDemoSchema,
  "resume-demo": resumeDemoSchema,
  "step-demo": stepDemoSchema,
  "set-demo-speed": setDemoSpeedSchema,
  "restart-demo": restartDemoSchema,
  "exit-demo": exitDemoSchema
} as const;

export const demoClientCommandSchema = z.discriminatedUnion("type", [
  startDemoSchema,
  pauseDemoSchema,
  resumeDemoSchema,
  stepDemoSchema,
  setDemoSpeedSchema,
  restartDemoSchema,
  exitDemoSchema
]);

export const demoSessionStateSchema = z.object({
  sessionId: z.string().min(1),
  demoId: z.string().min(1),
  roomCode: z.string().min(1),
  status: z.enum(["starting", "preparing", "playing", "paused", "completed", "failed"]),
  currentSceneIndex: z.number().int().nonnegative(),
  totalScenes: z.number().int().positive(),
  currentSceneTitle: z.string(),
  currentStepIndex: z.number().int().nonnegative(),
  totalStepsInScene: z.number().int().nonnegative(),
  activeActorName: z.string().nullable(),
  actionSummary: z.string(),
  ruleExplanation: z.string(),
  speedMultiplier: demoSpeedMultiplierSchema,
  errorMessage: z.string().nullable()
}).strict();

export const demoServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("demo-session-state"),
    state: demoSessionStateSchema
  }).strict(),
  z.object({
    type: z.literal("demo-exited"),
    sessionId: z.string().min(1)
  }).strict()
]);

export type DemoValidationResult =
  | { ok: true; data: DemoClientCommand }
  | { ok: false; error: string };

export function isDemoCommandType(type: unknown): type is DemoClientCommand["type"] {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(demoCommandSchemasMap, type);
}

export function validateDemoCommand(raw: unknown): DemoValidationResult {
  if (!raw || typeof raw !== "object" || !("type" in raw) || typeof (raw as { type: unknown }).type !== "string") {
    return { ok: false, error: "Formato de comando de demo invalido." };
  }
  const commandType = (raw as { type: string }).type;
  const schema = demoCommandSchemasMap[commandType as keyof typeof demoCommandSchemasMap];
  if (!schema) {
    return { ok: false, error: `Comando de demo desconocido: ${commandType}` };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: `Error de validacion en '${commandType}': ${result.error.issues[0]?.message ?? "Payload invalido"}` };
  }
  return { ok: true, data: result.data as DemoClientCommand };
}

export function validateDemoServerEvent(raw: unknown): { ok: true; data: DemoServerEvent } | { ok: false; error: string } {
  const result = demoServerEventSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Evento de demo invalido" };
  }
  return { ok: true, data: result.data as DemoServerEvent };
}
