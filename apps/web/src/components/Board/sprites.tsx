import type { ReactNode } from "react";
import type { SizeCategory } from "@dnd-tactical/shared";

/**
 * Sprites originales del proyecto (SVG local, fondo transparente, sin assets externos).
 *
 * Cada arquetipo es una figura de cuerpo completo (viewBox 64×128, pies en y≈124)
 * generada por un renderer humanoide parametrizado. La variante `portrait`
 * recorta cabeza y hombros para listas laterales y la vista 2D.
 */

export type SpriteArchetypeId =
  | "cedrick"
  | "bane"
  | "elaen"
  | "alaric"
  | "allied_guard"
  | "walker"
  | "explorer"
  | "guardian_large"
  | "orc_leader"
  | "orc_duelist"
  | "spear_guard"
  | "orc_sentinel"
  | "orc_archer"
  | "canocrock"
  | "fallback_player"
  | "fallback_enemy";

export const INTERNAL_ICON_IDENTIFIERS: ReadonlySet<string> = new Set([
  "shield",
  "swords",
  "sparkles",
  "skull",
  "crosshair",
  "footprints",
  "compass"
]);

export function isInternalIconIdentifier(value: string | undefined | null): boolean {
  if (!value) return false;
  return INTERNAL_ICON_IDENTIFIERS.has(value.trim().toLowerCase());
}

export interface CombatantSpriteInput {
  readonly id?: string;
  readonly name: string;
  readonly type: "player" | "enemy";
  readonly icon?: string;
  readonly sizeCategory?: SizeCategory;
}

export interface CombatantSpriteDescriptor {
  readonly archetypeId: SpriteArchetypeId;
  readonly title: string;
  readonly faction: "player" | "enemy";
  readonly isLarge: boolean;
  readonly isFallback: boolean;
}

