import type { EffectInstance } from "./effects/index.js";
import type { ProductionEffectId } from "./effects/catalog.js";
import type { Trait } from "./effects/contracts.js";
import type { ConcealmentTrace } from "./effects/reducer.js";

export type ParticipantRole = "gm" | "player";
export type CombatantType = "player" | "enemy";
export type ControllerType = "gm" | "player";
export interface CombatantControl { type: "gm" | "player"; participantId?: string; }
export type ActionType = "standard" | "move" | "full-round" | "swift" | "free";
export type LogKind = "system" | "movement" | "attack" | "damage" | "turn" | "initiative" | "opportunity" | "status" | "skill";
export type LifeStatus = "active" | "disabled" | "dying" | "stable" | "dead";
export type CombatOutcome = "ongoing" | "victory" | "tpk";
export type EncounterPhase = "preparation" | "active" | "critical-confirmation" | "opportunity-resolution" | "finished";
export type SizeCategory = "fine" | "diminutive" | "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan" | "colossal";
export type CreatureTypeId = "aberration" | "animal" | "construct" | "dragon" | "elemental" | "fey" | "giant" | "humanoid" | "magical_beast" | "monstrous_humanoid" | "ooze" | "outsider" | "plant" | "undead" | "vermin";
export type CombatFeatureId = `srd_sneak_attack_${number}d6`;
export type SpecialManeuverId = "trip" | "bull_rush" | "grapple";
export type SavingThrowType = "fortitude" | "reflex" | "will";
export type SkillId = "escape_artist";
export type SkillRanks = Readonly<Record<SkillId, number>>;

export interface Position { x: number; y: number; zFeet: number; }
export interface Board {
  width: number;
  height: number;
  cellSizeFeet: number;
  difficultTerrainCells?: string[]; // Claves "x,y" O(1)
  impassableCells?: string[];       // Claves "x,y" O(1) para muros y obstáculos: bloqueo de MOVIMIENTO exclusivamente (Sprint 052A/052B) — nunca implica Cover ni Line of Effect
  narrowCells?: string[];           // Claves "x,y" O(1) para Squeezing
  lineOfEffectBlockingCells?: string[]; // Claves "x,y" O(1): obstrucción física completa para Line of Effect (Sprint 052B). Independiente de impassableCells: no se infiere de un campo al otro.
  dimLightCells?: string[];  // Claves "x,y" O(1): iluminación tenue (Sprint 053B). Celda ausente de dimLightCells/darknessCells = luz brillante por defecto.
  darknessCells?: string[];  // Claves "x,y" O(1): oscuridad total (Sprint 053B). Si una celda aparece en ambos campos, darkness domina (ver getVisionAssessment).
}
export type ArmorClassBonusType = "armor" | "shield" | "natural_armor" | "dex" | "dodge" | "deflection" | "size" | "misc";
export interface ArmorClassBreakdown {
  base: number;
  armor: number;
  shield: number;
  naturalArmor: number;
  dexterity: number;
  size: number;
  dodge: number;
  deflection: number;
  misc: number;
}
export interface Buff {
  id: string;
  name: string;
  source: string;
  attackBonus?: number;
  acBonus?: number;
  acBonusType?: ArmorClassBonusType;
  speedBonusFeet?: number;
  remainingTurns: number;
  expiresAtStartOfTurnOf?: string;
  expiresAfterTurnOf?: string;
  preventsOpportunityAttacks?: boolean;
  aidBonus?: number;
  aidTargetId?: string;
  aidTargetName?: string;
  aidChoice?: "pending" | "attack" | "ac";
  aidSourceId?: string;
}
export type AbilityResolution =
  | { kind: "automatic-damage"; damageExpression: string }
  | { kind: "attack-roll"; attackType: "melee" | "ranged"; targetAcType: "normal" | "touch"; abilityForAttack: "strength" | "dexterity"; damageExpression: string; criticalThreatFrom: number; criticalMultiplier: number }
  | { kind: "healing"; healingExpression: string }
  | { kind: "effect"; effectId: string };
