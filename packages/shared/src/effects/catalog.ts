import type { EffectDefinition } from "./contracts.js";

/**
 * Catálogo declarativo (Nivel 1).
 * Totalmente estático, inmutable y libre de lógica.
 * Ninguna función del motor debe inyectar datos aquí.
 *
 * NOTA: Este catálogo permanece mecánicamente neutro durante el Sprint 005.
 * El primer efecto productivo pertenecerá al Sprint 006.
 */
export const effectsCatalog = {
  // INTERNAL: Efecto estrictamente reservado para validar la infraestructura
  // Infrastructure only. Never referenced by production.
  "__INFRASTRUCTURE_SAMPLE__": {
    name: "Infrastructure Sample Effect",
    description: "Placeholder exclusivo para pruebas de infraestructura y pruebas de inmutabilidad del motor.",
    traits: [],
    modifiers: [],
    ruleOverrides: [],
    onStack: "ignore"
  },

  // SRD Conditions
  "srd_stunned": {
    name: "Aturdido",
    description: "La criatura no puede tomar acciones, suelta lo que sostiene, pierde su bono de Destreza a la CA y recibe un penalizador de -2 a la CA.",
    traits: ["CANNOT_ACT", "NO_DEX_TO_AC", "NO_THREAT", "CANNOT_MAKE_AOO"],
    modifiers: [
      {
        type: "numeric",
        id: "stunned_ac_penalty",
        stat: "AC",
        stackingGroup: "condition",
        stackingPolicy: "lowest_value",
        value: -2
      }
    ],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_flat_footed": {
    name: "Desprevenido",
    description: "Un personaje que todavía no ha actuado durante un combate está desprevenido, incapaz de reaccionar a la situación normalmente. Pierde cualquier bono de Destreza a la CA (si tiene alguno) y no puede realizar ataques de oportunidad.",
    traits: ["NO_DEX_TO_AC", "CANNOT_MAKE_AOO"],
    modifiers: [],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_fatigued": {
    name: "Fatigado",
    description: "El personaje no puede correr ni cargar. Penalizador de -2 a Fuerza y Destreza.",
    traits: ["FATIGUED"],
    modifiers: [
      { type: "numeric", id: "fatigued_str", stat: "STRENGTH", stackingGroup: "penalty", stackingPolicy: "sum", value: -2 },
      { type: "numeric", id: "fatigued_dex", stat: "DEXTERITY", stackingGroup: "penalty", stackingPolicy: "sum", value: -2 }
    ],
    ruleOverrides: ["FORBID_RUN", "FORBID_CHARGE"],
    onStack: "ignore"
  },
  "srd_squeezing": {
    name: "Apretujarse",
    description: "El personaje se esta moviendo por una casilla estrecha. -4 a la CA y -4 a tiradas de ataque cuerpo a cuerpo.",
    traits: ["SQUEEZING"],
    modifiers: [
      { type: "numeric", id: "sqz_ac", stat: "AC", stackingGroup: "penalty", stackingPolicy: "sum", value: -4 }
    ],
    conditionalModifiers: [
      { id: "sqz_melee_atk", label: "squeezing -4", stat: "ATTACK", value: -4, stackingGroup: "circumstance", condition: { type: "attack_type", value: "melee" } }
    ],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_grappling": {
    name: "En presa",
    description: "La criatura forma parte de una presa, no puede moverse voluntariamente y pierde Destreza a la CA frente a atacantes externos.",
    traits: ["CANNOT_MOVE", "GRAPPLING"],
    modifiers: [],
    conditionalTraits: [
      { trait: "NO_DEX_TO_AC", condition: { type: "attacker_outside_effect_targets", value: true } }
    ],
    conditionalModifiers: [
      { id: "grappling_melee_atk", label: "forcejeo en presa -4", stat: "ATTACK", value: -4, stackingGroup: "circumstance", condition: { type: "attack_type", value: "melee" } }
    ],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_prone": {
    name: "Derribado",
    description: "El personaje está en el suelo. -4 a la CA contra ataques cuerpo a cuerpo, +4 a la CA contra ataques a distancia. Penalizador de -4 a sus propios ataques melee.",
    traits: ["PRONE"],
    modifiers: [],
    conditionalModifiers: [
      { id: "prone_vs_melee_def", label: "derribado contra melee -4", stat: "AC", value: -4, stackingGroup: "misc", condition: { type: "attack_type", value: "melee"  } },
      { id: "prone_vs_ranged_def", label: "derribado contra ranged +4", stat: "AC", value: +4, stackingGroup: "misc", condition: { type: "attack_type", value: "ranged" } },
      { id: "prone_melee_atk", label: "ataque derribado -4", stat: "ATTACK", value: -4, stackingGroup: "misc", condition: { type: "attack_type", value: "melee" } }
    ],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_dazed": {
    name: "Atontado",
    description: "El personaje no puede realizar acciones (CANNOT_ACT).",
    traits: ["CANNOT_ACT"],
    modifiers: [],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_paralyzed": {
    name: "Paralizado",
    description: "El personaje queda indefenso (HELPLESS), con Destreza 0, y no puede moverse ni actuar.",
    traits: ["CANNOT_ACT", "CANNOT_MOVE", "HELPLESS"],
    modifiers: [
      { type: "override", stat: "DEXTERITY", value: 0 }
    ],
    ruleOverrides: [],
    onStack: "ignore"
  },
  "srd_running_exposed": {
    name: "Corriendo (sin Destreza a la CA)",
    description: "Sprint 041 (MOVE-RUN), D-3: al correr sin la dote de Correr, el personaje no puede evitar los ataques y pierde su bonificador de Destreza a la CA. Reutiliza NO_DEX_TO_AC (suprime Destreza y Esquiva juntos, como Desprevenido); RAW solo priva de Destreza, conservando Esquiva — simplificación documentada en el NDD, sin CANNOT_MAKE_AOO (D-1: correr no impide realizar ataques de oportunidad).",
    traits: ["NO_DEX_TO_AC"],
    modifiers: [],
    ruleOverrides: [],
    onStack: "ignore"
  },

  // Peligros Ambientales (Sprint 034) — EffectInstance ancla vía `targetCells`, no `targets`.
  "srd_wall_of_fire_hazard": {
    name: "Muro de Fuego (Peligro Ambiental)",
    description: "Franja de celdas envuelta en llamas mágicas. Quien ocupe alguna de sus celdas al inicio de la ronda sufre daño de fuego; una salvación de Reflejos exitosa reduce el daño a la mitad.",
    traits: [],
    modifiers: [],
    ruleOverrides: [],
    onStack: "ignore",
    hazard: {
      savingThrowType: "reflex",
      saveEffect: "half",
      dc: 15,
      damageExpression: "2d4"
    }
  },
  "srd_poison_gas_hazard": {
    name: "Nube de Gas Venenoso (Peligro Ambiental)",
    description: "Nube persistente de gas tóxico. Quien la respire al inicio de la ronda debe superar una salvación de Fortaleza o quedar Fatigado; una salvación exitosa niega el efecto por completo.",
    traits: [],
    modifiers: [],
    ruleOverrides: [],
    onStack: "ignore",
    hazard: {
      savingThrowType: "fortitude",
      saveEffect: "negates",
      dc: 13,
      onFailEffectId: "srd_fatigued"
    }
  }
} as const satisfies Record<string, EffectDefinition>;

/**
 * Tipo de identificador del catálogo productivo.
 * Estricto: solo IDs que existen en effectsCatalog.
 */
export type ProductionEffectId = keyof typeof effectsCatalog;

export function isProductionEffectId(value: string): value is ProductionEffectId {
  return value in effectsCatalog;
}
