import type { ReactNode } from "react";
import type { Combatant, SizeCategory } from "@dnd-tactical/shared";

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
  if (
    nameNorm.includes("guardian coloso") ||
    nameNorm.includes("coloso") ||
    idNorm.startsWith("guardian_large")
  ) {
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

function renderArchetypeSvgContent(archetypeId: SpriteArchetypeId): ReactNode {
  switch (archetypeId) {
    case "cedrick":
      return (
        <g>
          {/* Cape & armor torso */}
          <path d="M18 54 L24 30 L40 30 L46 54 Z" fill="#2c4a6f" stroke="#9ec5fe" strokeWidth="1.5" />
          <path d="M22 52 L25 32 L39 32 L42 52 Z" fill="#7c8b99" stroke="#d8e2eb" strokeWidth="1.5" />
          {/* Sunbreast emblem */}
          <circle cx="32" cy="40" r="3.5" fill="#f4d06f" />
          {/* Crested Knight Helm */}
          <path d="M25 18 C25 12, 39 12, 39 18 L39 29 L25 29 Z" fill="#b0bec5" stroke="#eceff1" strokeWidth="1.5" />
          <path d="M28 21 L36 21 M32 17 L32 26" stroke="#263238" strokeWidth="2" strokeLinecap="round" />
          <path d="M30 10 L34 10 L33 14 L31 14 Z" fill="#f4d06f" />
          {/* Raised Longsword (left) */}
          <path d="M14 10 L17 10 L17 34 L14 34 Z" fill="#e0e7ee" stroke="#90a4ae" strokeWidth="1" />
          <path d="M11 33 L20 33 L20 36 L11 36 Z" fill="#f4d06f" />
          {/* Heavy Steel Shield (right) */}
          <path d="M37 28 L52 28 L50 43 L44.5 51 L39 43 Z" fill="#395b64" stroke="#f4d06f" strokeWidth="2" />
          <path d="M44.5 32 L44.5 46 M40 38 L49 38" stroke="#f4d06f" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case "bane":
      return (
        <g>
          {/* Hooded rogue mantle */}
          <path d="M17 54 L23 29 L41 29 L47 54 Z" fill="#1b3b36" stroke="#58b6a9" strokeWidth="1.5" />
          <path d="M24 52 L27 33 L37 33 L40 52 Z" fill="#293230" />
          {/* Crossed leather straps */}
          <path d="M25 34 L39 49 M39 34 L25 49" stroke="#8d6e63" strokeWidth="2" />
          {/* Hood & masked face */}
          <path d="M23 22 C23 12, 41 12, 41 22 L39 30 L25 30 Z" fill="#1f4e47" stroke="#80cbc4" strokeWidth="1.5" />
          <path d="M27 22 L37 22 L36 28 L28 28 Z" fill="#121817" />
          <circle cx="30" cy="24" r="1.4" fill="#64ffda" />
          <circle cx="34" cy="24" r="1.4" fill="#64ffda" />
          {/* Rapier blade */}
          <path d="M46 11 L48 11 L43 38 L41 38 Z" fill="#e0f2f1" />
          <path d="M38 36 C41 33, 46 35, 46 39 L39 39 Z" fill="#ffd54f" stroke="#ffecb3" strokeWidth="1" />
          {/* Offhand parrying dagger */}
          <path d="M13 31 L22 39 L20 41 L11 33 Z" fill="#cfd8dc" />
        </g>
      );

    case "elaen":
      return (
        <g>
          {/* Quiver arrows behind shoulder */}
          <path d="M20 14 L25 28 M23 13 L27 27" stroke="#d7ccc8" strokeWidth="2" strokeLinecap="round" />
          <path d="M19 13 L22 16 M22 12 L25 15" stroke="#81c784" strokeWidth="2" />
          {/* Ranger cloak & tunic */}
          <path d="M19 54 L24 30 L40 30 L45 54 Z" fill="#2e5233" stroke="#81c784" strokeWidth="1.5" />
          <path d="M25 52 L27 33 L37 33 L39 52 Z" fill="#5d4037" />
          {/* Elven head & circlet */}
          <circle cx="32" cy="21" r="7" fill="#d7b899" stroke="#a1887f" strokeWidth="1.2" />
          <path d="M24 19 Q32 11 40 19" fill="#33691e" />
          <path d="M25 19 L39 19" stroke="#ffd54f" strokeWidth="1.8" />
          {/* Recurved Longbow & arrow */}
          <path d="M44 11 C53 22, 53 40, 44 51" fill="none" stroke="#c88746" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="44" y1="12" x2="44" y2="50" stroke="#e0e0e0" strokeWidth="1.2" />
          <line x1="33" y1="31" x2="54" y2="31" stroke="#fff8e1" strokeWidth="1.8" />
          <polygon points="55,31 50,28.5 50,33.5" fill="#80deea" />
        </g>
      );

    case "alaric":
      return (
        <g>
          {/* Arcane robe with gold trim */}
          <path d="M18 54 L25 29 L39 29 L46 54 Z" fill="#31275c" stroke="#b39ddb" strokeWidth="1.5" />
          <path d="M29 30 L27 54 M35 30 L37 54" stroke="#ffd54f" strokeWidth="1.5" />
          {/* Wizard pointed hat & beard */}
          <circle cx="32" cy="22" r="6.5" fill="#e0c3a8" />
          <path d="M27 25 L32 34 L37 25 Z" fill="#cfd8dc" />
          <path d="M20 19 L44 19 L32 6 Z" fill="#3f3373" stroke="#ffd54f" strokeWidth="1.4" />
          {/* Quarterstaff with glowing crystal */}
          <line x1="48" y1="14" x2="45" y2="54" stroke="#8d6e63" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="48" cy="12" r="4.5" fill="#7c4dff" stroke="#e040fb" strokeWidth="1.5" />
          <circle cx="48" cy="12" r="2" fill="#ffffff" />
          {/* Arcane orb in left hand */}
          <circle cx="17" cy="36" r="4" fill="#00e5ff" stroke="#b2ebf2" strokeWidth="1.4" />
        </g>
      );

    case "allied_guard":
      return (
        <g>
          <path d="M19 54 L24 31 L40 31 L45 54 Z" fill="#284b52" stroke="#80cbc4" strokeWidth="1.5" />
          {/* Kettle helm */}
          <circle cx="32" cy="22" r="6.5" fill="#90a4ae" />
          <path d="M21 20 Q32 13 43 20 Z" fill="#78909c" stroke="#cfd8dc" strokeWidth="1.4" />
          {/* Sword */}
          <line x1="16" y1="14" x2="20" y2="38" stroke="#eceff1" strokeWidth="2.4" strokeLinecap="round" />
          {/* Allied Shield with chevron */}
          <path d="M36 30 L50 30 L48 44 L43 51 L38 44 Z" fill="#1d5c55" stroke="#b2dfdb" strokeWidth="1.8" />
          <path d="M39 40 L43 35 L47 40" fill="none" stroke="#ffd54f" strokeWidth="2" />
        </g>
      );

    case "walker":
      return (
        <g>
          {/* Swept travel cloak */}
          <path d="M16 53 L24 30 L39 30 L44 53 Z" fill="#2d4c46" stroke="#80cbc4" strokeWidth="1.5" />
          <circle cx="32" cy="21" r="6.5" fill="#d7b899" />
          {/* Feathered cap */}
          <path d="M23 19 Q32 12 41 19 Z" fill="#1b4d48" />
          <path d="M36 16 Q43 10 46 13" fill="none" stroke="#ffd54f" strokeWidth="2" strokeLinecap="round" />
          {/* Short sword */}
          <path d="M44 20 L47 20 L43 39 L40 39 Z" fill="#e0f7fa" stroke="#80deea" strokeWidth="1" />
        </g>
      );

    case "explorer":
      return (
        <g>
          <path d="M19 54 L24 30 L40 30 L45 54 Z" fill="#3a5239" stroke="#a5d6a7" strokeWidth="1.5" />
          <circle cx="32" cy="21" r="6.5" fill="#d7b899" />
          {/* Wide ranger hat */}
          <ellipse cx="32" cy="17" rx="11" ry="3.5" fill="#4e342e" stroke="#a1887f" strokeWidth="1.2" />
          {/* Compass emblem on chest */}
          <circle cx="32" cy="40" r="5" fill="#1b2620" stroke="#ffd54f" strokeWidth="1.4" />
          <polygon points="32,36 33.5,40 32,44 30.5,40" fill="#ffd54f" />
          {/* Short blade */}
          <line x1="46" y1="22" x2="43" y2="40" stroke="#cfd8dc" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );

    case "guardian_large":
      return (
        <g>
          {/* Massive 2x2 Colossus shoulders & plate armor */}
          <path d="M8 56 L14 24 L50 24 L56 56 Z" fill="#37474f" stroke="#80deea" strokeWidth="2" />
          <path d="M6 28 L20 22 L20 35 L8 36 Z" fill="#546e7a" stroke="#b0bec5" strokeWidth="1.6" />
          <path d="M58 28 L44 22 L44 35 L56 36 Z" fill="#546e7a" stroke="#b0bec5" strokeWidth="1.6" />
          {/* Rune core on chest */}
          <polygon points="32,31 38,39 32,47 26,39" fill="#00bcd4" stroke="#e0f7fa" strokeWidth="1.5" />
          {/* Colossus Helmet with glowing visor */}
          <rect x="23" y="10" width="18" height="15" rx="3" fill="#607d8b" stroke="#eceff1" strokeWidth="1.8" />
          <rect x="26" y="16" width="12" height="3.5" rx="1" fill="#00e5ff" />
          {/* Colossal Greatsword */}
          <path d="M52 6 L57 6 L55 48 L50 48 Z" fill="#cfd8dc" stroke="#ffffff" strokeWidth="1.2" />
          <rect x="47" y="44" width="13" height="3.5" rx="1" fill="#ffd54f" />
        </g>
      );

    case "orc_leader":
      return (
        <g>
          {/* Spiked warlord armor */}
          <path d="M16 54 L22 29 L42 29 L48 54 Z" fill="#5d1f1a" stroke="#ff8a65" strokeWidth="1.6" />
          <polygon points="15,31 24,27 21,36" fill="#90a4ae" />
          <polygon points="49,31 40,27 43,36" fill="#90a4ae" />
          {/* Orc head & horned helm */}
          <circle cx="32" cy="21" r="7.5" fill="#556b2f" stroke="#2e3b19" strokeWidth="1.2" />
          <path d="M24 17 Q17 9 20 6" fill="none" stroke="#eceff1" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 17 Q47 9 44 6" fill="none" stroke="#eceff1" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="29" cy="20" r="1.5" fill="#ff5252" />
          <circle cx="35" cy="20" r="1.5" fill="#ff5252" />
          {/* Double-bladed Greataxe */}
          <line x1="48" y1="10" x2="44" y2="54" stroke="#6d4c41" strokeWidth="2.8" />
          <path d="M47 13 C57 10, 58 26, 46 25 Z" fill="#cfd8dc" stroke="#ff8a65" strokeWidth="1.2" />
          <path d="M47 13 C38 11, 38 25, 46 25 Z" fill="#b0bec5" stroke="#ff8a65" strokeWidth="1.2" />
        </g>
      );

    case "orc_duelist":
      return (
        <g>
          <path d="M18 54 L24 30 L40 30 L46 54 Z" fill="#6b2c23" stroke="#ffab91" strokeWidth="1.5" />
          <circle cx="32" cy="21" r="7" fill="#687d43" stroke="#333d21" strokeWidth="1.2" />
          <circle cx="29.5" cy="20" r="1.4" fill="#ffca28" />
          <circle cx="34.5" cy="20" r="1.4" fill="#ffca28" />
          {/* Curved duelist blade */}
          <path d="M14 14 C10 24, 15 34, 21 38" fill="none" stroke="#eceff1" strokeWidth="3" strokeLinecap="round" />
          {/* Spiked buckler */}
          <circle cx="44" cy="39" r="7.5" fill="#455a64" stroke="#ff8a65" strokeWidth="1.8" />
          <circle cx="44" cy="39" r="2.5" fill="#ffd54f" />
        </g>
      );

    case "spear_guard":
      return (
        <g>
          <path d="M19 54 L24 30 L40 30 L45 54 Z" fill="#4e241e" stroke="#e08368" strokeWidth="1.5" />
          {/* Crested iron helm */}
          <path d="M25 22 C25 13, 39 13, 39 22 L38 29 L26 29 Z" fill="#546e7a" stroke="#cfd8dc" strokeWidth="1.4" />
          <path d="M32 9 L35 15 L29 15 Z" fill="#ef5350" />
          {/* Long Spear */}
          <line x1="48" y1="6" x2="42" y2="54" stroke="#a1887f" strokeWidth="2.5" />
          <polygon points="48.5,4 44,14 52,14" fill="#eceff1" stroke="#b0bec5" strokeWidth="1" />
        </g>
      );

    case "orc_sentinel":
      return (
        <g>
          <path d="M17 54 L22 29 L42 29 L47 54 Z" fill="#54231d" stroke="#ff8a65" strokeWidth="1.5" />
          <circle cx="32" cy="21" r="7" fill="#5c703a" />
          {/* Iron jaw guard */}
          <path d="M25 22 L39 22 L37 29 L27 29 Z" fill="#78909c" stroke="#cfd8dc" strokeWidth="1.2" />
          {/* Heavy broadsword */}
          <path d="M45 12 L49 12 L47 40 L43 40 Z" fill="#cfd8dc" />
          <rect x="41" y="38" width="10" height="3" fill="#ffab91" />
        </g>
      );

    case "orc_archer":
      return (
        <g>
          <path d="M19 54 L24 30 L40 30 L45 54 Z" fill="#5a2c22" stroke="#ffab91" strokeWidth="1.5" />
          <circle cx="32" cy="21" r="6.8" fill="#63783f" />
          <path d="M24 18 Q32 10 40 18 Z" fill="#4e342e" />
          {/* Shortbow */}
          <path d="M44 15 C52 24, 52 38, 44 47" fill="none" stroke="#a1887f" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="44" y1="16" x2="44" y2="46" stroke="#cfd8dc" strokeWidth="1.1" />
          <line x1="34" y1="31" x2="52" y2="31" stroke="#ffcc80" strokeWidth="1.8" />
        </g>
      );

    case "canocrock":
      return (
        <g>
          {/* Armored beast body & dorsal plates */}
          <ellipse cx="32" cy="40" rx="16" ry="11" fill="#4a3b2c" stroke="#ff8a65" strokeWidth="1.6" />
          <polygon points="22,29 26,22 30,29" fill="#a1887f" />
          <polygon points="30,28 34,20 38,28" fill="#a1887f" />
          <polygon points="38,30 42,23 45,31" fill="#a1887f" />
          {/* Snapping jaws */}
          <path d="M14 34 L28 30 L28 42 L15 41 Z" fill="#5d4c3c" stroke="#d7ccc8" strokeWidth="1.2" />
          <circle cx="23" cy="34" r="1.8" fill="#ff5252" />
        </g>
      );

    case "fallback_player":
      return (
        <g>
          <path d="M19 54 L24 31 L40 31 L45 54 Z" fill="#245953" stroke="#80cbc4" strokeWidth="1.6" />
          <circle cx="32" cy="21" r="7" fill="#b2dfdb" />
          <polygon points="32,35 36,41 32,47 28,41" fill="#ffd54f" />
        </g>
      );

    case "fallback_enemy":
      return (
        <g>
          <path d="M19 54 L24 31 L40 31 L45 54 Z" fill="#6e2c22" stroke="#ffab91" strokeWidth="1.6" />
          <circle cx="32" cy="21" r="7" fill="#ffccbc" />
          <polygon points="32,35 37,43 27,43" fill="#ff8a65" />
        </g>
      );
  }
}

export function CombatantSprite({
  combatant,
  forceFallback = false,
  mirrored = false,
  className = ""
}: {
  readonly combatant: CombatantSpriteInput;
  readonly forceFallback?: boolean;
  readonly mirrored?: boolean;
  readonly className?: string;
}) {
  const descriptor = resolveCombatantSprite(combatant, { forceFallback });
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={descriptor.title}
      data-testid={combatant.id ? `sprite-${combatant.id}` : undefined}
      data-sprite-archetype={descriptor.archetypeId}
      data-sprite-fallback={String(descriptor.isFallback)}
      className={`combatant-sprite-svg ${className}`.trim()}
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
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
      <CombatantSprite combatant={combatant} forceFallback={forceFallback} />
    </span>
  );
}
