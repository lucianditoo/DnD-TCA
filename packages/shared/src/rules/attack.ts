import { type AmmunitionKind, type WeaponEntry } from "../data/equipment/index.js";
import { cryptoId } from "../demo-data.js";
import { effectsCatalog, type ProductionEffectId } from "../effects/catalog.js";
import { type EffectDefinition, type Trait } from "../effects/contracts.js";
import { EffectReducer, type ReducedEffects } from "../effects/reducer.js";
import { type CatalogEffectId } from "../effects/types.js";
import { EquipmentCatalog } from "../equipmentCatalog.js";
import { deriveMeleeThreatSources, getEquippedWeaponEntry, resolveEquippedWeaponProfile } from "../equipmentStats.js";
import { FeatCatalog } from "../featCatalog.js";
import { lifeStatus } from "../lifeStatus.js";
import { footprintCellKey, type FootprintGeometry, getCombatantOccupiedCells, getCombatantOccupiedCellsAt, projectFootprintGeometry } from "../movementGeometry.js";
import { type MovementResolutionStep } from "../movementResolution.js";
import { getSizeRule } from "../sizeRules.js";
import { type SpellSaveDCBreakdown } from "../spells/contracts.js";
import { type AttackContextModifiers, type AttackDeliveryContext, type Combatant, type CombatantSnapshot, type CombatRulesSnapshot, type ConcealmentAssessment, type OpportunityAttack, type OpportunityAttackLegality, type Position, type SizeCategory, type SpecialManeuverId } from "../types.js";
import { canDisabledCombatantTakeAction, canTakeTurn } from "./life.js";
import { distanceFeet, type ForcedMovementDirection, type MovementStepProjection, projectForcedMovement } from "./movement.js";
import { _getEffectiveAbilityScoreFromReduced, type AttackContext, getAbilityModifier, getEffectiveAbilityModifier, hasEffectTrait, type ManeuverAbility, type RuleResult, Rules } from "./utils.js";
import { buildCoverAssessment, getAttackLineInterception, getConcealmentAssessment, getLineOfEffect } from "./vision.js";

// ─────────────────────────────────────────────────────────────────────────────
// Contexto de ataque táctico para evaluación situacional de CA
// ─────────────────────────────────────────────────────────────────────────────
export interface DefensiveAbilityProjection {
  readonly effectiveDexterityScore: number;
  readonly dexterityModifier: number;
  readonly suppressDexAndDodge: boolean;
  readonly traitSource: "HELPLESS" | "NO_DEX_TO_AC" | "FLAT_FOOTED" | "NORMAL";
}

export function getDefensiveAbilityProjection(
  combatant: Combatant,
  reduced: ReducedEffects,
  attackContext?: AttackContext,
  contextualTraits?: readonly Trait[]
): DefensiveAbilityProjection {
  const isHelpless = hasEffectTrait(reduced, "HELPLESS") || (contextualTraits && contextualTraits.includes("HELPLESS"));

  if (isHelpless) {
    return {
      effectiveDexterityScore: 0,
      dexterityModifier: -5,
      suppressDexAndDodge: true,
      traitSource: "HELPLESS"
    };
  }

  const effectiveDexScore = _getEffectiveAbilityScoreFromReduced(combatant, "dexterity", reduced);
  const effectiveDexMod = getAbilityModifier(effectiveDexScore);

  const isFlatFooted = attackContext?.isFlatFootedOverride === true;
  const noDex = hasEffectTrait(reduced, "NO_DEX_TO_AC") || (contextualTraits && contextualTraits.includes("NO_DEX_TO_AC"));

  if (noDex || isFlatFooted) {
    return {
      effectiveDexterityScore: effectiveDexScore,
      dexterityModifier: Math.min(0, effectiveDexMod), // if mod is > 0, we suppress it
      suppressDexAndDodge: true,
      traitSource: noDex ? "NO_DEX_TO_AC" : "FLAT_FOOTED"
    };
  }

  return {
    effectiveDexterityScore: effectiveDexScore,
    dexterityModifier: effectiveDexMod,
    suppressDexAndDodge: false,
    traitSource: "NORMAL"
  };
}

export function isValidCoupDeGraceTarget(
  context: CombatRulesSnapshot<any>,
  targetId: string,
  catalog: Record<string, EffectDefinition>
): boolean {
  const target = context.combatants.find(c => c.id === targetId);
  if (!target) return false;
  if (lifeStatus(target) === "dead") return false;
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: target.id,
    catalog
  });
  return hasEffectTrait(reduced, "HELPLESS");
}

export function getSpecialManeuverSizeModifier(sizeCategory: SizeCategory): number {
  return getSizeRule(sizeCategory).grappleModifier;
}

export function canFullAttack<TCatalog extends Record<string, EffectDefinition>>(room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, attacker: Combatant): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(attacker);
  if (!turnCheck.ok) return turnCheck;
  if (room.currentTurn.usedTotalDefense) return { ok: false, error: attacker.name + " ya uso Defensa total y no puede atacar este turno." };

  const disabledCheck = canDisabledCombatantTakeAction(room, attacker, "full-round");
  if (!disabledCheck.ok) return disabledCheck;

  if (room.currentTurn.movementUsedFeet > room.board.cellSizeFeet) return { ok: false, error: "No puede hacer ataque completo despues de moverse mas de 5 pies." };
  if (room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack) return { ok: false, error: "Ya uso su accion ofensiva este turno." };
  return { ok: true, value: true };
}

export function canStandardAttack<TCatalog extends Record<string, EffectDefinition>>(room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, attacker: Combatant): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(attacker);
  if (!turnCheck.ok) return turnCheck;
  if (room.currentTurn.usedTotalDefense) return { ok: false, error: attacker.name + " ya uso Defensa total y no puede atacar este turno." };

  const disabledCheck = canDisabledCombatantTakeAction(room, attacker, "standard");
  if (!disabledCheck.ok) return disabledCheck;

  if (room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack) return { ok: false, error: "Ya uso su accion ofensiva este turno." };
  return { ok: true, value: true };
}

export function findTriggeredOpportunityAttacks(
  room: CombatRulesSnapshot<ProductionEffectId>,
  mover: Combatant,
  destination: Position,
  distanceMovedFeet: number,
  canMakeAoO: (combatant: Combatant) => boolean
): OpportunityAttack[] {
  return findTriggeredOpportunityAttacksForPath(room, mover, [destination], distanceMovedFeet, canMakeAoO);
}

const NO_EXEMPT_DEPARTURE_CELLS: ReadonlySet<string> = new Set();

