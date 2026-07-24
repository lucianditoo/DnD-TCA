import type { CombatRoom } from "../types.js";
import type { EffectInstance } from "./types.js";
import { effectsCatalog, isProductionEffectId, type ProductionEffectId } from "./catalog.js";

/**
 * Resuelve la cadena de severidad de un effectId: él mismo más todo lo alcanzable
 * siguiendo sus punteros `upgradeTo` (de más débil a más severo). Con el catálogo actual
 * la única cadena real es Fatigued→Exhausted, pero esto no asume una profundidad fija.
 * Un Set corta cualquier ciclo accidental en vez de recorrer infinitamente.
 */
function severityChain(effectId: ProductionEffectId): ProductionEffectId[] {
  const chain: ProductionEffectId[] = [effectId];
  const seen = new Set<ProductionEffectId>(chain);
  let cursor = effectId;
  for (;;) {
    const definition = effectsCatalog[cursor];
    if (definition.onStack !== "upgrade_to" || !definition.upgradeTo) break;
    if (!isProductionEffectId(definition.upgradeTo)) {
      throw new Error(`[EffectManager] "${cursor}" declara onStack:"upgrade_to" sin un upgradeTo válido en el catálogo.`);
    }
    if (seen.has(definition.upgradeTo)) break; // Ciclo: no continuar.
    chain.push(definition.upgradeTo);
    seen.add(definition.upgradeTo);
    cursor = definition.upgradeTo;
  }
  return chain;
}

/**
 * Effect Manager (Mutation Layer)
 * Única entidad autorizada para modificar la colección global de efectos.
 * Sus funciones son estrictamente puras (no modifican la instancia pasada).
 * No contiene lógica de juego ni evaluación de reglas.
 */
export const EffectManager = {
  /**
   * Añade una instancia de efecto al estado global.
   * La generación del instanceId debe proveerse desde fuera (para determinismo y tests).
   * Comportamiento ante Unknown Effect: Lanza excepción para proteger la inmutabilidad
   * y evitar estados corruptos por referencias inválidas.
   *
   * Sprint 049 (EFFECT-EXHAUSTED): único punto de consumo de `onStack`. Antes de este
   * sprint el campo estaba declarado en `EffectDefinition` pero ningún consumidor lo leía
   * (bug preexistente documentado en DT-022 y en el comentario de
   * `tests/conditions-v3.test.mjs` sobre instancias duplicadas de `srd_prone`). La detección
   * de colisión solo compara `targets` (efectos anclados a criaturas); los efectos anclados a
   * `targetCells` (peligros ambientales) nunca colisionan aquí a propósito — varias instancias
   * de un mismo hazard sobre la misma celda son escenarios válidos y ya cubiertos por
   * `tests/environmental-hazards.test.mjs` ("múltiples hazards solapados").
   *
   * La colisión se evalúa por cadena de severidad completa (`severityChain`), no solo por
   * effectId exacto: si el objetivo ya tiene un miembro más severo de la misma cadena
   * (ej. ya Exhausted cuando una fuente insiste con Fatigued, como el gas venenoso ronda tras
   * ronda), la nueva aplicación es redundante y se descarta sin importar el `onStack` declarado
   * en el effectId entrante. Si en cambio el objetivo solo tiene un miembro más débil (ej. se
   * aplica Exhausted directamente mientras el objetivo solo está Fatigued), la instancia débil
   * se reemplaza por la nueva, más severa.
   */
  add(room: CombatRoom, instance: EffectInstance<ProductionEffectId>): CombatRoom {
    if (!(instance.effectId in effectsCatalog)) {
      throw new Error(`[EffectManager] Unknown Effect: ${String(instance.effectId)} no existe en el catálogo.`);
    }

    // Copia defensiva profunda para garantizar que referencias externas no puedan mutar el estado almacenado
    const safeInstance: EffectInstance<ProductionEffectId> = {
      instanceId: instance.instanceId,
      effectId: instance.effectId,
      source: { ...instance.source },
      appliedAtEvent: { ...instance.appliedAtEvent },
      ...(instance.targets ? { targets: [...instance.targets] } : {}),
      ...(instance.targetCells ? { targetCells: [...instance.targetCells] } : {}),
      ...(instance.duration ? { duration: { ...instance.duration } } : {}),
      ...(instance.stacks !== undefined ? { stacks: instance.stacks } : {})
    };

    const incomingTargets = safeInstance.targets;
    if (incomingTargets && incomingTargets.length > 0) {
      const incomingChain = severityChain(safeInstance.effectId);

      const related = room.effectInstances.filter((existing) => {
        if (!existing.targets?.some((t) => incomingTargets.includes(t))) return false;
        if (existing.effectId === safeInstance.effectId) return true;
        if (incomingChain.includes(existing.effectId)) return true; // existente más severo
        return severityChain(existing.effectId).includes(safeInstance.effectId); // existente más débil
      });

      if (related.length > 0) {
        const hasStrictlyMoreSevere = related.some(
          (i) => i.effectId !== safeInstance.effectId && incomingChain.includes(i.effectId)
        );
        if (hasStrictlyMoreSevere) {
          return room; // El objetivo ya está en un estado igual o peor de la misma familia: redundante.
        }

        const sameEffect = related.filter((i) => i.effectId === safeInstance.effectId);
        const relatedIds = new Set(related.map((i) => i.instanceId));
        const remaining = room.effectInstances.filter((i) => !relatedIds.has(i.instanceId));

        if (sameEffect.length === 0) {
          // Todo lo relacionado es estrictamente más débil (ej. Exhausted aplicado directo
          // sobre un objetivo solo Fatigued): la nueva instancia, más severa, las reemplaza.
          return { ...room, effectInstances: [...remaining, safeInstance] };
        }

        const definition = effectsCatalog[safeInstance.effectId];
        if (definition.onStack === "ignore") {
          return room; // Ya existe una instancia activa del mismo efecto sobre el mismo objetivo: se descarta la nueva.
        }

        // onStack === "upgrade_to": ya validado por severityChain que upgradeTo es válido.
        const upgradedInstance: EffectInstance<ProductionEffectId> = {
          ...safeInstance,
          effectId: definition.upgradeTo as ProductionEffectId
        };
        return { ...room, effectInstances: [...remaining, upgradedInstance] };
      }
    }

    return {
      ...room,
      effectInstances: [...room.effectInstances, safeInstance]
    };
  },

  /**
   * Remueve una instancia de efecto basándose en su ID único.
   * Si el efecto no existe, devuelve el estado sin modificar.
   */
  remove(room: CombatRoom, instanceId: string): CombatRoom {
    return EffectManager.removeMany(room, [instanceId]);
  },

  /**
   * Remueve múltiples instancias de efecto a la vez, garantizando una única
   * copia del CombatRoom (inmutabilidad de alto nivel sin copias redundantes).
   */
  removeMany(room: CombatRoom, instanceIds: string[]): CombatRoom {
    if (!instanceIds || instanceIds.length === 0) {
      return room; // Ninguna mutación
    }

    const setToRemove = new Set(instanceIds);
    const originalLength = room.effectInstances.length;
    
    const nextInstances = room.effectInstances.filter(
      (inst) => !setToRemove.has(inst.instanceId)
    );

    if (nextInstances.length === originalLength) {
      return room; // Nada cambió estructuralmente
    }

    return {
      ...room,
      effectInstances: nextInstances
    };
  }
};
