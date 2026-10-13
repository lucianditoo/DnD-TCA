import type { Board, CreatureTemplate, EncounterPhase, Position } from "../types.js";
import type { ProductionEffectId } from "../effects/catalog.js";

export interface DemoStepCheckpoint {
  readonly phase?: EncounterPhase;
  readonly round?: number;
  readonly activeCombatantId?: string;
  readonly combatantPosition?: { readonly combatantId: string; readonly position: Position };
  readonly targetHp?: { readonly combatantId: string; readonly hpCurrent: number };
  readonly hasEffect?: { readonly combatantId: string; readonly effectId: ProductionEffectId; readonly present: boolean };
  readonly spellSlotExpended?: { readonly combatantId: string; readonly slotId: string; readonly isExpended: boolean };
  readonly ammoRemaining?: { readonly combatantId: string; readonly itemId: string; readonly quantity: number };
  readonly movementUsedFeet?: number;
  readonly pendingOpportunityAttacksCount?: number;
  readonly opportunityAttacksThisRound?: { readonly combatantId: string; readonly count: number };
}

export type DemoStepCommandSpec =
  | { readonly kind: "sort-initiative" }
  | { readonly kind: "end-turn" }
  | { readonly kind: "move-combatant"; readonly combatantId: string; readonly to: Position; readonly path?: readonly Position[]; readonly isAcrobatic?: boolean }
  | { readonly kind: "declare-attack-mode"; readonly combatantId: string; readonly mode: "standard" | "full"; readonly defensive: boolean }
  | { readonly kind: "resolve-attack"; readonly attackerId: string; readonly targetId: string; readonly d20Roll: number; readonly damage: number }
  | { readonly kind: "resolve-attack-confirmation"; readonly d20Roll: number; readonly damage: number | null }
  | { readonly kind: "resolve-opportunity-attack"; readonly d20Roll: number; readonly damage: number | null }
  | { readonly kind: "use-tactical-action"; readonly combatantId: string; readonly action: "stand-up" }
  | { readonly kind: "use-tactical-action"; readonly combatantId: string; readonly action: "five-foot-step"; readonly to: Position }
  | { readonly kind: "resolve-special-maneuver"; readonly maneuver: { readonly type: "trip"; readonly attackerId: string; readonly targetId: string; readonly d20TouchRoll: number; readonly d20OpposedRoll: number } }
  | { readonly kind: "cast-spell"; readonly casterId: string; readonly targetId: string; readonly slotId: string; readonly d20Roll: number | null; readonly amount: number | null };

export interface DemoManeuverRolls {
  readonly "opportunity-attack"?: number;
  readonly "opposed-defender"?: number;
  readonly "counter-trip-attacker"?: number;
  readonly "counter-trip-defender"?: number;
  readonly d100?: number;
}

export interface DemoStepDefinition {
  readonly id: string;
  readonly actorName: string;
  readonly actionSummary: string;
  readonly ruleExplanation: string;
  readonly command: DemoStepCommandSpec;
  readonly diceRolls?: readonly number[];
  readonly maneuverRolls?: DemoManeuverRolls;
  readonly expect: DemoStepCheckpoint;
  readonly pauseAfterMs: number;
}

export interface DemoSceneDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly board: Board;
  readonly combatants: readonly CreatureTemplate[];
  readonly initiatives: ReadonlyArray<{ readonly combatantId: string; readonly value: number }>;
  readonly steps: readonly DemoStepDefinition[];
}

export interface DemoScriptDefinition {
  readonly id: string;
  readonly title: string;
  readonly scenes: readonly DemoSceneDefinition[];
}