export function findTriggeredOpportunityAttacksForPath(
  room: CombatRulesSnapshot<ProductionEffectId>,
  mover: Combatant,
  path: Position[],
  distanceMovedFeet: number,
  canMakeAoO: (combatant: Combatant) => boolean,
  isAcrobatic: boolean = false,
  /**
   * MOVE-WITHDRAW: celdas (claves `footprintCellKey`) cuya salida NO dispara AdO.
   * Uso: la huella inicial completa de una Retirada. Default neutro (conjunto vacío):
   * los call sites existentes conservan su comportamiento exacto. La exención filtra
   * únicamente el evento de provocación; jamás toca la capacidad del reactor
   * (`canMakeAoO` / AOO-03 / Reflejos de Combate siguen decidiendo).
   */
  exemptDepartureCellKeys: ReadonlySet<string> = NO_EXEMPT_DEPARTURE_CELLS,
  /** Optional validated footprints; no route validation or axis inference here. */
  confirmedSteps?: readonly (Pick<MovementStepProjection, "occupiedCells" | "spatialMode" | "squeezingAxis"> & Partial<Pick<MovementResolutionStep, "cumulativeCostFeet" | "cumulativeBaseRouteCostFeet" | "resultingContext">>)[]
): OpportunityAttack[] {
  if (confirmedSteps && confirmedSteps.length !== path.length) {
    throw new Error("La evidencia espacial confirmada no corresponde a la ruta de AdO.");
  }
  if (distanceMovedFeet <= 0 || path.length === 0) return [];
  if (lifeStatus(mover) === "dead" || lifeStatus(mover) === "dying" || lifeStatus(mover) === "stable") return [];
  const destination = path[path.length - 1];
  const opportunities: OpportunityAttack[] = [];
  const triggeredAttackerIds = new Set<string>();
  const reactors = room.combatants
    .filter((other) => other.id !== mover.id && other.type !== mover.type)
    .filter((other) => lifeStatus(other) === "active" && canMakeAoO(other))
    .filter((other) => canProjectMeleeThreat(room, other))
    .map((other) => ({
      combatant: other,
      geometry: getCombatantFootprintGeometry(other, room),
      threatSources: deriveMeleeThreatSources(other)
    }));
  let origin = mover.position;
  let costBeforeOrigin = 0;
  let diagonalSteps = 0;

  for (const [stepIndex, step] of path.entries()) {
    const dx = Math.abs(origin.x - step.x);
    const dy = Math.abs(origin.y - step.y);
    const stepCost = dx === 1 && dy === 1 ? (++diagonalSteps % 2 === 1 ? room.board.cellSizeFeet : room.board.cellSizeFeet * 2) : room.board.cellSizeFeet;
    const originProjection = confirmedSteps?.[stepIndex - 1];
    const originCells = originProjection?.occupiedCells ?? getCombatantOccupiedCellsAt(mover, room, origin);
    const stepCells = confirmedSteps?.[stepIndex]?.occupiedCells ?? getCombatantOccupiedCellsAt(mover, room, step);
    const stepCellKeys = new Set(stepCells.map(footprintCellKey));
    const abandonedCells = originCells.filter((cell) => {
      const key = footprintCellKey(cell);
      return !stepCellKeys.has(key) && !exemptDepartureCellKeys.has(key);
    });
    // Sprint 055B: proxy efímero con la posición exacta de la casilla abandonada en este paso —
    // `mover.position` en el snapshot es la posición inicial de todo el trayecto, no la casilla
    // concreta que se evalúa en pasos intermedios. Nunca se muta `mover`; es una copia superficial
    // consumida únicamente por `getOpportunityAttackLegality` (Line of Effect/Cover/Concealment).
    const moverAtOrigin: Combatant = { ...mover, position: origin };
    // A hypothetical origin uses its already confirmed spatial state. This view
    // is local and never changes the authoritative snapshot or room effects.
    const originContext = originProjection ? {
      ...room,
      combatants: room.combatants.map(c => c.id === mover.id ? moverAtOrigin : c),
      effectInstances: [
        ...room.effectInstances.filter(instance =>
          !(instance.effectId === "srd_squeezing" && instance.targets?.includes(mover.id))),
        ...(originProjection.spatialMode === "squeezing" ? [{
          instanceId: "confirmed-route-footprint", effectId: "srd_squeezing" as const,
          squeezingAxis: originProjection.squeezingAxis,
          source: { type: "system" as const }, targets: [mover.id],
          appliedAtEvent: { type: "SystemInjected" as const, round: 0 }
        }] : [])
      ]
    } : room;
    for (const reactor of reactors) {
      const other = reactor.combatant;
      if (triggeredAttackerIds.has(other.id) || other.stats?.movementOpportunityTargetsThisRound?.includes(mover.id)) continue;
      const provokingCells = abandonedCells.filter((cell) => {
        const distance = distanceBetweenFootprintGeometriesFeet(
          reactor.geometry,
          projectFootprintGeometry([cell]),
          room.board.cellSizeFeet
        );
        return hasMeleeThreatFromSourcesAtDistance(reactor.threatSources, distance);
      });
      if (provokingCells.length === 0) continue;
      // Sprint 055B (NDD §14.5/§14.7): Line of Effect/Cover/Ocultación Total pueden impedir que
      // ESTE reactor concreto ejecute el AdO contra ESTE provocador concreto, sin afectar a otros
      // reactores/pasos. No se marca `triggeredAttackerIds` cuando se rechaza — el mismo reactor
      // puede volver a intentarlo en un paso posterior si las condiciones cambian (ej. el
      // provocador sale de detrás de un obstáculo), coherente con que un AdO rechazado nunca
      // "se gasta".
      const legality = getOpportunityAttackLegality(originContext, other, moverAtOrigin);
      if (!legality.allowed) continue;
      triggeredAttackerIds.add(other.id);
      opportunities.push({
        id: cryptoId("aoo"),
        attackerId: other.id,
        targetId: mover.id,
        attackerPosition: { ...other.position },
        origin: { ...origin },
        destination: { ...destination },
        movementCostFeet: Math.max(0, distanceMovedFeet - (stepIndex === 0 ? 0 : confirmedSteps?.[stepIndex - 1]?.cumulativeCostFeet ?? costBeforeOrigin)),
        movementStepIndex: stepIndex,
        movementPrefix: {
          remainingBaseFeet: (confirmedSteps?.at(-1)?.cumulativeBaseRouteCostFeet ?? distanceMovedFeet) - (confirmedSteps?.[stepIndex - 1]?.cumulativeBaseRouteCostFeet ?? costBeforeOrigin),
          diagonalSteps: confirmedSteps?.[stepIndex - 1]?.resultingContext?.normalDiagonalStepsThisTurn ?? room.currentTurn.normalDiagonalStepsThisTurn,
          squeezingAxis: confirmedSteps?.[stepIndex - 1]?.squeezingAxis ?? (stepIndex === 0 ? room.effectInstances.find(effect => effect.effectId === "srd_squeezing" && effect.targets?.includes(mover.id))?.squeezingAxis : undefined)
        },
        reason: mover.name + " abandona una casilla amenazada por " + other.name + " durante su ruta de movimiento.",
        createdAt: new Date().toISOString(),
        provokingCells: provokingCells.map((cell) => ({ ...cell })),
        ...(isAcrobatic ? { requiredCd: 15 as const } : {})
      });
    }
    costBeforeOrigin += stepCost;
    origin = step;
  }

  return opportunities;
}

export function isCriticalThreat(d20Roll: number, attackTotal: number, targetAC: number, threatFrom: number): boolean {
  if (d20Roll === 1) return false;
  return (d20Roll >= threatFrom && attackTotal >= targetAC) || d20Roll === 20;
}

export function isCriticalConfirmed(confirmD20Roll: number, attackBonusTotal: number, targetAC: number): boolean {
  if (confirmD20Roll === 1) return false;
  if (confirmD20Roll === 20) return true;
  return confirmD20Roll + attackBonusTotal >= targetAC;
}

export function getWeaponAttackTypeForTarget(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, target: Combatant): "melee" | "ranged" {
  const weapon = resolveEquippedWeaponProfile(attacker).profile;
  if (!weapon || weapon.handedness !== "ranged" && weapon.handedness !== "thrown") return "melee";
  if (weapon.handedness === "ranged") return "ranged";
  const distance = distanceBetweenFootprintsFeet(room, attacker, target);
  return distance <= weapon.meleeReachFeet ? "melee" : "ranged";
}

export interface AmmunitionState {
  readonly required: boolean;
  readonly ammunitionKind?: AmmunitionKind;
  readonly availableQuantity: number;
  readonly selectedItemId?: string;
}

