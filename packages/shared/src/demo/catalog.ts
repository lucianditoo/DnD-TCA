import type { CreatureTemplate } from "../types.js";
import type { DemoScriptDefinition } from "./types.js";

function makeDemoProfile(
  partial: Omit<CreatureTemplate, "skillRanks" | "intrinsicDefense" | "abilities" | "buffs" | "featureIds" | "featIds"> & {
    featureIds?: CreatureTemplate["featureIds"];
    featIds?: string[];
  }
): CreatureTemplate {
  return {
    ...partial,
    featureIds: partial.featureIds ?? [],
    featIds: partial.featIds ?? [],
    skillRanks: { escape_artist: 0 },
    intrinsicDefense: {
      naturalArmorBonus: 0,
      dodgeBonus: 0,
      deflectionBonus: 0,
      miscArmorClassBonus: 0
    },
    abilities: [],
    buffs: []
  };
}

export const SCRIPTED_TACTICAL_DEMO_ID = "scripted_tactical_demo_v1";

export const scriptedTacticalDemoV1: DemoScriptDefinition = {
  id: SCRIPTED_TACTICAL_DEMO_ID,
  title: "Demostración Táctica D&D 3.5",
  scenes: [
    {
      id: "scene_a_ambush",
      title: "Escena A — La Emboscada",
      description: "Iniciativa, desprevención (Flat-Footed), ataque cuerpo a cuerpo, flanqueo, ataque furtivo (+2d6), confirmación de crítico y disparo con consumo de munición.",
      board: { width: 12, height: 8, cellSizeFeet: 5 },
      combatants: [
        makeDemoProfile({
          id: "cedrick",
          name: "Cedrick",
          type: "player",
          controller: "gm",
          icon: "shield",
          hpMax: 22,
          baseAttackBonus: 2,
          baseFortitude: 3,
          baseReflex: 1,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "cedrick-sword", catalogId: "longsword" },
            { itemId: "cedrick-armor", catalogId: "chain_shirt" },
            { itemId: "cedrick-shield", catalogId: "heavy_steel_shield" }
          ],
          equipmentSlots: { mainHandItemId: "cedrick-sword", offHandItemId: "cedrick-shield", armorItemId: "cedrick-armor" },
          position: { x: 3, y: 3, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "orc_leader",
          name: "Jefe Orco",
          type: "enemy",
          controller: "gm",
          icon: "skull",
          hpMax: 35,
          baseAttackBonus: 3,
          baseFortitude: 3,
          baseReflex: 1,
          baseWill: 0,
          baseSpeedFeet: 30,
          abilityScores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 10, charisma: 8 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "orc-axe", catalogId: "greataxe" },
            { itemId: "orc-armor", catalogId: "studded_leather" }
          ],
          equipmentSlots: { mainHandItemId: "orc-axe", offHandItemId: null, armorItemId: "orc-armor" },
          position: { x: 4, y: 3, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "bane",
          name: "Bane",
          type: "player",
          controller: "gm",
          icon: "swords",
          hpMax: 18,
          baseAttackBonus: 2,
          baseFortitude: 1,
          baseReflex: 5,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 14, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 10, charisma: 12 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          featureIds: ["srd_sneak_attack_2d6"],
          inventory: [
            { itemId: "bane-rapier", catalogId: "rapier" },
            { itemId: "bane-armor", catalogId: "studded_leather" }
          ],
          equipmentSlots: { mainHandItemId: "bane-rapier", offHandItemId: null, armorItemId: "bane-armor" },
          position: { x: 6, y: 3, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "elaen",
          name: "Elaen",
          type: "player",
          controller: "gm",
          icon: "crosshair",
          hpMax: 16,
          baseAttackBonus: 2,
          baseFortitude: 3,
          baseReflex: 5,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 12, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "elaen-bow", catalogId: "longbow" },
            { itemId: "elaen-arrows", catalogId: "arrows_20", quantity: 20 },
            { itemId: "elaen-armor", catalogId: "leather" }
          ],
          equipmentSlots: { mainHandItemId: "elaen-bow", offHandItemId: null, armorItemId: "elaen-armor" },
          position: { x: 1, y: 6, zFeet: 0 }
        })
      ],
      initiatives: [
        { combatantId: "orc_leader", value: 20 },
        { combatantId: "cedrick", value: 18 },
        { combatantId: "bane", value: 15 },
        { combatantId: "elaen", value: 12 }
      ],
      steps: [
        {
          id: "a-1-sort-initiative",
          actorName: "Sistema",
          actionSummary: "Ordenar iniciativa y abrir el encuentro",
          ruleExplanation: "Al iniciar el combate, se ordenan los combatientes por iniciativa descendente (Jefe Orco 20, Cedrick 18, Bane 15, Elaen 12). Quienes aún no han actuado reciben el estado Desprevenido (srd_flat_footed).",
          command: { kind: "sort-initiative" },
          expect: {
            phase: "active",
            round: 1,
            activeCombatantId: "orc_leader",
            hasEffect: { combatantId: "cedrick", effectId: "srd_flat_footed", present: true }
          },
          pauseAfterMs: 1200
        },
        {
          id: "a-2-orc-end-turn",
          actorName: "Jefe Orco",
          actionSummary: "Jefe Orco finaliza su turno inicial",
          ruleExplanation: "Cuando el turno avanza a Cedrick, el motor retira automáticamente su estado Desprevenido (srd_flat_footed) al comenzar su primera activación.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            activeCombatantId: "cedrick",
            hasEffect: { combatantId: "cedrick", effectId: "srd_flat_footed", present: false }
          },
          pauseAfterMs: 1000
        },
        {
          id: "a-3-cedrick-declare-attack",
          actorName: "Cedrick",
          actionSummary: "Cedrick declara Ataque Estándar",
          ruleExplanation: "En D&D 3.5, el combatiente declara su modo de ataque (Estándar o Completo) antes de ejecutar la tirada de ataque cuerpo a cuerpo.",
          command: { kind: "declare-attack-mode", combatantId: "cedrick", mode: "standard", defensive: false },
          expect: { phase: "active", activeCombatantId: "cedrick" },
          pauseAfterMs: 800
        },
        {
          id: "a-4-cedrick-attack",
          actorName: "Cedrick",
          actionSummary: "Cedrick ataca al Jefe Orco con espada larga (d20=12, daño=7)",
          ruleExplanation: "Tirada 12 + BAB 2 + FUE 3 = 17 contra CA 14 del Jefe Orco. Impacta e inflige 7 puntos de daño cortante (HP 35 → 28).",
          command: { kind: "resolve-attack", attackerId: "cedrick", targetId: "orc_leader", d20Roll: 12, damage: 7 },
          expect: {
            phase: "active",
            targetHp: { combatantId: "orc_leader", hpCurrent: 28 }
          },
          pauseAfterMs: 1200
        },
        {
          id: "a-5-cedrick-end-turn",
          actorName: "Cedrick",
          actionSummary: "Cedrick termina su turno",
          ruleExplanation: "El turno pasa a Bane (iniciativa 15), quien deja de estar desprevenido.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            activeCombatantId: "bane",
            hasEffect: { combatantId: "bane", effectId: "srd_flat_footed", present: false }
          },
          pauseAfterMs: 900
        },
        {
          id: "a-6-bane-move-flank",
          actorName: "Bane",
          actionSummary: "Bane se desplaza de (6,3) a (5,3) para flanquear al Jefe Orco",
          ruleExplanation: "Con Cedrick en (3,3) y Bane en (5,3) amenazando en lados opuestos al Jefe Orco en (4,3), se activa Flanqueo (+2 al ataque melee y habilita Ataque Furtivo).",
          command: {
            kind: "move-combatant",
            combatantId: "bane",
            to: { x: 5, y: 3, zFeet: 0 },
            path: [{ x: 5, y: 3, zFeet: 0 }]
          },
          expect: {
            phase: "active",
            combatantPosition: { combatantId: "bane", position: { x: 5, y: 3, zFeet: 0 } },
            movementUsedFeet: 5
          },
          pauseAfterMs: 1200
        },
        {
          id: "a-7-bane-declare-attack",
          actorName: "Bane",
          actionSummary: "Bane declara Ataque Estándar con estoque",
          ruleExplanation: "Tras usar su acción de movimiento para posicionarse en flanqueo, Bane utiliza su acción estándar para atacar.",
          command: { kind: "declare-attack-mode", combatantId: "bane", mode: "standard", defensive: false },
          expect: { phase: "active", activeCombatantId: "bane" },
          pauseAfterMs: 800
        },
        {
          id: "a-8-bane-attack-crit-threat",
          actorName: "Bane",
          actionSummary: "Bane ataca en flanqueo (d20=20 amenaza de crítico, base=4, furtivo 2d6=[3,4]=7)",
          ruleExplanation: "El 20 natural impacta automáticamente y amenaza crítico con el estoque (18-20/x2). Por flanqueo se suma Ataque Furtivo +2d6 (7 de precisión). La sala pasa a 'critical-confirmation'.",
          command: { kind: "resolve-attack", attackerId: "bane", targetId: "orc_leader", d20Roll: 20, damage: 4 },
          diceRolls: [3, 4],
          expect: {
            phase: "critical-confirmation",
            activeCombatantId: "bane"
          },
          pauseAfterMs: 1400
        },
        {
          id: "a-9-bane-confirm-crit",
          actorName: "Bane",
          actionSummary: "Bane confirma el crítico (d20=18)",
          ruleExplanation: "Confirmación: 18 + 6 = 24 contra CA 14. ¡Crítico confirmado! El daño base del arma se duplica (4 × 2 = 8), mientras que el daño de precisión del Ataque Furtivo (+7) nunca se multiplica. Total: 15 de daño (HP 28 → 13).",
          command: { kind: "resolve-attack-confirmation", d20Roll: 18, damage: null },
          expect: {
            phase: "active",
            targetHp: { combatantId: "orc_leader", hpCurrent: 13 }
          },
          pauseAfterMs: 1400
        },
        {
          id: "a-10-bane-end-turn",
          actorName: "Bane",
          actionSummary: "Bane termina su turno",
          ruleExplanation: "El turno avanza a Elaen (iniciativa 12).",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "elaen" },
          pauseAfterMs: 900
        },
        {
          id: "a-11-elaen-declare-attack",
          actorName: "Elaen",
          actionSummary: "Elaen prepara disparo con arco largo",
          ruleExplanation: "Elaen declara Ataque Estándar a distancia desde (1,6) hacia el Jefe Orco en (4,3).",
          command: { kind: "declare-attack-mode", combatantId: "elaen", mode: "standard", defensive: false },
          expect: { phase: "active", activeCombatantId: "elaen" },
          pauseAfterMs: 800
        },
        {
          id: "a-12-elaen-ranged-attack",
          actorName: "Elaen",
          actionSummary: "Elaen dispara con arco largo (d20=14, daño=6) y consume 1 flecha",
          ruleExplanation: "Tirada 14 + BAB 2 + DES 3 = 19 contra CA 14. Impacta por 6 de daño (HP 13 → 7) y descuenta automáticamente 1 flecha del carcaj (20 → 19).",
          command: { kind: "resolve-attack", attackerId: "elaen", targetId: "orc_leader", d20Roll: 14, damage: 6 },
          expect: {
            phase: "active",
            targetHp: { combatantId: "orc_leader", hpCurrent: 7 },
            ammoRemaining: { combatantId: "elaen", itemId: "elaen-arrows", quantity: 19 }
          },
          pauseAfterMs: 1400
        },
        {
          id: "a-13-elaen-end-turn",
          actorName: "Elaen",
          actionSummary: "Elaen finaliza el primer asalto de La Emboscada",
          ruleExplanation: "Concluye la Escena A habiendo demostrado iniciativa, desprevención, ataque melee, flanqueo, ataque furtivo, crítico confirmado y ataque a distancia con munición.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            round: 2,
            activeCombatantId: "orc_leader"
          },
          pauseAfterMs: 1200
        }
      ]
    },
    {
      id: "scene_b_positioning",
      title: "Escena B — Posición, Cobertura, AdO y Espacio Estrecho",
      description: "Cobertura por criatura interpuesta (+4 CA), despeje de línea de tiro, Ataque de Oportunidad por abandonar casilla amenazada, compresión Large (Squeezing) y terreno difícil.",
      board: {
        width: 16,
        height: 8,
        cellSizeFeet: 5,
        impassableCells: ["2,6", "3,6", "4,6", "5,6"],
        narrowCells: ["1,5", "2,5", "3,5", "4,5", "5,5"],
        difficultTerrainCells: ["13,5"]
      },
      combatants: [
        makeDemoProfile({
          id: "elaen",
          name: "Elaen",
          type: "player",
          controller: "gm",
          icon: "crosshair",
          hpMax: 16,
          baseAttackBonus: 2,
          baseFortitude: 3,
          baseReflex: 4,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 12, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "elaen-bow", catalogId: "longbow" },
            { itemId: "elaen-arrows", catalogId: "arrows_20", quantity: 20 },
            { itemId: "elaen-armor", catalogId: "leather" }
          ],
          equipmentSlots: { mainHandItemId: "elaen-bow", offHandItemId: null, armorItemId: "elaen-armor" },
          position: { x: 1, y: 1, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "guardia",
          name: "Guardia Aliado",
          type: "player",
          controller: "gm",
          icon: "shield",
          hpMax: 20,
          baseAttackBonus: 2,
          baseFortitude: 3,
          baseReflex: 1,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "guardia-sword", catalogId: "longsword" },
            { itemId: "guardia-armor", catalogId: "chain_shirt" }
          ],
          equipmentSlots: { mainHandItemId: "guardia-sword", offHandItemId: null, armorItemId: "guardia-armor" },
          position: { x: 3, y: 1, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "caminante",
          name: "Caminante",
          type: "player",
          controller: "gm",
          icon: "footprints",
          hpMax: 20,
          baseAttackBonus: 2,
          baseFortitude: 2,
          baseReflex: 3,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 14, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "cam-sword", catalogId: "short_sword" },
            { itemId: "cam-armor", catalogId: "chain_shirt" }
          ],
          equipmentSlots: { mainHandItemId: "cam-sword", offHandItemId: null, armorItemId: "cam-armor" },
          position: { x: 9, y: 1, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "guardian_large",
          name: "Guardián Coloso",
          type: "player",
          controller: "gm",
          icon: "shield",
          hpMax: 30,
          baseAttackBonus: 3,
          baseFortitude: 4,
          baseReflex: 1,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 18, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 10, charisma: 10 },
          sizeCategory: "large",
          creatureTypeId: "giant",
          inventory: [
            { itemId: "coloso-sword", catalogId: "longsword" },
            { itemId: "coloso-armor", catalogId: "leather" }
          ],
          equipmentSlots: { mainHandItemId: "coloso-sword", offHandItemId: null, armorItemId: "coloso-armor" },
          position: { x: 0, y: 5, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "explorador",
          name: "Explorador",
          type: "player",
          controller: "gm",
          icon: "compass",
          hpMax: 18,
          baseAttackBonus: 2,
          baseFortitude: 2,
          baseReflex: 3,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 12, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "exp-sword", catalogId: "short_sword" },
            { itemId: "exp-armor", catalogId: "leather" }
          ],
          equipmentSlots: { mainHandItemId: "exp-sword", offHandItemId: null, armorItemId: "exp-armor" },
          position: { x: 12, y: 5, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "enemigo_melee",
          name: "Centinela Orco",
          type: "enemy",
          controller: "gm",
          icon: "skull",
          hpMax: 20,
          baseAttackBonus: 1,
          baseFortitude: 2,
          baseReflex: 1,
          baseWill: 0,
          baseSpeedFeet: 30,
          abilityScores: { strength: 14, dexterity: 12, constitution: 12, intelligence: 8, wisdom: 10, charisma: 8 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "centinela-sword", catalogId: "longsword" },
            { itemId: "centinela-armor", catalogId: "studded_leather" }
          ],
          equipmentSlots: { mainHandItemId: "centinela-sword", offHandItemId: null, armorItemId: "centinela-armor" },
          position: { x: 9, y: 2, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "orco",
          name: "Arquero Orco",
          type: "enemy",
          controller: "gm",
          icon: "skull",
          hpMax: 20,
          baseAttackBonus: 1,
          baseFortitude: 2,
          baseReflex: 1,
          baseWill: 0,
          baseSpeedFeet: 30,
          abilityScores: { strength: 12, dexterity: 10, constitution: 12, intelligence: 8, wisdom: 10, charisma: 8 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "orco-bow", catalogId: "shortbow" },
            { itemId: "orco-arrows", catalogId: "arrows_20", quantity: 20 },
            { itemId: "orco-armor", catalogId: "chain_shirt" }
          ],
          equipmentSlots: { mainHandItemId: "orco-bow", offHandItemId: null, armorItemId: "orco-armor" },
          position: { x: 5, y: 1, zFeet: 0 }
        })
      ],
      initiatives: [
        { combatantId: "elaen", value: 25 },
        { combatantId: "guardia", value: 22 },
        { combatantId: "enemigo_melee", value: 21 },
        { combatantId: "caminante", value: 20 },
        { combatantId: "guardian_large", value: 18 },
        { combatantId: "explorador", value: 16 },
        { combatantId: "orco", value: 10 }
      ],
      steps: [
        {
          id: "b-1-sort-initiative",
          actorName: "Sistema",
          actionSummary: "Ordenar iniciativa de la Escena B",
          ruleExplanation: "Se establece el orden: Elaen (25) → Guardia Aliado (22) → Centinela Orco (21) → Caminante (20) → Guardián Coloso (18) → Explorador (16) → Arquero Orco (10).",
          command: { kind: "sort-initiative" },
          expect: { phase: "active", round: 1, activeCombatantId: "elaen" },
          pauseAfterMs: 1000
        },
        {
          id: "b-2-elaen-declare-cover-shot",
          actorName: "Elaen",
          actionSummary: "Elaen prepara disparo con línea obstruida por aliado",
          ruleExplanation: "Elaen en (1,1) apunta al Arquero Orco en (5,1), pero el Guardia Aliado se interpone exactamente en (3,1).",
          command: { kind: "declare-attack-mode", combatantId: "elaen", mode: "standard", defensive: false },
          expect: { phase: "active", activeCombatantId: "elaen" },
          pauseAfterMs: 800
        },
        {
          id: "b-3-elaen-shot-misses-by-cover",
          actorName: "Elaen",
          actionSummary: "Elaen dispara (d20=11): falla debido a Cobertura por Criatura (+4 CA)",
          ruleExplanation: "Tirada 11 + 4 = 15. La CA base del Arquero Orco es 14, pero la criatura interpuesta en (3,1) le otorga +4 de cobertura (CA efectiva 18). El disparo falla.",
          command: { kind: "resolve-attack", attackerId: "elaen", targetId: "orco", d20Roll: 11, damage: 5 },
          expect: {
            phase: "active",
            targetHp: { combatantId: "orco", hpCurrent: 20 },
            ammoRemaining: { combatantId: "elaen", itemId: "elaen-arrows", quantity: 19 }
          },
          pauseAfterMs: 1400
        },
        {
          id: "b-4-elaen-end-turn",
          actorName: "Elaen",
          actionSummary: "Elaen termina su turno",
          ruleExplanation: "El turno pasa al Guardia Aliado (iniciativa 22).",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "guardia" },
          pauseAfterMs: 800
        },
        {
          id: "b-5-guardia-clears-line",
          actorName: "Guardia Aliado",
          actionSummary: "Guardia Aliado se mueve de (3,1) a (3,2) despejando la línea de tiro",
          ruleExplanation: "Al apartarse de la celda (3,1), la línea entre (1,1) y (5,1) queda completamente despejada de criaturas interpuestas.",
          command: {
            kind: "move-combatant",
            combatantId: "guardia",
            to: { x: 3, y: 2, zFeet: 0 },
            path: [{ x: 3, y: 2, zFeet: 0 }]
          },
          expect: {
            phase: "active",
            combatantPosition: { combatantId: "guardia", position: { x: 3, y: 2, zFeet: 0 } },
            movementUsedFeet: 5
          },
          pauseAfterMs: 1100
        },
        {
          id: "b-6-guardia-end-turn",
          actorName: "Guardia Aliado",
          actionSummary: "Guardia Aliado termina su turno",
          ruleExplanation: "El turno pasa al Centinela Orco (iniciativa 21), quien deja de estar desprevenido y queda listo para reaccionar con Ataques de Oportunidad.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            activeCombatantId: "enemigo_melee",
            hasEffect: { combatantId: "enemigo_melee", effectId: "srd_flat_footed", present: false }
          },
          pauseAfterMs: 800
        },
        {
          id: "b-6b-centinela-ready-turn",
          actorName: "Centinela Orco",
          actionSummary: "Centinela Orco mantiene su posición amenazando (9,1)",
          ruleExplanation: "Habiendo actuado en el asalto, el Centinela Orco ya no está desprevenido y amenaza las casillas adyacentes.",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "caminante" },
          pauseAfterMs: 800
        },
        {
          id: "b-7-caminante-provokes-aoo",
          actorName: "Caminante",
          actionSummary: "Caminante se mueve de (9,1) a (11,1) saliendo de casilla amenazada",
          ruleExplanation: "Abandonar una casilla amenazada por el Centinela Orco (en 9,2) mediante movimiento normal provoca un Ataque de Oportunidad. La sala pasa a 'opportunity-resolution'.",
          command: {
            kind: "move-combatant",
            combatantId: "caminante",
            to: { x: 11, y: 1, zFeet: 0 },
            path: [
              { x: 10, y: 1, zFeet: 0 },
              { x: 11, y: 1, zFeet: 0 }
            ]
          },
          expect: {
            phase: "opportunity-resolution",
            pendingOpportunityAttacksCount: 1
          },
          pauseAfterMs: 1400
        },
        {
          id: "b-8-resolve-movement-aoo",
          actorName: "Centinela Orco",
          actionSummary: "Centinela Orco resuelve su Ataque de Oportunidad (d20=5, falla)",
          ruleExplanation: "El Centinela Orco realiza su AdO (5 + 3 = 8 vs CA 16, falla). Caminante completa su desplazamiento hasta (11,1) y la sala retorna a fase 'active'.",
          command: { kind: "resolve-opportunity-attack", d20Roll: 5, damage: 4 },
          expect: {
            phase: "active",
            pendingOpportunityAttacksCount: 0,
            combatantPosition: { combatantId: "caminante", position: { x: 11, y: 1, zFeet: 0 } },
            targetHp: { combatantId: "caminante", hpCurrent: 20 }
          },
          pauseAfterMs: 1300
        },
        {
          id: "b-9-caminante-end-turn",
          actorName: "Caminante",
          actionSummary: "Caminante termina su turno",
          ruleExplanation: "El turno pasa al Guardián Coloso (criatura Large 2×2).",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "guardian_large" },
          pauseAfterMs: 800
        },
        {
          id: "b-10-large-squeezing",
          actorName: "Guardián Coloso",
          actionSummary: "Guardián Coloso (Large 2×2) avanza 2 casillas por el corredor estrecho hasta (2,5)",
          ruleExplanation: "Una criatura Large (espacio 10 ft) que entra en un corredor de 5 ft debe Apretujarse (srd_squeezing): cada casilla cuesta el doble (10 ft × 2 = 20 ft) y sufre -4 al ataque y -4 a la CA.",
          command: {
            kind: "move-combatant",
            combatantId: "guardian_large",
            to: { x: 2, y: 5, zFeet: 0 },
            path: [
              { x: 1, y: 5, zFeet: 0 },
              { x: 2, y: 5, zFeet: 0 }
            ]
          },
          expect: {
            phase: "active",
            combatantPosition: { combatantId: "guardian_large", position: { x: 2, y: 5, zFeet: 0 } },
            hasEffect: { combatantId: "guardian_large", effectId: "srd_squeezing", present: true },
            movementUsedFeet: 20
          },
          pauseAfterMs: 1400
        },
        {
          id: "b-11-large-end-turn",
          actorName: "Guardián Coloso",
          actionSummary: "Guardián Coloso termina su turno",
          ruleExplanation: "El turno pasa al Explorador (iniciativa 16).",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "explorador" },
          pauseAfterMs: 800
        },
        {
          id: "b-12-difficult-terrain",
          actorName: "Explorador",
          actionSummary: "Explorador se mueve de (12,5) a (14,5) atravesando escombros en (13,5)",
          ruleExplanation: "Entrar en una casilla de terreno difícil (13,5) cuesta el doble (10 ft), más 5 ft por la casilla normal (14,5): 15 ft totales consumidos.",
          command: {
            kind: "move-combatant",
            combatantId: "explorador",
            to: { x: 14, y: 5, zFeet: 0 },
            path: [
              { x: 13, y: 5, zFeet: 0 },
              { x: 14, y: 5, zFeet: 0 }
            ]
          },
          expect: {
            phase: "active",
            combatantPosition: { combatantId: "explorador", position: { x: 14, y: 5, zFeet: 0 } },
            movementUsedFeet: 15
          },
          pauseAfterMs: 1300
        },
        {
          id: "b-13-explorador-end-turn",
          actorName: "Explorador",
          actionSummary: "Explorador termina su turno",
          ruleExplanation: "El turno pasa al Arquero Orco (iniciativa 10).",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "orco" },
          pauseAfterMs: 700
        },
        {
          id: "b-15-orco-end-turn-round-2",
          actorName: "Arquero Orco",
          actionSummary: "Arquero Orco termina su turno; inicia Ronda 2 y se restauran reacciones",
          ruleExplanation: "Al concluir el último turno del orden de iniciativa, el servidor avanza a la Ronda 2, emite RoundStarted y restaura el contador de Ataques de Oportunidad de todos los combatientes.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            round: 2,
            activeCombatantId: "elaen",
            opportunityAttacksThisRound: { combatantId: "enemigo_melee", count: 0 }
          },
          pauseAfterMs: 1100
        },
        {
          id: "b-16-elaen-declare-clear-shot",
          actorName: "Elaen",
          actionSummary: "Elaen prepara nuevo disparo con línea despejada",
          ruleExplanation: "En la Ronda 2, el Guardia Aliado ya no obstruye la línea entre (1,1) y (5,1).",
          command: { kind: "declare-attack-mode", combatantId: "elaen", mode: "standard", defensive: false },
          expect: { phase: "active", activeCombatantId: "elaen" },
          pauseAfterMs: 800
        },
        {
          id: "b-17-elaen-clear-shot-hits",
          actorName: "Elaen",
          actionSummary: "Elaen repite la misma tirada (d20=11, daño=5): sin cobertura, ahora impacta",
          ruleExplanation: "Con la misma tirada 11 + 4 = 15, al no existir cobertura (+0 CA), supera la CA 14 del Arquero Orco e inflige 5 de daño (HP 20 → 15).",
          command: { kind: "resolve-attack", attackerId: "elaen", targetId: "orco", d20Roll: 11, damage: 5 },
          expect: {
            phase: "active",
            targetHp: { combatantId: "orco", hpCurrent: 15 },
            ammoRemaining: { combatantId: "elaen", itemId: "elaen-arrows", quantity: 18 }
          },
          pauseAfterMs: 1400
        },
        {
          id: "b-18-elaen-end-scene-b",
          actorName: "Elaen",
          actionSummary: "Elaen finaliza la Escena B",
          ruleExplanation: "Concluye la Escena B habiendo demostrado cobertura por criatura, despeje táctico, AdO por movimiento, squeezing Large y terreno difícil.",
          command: { kind: "end-turn" },
          expect: { phase: "active", round: 2, activeCombatantId: "guardia" },
          pauseAfterMs: 1100
        }
      ]
    },
    {
      id: "scene_c_maneuvers_magic",
      title: "Escena C — Maniobras y Magia",
      description: "Derribo (Trip) con AdO defensivo previo, levantarse provocando AdO, Shocking Grasp bajo amenaza y Hold Person en Ronda 2 con salvación de Voluntad.",
      board: { width: 12, height: 8, cellSizeFeet: 5 },
      combatants: [
        makeDemoProfile({
          id: "cedrick",
          name: "Cedrick",
          type: "player",
          controller: "gm",
          icon: "shield",
          hpMax: 22,
          baseAttackBonus: 2,
          baseFortitude: 3,
          baseReflex: 1,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 18, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "cedrick-sword", catalogId: "longsword" },
            { itemId: "cedrick-armor", catalogId: "chain_shirt" },
            { itemId: "cedrick-shield", catalogId: "heavy_steel_shield" }
          ],
          equipmentSlots: { mainHandItemId: "cedrick-sword", offHandItemId: "cedrick-shield", armorItemId: "cedrick-armor" },
          position: { x: 2, y: 2, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "defensor",
          name: "Duelista Orco",
          type: "enemy",
          controller: "gm",
          icon: "swords",
          hpMax: 20,
          baseAttackBonus: 1,
          baseFortitude: 2,
          baseReflex: 2,
          baseWill: 0,
          baseSpeedFeet: 30,
          abilityScores: { strength: 14, dexterity: 12, constitution: 12, intelligence: 8, wisdom: 10, charisma: 8 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "defensor-sword", catalogId: "short_sword" },
            { itemId: "defensor-armor", catalogId: "chain_shirt" }
          ],
          equipmentSlots: { mainHandItemId: "defensor-sword", offHandItemId: null, armorItemId: "defensor-armor" },
          position: { x: 3, y: 2, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "mago",
          name: "Alaric el Mago",
          type: "player",
          controller: "gm",
          icon: "sparkles",
          hpMax: 14,
          baseAttackBonus: 1,
          baseFortitude: 1,
          baseReflex: 2,
          baseWill: 4,
          baseSpeedFeet: 30,
          abilityScores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 12, wisdom: 12, charisma: 10 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "mago-staff", catalogId: "quarterstaff" }
          ],
          equipmentSlots: { mainHandItemId: "mago-staff", offHandItemId: null, armorItemId: null },
          preparedSpellLoadout: [
            { slotId: "slot-1-shocking-grasp", spellId: "srd_shocking_grasp" },
            { slotId: "slot-2-hold-person", spellId: "srd_hold_person" }
          ],
          position: { x: 8, y: 5, zFeet: 0 }
        }),
        makeDemoProfile({
          id: "enemigo_guardia",
          name: "Guardia de Lanza",
          type: "enemy",
          controller: "gm",
          icon: "skull",
          hpMax: 18,
          baseAttackBonus: 1,
          baseFortitude: 2,
          baseReflex: 1,
          baseWill: 1,
          baseSpeedFeet: 30,
          abilityScores: { strength: 12, dexterity: 12, constitution: 12, intelligence: 8, wisdom: 10, charisma: 8 },
          sizeCategory: "medium",
          creatureTypeId: "humanoid",
          inventory: [
            { itemId: "guardia-spear", catalogId: "spear" },
            { itemId: "guardia-armor", catalogId: "chain_shirt" }
          ],
          equipmentSlots: { mainHandItemId: "guardia-spear", offHandItemId: null, armorItemId: "guardia-armor" },
          position: { x: 9, y: 5, zFeet: 0 }
        })
      ],
      initiatives: [
        { combatantId: "defensor", value: 25 },
        { combatantId: "cedrick", value: 20 },
        { combatantId: "enemigo_guardia", value: 15 },
        { combatantId: "mago", value: 10 }
      ],
      steps: [
        {
          id: "c-1-sort-initiative",
          actorName: "Sistema",
          actionSummary: "Ordenar iniciativa de la Escena C",
          ruleExplanation: "Orden de iniciativa: Duelista Orco (25) → Cedrick (20) → Guardia de Lanza (15) → Alaric el Mago (10).",
          command: { kind: "sort-initiative" },
          expect: { phase: "active", round: 1, activeCombatantId: "defensor" },
          pauseAfterMs: 900
        },
        {
          id: "c-1b-defensor-ready",
          actorName: "Duelista Orco",
          actionSummary: "Duelista Orco inicia su turno y queda en guardia frente a Cedrick",
          ruleExplanation: "Al actuar en la Ronda 1, el Duelista Orco ya no está desprevenido y puede realizar Ataques de Oportunidad si Cedrick intenta una maniobra sin dote.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            activeCombatantId: "cedrick",
            hasEffect: { combatantId: "defensor", effectId: "srd_flat_footed", present: false }
          },
          pauseAfterMs: 800
        },
        {
          id: "c-2-cedrick-trip",
          actorName: "Cedrick",
          actionSummary: "Cedrick ejecuta Derribo (Trip) contra el Duelista Orco",
          ruleExplanation: "Sin Improved Trip, el Derribo provoca un AdO defensivo previo del Duelista (d20=4 + 3 = 7 vs CA 18, falla). Al no recibir daño, Cedrick conecta el toque melee (14 + 6 = 20 vs Touch AC 11) y gana la prueba opuesta de Fuerza (16 + 4 = 20 vs 8 + 2 = 10), aplicando Derribado (srd_prone).",
          command: {
            kind: "resolve-special-maneuver",
            maneuver: {
              type: "trip",
              attackerId: "cedrick",
              targetId: "defensor",
              d20TouchRoll: 14,
              d20OpposedRoll: 16
            }
          },
          maneuverRolls: {
            "opportunity-attack": 4,
            "opposed-defender": 8
          },
          expect: {
            phase: "active",
            hasEffect: { combatantId: "defensor", effectId: "srd_prone", present: true },
            targetHp: { combatantId: "cedrick", hpCurrent: 22 }
          },
          pauseAfterMs: 1500
        },
        {
          id: "c-3-cedrick-end-turn",
          actorName: "Cedrick",
          actionSummary: "Cedrick termina su turno",
          ruleExplanation: "El turno avanza al Guardia de Lanza (iniciativa 15), quien pierde el estado desprevenido y amenaza a Alaric el Mago.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            activeCombatantId: "enemigo_guardia",
            hasEffect: { combatantId: "enemigo_guardia", effectId: "srd_flat_footed", present: false }
          },
          pauseAfterMs: 800
        },
        {
          id: "c-3b-guardia-ready",
          actorName: "Guardia de Lanza",
          actionSummary: "Guardia de Lanza mantiene su amenaza sobre Alaric el Mago",
          ruleExplanation: "El turno pasa a Alaric el Mago (iniciativa 10), amenazado a 5 ft por el Guardia de Lanza.",
          command: { kind: "end-turn" },
          expect: { phase: "active", activeCombatantId: "mago" },
          pauseAfterMs: 800
        },
        {
          id: "c-7-mago-shocking-grasp-provokes",
          actorName: "Alaric el Mago",
          actionSummary: "Alaric intenta lanzar Shocking Grasp en casilla amenazada (provoca AdO)",
          ruleExplanation: "Lanzar un conjuro de acción estándar dentro del alcance amenazado provoca un Ataque de Oportunidad del Guardia de Lanza antes de que el conjuro se resuelva.",
          command: {
            kind: "cast-spell",
            casterId: "mago",
            targetId: "enemigo_guardia",
            slotId: "slot-1-shocking-grasp",
            d20Roll: 15,
            amount: 5
          },
          expect: {
            phase: "opportunity-resolution",
            pendingOpportunityAttacksCount: 1,
            spellSlotExpended: { combatantId: "mago", slotId: "slot-1-shocking-grasp", isExpended: false }
          },
          pauseAfterMs: 1300
        },
        {
          id: "c-8-guardia-aoo-on-shocking-grasp",
          actorName: "Guardia de Lanza",
          actionSummary: "Guardia de Lanza ejecuta su AdO de Ronda 1 contra el Mago (d20=5, falla)",
          ruleExplanation: "El Guardia de Lanza falla su AdO (5 + 2 = 7 vs CA 12) y agota su única reacción de la Ronda 1 (opportunityAttacksThisRound = 1).",
          command: { kind: "resolve-opportunity-attack", d20Roll: 5, damage: 4 },
          expect: {
            phase: "active",
            pendingOpportunityAttacksCount: 0,
            opportunityAttacksThisRound: { combatantId: "enemigo_guardia", count: 1 },
            targetHp: { combatantId: "mago", hpCurrent: 14 }
          },
          pauseAfterMs: 1200
        },
        {
          id: "c-9-mago-shocking-grasp-resolves",
          actorName: "Alaric el Mago",
          actionSummary: "Alaric completa Shocking Grasp: toque melee (d20=15) e impacto eléctrico (daño=5)",
          ruleExplanation: "Con el AdO del Guardia ya agotado en este asalto, el conjuro se resuelve contra la CA de Toque (15 + 1 = 16 vs Touch AC 11), inflige 5 puntos de daño eléctrico (HP 18 → 13) y consume el slot de nivel 1.",
          command: {
            kind: "cast-spell",
            casterId: "mago",
            targetId: "enemigo_guardia",
            slotId: "slot-1-shocking-grasp",
            d20Roll: 15,
            amount: 5
          },
          expect: {
            phase: "active",
            targetHp: { combatantId: "enemigo_guardia", hpCurrent: 13 },
            spellSlotExpended: { combatantId: "mago", slotId: "slot-1-shocking-grasp", isExpended: true }
          },
          pauseAfterMs: 1400
        },
        {
          id: "c-10-mago-end-turn-round-2",
          actorName: "Alaric el Mago",
          actionSummary: "Alaric termina su turno; comienza la Ronda 2 y se restauran reacciones",
          ruleExplanation: "Al avanzar a la Ronda 2, el evento RoundStarted restaura opportunityAttacksThisRound = 0 para todos los combatientes y el turno pasa al Duelista Orco (quien sigue Derribado).",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            round: 2,
            activeCombatantId: "defensor",
            opportunityAttacksThisRound: { combatantId: "enemigo_guardia", count: 0 }
          },
          pauseAfterMs: 1100
        },
        {
          id: "c-4-defensor-stand-up",
          actorName: "Duelista Orco",
          actionSummary: "Duelista Orco usa su acción de movimiento para levantarse (Stand Up)",
          ruleExplanation: "Levantarse elimina el estado Derribado (srd_prone), consume la acción de movimiento (15 ft) y provoca un Ataque de Oportunidad de Cedrick.",
          command: { kind: "use-tactical-action", combatantId: "defensor", action: "stand-up" },
          expect: {
            phase: "opportunity-resolution",
            pendingOpportunityAttacksCount: 1,
            hasEffect: { combatantId: "defensor", effectId: "srd_prone", present: false }
          },
          pauseAfterMs: 1300
        },
        {
          id: "c-5-cedrick-standup-aoo",
          actorName: "Cedrick",
          actionSummary: "Cedrick resuelve el AdO provocado al levantarse (d20=5, falla)",
          ruleExplanation: "Cedrick ejecuta su Ataque de Oportunidad (5 + 6 = 11 vs CA 15, falla). La sala retorna a 'active' y el Duelista permanece de pie.",
          command: { kind: "resolve-opportunity-attack", d20Roll: 5, damage: 4 },
          expect: {
            phase: "active",
            pendingOpportunityAttacksCount: 0,
            targetHp: { combatantId: "defensor", hpCurrent: 20 }
          },
          pauseAfterMs: 1200
        },
        {
          id: "c-6-defensor-end-turn-r2",
          actorName: "Duelista Orco",
          actionSummary: "Duelista Orco termina su turno en Ronda 2",
          ruleExplanation: "El turno pasa a Cedrick.",
          command: { kind: "end-turn" },
          expect: { phase: "active", round: 2, activeCombatantId: "cedrick" },
          pauseAfterMs: 700
        },
        {
          id: "c-12-cedrick-end-turn-r2",
          actorName: "Cedrick",
          actionSummary: "Cedrick cede su turno en Ronda 2",
          ruleExplanation: "El turno pasa al Guardia de Lanza.",
          command: { kind: "end-turn" },
          expect: { phase: "active", round: 2, activeCombatantId: "enemigo_guardia" },
          pauseAfterMs: 700
        },
        {
          id: "c-13-guardia-end-turn-r2",
          actorName: "Guardia de Lanza",
          actionSummary: "Guardia de Lanza cede su turno en Ronda 2",
          ruleExplanation: "El turno llega nuevamente a Alaric el Mago.",
          command: { kind: "end-turn" },
          expect: { phase: "active", round: 2, activeCombatantId: "mago" },
          pauseAfterMs: 700
        },
        {
          id: "c-14-mago-hold-person-provokes",
          actorName: "Alaric el Mago",
          actionSummary: "Alaric lanza Hold Person en Ronda 2 (provoca nuevo AdO recuperado)",
          ruleExplanation: "Como la Ronda 2 restauró la reacción del Guardia de Lanza, lanzar Hold Person en casilla amenazada vuelve a provocar un Ataque de Oportunidad.",
          command: {
            kind: "cast-spell",
            casterId: "mago",
            targetId: "enemigo_guardia",
            slotId: "slot-2-hold-person",
            d20Roll: null,
            amount: null
          },
          expect: {
            phase: "opportunity-resolution",
            pendingOpportunityAttacksCount: 1,
            spellSlotExpended: { combatantId: "mago", slotId: "slot-2-hold-person", isExpended: false }
          },
          pauseAfterMs: 1300
        },
        {
          id: "c-15-guardia-aoo-on-hold-person",
          actorName: "Guardia de Lanza",
          actionSummary: "Guardia de Lanza resuelve su AdO de Ronda 2 (d20=5, falla)",
          ruleExplanation: "El Guardia vuelve a fallar su AdO (5 + 2 = 7 vs CA 12), agotando su reacción de la Ronda 2.",
          command: { kind: "resolve-opportunity-attack", d20Roll: 5, damage: 4 },
          expect: {
            phase: "active",
            pendingOpportunityAttacksCount: 0,
            opportunityAttacksThisRound: { combatantId: "enemigo_guardia", count: 1 }
          },
          pauseAfterMs: 1200
        },
        {
          id: "c-16-mago-hold-person-resolves",
          actorName: "Alaric el Mago",
          actionSummary: "Alaric completa Hold Person: Guardia falla salvación de Voluntad (d20=5 + 1 = 6 vs CD 14)",
          ruleExplanation: "El Guardia de Lanza realiza una tirada de salvación de Voluntad contra CD 14: tira 5 + Voluntad 1 = 6 (fallo). Queda Paralizado (srd_paralyzed: HELPLESS, DES 0) y se consume el slot de conjuro.",
          command: {
            kind: "cast-spell",
            casterId: "mago",
            targetId: "enemigo_guardia",
            slotId: "slot-2-hold-person",
            d20Roll: null,
            amount: null
          },
          diceRolls: [5],
          expect: {
            phase: "active",
            hasEffect: { combatantId: "enemigo_guardia", effectId: "srd_paralyzed", present: true },
            spellSlotExpended: { combatantId: "mago", slotId: "slot-2-hold-person", isExpended: true }
          },
          pauseAfterMs: 1500
        },
        {
          id: "c-17-mago-end-demo",
          actorName: "Alaric el Mago",
          actionSummary: "Alaric finaliza su turno y concluye la demostración táctica",
          ruleExplanation: "¡Demostración completada! Las tres escenas se ejecutaron íntegramente sobre el motor autoritativo del servidor.",
          command: { kind: "end-turn" },
          expect: {
            phase: "active",
            round: 3,
            activeCombatantId: "defensor"
          },
          pauseAfterMs: 1000
        }
      ]
    }
  ]
};

export const DemoCatalog = Object.freeze({
  get(id: string): DemoScriptDefinition | undefined {
    return id === SCRIPTED_TACTICAL_DEMO_ID ? scriptedTacticalDemoV1 : undefined;
  },
  all(): readonly DemoScriptDefinition[] {
    return [scriptedTacticalDemoV1];
  }
});
