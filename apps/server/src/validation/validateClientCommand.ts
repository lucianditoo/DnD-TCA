import { commandSchemasMap, type ClientCommand } from "@dnd-tactical/shared";

export function validateClientCommand(raw: unknown): { success: true; data: ClientCommand } | { success: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: "Validación de comando fallida: El payload de comando no es un objeto válido." };
  }
  const rawObj = raw as Record<string, unknown>;
  if (typeof rawObj.type !== "string") {
    return { success: false, error: "Validación de comando fallida: Propiedad 'type' faltante o no es un string." };
  }
  const schema = commandSchemasMap[rawObj.type];
  if (!schema) {
    return { success: false, error: `Validación de comando fallida: Tipo de comando desconocido '${rawObj.type}'.` };
  }

  const isRoomAction = rawObj.type !== "create-room" && rawObj.type !== "join-room" && rawObj.type !== "gm-undo-turn";
  const { stateVersion, ...payload } = rawObj;
  if (isRoomAction && stateVersion !== undefined &&
      (typeof stateVersion !== "number" || !Number.isSafeInteger(stateVersion) || stateVersion < 0)) {
    return { success: false, error: "Validación de comando fallida: stateVersion inválida." };
  }
  const result = schema.safeParse(isRoomAction ? payload : raw);
  if (result.success) {
    const data = result.data as ClientCommand;
    if (isRoomAction && typeof stateVersion === "number" && "actorId" in data) {
      return { success: true, data: { ...data, stateVersion } };
    }
    return { success: true, data };
  }
  const errorMsg = result.error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(" | ");
  return { success: false, error: "Validación de comando fallida: " + errorMsg };
}