export function getAmmunitionState(combatant: Combatant, weapon: WeaponEntry | undefined = getEquippedWeaponEntry(combatant)): AmmunitionState {
  if (!weapon || EquipmentCatalog.getRangedDelivery(weapon) !== "projectile") {
    return { required: false, availableQuantity: 0 };
  }
  const ammunitionKind = weapon.requiredAmmunitionKind;
  if (!ammunitionKind) throw new Error(`Invariante de catálogo violada: ${weapon.id} no declara munición requerida.`);
  const compatible = combatant.inventory
    .filter((item) => {
      const candidate = EquipmentCatalog.getWeapon(item.catalogId);
      return candidate?.isAmmunition === true && candidate.ammunitionKind === ammunitionKind;
    })
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
  const availableQuantity = compatible.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const selectedItemId = compatible.find((item) => (item.quantity ?? 0) > 0)?.itemId;
  return { required: true, ammunitionKind, availableQuantity, ...(selectedItemId ? { selectedItemId } : {}) };
}

export function validateAttackAmmunition(combatant: Combatant, weapon: WeaponEntry | undefined = getEquippedWeaponEntry(combatant)): RuleResult<AmmunitionState> {
  const state = getAmmunitionState(combatant, weapon);
  if (state.required && (!state.selectedItemId || state.availableQuantity <= 0)) {
    return { ok: false, error: `No queda munición compatible para ${weapon?.name ?? "el arma equipada"}.` };
  }
  return { ok: true, value: state };
}