export type AoEShapeType = "cone" | "line" | "burst";

export type AoEShape = 
  | { readonly type: "cone"; readonly lengthFeet: number }
  | { readonly type: "line"; readonly lengthFeet: number; readonly widthFeet: 5 }
  | { readonly type: "burst"; readonly radiusFeet: number };

export type CardinalDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/**
 * Sprint 042: única sede de tipos para Cover. `kind` distingue la fuente (criatura interpuesta)
 * para diagnóstico y presentación, sin persistir contexto espacial.
 * Sprint 052B: se retiró `"terrain-cover"` — `impassableCells` ya no concede Cover; la
 * obstrucción física completa ahora es responsabilidad exclusiva de `LineOfEffectAssessment`
 * (Total Cover), una regla distinta con consecuencias distintas. Ver
 * `docs/designs/terrain-cover-line-of-effect-decision.md`.
 */
export type CoverKind = "none" | "creature-cover";
export interface CoverAssessment {
  readonly applies: boolean;
  readonly acBonus: number;
  readonly kind: CoverKind;
  readonly blockerIds: readonly string[];
}

export type ConcealmentKind = "none" | "partial" | "total";
export interface ConcealmentAssessment {
  readonly applies: boolean;
  readonly kind: ConcealmentKind;
  readonly missChancePercent: number;
  readonly directTargetingAllowed: boolean;
  readonly requiresTargetSquare: boolean;
  readonly opportunityAttackAllowed: boolean;
  readonly labelParts: readonly string[];
  readonly traces: readonly ConcealmentTrace[];
  /**
   * Sprint 053B: trazas de `VisionAssessment` compuestas en el resultado final (severidad
   * máxima, ver `composeConcealmentAssessment`). Array separado de `traces` (efectos
   * declarativos) a propósito — Vision no se origina en un `EffectInstance` y nunca se sintetiza
   * como uno; ambos conjuntos de trazas se conservan por separado, nunca fusionados.
   */
  readonly visionTraces: readonly VisionTrace[];
}

/**
 * Sprint 052B: assessment puro e independiente de Line of Effect (obstrucción física completa,
 * `board.lineOfEffectBlockingCells`). Ausencia de Line of Effect ⇒ Total Cover ⇒ el ataque no
 * puede intentarse — una regla de legalidad, no de miss chance. Nunca se fusiona con
 * `CoverAssessment` ni `ConcealmentAssessment`. Ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` y
 * `docs/designs/terrain-cover-line-of-effect-decision.md`.
 */
export interface LineOfEffectAssessment {
  readonly hasLineOfEffect: boolean;
  readonly blockedCellKeys: readonly string[];
}

/**
 * Sprint 053B: geometría pura e independiente de Line of Sight (ruta visual). Hermana de
 * `LineOfEffectAssessment` (misma clase de pregunta geométrica, fuente distinta) — nunca su
 * alias ni un derivado suyo. Responde exclusivamente si existe una ruta visual geométricamente
 * despejada, sin luz ni percepción. Ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §3/§13.5.
 */
export interface VisualPathAssessment {
  readonly hasClearVisualPath: boolean;
  readonly blockedCellKeys: readonly string[];
}

/**
 * Sprint 053B: unión cerrada del motivo dominante de `VisionAssessment` — exactamente las 5
 * categorías que esta vertical produce, sin especular con categorías futuras (invisibilidad,
 * niebla, Blindsight). Ver §13.5/§13.9 del NDD.
 */
export type VisionReason =
  | "clear"
  | "dim-light"
  | "darkness"
  | "blocked-visual-path"
  | "darkvision-out-of-range";

/**
 * Sprint 053B: traza individual de una fuente de Vision — mismo vocabulario que
 * `ConcealmentTrace` (fuente + estado) pero sin `effectInstanceId`: Vision no se origina en un
 * `EffectInstance`.
 */
export interface VisionTrace {
  readonly source: "board-light" | "visual-path" | "intrinsic-perception";
  readonly label: string;
  readonly kind: ConcealmentKind;
  readonly missChancePercent: number;
  readonly status: "applied" | "suppressed";
}

