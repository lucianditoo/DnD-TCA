import type { EffectSource, DurationPolicy } from "./contracts.js";

export * from "./contracts.js";

/**
 * Identificador de efecto parametrizable por catálogo.
 * En producción: CatalogEffectId<typeof effectsCatalog> = keyof typeof effectsCatalog.
 * En tests: CatalogEffectId<typeof testCatalog> = keyof typeof testCatalog.
 * Esto evita as-any y permite inyección segura de catálogos de prueba.
 */
export type CatalogEffectId<TCatalog extends Record<string, unknown>> = keyof TCatalog & string;

/**
 * Tipo de producción: identidad de efectos del catálogo real.
 * Importado desde catalog.ts en los consumidores productivos.
 */
// ProductionEffectId se define en catalog.ts como keyof typeof effectsCatalog.

/**
 * Nivel 2: EffectInstance (El Estado)
 * Genérico por catálogo para permitir inyección segura en tests.
 * Representa una aplicación concreta, temporal y rastreable del catálogo.
 * Vive de forma global en el CombatState.
 */
export interface EffectInstance<TEffectId extends string = string> {
  readonly instanceId: string;       // Identificador único (provisto por la capa de aplicación)
  readonly effectId: TEffectId;      // Referencia al EffectDefinition en el catálogo
  readonly source: Readonly<EffectSource>;     // Causante
  readonly targets?: readonly string[];       // CombatantIDs afectados. Undefined implica un efecto global o de área.
  /**
   * Celdas de grid ancladas (Sprint 034), formato canónico "x,y,zFeet" (ver `footprintCellKey`
   * en rules.ts). Independiza el efecto de una identidad biológica: modela peligros ambientales
   * persistentes (Muro de Fuego, trampas fijas, nubes) anclados a coordenadas del tablero.
   * Mutuamente independiente de `targets`; ambos pueden coexistir o estar ausentes.
   */
  readonly targetCells?: readonly string[];
  readonly appliedAtEvent: Readonly<{
    type: "TurnStarted" | "ActionResolved" | "CombatStarted" | "SystemInjected";
    combatantId?: string;
    round: number;
  }>;
  readonly duration?: Readonly<DurationPolicy>;
  readonly stacks?: number;
}
