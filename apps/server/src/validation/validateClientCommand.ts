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

  const result = schema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as ClientCommand };
  }
  const errorMsg = result.error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(" | ");
  return { success: false, error: "Validación de comando fallida: " + errorMsg };
}