/**
 * Sprint 053B: composición de `VisualPathAssessment` + iluminación estática + capacidad
 * perceptiva del observador. Assessment independiente — no vive dentro de `ConcealmentAssessment`
 * ni de `CoverAssessment`; su resultado se compone con `ConcealmentAssessment` por severidad
 * máxima en `getConcealmentAssessment`, nunca se fusiona con él. Ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §13.5/§13.9.
 */
export interface VisionAssessment {
  readonly canPerceiveVisually: boolean;
  readonly kind: ConcealmentKind;
  readonly missChancePercent: number;
  readonly directTargetingAllowed: boolean;
  readonly requiresTargetSquare: boolean;
  readonly dominantReason: VisionReason;
  readonly traces: readonly VisionTrace[];
}

export interface Ability { id: string; name: string; description: string; actionType: ActionType; rangeFeet: number; target: "self" | "ally" | "enemy" | "creature" | "area"; aoe?: AoEShape; resolution: AbilityResolution; }

export interface AbilityScores { strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number; }
export interface WeaponProfile { name: string; handedness: "one-handed" | "two-handed" | "light" | "ranged" | "thrown"; damageDice: string; critical: string; abilityForAttack: "strength" | "dexterity"; abilityForDamage: "strength" | "dexterity" | "none"; damageAbilityMultiplier: number; meleeReachFeet: number; rangeIncrementFeet?: number; maxRangeIncrements?: number; maxRangeFeet: number; notes: string; criticalThreatFrom?: number; criticalMultiplier?: number; }
export interface MeleeThreatSource { sourceId: string; kind: "weapon" | "natural" | "unarmed" | "effect"; minReachFeet: number; maxReachFeet: number; }
export interface TacticalModifierSummary { attackBonus: number; labelParts: string[]; cover: CoverAssessment; concealment: ConcealmentAssessment; }
export interface AttackContextModifiers {
  flanking: boolean;
  byAttackType: Record<"melee" | "ranged", TacticalModifierSummary>;
}
export interface AttackDeliveryContext {
  readonly attackType: "melee" | "ranged";
  readonly distanceFeet: number;
  readonly requiresAttackRoll: boolean;
  readonly dealsDamage: boolean;
}

export interface EquipmentSlots {
  readonly mainHandItemId: string | null;
  readonly offHandItemId: string | null;
  readonly armorItemId: string | null;
}
export interface InventoryItem {
  readonly itemId: string;
  readonly catalogId: string;
  readonly quantity?: number;
}
export interface IntrinsicDefense {
  naturalArmorBonus: number;
  dodgeBonus: number;
  deflectionBonus: number;
  miscArmorClassBonus: number;
}
/**
 * Sprint 053B: rasgo permanente e innato de percepción visual, mismo patrón que
 * `IntrinsicDefense` — vive directamente en `Combatant`/`CreatureTemplate`, sourced desde
 * catálogo, no es un `EffectContribution` ni se deriva de `sizeCategory`/`creatureTypeId`. `0`
 * significa sin Darkvision. No incluye Low-Light Vision ni otros sentidos (Blindsight,
 * Blindsense) — ver `docs/designs/vision-and-line-of-effect-architecture.md` §13.4.
 */
export interface IntrinsicPerception {
  readonly darkvisionFeet: number;
}
/**
 * Entrada en el loadout de conjuros preparados de una criatura/perfil.
 * Representa UN slot individual (dos preparaciones del mismo conjuro = dos entradas).
 * NO almacena isExpended — el gasto solo existe durante el combate en CombatantSnapshot.
 */
export interface PreparedSpellLoadoutEntry {
  readonly slotId: string;
  readonly spellId: string;
}

/**
 * Slot de conjuro materializado en el snapshot de combate.
 * Derivado de PreparedSpellLoadoutEntry al inicio del combate con isExpended = false.
 */
export interface PreparedSpellSlot {
  readonly slotId: string;
  readonly spellId: string;
  readonly isExpended: boolean;
}

