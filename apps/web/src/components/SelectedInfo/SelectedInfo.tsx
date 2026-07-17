import { AlertTriangle, Crosshair, Footprints, HeartPulse, Shield, Swords } from "lucide-react";
import { averageWeaponDamageForCombatant, lifeStatus, lifeStatusLabel, resolveEquippedWeaponProfile, Rules, type CombatRoom, type Combatant } from "@dnd-tactical/shared";
import { Collapsible, Stat } from "../common";
import { formatBuff } from "../../viewModel";
import { SpellsCatalog } from "@dnd-tactical/shared";

import { useMemo } from "react";
export function SelectedInfo({ combatant, room, snapshot: context, attackerId, canControlSelected, onDeclareDodgeTarget }: { combatant: Combatant; room: CombatRoom; snapshot: import("@dnd-tactical/shared").CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>; attackerId?: string; canControlSelected?: boolean; onDeclareDodgeTarget?: (combatantId: string, dodgeTargetId: string | null) => void }) {
  const weapon = resolveEquippedWeaponProfile(combatant).profile;
  const armorClasses = useMemo(() => ({
    normal: Rules.totalArmorClass(context, combatant, { targetAcType: "normal" }).total,
    touch: Rules.totalArmorClass(context, combatant, { targetAcType: "touch" }).total,
    flatFooted: Rules.totalArmorClass(context, combatant, { targetAcType: "normal", isFlatFootedOverride: true }).total,
    vsAttacker: attackerId ? Rules.totalArmorClass(context, combatant, { targetAcType: "normal", attackerId }).total : null
  }), [context, combatant, attackerId]);

  const hasDodgeFeat = combatant.featIds.includes("srd_dodge");
  const isCombatantsTurn = room.currentTurn.combatantId === combatant.id;
  const canDeclareDodge = hasDodgeFeat && isCombatantsTurn && canControlSelected && room.phase === "active";
  
  const saves = useMemo(() => {
    return {
      fortitude: Rules.totalSavingThrow(context, combatant, "fortitude"),
      reflex: Rules.totalSavingThrow(context, combatant, "reflex"),
      will: Rules.totalSavingThrow(context, combatant, "will")
    };
  }, [context, combatant]);
  
  return <>
    <Collapsible key={"resumen-" + combatant.id} title="Resumen"><div className="stat-grid">
      <Stat icon={<HeartPulse size={16} />} label="HP" value={combatant.hpCurrent + "/" + combatant.hpMax} />
      <Stat icon={<AlertTriangle size={16} />} label="Estado" value={lifeStatusLabel(lifeStatus(combatant))} />
      <Stat icon={<Shield size={16} />} label="CA normal" value={String(armorClasses.normal)} />
      <Stat icon={<Shield size={16} />} label="CA toque" value={String(armorClasses.touch)} />
      <Stat icon={<Shield size={16} />} label="CA desprevenido" value={String(armorClasses.flatFooted)} />
      {armorClasses.vsAttacker !== null && <Stat icon={<Shield size={16} />} label="CA vs. objetivo actual" value={String(armorClasses.vsAttacker)} />}
      <Stat icon={<Shield size={16} />} label="Fortaleza" value={"+" + saves.fortitude.total} title={saves.fortitude.parts.join(", ")} />
      <Stat icon={<Shield size={16} />} label="Reflejos" value={"+" + saves.reflex.total} title={saves.reflex.parts.join(", ")} />
      <Stat icon={<Shield size={16} />} label="Voluntad" value={"+" + saves.will.total} title={saves.will.parts.join(", ")} />
      <Stat icon={<Footprints size={16} />} label="Vel." value={Rules.totalSpeedFeet(context, combatant) + " ft"} />
      <Stat icon={<Swords size={16} />} label="Ataque total" value={"+" + Rules.totalAttackBonus(context, combatant).total} />

      <Stat icon={<Swords size={16} />} label="Arma" value={weapon.name + " " + weapon.damageDice} />
      <Stat icon={<Crosshair size={16} />} label="Alcance" value={(weapon.rangeIncrementFeet ? weapon.rangeIncrementFeet + " ft inc. / " : "") + weapon.maxRangeFeet + " ft"} />
    </div>{combatant.buffs.length > 0 && <div className="buff-list">{combatant.buffs.map((buff) => <span key={buff.id}>{formatBuff(buff)}</span>)}</div>}
    {hasDodgeFeat && <div className="rules-box">
      <label>Esquiva (Dodge) - objetivo designado
        <select
          value={combatant.dodgeTargetId ?? ""}
          disabled={!canDeclareDodge}
          onChange={(event) => onDeclareDodgeTarget?.(combatant.id, event.target.value || null)}
        >
          <option value="">Ninguno</option>
          {room.combatants.filter((other) => other.id !== combatant.id && lifeStatus(other) !== "dead").map((other) => (
            <option key={other.id} value={other.id}>{other.name}</option>
          ))}
        </select>
      </label>
    </div>}</Collapsible>
    <Collapsible title="Arma y reglas"><div className="rules-box">{weapon.notes} Alcance maximo: {weapon.maxRangeFeet} ft. Daño promedio derivado: {averageWeaponDamageForCombatant(combatant)}.</div></Collapsible>
    <Collapsible title="Caracteristicas">{combatant.abilityScores ? <div className="score-grid"><span>Fue <strong>{combatant.abilityScores.strength}</strong></span><span>Des <strong>{combatant.abilityScores.dexterity}</strong></span><span>Con <strong>{combatant.abilityScores.constitution}</strong></span><span>Int <strong>{combatant.abilityScores.intelligence}</strong></span><span>Sab <strong>{combatant.abilityScores.wisdom}</strong></span><span>Car <strong>{combatant.abilityScores.charisma}</strong></span></div> : <div className="rules-box">Sin caracteristicas detalladas cargadas para este combatiente.</div>}</Collapsible>
    <Collapsible key={"habilidades-" + combatant.id} title="Habilidades">{combatant.abilities.length > 0 ? <div className="ability-list">{combatant.abilities.map((ability) => <div key={ability.id} className="ability-row"><div><strong>{ability.name}</strong><small>{ability.description}</small></div><small>{ability.rangeFeet} ft</small></div>)}</div> : <div className="rules-box">Sin habilidades preparadas.</div>}</Collapsible>
    <Collapsible key={"conjuros-" + combatant.id} title="Conjuros Preparados">
      {combatant.preparedSpells && combatant.preparedSpells.length > 0 ? (
        <div className="ability-list">
          {combatant.preparedSpells.map((slot) => {
            const spell = SpellsCatalog.require(slot.spellId);
            const dcBreakdown = Rules.calculateSpellSaveDCBreakdown(context, combatant, spell.id);
            return (
              <div key={slot.slotId} className="ability-row" style={slot.isExpended ? { opacity: 0.5, backgroundColor: "#f0f0f0" } : {}}>
                <div>
                  <strong>{spell.name}</strong> <small>Nivel {spell.level} • {spell.school}</small>
                  <small>DC {dcBreakdown.total} ({dcBreakdown.base} base + {dcBreakdown.spellLevel} nvl + {dcBreakdown.abilityModifier} {dcBreakdown.associatedAbility})</small>
                </div>
                <small>{spell.rangeFeet} ft</small>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rules-box">Sin conjuros preparados.</div>
      )}
    </Collapsible>
  </>;
}
