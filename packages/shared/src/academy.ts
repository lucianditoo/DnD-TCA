export const academyScenarios = [
  { id: "camera", category: "Tablero", title: "Cámara y oclusión", objective: "Girá la cámara para ver detrás del muro y movete a la casilla marcada (4, 4)." },
  { id: "fireball", category: "Conjuros", title: "Fireball", objective: "Elegí un origen detrás del muro para que Fireball detone antes y alcance solo al enemigo expuesto." },
  { id: "opportunity", category: "Reacciones", title: "Ataques de oportunidad", objective: "Salí de la amenaza y completá el movimiento hasta la casilla marcada (5, 2) después del AdO." }
] as const;
export type AcademyScenarioId = typeof academyScenarios[number]["id"];
export type AcademyCommand =
  | { type: "start-academy"; scenarioId: AcademyScenarioId }
  | { type: "restart-academy" | "exit-academy"; attemptId: string };
export interface AcademyState {
  attemptId: string;
  scenarioId: AcademyScenarioId;
  status: "active" | "victory" | "failed";
  reason?: string;
  goal?: { x: number; y: number };
}