export interface CreatureTemplate {
  id: string;
  name: string;
  type: CombatantType;
  controller: ControllerType;
  playerName?: string;
  icon: string;
  hpMax: number;
  baseAttackBonus: number;
  baseFortitude: number;
  baseReflex: number;
  baseWill: number;
  baseSpeedFeet: number;
  abilityScores: AbilityScores;
  sizeCategory: SizeCategory;
  creatureTypeId: CreatureTypeId;
  featureIds: CombatFeatureId[];
  skillRanks: SkillRanks;
  inventory: readonly InventoryItem[];
  equipmentSlots: EquipmentSlots;
  featIds: string[];
  intrinsicDefense: IntrinsicDefense;
  intrinsicPerception?: IntrinsicPerception;
  naturalAttackId?: string;
  abilities: string[];
  /** Conjuros preparados. Cada entrada representa un slot individual (no una definición). */
  preparedSpellLoadout?: PreparedSpellLoadoutEntry[];
  buffs: Array<Omit<Buff, "id">>;
  position: Position;
}
export interface CreatureCatalog { heroes: CreatureTemplate[]; enemies: CreatureTemplate[]; }
export interface GameCatalog { creatures: CreatureCatalog; abilities: Ability[]; }
export type StoredProfile = CreatureTemplate & { updatedAt: string };

export interface CombatantStats { damageDealt: number; damageTaken: number; distanceMovedFeet: number; attacksMade: number; hits: number; misses: number; opportunityAttacksMade: number; opportunityAttacksThisRound: number; readonly targetsAttackedThisRoundViaAoO: readonly string[]; kills: number; timesDroppedToZero: number; healingReceived: number; }

export interface CombatantSnapshot {
  id: string;
  sourceProfileId?: string;
  name: string;
  type: CombatantType;
  controller: ControllerType;
  controlledBy: CombatantControl;
  playerName?: string;
  hpCurrent: number;
  hpMax: number;
  baseAttackBonus: number;
  baseFortitude: number;
  baseReflex: number;
  baseWill: number;
  baseSpeedFeet: number;
  abilityScores: AbilityScores;
  sizeCategory: SizeCategory;
  creatureTypeId: CreatureTypeId;
  featureIds: CombatFeatureId[];
  skillRanks: SkillRanks;
  sneakAttackDice: number;
  ruleTraits: readonly Trait[];
  inventory: readonly InventoryItem[];
  equipmentSlots: EquipmentSlots;
  intrinsicDefense: IntrinsicDefense;
  intrinsicPerception?: IntrinsicPerception;
  naturalAttackId?: string;
  featIds: string[];
  /** Objetivo designado por Esquiva (Dodge). `null`/ausente = sin designación activa. */
  dodgeTargetId?: string | null;
  initiative: number | null;
  isStable: boolean;
  buffs: Buff[];
  abilities: Ability[];
  /** Conjuros preparados y su estado de gasto para este encuentro. */
  preparedSpells: PreparedSpellSlot[];
  position: Position;
  icon: string;
  stats: CombatantStats;
}

export type Combatant = CombatantSnapshot;

// ─────────────────────────────────────────────────────────────────────────────
// COMPILE-TIME GUARD: Forbidden Scalar Property Cache
//
// Prevents reintroduction of pre-V3 derived scalar properties that bypass the
// Rule Engine SSOT (Rules.totalArmorClass, totalAttackBonus, totalSpeedFeet).
// If any of the forbidden keys are added to the guarded interfaces, TypeScript
// will refuse to compile — the Extract resolves to a non-never string, which
// violates the <T extends never> constraint.
//
// Protected interfaces : CombatantSnapshot | CreatureTemplate | StoredProfile
// Forbidden properties : "armorClass" | "attackModifier" | "damageBase" | "speedFeet"
// ─────────────────────────────────────────────────────────────────────────────
type _ForbiddenScalarKeys = "armorClass" | "attackModifier" | "damageBase" | "speedFeet" | "weapon" | "equipment" | "threatProfile" | "armorClassBreakdown";
type _AssertNoForbiddenKeys<T extends never> = T;
type _ForbiddenInCombatantSnapshot = Extract<keyof CombatantSnapshot, _ForbiddenScalarKeys>;
type _CombatantSnapshotHasNoForbiddenScalarCache = _AssertNoForbiddenKeys<_ForbiddenInCombatantSnapshot>;
type _ForbiddenInCreatureTemplate = Extract<keyof CreatureTemplate, _ForbiddenScalarKeys>;
type _CreatureTemplateHasNoForbiddenScalarCache = _AssertNoForbiddenKeys<_ForbiddenInCreatureTemplate>;
type _ForbiddenInStoredProfile = Extract<keyof StoredProfile, _ForbiddenScalarKeys>;
type _StoredProfileHasNoForbiddenScalarCache = _AssertNoForbiddenKeys<_ForbiddenInStoredProfile>;