export function consumeInventoryQuantity(combatant: Combatant, itemId: string, amount = 1): Combatant {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Cantidad de consumo inválida: ${amount}.`);
  const current = combatant.inventory.find((item) => item.itemId === itemId);
  if (!current) throw new Error(`El inventario de ${combatant.name} no contiene ${itemId}.`);
  const quantity = current.quantity;
  if (quantity === undefined || quantity < amount) throw new Error(`Stock insuficiente en ${itemId}.`);
  return {
    ...combatant,
    inventory: combatant.inventory.map((item) => item.itemId === itemId ? { ...item, quantity: quantity - amount } : { ...item }),
    equipmentSlots: { ...combatant.equipmentSlots }
  };
}

function getCombatantFootprintGeometry(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot
): FootprintGeometry {
  return projectFootprintGeometry(getCombatantOccupiedCells(combatant, snapshot));
}

function distanceBetweenFootprintGeometriesFeet(
  first: FootprintGeometry,
  second: FootprintGeometry,
  cellSizeFeet: number
): number {
  const dx = Math.max(0, second.minX - first.maxX, first.minX - second.maxX);
  const dy = Math.max(0, second.minY - first.maxY, first.minY - second.maxY);
  return distanceFeet(
    { x: 0, y: 0, zFeet: first.zFeet },
    { x: dx, y: dy, zFeet: second.zFeet },
    cellSizeFeet
  );
}

function canProjectMeleeThreat(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant
): boolean {
  const status = lifeStatus(attacker);
  if (status !== "active" && status !== "disabled") return false;
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: attacker.id,
    catalog: effectsCatalog
  });
  return !hasEffectTrait(reduced, "NO_THREAT");
}

function hasMeleeThreatFromSourcesAtDistance(
  sources: ReturnType<typeof deriveMeleeThreatSources>,
  distance: number
): boolean {
  return sources.some((source) =>
    Number.isFinite(source.maxReachFeet) &&
    source.maxReachFeet > 0 &&
    distance > source.minReachFeet &&
    distance <= source.maxReachFeet
  );
}

function hasMeleeThreatAtDistance(attacker: Combatant, distance: number): boolean {
  return hasMeleeThreatFromSourcesAtDistance(deriveMeleeThreatSources(attacker), distance);
}

export function threatensCell(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, cell: Position): boolean {
  if (!canProjectMeleeThreat(room, attacker)) return false;
  const distance = distanceBetweenFootprintGeometriesFeet(
    getCombatantFootprintGeometry(attacker, room),
    projectFootprintGeometry([cell]),
    room.board.cellSizeFeet
  );
  return hasMeleeThreatAtDistance(attacker, distance);
}

function threatensTargetWithGeometry(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerGeometry: FootprintGeometry,
  targetGeometry: FootprintGeometry
): boolean {
  if (attacker.id === target.id || attacker.type === target.type) return false;
  if (!canProjectMeleeThreat(room, attacker)) return false;
  const distance = distanceBetweenFootprintGeometriesFeet(attackerGeometry, targetGeometry, room.board.cellSizeFeet);
  return hasMeleeThreatAtDistance(attacker, distance);
}

export function threatensTarget(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, target: Combatant): boolean {
  return threatensTargetWithGeometry(
    room,
    attacker,
    target,
    getCombatantFootprintGeometry(attacker, room),
    getCombatantFootprintGeometry(target, room)
  );
}

/** Distancia mínima entre las huellas ocupadas por dos combatientes. */
export function distanceBetweenFootprintsFeet(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, target: Combatant): number {
  return distanceBetweenFootprintGeometriesFeet(
    getCombatantFootprintGeometry(attacker, room),
    getCombatantFootprintGeometry(target, room),
    room.board.cellSizeFeet
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATK-RANGED-INTO-MELEE: penalizador por disparar a un objetivo enzarzado en
// combate cuerpo a cuerpo (PHB 3.5 pág. 140; NDD: ranged-into-melee-penalty.md)
// ─────────────────────────────────────────────────────────────────────────────
export const RANGED_INTO_MELEE_PENALTY = -4;

export const RANGED_INTO_MELEE_SAFE_DISTANCE_FEET = 10;

export interface RangedIntoMeleeAssessment {
  /** true si el penalizador -4 debe aplicarse a la tirada de ataque a distancia. */
  readonly applies: boolean;
  readonly penalty: 0 | typeof RANGED_INTO_MELEE_PENALTY;
  /** Motivo por el que un objetivo enzarzado NO recibe el penalizador. */
  readonly exemption?: "distance" | "feat";
  /** Distancia mínima (entre footprints) del objetivo al personaje amistoso más cercano al atacante. */
  readonly nearestFriendlyDistanceFeet: number | null;
}

const NOT_APPLICABLE: RangedIntoMeleeAssessment = Object.freeze({
  applies: false,
  penalty: 0,
  nearestFriendlyDistanceFeet: null
});

/**
 * Evaluador puro de la regla "enzarzado en cuerpo a cuerpo":
 * - el objetivo y un personaje amistoso del atacante son enemigos entre sí y AL MENOS UNO
 *   amenaza al otro (`threatensTarget` — RAW ingles: "either threatens the other"; la
 *   formulación "mutuamente" del corpus local es una imprecisión de traducción, ver D-11);
 * - excepción de distancia: se ignora el penalizador si el objetivo está a
 *   >= 10 ft del personaje amistoso más cercano al atacante (medición entre footprints,
 *   correcta para criaturas Large/Huge);
 * - excepción declarativa de dote: `FeatCatalog.rangedAttackContribution` (Disparo Preciso);
 * - simplificación V1 documentada: un objetivo indefenso (trait HELPLESS) o sin estado de
 *   vida activo/disabled no se considera enzarzado (RAW: "no se considerará enzarzado a no
 *   ser que esté siendo atacado" — el matiz de turno queda fuera de alcance).
 * Determinista e independiente del orden de los combatientes en el snapshot.
 */
export function getRangedIntoMeleeAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): RangedIntoMeleeAssessment {
  if (attacker.id === target.id || attacker.type === target.type) return NOT_APPLICABLE;

  const friendlies = room.combatants.filter(
    (candidate) => candidate.id !== attacker.id && candidate.type === attacker.type && lifeStatus(candidate) !== "dead"
  );
  if (friendlies.length === 0) return NOT_APPLICABLE;

  let nearestFriendlyDistanceFeet: number | null = null;
  for (const friendly of friendlies) {
    const distance = distanceBetweenFootprintsFeet(room, target, friendly);
    if (nearestFriendlyDistanceFeet === null || distance < nearestFriendlyDistanceFeet) {
      nearestFriendlyDistanceFeet = distance;
    }
  }

  const targetStatus = lifeStatus(target);
  const targetReduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: target.id,
    catalog: effectsCatalog
  });
  const targetEngageable =
    (targetStatus === "active" || targetStatus === "disabled") && !hasEffectTrait(targetReduced, "HELPLESS");

  const engaged = targetEngageable && friendlies.some(
    (friendly) => threatensTarget(room, friendly, target) || threatensTarget(room, target, friendly)
  );
  if (!engaged) {
    return Object.freeze({ applies: false, penalty: 0 as const, nearestFriendlyDistanceFeet });
  }

  if (nearestFriendlyDistanceFeet !== null && nearestFriendlyDistanceFeet >= RANGED_INTO_MELEE_SAFE_DISTANCE_FEET) {
    return Object.freeze({ applies: false, penalty: 0 as const, exemption: "distance" as const, nearestFriendlyDistanceFeet });
  }

  if (FeatCatalog.rangedAttackContribution(attacker.featIds).ignoresFiringIntoMeleePenalty === true) {
    return Object.freeze({ applies: false, penalty: 0 as const, exemption: "feat" as const, nearestFriendlyDistanceFeet });
  }

  return Object.freeze({ applies: true, penalty: RANGED_INTO_MELEE_PENALTY, nearestFriendlyDistanceFeet });
}

interface FootprintFaceSignature { readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1; }

function getFaceSignature(footprint: FootprintGeometry, target: FootprintGeometry): FootprintFaceSignature {
  const dx = footprint.maxX < target.minX ? -1 : footprint.minX > target.maxX ? 1 : 0;
  const dy = footprint.maxY < target.minY ? -1 : footprint.minY > target.maxY ? 1 : 0;
  return { dx, dy };
}

/** Frontera geométrica de oposición contra caras del footprint defensor. */
function areOppositeForFlanking(
  attacker: FootprintGeometry,
  ally: FootprintGeometry,
  target: FootprintGeometry
): boolean {
  const attackerFace = getFaceSignature(attacker, target);
  if (attackerFace.dx === 0 && attackerFace.dy === 0) return false;
  const allyFace = getFaceSignature(ally, target);
  return attackerFace.dx === -allyFace.dx && attackerFace.dy === -allyFace.dy;
}

export function isFlanking(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): boolean {
  const targetGeometry = getCombatantFootprintGeometry(target, room);
  const attackerGeometry = getCombatantFootprintGeometry(attacker, room);
  if (!threatensTargetWithGeometry(room, attacker, target, attackerGeometry, targetGeometry)) return false;
  for (const ally of room.combatants) {
    if (ally.id === attacker.id || ally.type !== attacker.type) continue;
    const allyGeometry = getCombatantFootprintGeometry(ally, room);
    if (
      threatensTargetWithGeometry(room, ally, target, allyGeometry, targetGeometry) &&
      areOppositeForFlanking(attackerGeometry, allyGeometry, targetGeometry)
    ) return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Pipeline avanzado de modificadores contextuales y daño de precisión
// -----------------------------------------------------------------------------
export function getAttackContextModifiers(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): AttackContextModifiers {
  const flanking = isFlanking(room, attacker, target);
  // ATK-RANGED-INTO-MELEE: penalizador -4 por disparar a un objetivo enzarzado en cuerpo a
  // cuerpo, resuelto por el helper puro (incluye excepción de 10 ft y la exención declarativa
  // de Disparo Preciso vía FeatCatalog — cero condicionales por dote en esta capa ni en los
  // resolvers). Esta es la misma costura isomorfa que ya usa el flanqueo: la consumen el
  // servidor (armas, conjuros con tirada de ataque) y la UI predictiva sin recalcular.
  const rangedIntoMelee = getRangedIntoMeleeAssessment(room, attacker, target);
  const rangedLabelParts =
    rangedIntoMelee.applies
      ? ["disparo a melé " + rangedIntoMelee.penalty]
      : rangedIntoMelee.exemption === "feat"
        ? ["disparo a melé evitado (Disparo Preciso)"]
        : [];
  // Sprint 042: única sede de cómputo de Cover — geometría resuelta una vez y proyectada por
  // tipo de ataque. Ningún otro punto del servidor/UI vuelve a llamar getAttackLineInterception.
  const interception = getAttackLineInterception(room, attacker, target);
  const cover = buildCoverAssessment(interception);
  const concealment = getConcealmentAssessment(room, attacker, target);
  return {
    flanking,
    byAttackType: {
      melee: { attackBonus: flanking ? 2 : 0, labelParts: flanking ? ["flanqueo +2"] : [], cover, concealment },
      ranged: { attackBonus: rangedIntoMelee.penalty, labelParts: rangedLabelParts, cover, concealment }
    }
  };
}

/**
 * Sprint 055B (NDD §14.5/§14.7, Opportunity Legality Assessment): decide si `reactor` puede
 * intentar un Ataque de Oportunidad concreto contra `provoker`. Compone exclusivamente tres
 * assessments ya existentes, sin recalcular ninguno: Line of Effect (más fundamental, se evalúa
 * primero — mismo orden de precedencia ya establecido para ataques declarados desde Sprint
 * 052B/053B), Cover (cualquier grado bloquea el AdO, a diferencia de un ataque normal donde Cover
 * solo aporta +4 CA — cita SRD `combat/08_ataques_de_oportunidad.txt`: "no puedes realizar un
 * ataque de oportunidad contra un oponente que tenga cobertura respecto a ti"), y
 * `ConcealmentAssessment.opportunityAttackAllowed` (ya deriva `!total` desde Sprint 053B — cita
 * SRD `combat/10_modificadores_de_combate.txt`: "No puedes realizar un ataque de oportunidad
 * contra un enemigo con ocultación total, ni aunque sepas en qué casilla o casillas está").
 * Ocultación parcial nunca bloquea aquí — solo aporta miss chance en `resolveAttack`, sin cambios.
 * No calcula amenaza, provocación ni daño — esas capas son responsabilidad de sus propias
 * funciones (`threatensTarget`/`canProjectMeleeThreat`, la detección de provocación del llamador,
 * y `resolveAttack` respectivamente).
 */
export function getOpportunityAttackLegality(
  room: CombatRulesSnapshot<ProductionEffectId>,
  reactor: Combatant,
  provoker: Combatant
): OpportunityAttackLegality {
  const lineOfEffect = getLineOfEffect(room, reactor, provoker);
  if (!lineOfEffect.hasLineOfEffect) {
    return { allowed: false, reason: "no-line-of-effect" };
  }

  const context = getAttackContextModifiers(room, reactor, provoker);
  if (context.byAttackType.melee.cover.applies) {
    return { allowed: false, reason: "cover" };
  }
  if (!context.byAttackType.melee.concealment.opportunityAttackAllowed) {
    return { allowed: false, reason: "total-concealment" };
  }

  return { allowed: true, reason: "clear" };
}

export function getEffectiveSneakAttackDice(
  room: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): number {
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  const bonus = reduced.numericModifiers["SNEAK_ATTACK_DICE"]?.total ?? 0;
  return Math.max(0, (combatant.sneakAttackDice || 0) + bonus);
}

export function canApplySneakAttack(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  delivery?: AttackDeliveryContext,
  concealment?: ConcealmentAssessment
): boolean {
  if (getEffectiveSneakAttackDice(room, attacker) <= 0 || attacker.type === target.type) return false;
  if (target.ruleTraits.includes("IMMUNE_TO_PRECISION_DAMAGE") || target.ruleTraits.includes("IMMUNE_TO_CRITICAL_HITS")) return false;

  const targetEffects = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: target.id,
    catalog: effectsCatalog
  });
  if (hasEffectTrait(targetEffects, "IMMUNE_TO_PRECISION_DAMAGE") || hasEffectTrait(targetEffects, "IMMUNE_TO_CRITICAL_HITS")) return false;

  const attackType = delivery?.attackType ?? getWeaponAttackTypeForTarget(room, attacker, target);
  const attackDistance = delivery?.distanceFeet ?? distanceBetweenFootprintsFeet(room, attacker, target);
  if (delivery && (!delivery.requiresAttackRoll || !delivery.dealsDamage)) return false;
  if (attackType === "ranged" && attackDistance > 30) return false;
  const effectiveConcealment = concealment ?? getConcealmentAssessment(room, attacker, target);
  if (effectiveConcealment.applies) return false;
  return hasEffectTrait(targetEffects, "NO_DEX_TO_AC") || isFlanking(room, attacker, target);
}

/** Wrappers de compatibilidad que conservan al evaluador productivo como única fuente matemática. */
export function calculateSpellSaveDC(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  spellId: string
): number {
  return Rules.calculateSpellSaveDC(snapshot, combatant, spellId);
}

export function calculateSpellSaveDCBreakdown(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  spellId: string
): SpellSaveDCBreakdown {
  return Rules.calculateSpellSaveDCBreakdown(snapshot, combatant, spellId);
}

const SIZE_ORDER: readonly SizeCategory[] = [
  "fine", "diminutive", "tiny", "small", "medium", "large", "huge", "gargantuan", "colossal"
];

export function hasActiveTrait(
  room: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  trait: Trait
): boolean {
  if (combatant.ruleTraits.includes(trait)) return true;
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  return hasEffectTrait(reduced, trait);
}

export interface MeleeTouchManeuverProfile {
  readonly distanceFeet: number;
  readonly minReachFeet: number;
  readonly maxReachFeet: number;
  readonly flankingBonus: number;
  readonly touchArmorClass: number;
  readonly concealment: ConcealmentAssessment;
}

/** Valida alcance y deriva el contexto Touch AC común a maniobras especiales. */
export function validateMeleeTouchManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  minReachFeet: number,
  maxReachFeet: number,
  maneuverName: string
): RuleResult<MeleeTouchManeuverProfile> {
  const distance = distanceBetweenFootprintsFeet(room, attacker, target);
  if (!(distance > minReachFeet && distance <= maxReachFeet)) {
    return { ok: false, error: `${target.name} esta a ${distance} ft, fuera del alcance de ${maneuverName} de ${attacker.name} (${minReachFeet}-${maxReachFeet} ft).` };
  }
  const tactical = getAttackContextModifiers(room, attacker, target).byAttackType.melee;
  const touchArmorClass = Rules.totalArmorClass(room, target, {
    attackType: "melee",
    targetAcType: "touch",
    attackerId: attacker.id,
    cover: tactical.cover
  }).total;
  return {
    ok: true,
    value: {
      distanceFeet: distance,
      minReachFeet,
      maxReachFeet,
      flankingBonus: tactical.attackBonus,
      touchArmorClass,
      concealment: tactical.concealment
    }
  };
}

export interface MeleeTouchManeuverResult {
  readonly hits: boolean;
  readonly d20Roll: number;
  readonly attackBonus: number;
  readonly total: number;
  readonly targetArmorClass: number;
  readonly parts: readonly string[];
}

/** Resuelve un toque melee contra un perfil ya validado, sin mutar el snapshot. */
export function resolveMeleeTouchManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  profile: MeleeTouchManeuverProfile,
  d20Roll: number
): MeleeTouchManeuverResult {
  const attack = Rules.totalAttackBonus(room, attacker, { abilityForAttack: "strength", attackType: "melee" });
  const attackBonus = attack.total + profile.flankingBonus;
  const total = d20Roll + attackBonus;
  const hits = d20Roll === 1 ? false : d20Roll === 20 ? true : total >= profile.touchArmorClass;
  return {
    hits,
    d20Roll,
    attackBonus,
    total,
    targetArmorClass: profile.touchArmorClass,
    parts: [...attack.parts, ...(profile.flankingBonus ? ["flanqueo +2"] : [])]
  };
}

export interface OpposedCheckResult {
  readonly attackerRoll: number;
  readonly defenderRoll: number;
  readonly attackerModifier: number;
  readonly defenderModifier: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly attackerWins: boolean;
  readonly requiresReroll: boolean;
}

/** Oráculo único de checks opuestos: total, desempate por modificador y reroll exacto. */
export function resolveOpposedCheck(
  attackerRoll: number,
  defenderRoll: number,
  attackerModifier: number,
  defenderModifier: number
): OpposedCheckResult {
  const attackerTotal = attackerRoll + attackerModifier;
  const defenderTotal = defenderRoll + defenderModifier;
  const requiresReroll = attackerTotal === defenderTotal && attackerModifier === defenderModifier;
  const attackerWins = attackerTotal > defenderTotal
    || (attackerTotal === defenderTotal && attackerModifier > defenderModifier);
  return {
    attackerRoll,
    defenderRoll,
    attackerModifier,
    defenderModifier,
    attackerTotal,
    defenderTotal,
    attackerWins,
    requiresReroll
  };
}

export type GrappleEscapeType = "grapple_check" | "escape_artist";

export interface GrappleLink {
  readonly effectInstanceId: string;
  readonly participantIds: readonly [string, string];
  readonly opponentId: string;
}

/** Localiza una única relación binaria de Presa. Cualquier ambigüedad falla cerrada. */
export function getGrappleLink(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatantId: string
): RuleResult<GrappleLink> {
  const links = snapshot.effectInstances.filter((instance) =>
    instance.effectId === "srd_grappling" && (instance.targets?.includes(combatantId) ?? false)
  );
  if (links.length !== 1) {
    return { ok: false, error: links.length === 0
      ? "El combatiente no pertenece a una Presa activa."
      : "El combatiente pertenece a múltiples vínculos de Presa; la relación es inválida." };
  }
  const link = links[0]!;
  const targets = link.targets ?? [];
  if (targets.length !== 2 || targets[0] === targets[1] || !targets.includes(combatantId)) {
    return { ok: false, error: "La instancia de Presa no contiene exactamente dos participantes distintos." };
  }
  if (targets.some((targetId) => !snapshot.combatants.some((combatant) => combatant.id === targetId))) {
    return { ok: false, error: "La instancia de Presa referencia un participante inexistente." };
  }
  const opponentId = targets.find((targetId) => targetId !== combatantId)!;
  return {
    ok: true,
    value: {
      effectInstanceId: link.instanceId,
      participantIds: [targets[0]!, targets[1]!],
      opponentId
    }
  };
}

export interface GrappleEscapePreview {
  readonly escapeType: GrappleEscapeType;
  readonly effectInstanceId: string;
  readonly opponentId: string;
  readonly opponentName: string;
  readonly escapeBaseAttackBonus: number;
  readonly escapeAbility: "strength" | "dexterity";
  readonly escapeAbilityModifier: number;
  readonly escapeSkillRanks: number;
  readonly escapeSizeModifier: number;
  readonly escapeModifier: number;
  readonly defenderBaseAttackBonus: number;
  readonly defenderStrengthModifier: number;
  readonly defenderSizeModifier: number;
  readonly defenderModifier: number;
  readonly escapeParts: readonly string[];
  readonly defenderParts: readonly string[];
}

/** Proyecta las dos fórmulas de Escape sin tirar dados ni mutar la sala. */
export function getGrappleEscapePreview(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  escapeType: GrappleEscapeType
): RuleResult<GrappleEscapePreview> {
  const link = getGrappleLink(snapshot, combatant.id);
  if (!link.ok || !link.value) return { ok: false, error: link.error };
  if (!hasActiveTrait(snapshot, combatant, "GRAPPLING")) {
    return { ok: false, error: `${combatant.name} no posee el estado GRAPPLING requerido para escapar.` };
  }
  const opponent = snapshot.combatants.find((candidate) => candidate.id === link.value!.opponentId);
  if (!opponent || !hasActiveTrait(snapshot, opponent, "GRAPPLING")) {
    return { ok: false, error: "El retenedor de la Presa no posee un estado de agarre válido." };
  }

  const usesSkill = escapeType === "escape_artist";
  const escapeBaseAttackBonus = usesSkill ? 0 : combatant.baseAttackBonus;
  const escapeAbility = usesSkill ? "dexterity" : "strength";
  const escapeAbilityModifier = getEffectiveAbilityModifier(snapshot, combatant, escapeAbility);
  const escapeSkillRanks = usesSkill ? combatant.skillRanks.escape_artist : 0;
  const escapeSizeModifier = usesSkill ? 0 : getSpecialManeuverSizeModifier(combatant.sizeCategory);
  const escapeModifier = escapeBaseAttackBonus + escapeAbilityModifier + escapeSkillRanks + escapeSizeModifier;
  const defenderStrengthModifier = getEffectiveAbilityModifier(snapshot, opponent, "strength");
  const defenderSizeModifier = getSpecialManeuverSizeModifier(opponent.sizeCategory);
  const defenderModifier = opponent.baseAttackBonus + defenderStrengthModifier + defenderSizeModifier;
  return {
    ok: true,
    value: {
      escapeType,
      effectInstanceId: link.value.effectInstanceId,
      opponentId: opponent.id,
      opponentName: opponent.name,
      escapeBaseAttackBonus,
      escapeAbility,
      escapeAbilityModifier,
      escapeSkillRanks,
      escapeSizeModifier,
      escapeModifier,
      defenderBaseAttackBonus: opponent.baseAttackBonus,
      defenderStrengthModifier,
      defenderSizeModifier,
      defenderModifier,
      escapeParts: usesSkill
        ? [`DES ${escapeAbilityModifier >= 0 ? "+" : ""}${escapeAbilityModifier}`, `Rangos +${escapeSkillRanks}`]
        : [`BAB +${escapeBaseAttackBonus}`, `FUE ${escapeAbilityModifier >= 0 ? "+" : ""}${escapeAbilityModifier}`, `Tamaño ${escapeSizeModifier >= 0 ? "+" : ""}${escapeSizeModifier}`],
      defenderParts: [`BAB +${opponent.baseAttackBonus}`, `FUE ${defenderStrengthModifier >= 0 ? "+" : ""}${defenderStrengthModifier}`, `Tamaño ${defenderSizeModifier >= 0 ? "+" : ""}${defenderSizeModifier}`]
    }
  };
}

export function resolveGrappleEscapeCheck(
  preview: GrappleEscapePreview,
  escapeRoll: number,
  defenderRoll: number
): OpposedCheckResult {
  return resolveOpposedCheck(escapeRoll, defenderRoll, preview.escapeModifier, preview.defenderModifier);
}

export interface GrappleAttackEligibility {
  readonly isGrappling: boolean;
  readonly sourceKind: "unrestricted" | "light_weapon" | "natural";
  readonly sourceId?: string;
  readonly sourceName: string;
  readonly attackPenalty: number;
  readonly labelParts: readonly string[];
}

/** Único selector de fuentes de ataque permitidas mientras el actor está en Presa. */
export function getGrappleAttackEligibility(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): RuleResult<GrappleAttackEligibility> {
  if (!hasActiveTrait(snapshot, combatant, "GRAPPLING")) {
    const source = resolveEquippedWeaponProfile(combatant);
    return { ok: true, value: { isGrappling: false, sourceKind: "unrestricted", sourceId: source.entry?.id, sourceName: source.profile.name, attackPenalty: 0, labelParts: [] } };
  }
  const weapon = getEquippedWeaponEntry(combatant);
  if (weapon) {
    if (weapon.handedness !== "light" || !weapon.isMelee) {
      return { ok: false, error: `${combatant.name} no puede atacar en Presa con ${weapon.name}; solo se permiten armas ligeras melee o ataques naturales.` };
    }
    return { ok: true, value: { isGrappling: true, sourceKind: "light_weapon", sourceId: weapon.id, sourceName: weapon.name, attackPenalty: -4, labelParts: ["forcejeo en presa -4"] } };
  }
  if (combatant.naturalAttackId) {
    const natural = resolveEquippedWeaponProfile(combatant).profile;
    return { ok: true, value: { isGrappling: true, sourceKind: "natural", sourceId: combatant.naturalAttackId, sourceName: natural.name, attackPenalty: -4, labelParts: ["forcejeo en presa -4"] } };
  }
  return { ok: false, error: `${combatant.name} no posee un arma ligera melee ni un ataque natural válido para atacar en Presa.` };
}

export interface TripManeuverPreview {
  readonly maneuverId: "trip";
  readonly distanceFeet: number;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly armedTrip: boolean;
  readonly minReachFeet: number;
  readonly maxReachFeet: number;
  readonly provokesOpportunityAttack: boolean;
  readonly defenderCanMakeOpportunityAttack: boolean;
  readonly flankingBonus: number;
  readonly touchArmorClass: number;
  readonly concealment: ConcealmentAssessment;
  readonly attackerStrengthModifier: number;
  readonly attackerSizeModifier: number;
  readonly defenderAbility: ManeuverAbility;
  readonly defenderAbilityModifier: number;
  readonly defenderSizeModifier: number;
}

export interface BullRushManeuverPreview {
  readonly maneuverId: "bull_rush";
  readonly distanceFeet: number;
  readonly provokesOpportunityAttack: boolean;
  readonly defenderCanMakeOpportunityAttack: boolean;
  readonly attackerStrengthModifier: number;
  readonly attackerSizeModifier: number;
  readonly defenderStrengthModifier: number;
  readonly defenderSizeModifier: number;
  readonly direction: ForcedMovementDirection;
  readonly projectedPath: readonly Position[];
  readonly projectedFinalPosition: Position;
  readonly blocked: boolean;
  readonly blockedAt: Position | null;
  readonly blockedReason: "impassable_cell" | "occupied_by_combatant" | null;
}

export interface GrappleManeuverPreview extends MeleeTouchManeuverProfile {
  readonly maneuverId: "grapple";
  readonly provokesOpportunityAttack: boolean;
  readonly defenderCanMakeOpportunityAttack: boolean;
  readonly attackerBaseAttackBonus: number;
  readonly attackerStrengthModifier: number;
  readonly attackerSizeModifier: number;
  readonly attackerGrappleModifier: number;
  readonly defenderBaseAttackBonus: number;
  readonly defenderStrengthModifier: number;
  readonly defenderSizeModifier: number;
  readonly defenderGrappleModifier: number;
}

function validateGrappleManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): RuleResult<GrappleManeuverPreview> {
  if (attacker.id === target.id) return { ok: false, error: "Presa requiere otro combatiente como objetivo." };
  if (attacker.type === target.type) return { ok: false, error: "Presa requiere un enemigo como objetivo." };
  const attackerStatus = lifeStatus(attacker);
  const targetStatus = lifeStatus(target);
  if (attackerStatus !== "active" && attackerStatus !== "disabled") {
    return { ok: false, error: `${attacker.name} no puede iniciar una Presa en su estado actual.` };
  }
  if (targetStatus !== "active" && targetStatus !== "disabled") {
    return { ok: false, error: `${target.name} no puede ser objetivo de Presa en su estado actual.` };
  }
  if (hasActiveTrait(room, attacker, "GRAPPLING") || hasActiveTrait(room, target, "GRAPPLING")) {
    return { ok: false, error: "Grapple V1 no permite iniciar una nueva Presa con un combatiente que ya está agarrando o agarrado." };
  }

  const touch = validateMeleeTouchManeuver(
    room,
    attacker,
    target,
    0,
    getSizeRule(attacker.sizeCategory).defaultReachFeet,
    "Presa"
  );
  if (!touch.ok || !touch.value) return { ok: false, error: touch.error };
  const provokesOpportunityAttack = !FeatCatalog.avoidsOpportunity(attacker.featIds, "grapple");
  const defenderCanMakeOpportunityAttack = provokesOpportunityAttack
    && targetStatus === "active"
    && Rules.canMakeOpportunityAttack(room, target, attacker.id)
    && threatensTarget(room, target, attacker);
  const attackerStrengthModifier = getEffectiveAbilityModifier(room, attacker, "strength");
  const attackerSizeModifier = getSpecialManeuverSizeModifier(attacker.sizeCategory);
  const defenderStrengthModifier = getEffectiveAbilityModifier(room, target, "strength");
  const defenderSizeModifier = getSpecialManeuverSizeModifier(target.sizeCategory);
  return {
    ok: true,
    value: {
      maneuverId: "grapple",
      ...touch.value,
      provokesOpportunityAttack,
      defenderCanMakeOpportunityAttack,
      attackerBaseAttackBonus: attacker.baseAttackBonus,
      attackerStrengthModifier,
      attackerSizeModifier,
      attackerGrappleModifier: attacker.baseAttackBonus + attackerStrengthModifier + attackerSizeModifier,
      defenderBaseAttackBonus: target.baseAttackBonus,
      defenderStrengthModifier,
      defenderSizeModifier,
      defenderGrappleModifier: target.baseAttackBonus + defenderStrengthModifier + defenderSizeModifier
    }
  };
}

function validateBullRushManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): RuleResult<BullRushManeuverPreview> {
  if (attacker.id === target.id) return { ok: false, error: "Embestida requiere otro combatiente como objetivo." };
  if (attacker.type === target.type) return { ok: false, error: "Embestida requiere un enemigo como objetivo." };
  const attackerStatus = lifeStatus(attacker);
  const targetStatus = lifeStatus(target);
  if (attackerStatus !== "active" && attackerStatus !== "disabled") {
    return { ok: false, error: `${attacker.name} no puede intentar una Embestida en su estado actual.` };
  }
  if (targetStatus !== "active" && targetStatus !== "disabled") {
    return { ok: false, error: `${target.name} no puede ser objetivo de Embestida en su estado actual.` };
  }
  const distance = distanceBetweenFootprintsFeet(room, attacker, target);
  const reachFeet = getSizeRule(attacker.sizeCategory).defaultReachFeet;
  if (!(distance > 0 && distance <= reachFeet)) {
    return { ok: false, error: `${target.name} esta a ${distance} ft, fuera del alcance de Embestida de ${attacker.name} (${reachFeet} ft).` };
  }

  const attackerGeometry = getCombatantFootprintGeometry(attacker, room);
  const targetGeometry = getCombatantFootprintGeometry(target, room);
  const direction: ForcedMovementDirection = {
    dx: (targetGeometry.minX > attackerGeometry.maxX ? 1 : targetGeometry.maxX < attackerGeometry.minX ? -1 : 0),
    dy: (targetGeometry.minY > attackerGeometry.maxY ? 1 : targetGeometry.maxY < attackerGeometry.minY ? -1 : 0)
  };
  if (direction.dx === 0 && direction.dy === 0) return { ok: false, error: "No se pudo derivar una direccion valida para la Embestida." };

  const provokesOpportunityAttack = !FeatCatalog.avoidsOpportunity(attacker.featIds, "bull_rush");
  const defenderCanMakeOpportunityAttack = provokesOpportunityAttack
    && targetStatus === "active"
    && Rules.canMakeOpportunityAttack(room, target, attacker.id)
    && threatensTarget(room, target, attacker);
  const projection = projectForcedMovement(room, target, direction, room.board.cellSizeFeet);
  return {
    ok: true,
    value: {
      maneuverId: "bull_rush",
      distanceFeet: distance,
      provokesOpportunityAttack,
      defenderCanMakeOpportunityAttack,
      attackerStrengthModifier: getEffectiveAbilityModifier(room, attacker, "strength"),
      attackerSizeModifier: getSpecialManeuverSizeModifier(attacker.sizeCategory),
      defenderStrengthModifier: getEffectiveAbilityModifier(room, target, "strength"),
      defenderSizeModifier: getSpecialManeuverSizeModifier(target.sizeCategory),
      direction,
      projectedPath: projection.path,
      projectedFinalPosition: projection.finalPosition,
      blocked: projection.blocked,
      blockedAt: projection.blockedAt,
      blockedReason: projection.blockedReason
    }
  };
}

export function validateSpecialManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  maneuverId: SpecialManeuverId
): RuleResult<TripManeuverPreview | BullRushManeuverPreview | GrappleManeuverPreview> {
  if (maneuverId === "grapple") return validateGrappleManeuver(room, attacker, target);
  if (maneuverId === "bull_rush") return validateBullRushManeuver(room, attacker, target);
  if (maneuverId !== "trip") return { ok: false, error: `Maniobra especial desconocida: ${String(maneuverId)}.` };
  if (attacker.id === target.id) return { ok: false, error: "Derribo requiere otro combatiente como objetivo." };
  if (attacker.type === target.type) return { ok: false, error: "Derribo requiere un enemigo como objetivo." };

  const attackerStatus = lifeStatus(attacker);
  if (attackerStatus !== "active" && attackerStatus !== "disabled") {
    return { ok: false, error: `${attacker.name} no puede intentar un derribo en su estado actual.` };
  }
  const targetStatus = lifeStatus(target);
  if (targetStatus !== "active" && targetStatus !== "disabled") {
    return { ok: false, error: `${target.name} no puede ser objetivo de Derribo en su estado actual.` };
  }
  if (hasActiveTrait(room, target, "PRONE")) return { ok: false, error: `${target.name} ya esta derribado.` };

  const attackerSizeIndex = SIZE_ORDER.indexOf(attacker.sizeCategory);
  const targetSizeIndex = SIZE_ORDER.indexOf(target.sizeCategory);
  if (attackerSizeIndex < 0 || targetSizeIndex < 0) return { ok: false, error: "Categoria de tamaño desconocida en Derribo." };
  if (targetSizeIndex > attackerSizeIndex + 1) {
    return { ok: false, error: `${target.name} supera en mas de una categoria de tamaño a ${attacker.name}.` };
  }

  const weapon = getEquippedWeaponEntry(attacker);
  const weaponId = weapon?.id ?? null;
  const armedTrip = Boolean(weapon?.specialManeuvers?.includes("trip"));
  let sourceId = "unarmed_strike";
  let sourceName = "ataque sin arma";
  let minReachFeet = 0;
  let maxReachFeet = getSizeRule(attacker.sizeCategory).defaultReachFeet;

  if (armedTrip && weaponId && weapon) {
    const source = deriveMeleeThreatSources(attacker).find((candidate) => candidate.sourceId === weaponId);
    if (!source) return { ok: false, error: `Invariante de Derribo violada: ${weapon.name} no posee fuente de amenaza derivada.` };
    sourceId = weaponId;
    sourceName = weapon.name;
    minReachFeet = source.minReachFeet;
    maxReachFeet = source.maxReachFeet;
  }

  const touchValidation = validateMeleeTouchManeuver(room, attacker, target, minReachFeet, maxReachFeet, "Derribo");
  if (!touchValidation.ok || !touchValidation.value) return { ok: false, error: touchValidation.error };

  const improvedTrip = FeatCatalog.avoidsOpportunity(attacker.featIds, "trip");
  const provokesOpportunityAttack = !improvedTrip && !armedTrip;
  const defenderCanMakeOpportunityAttack = provokesOpportunityAttack
    && targetStatus === "active"
    && Rules.canMakeOpportunityAttack(room, target, attacker.id)
    && threatensTarget(room, target, attacker);
  const defenderStrengthModifier = getEffectiveAbilityModifier(room, target, "strength");
  const defenderDexterityModifier = getEffectiveAbilityModifier(room, target, "dexterity");
  const defenderAbility: ManeuverAbility = defenderDexterityModifier > defenderStrengthModifier ? "dexterity" : "strength";

  return {
    ok: true,
    value: {
      maneuverId: "trip",
      distanceFeet: touchValidation.value.distanceFeet,
      sourceId,
      sourceName,
      armedTrip,
      minReachFeet,
      maxReachFeet,
      provokesOpportunityAttack,
      defenderCanMakeOpportunityAttack,
      flankingBonus: touchValidation.value.flankingBonus,
      touchArmorClass: touchValidation.value.touchArmorClass,
      concealment: touchValidation.value.concealment,
      attackerStrengthModifier: getEffectiveAbilityModifier(room, attacker, "strength"),
      attackerSizeModifier: getSpecialManeuverSizeModifier(attacker.sizeCategory),
      defenderAbility,
      defenderAbilityModifier: defenderAbility === "dexterity" ? defenderDexterityModifier : defenderStrengthModifier,
      defenderSizeModifier: getSpecialManeuverSizeModifier(target.sizeCategory)
    }
  };
}

export interface TripTouchAttackResult extends MeleeTouchManeuverResult {}

export function resolveTripTouchAttack(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  d20Roll: number
): TripTouchAttackResult {
  const validation = validateSpecialManeuver(room, attacker, target, "trip");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "trip") throw new Error(validation.error ?? "Derribo invalido.");
  return resolveMeleeTouchManeuver(room, attacker, validation.value, d20Roll);
}

export interface TripOpposedCheckResult {
  readonly attackerRoll: number;
  readonly defenderRoll: number;
  readonly attackerModifier: number;
  readonly defenderModifier: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly defenderAbility: ManeuverAbility;
  readonly attackerWins: boolean;
  readonly requiresReroll: boolean;
}

export function resolveTripOpposedCheck(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerRoll: number,
  defenderRoll: number
): TripOpposedCheckResult {
  const validation = validateSpecialManeuver(room, attacker, target, "trip");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "trip") throw new Error(validation.error ?? "Derribo invalido.");
  const attackerModifier = validation.value.attackerStrengthModifier + validation.value.attackerSizeModifier;
  const defenderModifier = validation.value.defenderAbilityModifier + validation.value.defenderSizeModifier;
  const opposed = resolveOpposedCheck(attackerRoll, defenderRoll, attackerModifier, defenderModifier);
  return {
    ...opposed,
    defenderAbility: validation.value.defenderAbility,
  };
}

export interface BullRushOpposedCheckResult {
  readonly attackerRoll: number;
  readonly defenderRoll: number;
  readonly attackerModifier: number;
  readonly defenderModifier: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly attackerWins: boolean;
  readonly requiresReroll: boolean;
  readonly margin: number;
}

export function resolveBullRushOpposedCheck(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerRoll: number,
  defenderRoll: number
): BullRushOpposedCheckResult {
  const validation = validateSpecialManeuver(room, attacker, target, "bull_rush");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "bull_rush") {
    throw new Error(validation.error ?? "Embestida invalida.");
  }
  const attackerModifier = validation.value.attackerStrengthModifier + validation.value.attackerSizeModifier;
  const defenderModifier = validation.value.defenderStrengthModifier + validation.value.defenderSizeModifier;
  const opposed = resolveOpposedCheck(attackerRoll, defenderRoll, attackerModifier, defenderModifier);
  return {
    ...opposed,
    margin: Math.max(0, opposed.attackerTotal - opposed.defenderTotal)
  };
}

export interface GrappleOpposedCheckResult extends OpposedCheckResult {}

export function resolveGrappleTouchAttack(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  d20Roll: number
): MeleeTouchManeuverResult {
  const validation = validateSpecialManeuver(room, attacker, target, "grapple");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "grapple") {
    throw new Error(validation.error ?? "Presa invalida.");
  }
  return resolveMeleeTouchManeuver(room, attacker, validation.value, d20Roll);
}

export function resolveGrappleOpposedCheck(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerRoll: number,
  defenderRoll: number
): GrappleOpposedCheckResult {
  const validation = validateSpecialManeuver(room, attacker, target, "grapple");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "grapple") {
    throw new Error(validation.error ?? "Presa invalida.");
  }
  return resolveOpposedCheck(
    attackerRoll,
    defenderRoll,
    validation.value.attackerGrappleModifier,
    validation.value.defenderGrappleModifier
  );
}

export interface AttackRoutineItem {
  type: "primary" | "iterative";
  penalty: number;
}

export function getAttackRoutine(combatant: Combatant): AttackRoutineItem[] {
  const routine: AttackRoutineItem[] = [{ type: "primary", penalty: 0 }];
  if (combatant.baseAttackBonus >= 6) routine.push({ type: "iterative", penalty: -5 });
  if (combatant.baseAttackBonus >= 11) routine.push({ type: "iterative", penalty: -10 });
  if (combatant.baseAttackBonus >= 16) routine.push({ type: "iterative", penalty: -15 });
  return routine;
}

/**
 * Sprint 036: read-model puro y congelado que unifica `getAttackRoutine` (forma/penalizador
 * ordinal por BAB) con `Rules.totalAttackBonus` (bonus base ya resuelto: característica, tamaño,
 * modificadores de efectos no dependientes de objetivo) en un único array consumible por UI y
 * servidor sin recalcular por separado. Deliberadamente NO recibe un `target`: flanqueo, Presa,
 * Apretujarse-vs-objetivo y Luchar a la Defensiva siguen viviendo exclusivamente en
 * `getAttackContextModifiers`/`evaluateConditionalModifiers`, evaluados por intento de ataque
 * contra un objetivo concreto — ver `docs/designs/iterative-attacks-core-design.md`.
 */
export interface IterativeAttack {
  readonly ordinal: number;
  readonly type: "primary" | "iterative";
  readonly routinePenalty: number;
  readonly effectiveAttackBonus: number;
}

export function getEffectiveAttackRoutine(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType">
): readonly IterativeAttack[] {
  const routine = getAttackRoutine(combatant);
  const baseAttack = Rules.totalAttackBonus(context, combatant, { ...attackContext, useEquippedWeapon: true });
  return Object.freeze(routine.map((entry, index) => Object.freeze({
    ordinal: index + 1,
    type: entry.type,
    routinePenalty: entry.penalty,
    effectiveAttackBonus: baseAttack.total + entry.penalty
  })));
}