function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function resolveCombatantSprite(
  combatant: CombatantSpriteInput,
  options?: { readonly forceFallback?: boolean }
): CombatantSpriteDescriptor {
  const isLarge = combatant.sizeCategory === "large" || combatant.sizeCategory === "huge";
  const faction = combatant.type;

  if (options?.forceFallback) {
    return {
      archetypeId: faction === "player" ? "fallback_player" : "fallback_enemy",
      title: faction === "player" ? "Combatiente Aliado" : "Combatiente Enemigo",
      faction,
      isLarge,
      isFallback: true
    };
  }

  const nameNorm = normalizeKey(combatant.name || "");
  const idNorm = normalizeKey(combatant.id || "");

  if (nameNorm.includes("cedrick") || idNorm.startsWith("cedrick")) {
    return { archetypeId: "cedrick", title: "Cedrick · Paladín con escudo", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("bane") || idNorm.startsWith("bane")) {
    return { archetypeId: "bane", title: "Bane · Pícaro duelista", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("elaen") || idNorm.startsWith("elaen")) {
    return { archetypeId: "elaen", title: "Elaen · Arquera élfica", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("alaric") || nameNorm.includes("mago") || idNorm.startsWith("mago")) {
    return { archetypeId: "alaric", title: "Alaric el Mago · Lanzador arcano", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("guardian coloso") || nameNorm.includes("coloso") || idNorm.startsWith("guardian_large")) {
    return {
      archetypeId: "guardian_large",
      title: "Guardián Coloso · Gigante acorazado (Large 2×2)",
      faction,
      isLarge: true,
      isFallback: false
    };
  }
  if (nameNorm.includes("guardia aliado") || idNorm.startsWith("guardia")) {
    return { archetypeId: "allied_guard", title: "Guardia Aliado · Escudero táctico", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("caminante") || idNorm.startsWith("caminante")) {
    return { archetypeId: "walker", title: "Caminante · Batidor ligero", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("explorador") || idNorm.startsWith("explorador")) {
    return { archetypeId: "explorer", title: "Explorador · Rastreador de terreno", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("jefe orco") || idNorm.startsWith("orc_leader")) {
    return { archetypeId: "orc_leader", title: "Jefe Orco · Caudillo con gran hacha", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("duelista orco") || idNorm.startsWith("defensor")) {
    return { archetypeId: "orc_duelist", title: "Duelista Orco · Espadachín", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("guardia de lanza") || idNorm.startsWith("enemigo_guardia")) {
    return { archetypeId: "spear_guard", title: "Guardia de Lanza · Lancero orco", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("centinela orco") || idNorm.startsWith("enemigo_melee")) {
    return { archetypeId: "orc_sentinel", title: "Centinela Orco · Guardia pesado", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("arquero orco") || idNorm === "orco") {
    return { archetypeId: "orc_archer", title: "Arquero Orco · Tirador", faction, isLarge, isFallback: false };
  }
  if (nameNorm.includes("canocrock") || idNorm.startsWith("canocrock")) {
    return { archetypeId: "canocrock", title: "Canocrock · Bestia mágica acorazada", faction, isLarge, isFallback: false };
  }

  return {
    archetypeId: faction === "player" ? "fallback_player" : "fallback_enemy",
    title: faction === "player" ? "Héroe / Aliado (Fallback)" : "Enemigo (Fallback)",
    faction,
    isLarge,
    isFallback: true
  };
}

// ---------------------------------------------------------------------------
// Renderer humanoide parametrizado
// ---------------------------------------------------------------------------

type HeadGear =
  | "bare"
  | "crest-helm"
  | "hood"
  | "circlet"
  | "wizard-hat"
  | "kettle-helm"
  | "feather-cap"
  | "wide-hat"
  | "horned-helm"
  | "jaw-guard"
  | "spike-helm"
  | "colossus-helm";

type MainHand =
  | "none"
  | "longsword"
  | "greatsword"
  | "rapier"
  | "shortsword"
  | "scimitar"
  | "greataxe"
  | "spear"
  | "staff"
  | "arrow";

type OffHand = "none" | "kite-shield" | "round-shield" | "buckler" | "dagger" | "orb" | "longbow" | "shortbow";

interface HumanoidSpec {
  readonly skin: string;
  readonly skinShade: string;
  readonly torso: string;
  readonly torsoShade: string;
  readonly trim: string;
  readonly lower: "legs" | "robe";
  readonly legs: string;
  readonly boots: string;
  readonly cape?: string;
  readonly head: HeadGear;
  readonly gear: string;
  readonly gearAccent: string;
  readonly hair?: string;
  readonly beard?: string;
  readonly eyes: string;
  readonly tusks?: boolean;
  readonly pauldrons?: string;
  readonly emblem?: string;
  readonly quiver?: boolean;
  readonly main: MainHand;
  readonly off: OffHand;
  readonly accent: string;
  readonly bulk?: number;
}

const OUTLINE = "#0e1114";

const HUMANOID_SPECS: Readonly<Record<Exclude<SpriteArchetypeId, "canocrock">, HumanoidSpec>> = {
  cedrick: {
    skin: "#e2b997", skinShade: "#b98d6c", torso: "#9aa7b3", torsoShade: "#6c7884", trim: "#e7c35a",
    lower: "legs", legs: "#56636e", boots: "#3b3129", cape: "#2b4d78", head: "crest-helm",
    gear: "#b7c2cc", gearAccent: "#e7c35a", eyes: "#1b2a38", pauldrons: "#c3ccd5", emblem: "#e7c35a",
    main: "longsword", off: "kite-shield", accent: "#2b4d78"
  },
  bane: {
    skin: "#d8b08f", skinShade: "#a9805f", torso: "#2c3a37", torsoShade: "#1d2725", trim: "#7a5a43",
    lower: "legs", legs: "#262f2d", boots: "#2a211b", cape: "#1d4a44", head: "hood",
    gear: "#235a52", gearAccent: "#5fc9b8", eyes: "#7dffe3",
    main: "rapier", off: "dagger", accent: "#5fc9b8"
  },
  elaen: {
    skin: "#ecc9a8", skinShade: "#c19b7a", torso: "#3d6a42", torsoShade: "#2a4c2e", trim: "#c8a35a",
    lower: "legs", legs: "#5b4535", boots: "#3a2a1f", cape: "#2f5232", head: "circlet",
    gear: "#e2c46a", gearAccent: "#e2c46a", hair: "#e9d9a6", eyes: "#2b5d33", quiver: true,
    main: "arrow", off: "longbow", accent: "#9bd18c"
  },
  alaric: {
    skin: "#e5c4a6", skinShade: "#b89577", torso: "#3a2f6e", torsoShade: "#271f4f", trim: "#e7c35a",
    lower: "robe", legs: "#3a2f6e", boots: "#22193f", head: "wizard-hat",
    gear: "#433682", gearAccent: "#e7c35a", beard: "#d9dde2", eyes: "#2b2350",
    main: "staff", off: "orb", accent: "#a98bff"
  },
  allied_guard: {
    skin: "#d9b291", skinShade: "#ab8565", torso: "#2f5f63", torsoShade: "#1f4245", trim: "#d8c27a",
    lower: "legs", legs: "#3c4c50", boots: "#2b241f", head: "kettle-helm",
    gear: "#94a3ad", gearAccent: "#d8c27a", eyes: "#1b2a30", pauldrons: "#8796a0",
    main: "shortsword", off: "round-shield", accent: "#4fb3a6"
  },
  walker: {
    skin: "#c99f7e", skinShade: "#9c7559", torso: "#4c6a5a", torsoShade: "#344b3f", trim: "#a98455",
    lower: "legs", legs: "#5a5040", boots: "#3a2d22", cape: "#3d5a52", head: "feather-cap",
    gear: "#2c5850", gearAccent: "#e8c45d", eyes: "#1e2b26", hair: "#5a3d28",
    main: "shortsword", off: "none", accent: "#6fc2a8"
  },
  explorer: {
    skin: "#d5ab88", skinShade: "#a8805f", torso: "#5d6b3d", torsoShade: "#43502a", trim: "#b48a52",
    lower: "legs", legs: "#5a4636", boots: "#33261c", head: "wide-hat",
    gear: "#5a3e2c", gearAccent: "#c79a5a", eyes: "#26301a", beard: "#6b4a30",
    main: "shortsword", off: "dagger", accent: "#a5c97a"
  },
  guardian_large: {
    skin: "#8d9aa3", skinShade: "#5f6b73", torso: "#4c5d68", torsoShade: "#33414a", trim: "#53e1f0",
    lower: "legs", legs: "#3c4a53", boots: "#262f35", head: "colossus-helm",
    gear: "#6f8290", gearAccent: "#53e1f0", eyes: "#53e1f0", pauldrons: "#7b8e9b", emblem: "#53e1f0",
    main: "greatsword", off: "none", accent: "#53e1f0", bulk: 1.18
  },
  orc_leader: {
    skin: "#6f8a3c", skinShade: "#4c6227", torso: "#6a2a20", torsoShade: "#4a1c15", trim: "#c9a14a",
    lower: "legs", legs: "#3e2e26", boots: "#24190f", cape: "#3d1712", head: "horned-helm",
    gear: "#76828a", gearAccent: "#e9e3d2", eyes: "#ff5a3c", tusks: true, pauldrons: "#80898f",
    main: "greataxe", off: "none", accent: "#e0573f", bulk: 1.08
  },
  orc_duelist: {
    skin: "#7b9446", skinShade: "#566b2c", torso: "#7a3628", torsoShade: "#57251b", trim: "#d1a35a",
    lower: "legs", legs: "#44322a", boots: "#2a1d14", head: "bare",
    gear: "#2d2a26", gearAccent: "#d1a35a", hair: "#1c1a17", eyes: "#ffcf3d", tusks: true,
    main: "scimitar", off: "buckler", accent: "#e2774f"
  },
  spear_guard: {
    skin: "#728c40", skinShade: "#50662a", torso: "#5a2a22", torsoShade: "#3f1d17", trim: "#a7a7a7",
    lower: "legs", legs: "#3a2c25", boots: "#22180f", head: "spike-helm",
    gear: "#5f6e77", gearAccent: "#d94b3d", eyes: "#ffb03a", tusks: true, pauldrons: "#6b767d",
    main: "spear", off: "round-shield", accent: "#d94b3d"
  },
  orc_sentinel: {
    skin: "#67803a", skinShade: "#485c25", torso: "#5c2720", torsoShade: "#401b16", trim: "#9aa3a8",
    lower: "legs", legs: "#3b2d26", boots: "#22180f", head: "jaw-guard",
    gear: "#7f8c94", gearAccent: "#c6ced3", eyes: "#ff6a3d", tusks: true, pauldrons: "#7a858c",
    main: "longsword", off: "kite-shield", accent: "#c14a35", bulk: 1.05
  },
  orc_archer: {
    skin: "#7a9248", skinShade: "#566a2e", torso: "#5e3626", torsoShade: "#43261a", trim: "#9c7a4a",
    lower: "legs", legs: "#40332a", boots: "#261b12", head: "hood",
    gear: "#4a3424", gearAccent: "#c79a5a", eyes: "#ffcf3d", tusks: true, quiver: true,
    main: "arrow", off: "shortbow", accent: "#d98a4f"
  },
  fallback_player: {
    skin: "#dcb796", skinShade: "#ad8a6b", torso: "#2d6a63", torsoShade: "#1f4b46", trim: "#d8c27a",
    lower: "legs", legs: "#3b4a48", boots: "#2b241f", head: "bare",
    gear: "#3a2e25", gearAccent: "#d8c27a", hair: "#4a3424", eyes: "#1d2a28",
    main: "shortsword", off: "none", accent: "#4fb3a6"
  },
  fallback_enemy: {
    skin: "#7d8f4c", skinShade: "#58692f", torso: "#6b2f24", torsoShade: "#4b2119", trim: "#a98455",
    lower: "legs", legs: "#3e3029", boots: "#24190f", head: "bare",
    gear: "#2a2420", gearAccent: "#a98455", hair: "#1c1a17", eyes: "#ff8a3d", tusks: true,
    main: "shortsword", off: "none", accent: "#e0573f"
  }
};

function renderHeadGear(spec: HumanoidSpec): ReactNode {
  const { gear, gearAccent } = spec;
  switch (spec.head) {
    case "bare":
      return spec.hair ? <path d="M23 18 Q24 9 32 9 Q40 9 41 18 Q37 13 32 13 Q27 13 23 18 Z" fill={spec.hair} stroke={OUTLINE} strokeWidth="1" /> : null;
    case "crest-helm":
      return (
        <g>
          <path d="M22.5 24 Q22 10 32 9 Q42 10 41.5 24 L39 26 L25 26 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M26 19 L38 19 L38 22 L26 22 Z" fill="#1a2128" />
          <path d="M31 9 L33 9 L33 25 L31 25 Z" fill={gearAccent} opacity="0.85" />
          <path d="M28 8 Q32 0 36 8 Q32 5 28 8 Z" fill={spec.accent} stroke={OUTLINE} strokeWidth="0.8" />
        </g>
      );
    case "hood":
      return (
        <g>
          <path d="M20 30 Q19 8 32 7 Q45 8 44 30 L40 27 Q40 15 32 14 Q24 15 24 27 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M25 22 L39 22 L38 27 L26 27 Z" fill="#141a19" opacity="0.92" />
        </g>
      );
    case "circlet":
      return (
        <g>
          <path d="M22 26 Q20 8 32 8 Q44 8 42 26 Q44 36 40 44 L38 26 Q36 15 32 15 Q28 15 26 26 L24 44 Q20 36 22 26 Z" fill={spec.hair ?? "#d9c48a"} stroke={OUTLINE} strokeWidth="1" />
          <path d="M23.5 17 Q32 13 40.5 17" fill="none" stroke={gearAccent} strokeWidth="1.8" />
          <circle cx="32" cy="15" r="1.6" fill="#7fe0ff" />
          <path d="M22.5 21 L19 18 L22.6 24 Z M41.5 21 L45 18 L41.4 24 Z" fill={spec.skin} stroke={OUTLINE} strokeWidth="0.7" />
        </g>
      );
    case "wizard-hat":
      return (
        <g>
          <path d="M18 17 Q32 12 46 17 Q40 21 32 21 Q24 21 18 17 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M24 17 Q30 -2 44 -2 Q35 4 39 17 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M24.5 15.5 Q32 13 39.5 15.5" fill="none" stroke={gearAccent} strokeWidth="1.6" />
          <circle cx="33" cy="9" r="1.4" fill={gearAccent} />
        </g>
      );
    case "kettle-helm":
      return (
        <g>
          <path d="M23 21 Q23 10 32 10 Q41 10 41 21 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M17 21 Q32 17 47 21 L45 24 Q32 21 19 24 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.1" />
          <path d="M26 13 Q32 11 38 13" fill="none" stroke="#dfe6ea" strokeWidth="1" opacity="0.6" />
        </g>
      );
    case "feather-cap":
      return (
        <g>
          <path d="M22 19 Q22 10 32 10 Q42 10 42 19 Q32 15 22 19 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.1" />
          <path d="M37 13 Q46 3 52 6 Q45 7 40 15 Z" fill={gearAccent} stroke={OUTLINE} strokeWidth="0.8" />
        </g>
      );
    case "wide-hat":
      return (
        <g>
          <ellipse cx="32" cy="16.5" rx="15" ry="3.6" fill={gear} stroke={OUTLINE} strokeWidth="1.1" />
          <path d="M25 16 Q25 7 32 7 Q39 7 39 16 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.1" />
          <path d="M25.3 14 L38.7 14" stroke={gearAccent} strokeWidth="1.6" />
        </g>
      );
    case "horned-helm":
      return (
        <g>
          <path d="M22.5 22 Q22 10 32 9.5 Q42 10 41.5 22 L38 22 L38 19 L26 19 L26 22 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M24 14 Q15 12 13 2 Q19 9 26 11 Z" fill={gearAccent} stroke={OUTLINE} strokeWidth="1" />
          <path d="M40 14 Q49 12 51 2 Q45 9 38 11 Z" fill={gearAccent} stroke={OUTLINE} strokeWidth="1" />
        </g>
      );
    case "jaw-guard":
      return (
        <g>
          <path d="M23 19 Q23 10 32 10 Q41 10 41 19 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.1" />
          <path d="M24 24 L40 24 L38 31 L26 31 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.1" />
          <path d="M27 26 L37 26 M27 28.5 L37 28.5" stroke={gearAccent} strokeWidth="0.9" />
        </g>
      );
    case "spike-helm":
      return (
        <g>
          <path d="M22.5 24 Q22 11 32 10 Q42 11 41.5 24 L39 24 L39 20 L25 20 L25 24 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.2" />
          <path d="M30 11 L32 1 L34 11 Z" fill="#c9d1d6" stroke={OUTLINE} strokeWidth="0.8" />
          <path d="M31 2 Q24 4 23 9" fill="none" stroke={gearAccent} strokeWidth="1.6" />
        </g>
      );
    case "colossus-helm":
      return (
        <g>
          <path d="M21 27 L21 13 Q21 6 32 6 Q43 6 43 13 L43 27 L38 30 L26 30 Z" fill={gear} stroke={OUTLINE} strokeWidth="1.3" />
          <path d="M24 17 L40 17 L39 21 L25 21 Z" fill={gearAccent} />
          <path d="M32 6 L32 16" stroke="#9fb1bc" strokeWidth="1.4" />
          <path d="M21 14 L16 10 L21 20 Z M43 14 L48 10 L43 20 Z" fill={gear} stroke={OUTLINE} strokeWidth="1" />
        </g>
      );
  }
}

function renderMainHand(spec: HumanoidSpec, hx: number, hy: number): ReactNode {
  const steel = "#dfe5ea";
  switch (spec.main) {
    case "none":
      return null;
    case "longsword":
      return (
        <g>
          <path d={`M${hx - 1.4} ${hy - 4} L${hx + 1.4} ${hy - 4} L${hx + 1} ${hy - 44} L${hx} ${hy - 48} L${hx - 1} ${hy - 44} Z`} fill={steel} stroke={OUTLINE} strokeWidth="0.9" />
          <rect x={hx - 5} y={hy - 5} width="10" height="2.6" rx="1" fill={spec.trim} stroke={OUTLINE} strokeWidth="0.7" />
          <rect x={hx - 1.2} y={hy - 2.5} width="2.4" height="7" fill="#4a3426" />
        </g>
      );
    case "greatsword":
      return (
        <g>
          <path d={`M${hx - 2.4} ${hy - 6} L${hx + 2.4} ${hy - 6} L${hx + 1.8} ${hy - 62} L${hx} ${hy - 67} L${hx - 1.8} ${hy - 62} Z`} fill={steel} stroke={OUTLINE} strokeWidth="1" />
          <path d={`M${hx} ${hy - 10} L${hx} ${hy - 58}`} stroke={spec.accent} strokeWidth="0.9" opacity="0.8" />
          <rect x={hx - 7} y={hy - 7.5} width="14" height="3.2" rx="1.2" fill={spec.trim} stroke={OUTLINE} strokeWidth="0.8" />
          <rect x={hx - 1.5} y={hy - 4.5} width="3" height="10" fill="#3a2a20" />
        </g>
      );
    case "rapier":
      return (
        <g>
          <path d={`M${hx} ${hy - 3} L${hx + 9} ${hy - 50}`} stroke={steel} strokeWidth="1.5" strokeLinecap="round" />
          <path d={`M${hx - 4} ${hy - 2} Q${hx} ${hy - 9} ${hx + 4} ${hy - 2}`} fill="none" stroke={spec.trim} strokeWidth="1.6" />
          <circle cx={hx} cy={hy - 1} r="1.6" fill={spec.trim} />
        </g>
      );
    case "shortsword":
      return (
        <g>
          <path d={`M${hx - 1.3} ${hy - 4} L${hx + 1.3} ${hy - 4} L${hx + 1} ${hy - 28} L${hx} ${hy - 31} L${hx - 1} ${hy - 28} Z`} fill={steel} stroke={OUTLINE} strokeWidth="0.8" />
          <rect x={hx - 4} y={hy - 5} width="8" height="2.2" rx="1" fill={spec.trim} />
        </g>
      );
    case "scimitar":
      return (
        <g>
          <path d={`M${hx - 1} ${hy - 3} Q${hx + 12} ${hy - 22} ${hx + 4} ${hy - 44} Q${hx + 6} ${hy - 22} ${hx + 1.5} ${hy - 3} Z`} fill={steel} stroke={OUTLINE} strokeWidth="0.9" />
          <rect x={hx - 4} y={hy - 4} width="8" height="2.4" rx="1" fill={spec.trim} />
        </g>
      );
    case "greataxe":
      return (
        <g>
          <path d={`M${hx} ${hy + 22} L${hx} ${hy - 50}`} stroke="#5b3f2d" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${hx} ${hy - 46} Q${hx + 16} ${hy - 54} ${hx + 14} ${hy - 32} Q${hx + 8} ${hy - 38} ${hx} ${hy - 36} Z`} fill="#c9d0d5" stroke={OUTLINE} strokeWidth="1" />
          <path d={`M${hx} ${hy - 46} Q${hx - 13} ${hy - 52} ${hx - 11} ${hy - 34} Q${hx - 6} ${hy - 39} ${hx} ${hy - 37} Z`} fill="#aeb7bd" stroke={OUTLINE} strokeWidth="1" />
        </g>
      );
    case "spear":
      return (
        <g>
          <path d={`M${hx + 1} ${hy + 50} L${hx - 3} ${hy - 58}`} stroke="#8a6a4e" strokeWidth="2.4" strokeLinecap="round" />
          <path d={`M${hx - 3.4} ${hy - 70} L${hx - 7} ${hy - 57} L${hx + 0.4} ${hy - 57} Z`} fill={steel} stroke={OUTLINE} strokeWidth="0.9" />
          <path d={`M${hx - 5.5} ${hy - 55} L${hx - 1} ${hy - 53}`} stroke={spec.accent} strokeWidth="2" />
        </g>
      );
    case "staff":
      return (
        <g>
          <path d={`M${hx} ${hy + 54} L${hx + 1} ${hy - 54}`} stroke="#6d4c36" strokeWidth="2.8" strokeLinecap="round" />
          <path d={`M${hx - 3} ${hy - 54} Q${hx + 1} ${hy - 66} ${hx + 5} ${hy - 54}`} fill="none" stroke="#6d4c36" strokeWidth="2" />
          <circle cx={hx + 1} cy={hy - 58} r="4.4" fill="#8f6bff" stroke="#e6dcff" strokeWidth="1.2" />
          <circle cx={hx} cy={hy - 59.5} r="1.5" fill="#ffffff" />
        </g>
      );
    case "arrow":
      return (
        <g>
          <path d={`M${hx} ${hy} L${hx - 24} ${hy - 10}`} stroke="#e6d6b8" strokeWidth="1.3" />
          <path d={`M${hx - 26} ${hy - 11} L${hx - 21} ${hy - 12.5} L${hx - 22} ${hy - 8} Z`} fill={steel} />
        </g>
      );
  }
}

function renderOffHand(spec: HumanoidSpec, hx: number, hy: number): ReactNode {
  switch (spec.off) {
    case "none":
      return null;
    case "kite-shield":
      return (
        <g>
          <path d={`M${hx - 11} ${hy - 26} L${hx + 9} ${hy - 26} L${hx + 8} ${hy - 4} L${hx - 1} ${hy + 10} L${hx - 10} ${hy - 4} Z`} fill={spec.accent} stroke={OUTLINE} strokeWidth="1.2" />
          <path d={`M${hx - 8.5} ${hy - 23.5} L${hx + 6.5} ${hy - 23.5} L${hx + 5.8} ${hy - 5} L${hx - 1} ${hy + 6} L${hx - 7.8} ${hy - 5} Z`} fill="none" stroke={spec.trim} strokeWidth="1.3" />
          <path d={`M${hx - 1} ${hy - 20} L${hx - 1} ${hy + 2} M${hx - 7} ${hy - 12} L${hx + 5} ${hy - 12}`} stroke={spec.trim} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "round-shield":
      return (
        <g>
          <circle cx={hx - 1} cy={hy - 8} r="11" fill={spec.accent} stroke={OUTLINE} strokeWidth="1.2" />
          <circle cx={hx - 1} cy={hy - 8} r="8.5" fill="none" stroke={spec.trim} strokeWidth="1" />
          <circle cx={hx - 1} cy={hy - 8} r="2.6" fill={spec.trim} stroke={OUTLINE} strokeWidth="0.6" />
        </g>
      );
    case "buckler":
      return (
        <g>
          <circle cx={hx - 1} cy={hy - 4} r="7" fill="#58626a" stroke={OUTLINE} strokeWidth="1.1" />
          <circle cx={hx - 1} cy={hy - 4} r="2.4" fill={spec.trim} />
        </g>
      );
    case "dagger":
      return (
        <g>
          <path d={`M${hx} ${hy - 2} L${hx - 7} ${hy - 20}`} stroke="#dfe5ea" strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M${hx - 3} ${hy - 1} L${hx + 3} ${hy - 4}`} stroke={spec.trim} strokeWidth="1.6" />
        </g>
      );
    case "orb":
      return (
        <g>
          <circle cx={hx - 1} cy={hy - 6} r="5.2" fill="#3fd8ff" opacity="0.35" />
          <circle cx={hx - 1} cy={hy - 6} r="3.6" fill="#7fe6ff" stroke="#e8fbff" strokeWidth="0.9" />
        </g>
      );
    case "longbow":
      return (
        <g>
          <path d={`M${hx + 4} ${hy - 50} Q${hx - 12} ${hy - 6} ${hx + 4} ${hy + 38}`} fill="none" stroke="#b07a42" strokeWidth="2.6" strokeLinecap="round" />
          <path d={`M${hx + 4} ${hy - 50} L${hx + 4} ${hy + 38}`} stroke="#e8e2d2" strokeWidth="0.8" />
        </g>
      );
    case "shortbow":
      return (
        <g>
          <path d={`M${hx + 3} ${hy - 34} Q${hx - 10} ${hy - 6} ${hx + 3} ${hy + 22}`} fill="none" stroke="#8a6440" strokeWidth="2.4" strokeLinecap="round" />
          <path d={`M${hx + 3} ${hy - 34} L${hx + 3} ${hy + 22}`} stroke="#e8e2d2" strokeWidth="0.8" />
        </g>
      );
  }
}

function renderHumanoid(spec: HumanoidSpec): ReactNode {
  const bulk = spec.bulk ?? 1;
  const sw = 11 * bulk; // semiancho de hombros
  const left = 32 - sw;
  const right = 32 + sw;
  const rightHand = { x: right + 3.5, y: 70 };
  const leftHand = { x: left - 3.5, y: 70 };

  return (
    <g>
      {/* Capa (detrás del cuerpo) */}
      {spec.cape && (
        <path
          d={`M${left - 1} 35 L${right + 1} 35 L${right + 7} 114 Q32 119 ${left - 7} 114 Z`}
          fill={spec.cape}
          stroke={OUTLINE}
          strokeWidth="1.1"
        />
      )}
      {spec.quiver && (
        <g>
          <path d={`M${right - 4} 30 L${right + 4} 32 L${right - 1} 62 L${right - 8} 60 Z`} fill="#6b4a32" stroke={OUTLINE} strokeWidth="0.9" />
          <path d={`M${right - 2} 30 L${right + 1} 22 M${right} 31 L${right + 4} 24 M${right + 2} 32 L${right + 6} 26`} stroke="#e8dcc2" strokeWidth="1.2" />
        </g>
      )}

      {/* Piernas / túnica */}
      {spec.lower === "legs" ? (
        <g>
          <path d={`M${32 - 8 * bulk} 70 L31 70 L30.4 114 L${32 - 7.4 * bulk} 114 Z`} fill={spec.legs} stroke={OUTLINE} strokeWidth="1" />
          <path d={`M33 70 L${32 + 8 * bulk} 70 L${32 + 7.4 * bulk} 114 L33.6 114 Z`} fill={spec.legs} stroke={OUTLINE} strokeWidth="1" />
          <path d={`M${32 - 8.6 * bulk} 111 L31 111 L31 123.5 L${32 - 12 * bulk} 123.5 Q${32 - 12 * bulk} 117 ${32 - 8.6 * bulk} 115 Z`} fill={spec.boots} stroke={OUTLINE} strokeWidth="1" />
          <path d={`M33 111 L${32 + 8.6 * bulk} 111 L${32 + 8.6 * bulk} 115 Q${32 + 12 * bulk} 117 ${32 + 12 * bulk} 123.5 L33 123.5 Z`} fill={spec.boots} stroke={OUTLINE} strokeWidth="1" />
        </g>
      ) : (
        <g>
          <path d={`M${left + 1} 60 L${right - 1} 60 L${right + 6} 121 Q32 125 ${left - 6} 121 Z`} fill={spec.legs} stroke={OUTLINE} strokeWidth="1.1" />
          <path d={`M32 62 L32 123`} stroke={spec.torsoShade} strokeWidth="3" opacity="0.6" />
          <path d={`M${left - 5.6} 118 Q32 122 ${right + 5.6} 118`} fill="none" stroke={spec.trim} strokeWidth="1.8" />
          <path d={`M28 62 L26 121 M36 62 L38 121`} stroke={spec.trim} strokeWidth="1.2" opacity="0.8" />
        </g>
      )}

      {/* Brazo izquierdo (detrás) */}
      <path d={`M${left + 1} 37 L${left - 5} 66 L${left - 1.5} 69 L${left + 4} 43 Z`} fill={spec.torsoShade} stroke={OUTLINE} strokeWidth="1" />
      <circle cx={leftHand.x} cy={leftHand.y - 1} r="3.1" fill={spec.skinShade} stroke={OUTLINE} strokeWidth="0.8" />

      {/* Torso */}
      <path
        d={`M${left} 36 Q32 30 ${right} 36 L${right - 3} 72 L${left + 3} 72 Z`}
        fill={spec.torso}
        stroke={OUTLINE}
        strokeWidth="1.2"
      />
      <path d={`M32 33 L${right} 36 L${right - 3} 72 L32 72 Z`} fill={spec.torsoShade} opacity="0.45" />
      <rect x={left + 3} y="64" width={2 * sw - 6} height="5" fill="#2e241c" stroke={OUTLINE} strokeWidth="0.8" />
      <rect x="30" y="64.5" width="4" height="4" fill={spec.trim} />
      {spec.emblem && <path d="M32 42 L36 48 L32 54 L28 48 Z" fill={spec.emblem} stroke={OUTLINE} strokeWidth="0.8" />}
      {spec.pauldrons && (
        <g>
          <ellipse cx={left + 1} cy="38" rx={5.5 * bulk} ry="4.4" fill={spec.pauldrons} stroke={OUTLINE} strokeWidth="1" />
          <ellipse cx={right - 1} cy="38" rx={5.5 * bulk} ry="4.4" fill={spec.pauldrons} stroke={OUTLINE} strokeWidth="1" />
        </g>
      )}

      {/* Cuello y cabeza */}
      <rect x="29" y="27" width="6" height="7" fill={spec.skinShade} />
      <circle cx="32" cy="20" r="8.6" fill={spec.skin} stroke={OUTLINE} strokeWidth="1.1" />
      <path d="M33 11.6 Q40.6 13 40.6 20 Q40.6 27 33 28.4 Q37 24 37 20 Q37 15 33 11.6 Z" fill={spec.skinShade} opacity="0.55" />
      <rect x="27.6" y="19" width="2.6" height="1.9" rx="0.6" fill={spec.eyes} />
      <rect x="33.8" y="19" width="2.6" height="1.9" rx="0.6" fill={spec.eyes} />
      {spec.tusks && <path d="M28.6 25 L29.6 22.6 L30.4 25 Z M35.4 25 L34.4 22.6 L33.6 25 Z" fill="#f1ead8" />}
      {spec.beard && <path d="M25 22 Q32 40 39 22 Q36 27 32 27 Q28 27 25 22 Z" fill={spec.beard} stroke={OUTLINE} strokeWidth="0.8" />}
      {renderHeadGear(spec)}

      {/* Brazo derecho (delante) y mano de arma */}
      <path d={`M${right - 1} 37 L${right + 5} 66 L${right + 1.5} 69 L${right - 4} 43 Z`} fill={spec.torso} stroke={OUTLINE} strokeWidth="1" />
      {renderMainHand(spec, rightHand.x, rightHand.y)}
      <circle cx={rightHand.x} cy={rightHand.y - 1} r="3.1" fill={spec.skin} stroke={OUTLINE} strokeWidth="0.8" />
      {renderOffHand(spec, leftHand.x, leftHand.y)}
    </g>
  );
}

function renderCanocrock(): ReactNode {
  return (
    <g>
      {/* Bestia cuadrúpeda acorazada: cuerpo bajo, placas dorsales y fauces */}
      <path d="M14 106 L12 123 L19 123 L21 108 Z M44 106 L45 123 L52 123 L50 106 Z" fill="#3b2f24" stroke={OUTLINE} strokeWidth="1" />
      <path d="M22 108 L21 123 L27 123 L29 108 Z M38 108 L38 123 L44 123 L43 108 Z" fill="#4a3b2d" stroke={OUTLINE} strokeWidth="1" />
      <path d="M8 96 Q10 72 34 70 Q58 72 58 96 Q56 112 34 112 Q12 112 8 96 Z" fill="#5a4634" stroke={OUTLINE} strokeWidth="1.3" />
      <path d="M14 82 L20 64 L26 80 Z M26 76 L33 56 L40 76 Z M40 80 L47 63 L52 84 Z" fill="#a08a6c" stroke={OUTLINE} strokeWidth="1" />
      <path d="M12 96 Q34 104 56 96" fill="none" stroke="#7a6248" strokeWidth="2" />
      <path d="M2 84 Q4 74 16 76 L22 90 Q12 98 4 94 Z" fill="#6a533d" stroke={OUTLINE} strokeWidth="1.1" />
      <path d="M2 90 L18 92 L16 96 L4 95 Z" fill="#2a1f16" />
      <path d="M5 90 L6 93 L8 90 L9 93 L11 90 L12 93 L14 90" fill="none" stroke="#efe6d2" strokeWidth="0.9" />
      <circle cx="11" cy="81" r="1.8" fill="#ff5a3c" />
      <path d="M58 92 Q64 86 62 78" fill="none" stroke="#5a4634" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function renderArchetypeSvgContent(archetypeId: SpriteArchetypeId): ReactNode {
  if (archetypeId === "canocrock") return renderCanocrock();
  return renderHumanoid(HUMANOID_SPECS[archetypeId]);
}

export type SpriteVariant = "full" | "portrait";

const VIEWBOX: Readonly<Record<SpriteVariant, string>> = {
  full: "-4 -6 72 132",
  portrait: "10 2 44 44"
};

const CANOCROCK_PORTRAIT_VIEWBOX = "0 52 64 64";

export function CombatantSprite({
  combatant,
  forceFallback = false,
  variant = "full",
  mirrored = false,
  className = ""
}: {
  readonly combatant: CombatantSpriteInput;
  readonly forceFallback?: boolean;
  readonly variant?: SpriteVariant;
  readonly mirrored?: boolean;
  readonly className?: string;
}) {
  const descriptor = resolveCombatantSprite(combatant, { forceFallback });
  const viewBox =
    variant === "portrait" && descriptor.archetypeId === "canocrock" ? CANOCROCK_PORTRAIT_VIEWBOX : VIEWBOX[variant];
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={variant === "full" ? "xMidYMax meet" : "xMidYMid meet"}
      role="img"
      aria-label={descriptor.title}
      data-testid={combatant.id ? `sprite-${combatant.id}` : undefined}
      data-sprite-archetype={descriptor.archetypeId}
      data-sprite-fallback={String(descriptor.isFallback)}
      data-sprite-variant={variant}
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
      className={`combatant-sprite-svg ${className}`.trim()}
    >
      <title>{descriptor.title}</title>
      {renderArchetypeSvgContent(descriptor.archetypeId)}
    </svg>
  );
}

export function CombatantAvatar({
  combatant,
  forceFallback = false
}: {
  readonly combatant: CombatantSpriteInput;
  readonly forceFallback?: boolean;
}) {
  const descriptor = resolveCombatantSprite(combatant, { forceFallback });
  return (
    <span
      className={`token-dot ${combatant.type}`}
      title={descriptor.title}
      data-sprite-archetype={descriptor.archetypeId}
      data-sprite-fallback={String(descriptor.isFallback)}
    >
      <CombatantSprite combatant={combatant} forceFallback={forceFallback} variant="portrait" />
    </span>
  );
}