export interface OpportunityAttack {
  id: string;
  attackerId: string;
  targetId: string;
  attackerPosition: Position;
  origin: Position;
  destination: Position;
  movementCostFeet?: number;
  reason: string;
  createdAt: string;
  provokingCells?: Position[];
  requiredCd?: 15 | 25;
}

export interface TurnState { combatantId: string | null; movementUsedFeet: number; usedMoveAction: boolean; usedStandardAction: boolean; usedFullAttack: boolean; usedFiveFootStep: boolean; usedSwiftAction: boolean; usedTotalDefense: boolean; usedStabilization: boolean; attacksMade: number; attackMode: "none" | "standard" | "full"; defensiveFightingDeclared: boolean; }
export interface CombatLogEntry { id: string; kind: LogKind; message: string; createdAt: string; }
export type DamageCategory = "base" | "precision" | "energy" | "other";
export interface DamageComponent {
  readonly sourceId: string;
  readonly label: string;
  readonly category: DamageCategory;
  readonly amount: number;
  readonly diceExpression?: string;
  readonly neverMultiply: boolean;
}
export interface DamageBundle {
  readonly components: readonly DamageComponent[];
  readonly total: number;
}
export interface AttackThreatState {
  readonly attackerId: string;
  readonly targetId: string;
  readonly initialD20Roll: number;
  readonly attackBonusTotal: number;
  readonly targetArmorClass: number;
  readonly normalDamageBundle: DamageBundle;
  readonly criticalThreatFrom: number;
  readonly criticalMultiplier: number;
  readonly weaponName: string;
  readonly isFullAttack: boolean;
  readonly fightingDefensively?: boolean;
  readonly label: string;
  readonly opportunityAttackId?: string;
}
export interface PendingCoupDeGrace {
  readonly actorId: string;
  readonly targetId: string;
  readonly weaponId: string | null;
}

export interface CombatRoom { code: string; board: Board; combatants: Combatant[]; turnOrder: string[]; activeTurnIndex: number; round: number; phase: EncounterPhase; outcome: CombatOutcome; completedAt: string | null; currentTurn: TurnState; pendingOpportunityAttacks: OpportunityAttack[]; log: CombatLogEntry[]; activeAttackThreat: AttackThreatState | null; pendingCoupDeGrace: PendingCoupDeGrace | null; effectInstances: EffectInstance<ProductionEffectId>[]; eventSequence: number; }
export interface CombatRulesSnapshot<TEffectId extends string = string> {
  readonly board: {
    readonly width: number;
    readonly height: number;
    readonly cellSizeFeet: number;
    readonly difficultTerrainCells?: ReadonlyArray<string>;
    readonly impassableCells?: ReadonlyArray<string>;
    readonly narrowCells?: ReadonlyArray<string>;
    readonly lineOfEffectBlockingCells?: ReadonlyArray<string>;
    readonly dimLightCells?: ReadonlyArray<string>;
    readonly darknessCells?: ReadonlyArray<string>;
  };
  readonly combatants: ReadonlyArray<Readonly<CombatantSnapshot>>;
  readonly currentTurn: Readonly<TurnState>;
  readonly phase: EncounterPhase;
  readonly pendingOpportunityAttacks: ReadonlyArray<Readonly<OpportunityAttack>>;
  readonly activeAttackThreat: Readonly<AttackThreatState> | null;
  readonly pendingCoupDeGrace: Readonly<PendingCoupDeGrace> | null;
  /**
   * Copia defensiva de las instancias de efectos activas en el momento de creación del snapshot.
   * El Snapshot es un portador pasivo de datos: no interpreta, no reduce, no aplica reglas.
   * La capa de reglas (rules.ts) usará este campo para pasarlo al EffectReducer.
   */
  readonly effectInstances: ReadonlyArray<Readonly<EffectInstance<TEffectId>>>;
}

// DT-006: Structural Guard to prevent orphan fields in CombatRulesSnapshot
export type SizedStructuralMatch<T, K> = {
  [P in keyof T]: P extends keyof K ? true : never;
};

type _EphemeralRoomKeys = "code" | "log" | "completedAt" | "outcome" | "turnOrder" | "activeTurnIndex" | "round" | "eventSequence";
type _RequiredSnapshotKeys = Omit<CombatRoom, _EphemeralRoomKeys>;
type _RoomSnapshotExhaustiveGuard = SizedStructuralMatch<_RequiredSnapshotKeys, CombatRulesSnapshot>;
type _AssertGuard<T extends Record<string, true>> = T;
type _ValidateExhaustiveGuard = _AssertGuard<_RoomSnapshotExhaustiveGuard>;
export interface Participant { id: string; role: ParticipantRole; name: string; roomCode: string; }

/**
 * Sprint 053B: intención genérica de objetivo de ataque — por combatiente (targeting directo) o
 * por casilla (Ocultación Total / Blind Targeting). Unión discriminada; nunca un comando
 * paralelo — ver `docs/designs/vision-and-line-of-effect-architecture.md` §13.7.
 */
export type AttackTarget =
  | { readonly kind: "combatant"; readonly combatantId: string }
  | { readonly kind: "square"; readonly position: Position };

export type ClientCommand =
  | { type: "create-room"; name: string }
  | { type: "join-room"; roomCode: string; name: string; role: ParticipantRole }
  | { type: "add-demo-combatant"; roomCode: string; actorId: string; variant: "hero" | "enemy" | "cedrick" | "ranger" }
  | { type: "add-catalog-combatant"; roomCode: string; actorId: string; templateId: string; category: "heroes" | "enemies" }
  | { type: "add-profile-combatant"; roomCode: string; actorId: string; profile: CreatureTemplate }
  | { type: "set-initiative"; roomCode: string; actorId: string; combatantId: string; initiative: number }
  | { type: "sort-initiative"; roomCode: string; actorId: string }
  | { type: "move-combatant"; roomCode: string; actorId: string; combatantId: string; to: Position; path?: Position[]; isAcrobatic?: boolean }
  | { type: "declare-attack-mode"; roomCode: string; actorId: string; combatantId: string; mode: "standard" | "full"; defensive: boolean }
  | { type: "cancel-attack-mode"; roomCode: string; actorId: string; combatantId: string }
  | { type: "resolve-attack"; roomCode: string; actorId: string; attackerId: string; targetId?: string; target?: AttackTarget; d20Roll: number | null; damage: number | null; isAutoRoll?: boolean }
  | { type: "resolve-attack-confirmation"; roomCode: string; actorId: string; d20Roll: number | null; damage: number | null; isAutoRoll?: boolean }
  | { type: "cancel-attack-threat"; roomCode: string; actorId: string }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "total-defense" }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "charge"; targetId: string; d20Roll: number; damage: number | null }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "aid-another"; allyId: string; targetId: string; d20Roll: number }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "five-foot-step"; to: Position }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "withdraw"; to: Position; path?: Position[] }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "run"; to: Position }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "stand-up"; isAutoRoll?: boolean }
  | { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "coup-de-grace"; targetId: string }
  | { type: "resume-coup-de-grace"; roomCode: string; actorId: string; combatantId: string }
  | { type: "choose-aid-bonus"; roomCode: string; actorId: string; combatantId: string; buffId: string; choice: "attack" | "ac" }
  | { type: "use-ability"; roomCode: string; actorId: string; casterId: string; targetId: string; abilityId: string; amount: number | null }
  | { type: "resolve-ability-attack"; roomCode: string; actorId: string; casterId: string; targetId: string; abilityId: string; d20Roll: number; damage: number | null }
  | { type: "resolve-opportunity-attack"; roomCode: string; actorId: string; opportunityId: string; d20Roll: number | null; damage: number | null; isAutoRoll?: boolean }
  | { type: "equip-item"; roomCode: string; actorId: string; combatantId: string; itemId: string; slot: "mainHand" | "offHand" | "armor" }
  | { type: "unequip-item"; roomCode: string; actorId: string; combatantId: string; slot: "mainHand" | "offHand" | "armor" }
  | { type: "resolve-special-maneuver"; roomCode: string; actorId: string; maneuver:
      | { type: "trip"; attackerId: string; targetId: string; d20TouchRoll: number; d20OpposedRoll: number }
      | { type: "bull_rush"; attackerId: string; targetId: string; d20OpposedRoll: number | null; isAutoRoll?: boolean }
      | { type: "grapple"; attackerId: string; targetId: string; d20TouchRoll: number | null; d20OpposedRoll: number | null; isAutoRoll?: boolean }
    }
  | { type: "resolve-grapple-escape"; roomCode: string; actorId: string; combatantId: string; escapeType: "grapple_check" | "escape_artist"; d20Roll: number | null; isAutoRoll?: boolean }
  | { type: "resolve-saving-throw"; roomCode: string; actorId: string; targetId: string; saveType: "fortitude" | "reflex" | "will"; dc: number; d20Roll: number }
  | { type: "roll-stabilization"; roomCode: string; actorId: string; combatantId: string; d100Roll: number }
  | { type: "heal-combatant"; roomCode: string; actorId: string; combatantId: string; amount: number; source: string }
  /**
   * Lanzamiento de conjuro autoritativo.
   * El cliente referencia un slot por slotId — nunca envía spellId, level, school, saveDC ni targetAcType.
   * El servidor deriva el conjuro del slot y valida todo desde SpellsCatalog.
   * `d20Roll` es requerido para conjuros con tirada de ataque, null para los demás.
   * `amount` es requerido para curación manual, null para los demás.
   */
  | { type: "cast-spell"; roomCode: string; actorId: string; casterId: string; targetId?: string; direction?: CardinalDirection; targetPosition?: Position; slotId: string; d20Roll: number | null; amount: number | null }
  | { type: "gm-move-combatant"; roomCode: string; actorId: string; combatantId: string; to: Position }
  | { type: "gm-set-hp"; roomCode: string; actorId: string; combatantId: string; hpCurrent: number; hpMax?: number }
  | { type: "gm-set-status"; roomCode: string; actorId: string; combatantId: string; status: LifeStatus }
  | { type: "gm-clear-opportunities"; roomCode: string; actorId: string }
  | { type: "gm-add-log"; roomCode: string; actorId: string; message: string }
  | { type: "gm-apply-effect"; roomCode: string; actorId: string; targetId: string; effectId: string; durationPreset?: "until_target_turn_end" }
  | { type: "gm-apply-environmental-hazard"; roomCode: string; actorId: string; effectId: string; targetCells: string[] }
  | { type: "gm-remove-effect"; roomCode: string; actorId: string; instanceId: string }
  | { type: "declare-dodge-target"; roomCode: string; actorId: string; combatantId: string; targetId: string | null }
  | { type: "gm-force-outcome"; roomCode: string; actorId: string; outcome: CombatOutcome }
  | { type: "end-turn"; roomCode: string; actorId: string };

export type ServerEvent =
  | { type: "hello"; participant: Participant; room: CombatRoom; catalog: GameCatalog }
  | { type: "room-update"; room: CombatRoom }
  | { type: "error"; message: string };
