import { Footprints, HeartPulse, X } from "lucide-react";
import { type CombatOutcome, type CombatRoom, type Combatant, type LifeStatus } from "@dnd-tactical/shared";
import { Collapsible } from "../common";
import type { ActiveEffectView, ApplicableEffectOption } from "../../viewModel";

export function GmPanel({ room, selected, gmMoveTarget, gmMoveMode, healAmount, hpOverride, hpMaxOverride, gmNote, activeEffects, applicableEffects, effectToApplyId, effectDurationPreset, onGmMoveTargetChange, onToggleGmMoveMode, onHealAmountChange, onHealSelected, onHpOverrideChange, onHpMaxOverrideChange, onGmSetHp, onGmSetStatus, onGmClearOpportunities, onGmForceOutcome, onGmNoteChange, onGmAddNote, onEffectToApplyChange, onEffectDurationPresetChange, onApplyEffect, onRemoveEffect }: { room: CombatRoom; selected: Combatant; gmMoveTarget: Combatant | null; gmMoveMode: boolean; healAmount: string; hpOverride: string; hpMaxOverride: string; gmNote: string; activeEffects: ActiveEffectView[]; applicableEffects: ApplicableEffectOption[]; effectToApplyId: string; effectDurationPreset: "permanent" | "until_target_turn_end"; onGmMoveTargetChange: (id: string) => void; onToggleGmMoveMode: () => void; onHealAmountChange: (value: string) => void; onHealSelected: () => void; onHpOverrideChange: (value: string) => void; onHpMaxOverrideChange: (value: string) => void; onGmSetHp: () => void; onGmSetStatus: (status: LifeStatus) => void; onGmClearOpportunities: () => void; onGmForceOutcome: (outcome: CombatOutcome) => void; onGmNoteChange: (value: string) => void; onGmAddNote: () => void; onEffectToApplyChange: (effectId: string) => void; onEffectDurationPresetChange: (preset: "permanent" | "until_target_turn_end") => void; onApplyEffect: () => void; onRemoveEffect: (instanceId: string) => void }) {
  return <Collapsible title="Panel GM"><div className="gm-panel">
    <label>Mover token<select value={gmMoveTarget?.id ?? ""} onChange={(event) => onGmMoveTargetChange(event.target.value)}>{room.combatants.map((combatant) => <option key={combatant.id} value={combatant.id}>{combatant.name}</option>)}</select></label>
    <button className={gmMoveMode ? "gm-move-toggle active" : "gm-move-toggle"} onClick={onToggleGmMoveMode}><Footprints size={16} /> {gmMoveMode ? "Mover GM activo" : "Mover como GM"}</button>
    {gmMoveMode && <div className="rules-box">Click en una casilla verde libre para reposicionar a {gmMoveTarget?.name ?? "un token"}. Click en otro token para elegirlo.</div>}
    <div className="split"><label>Curar HP<input type="number" value={healAmount} onChange={(event) => onHealAmountChange(event.target.value)} /></label><button onClick={onHealSelected}><HeartPulse size={16} /> Curar</button></div>
    {selected.abilities.some((ability) => ability.id === "cure-light-wounds") && <div className="rules-box">Cure Light Wounds: elige un objetivo aliado, ingresa la curacion manual y pulsa Curar.</div>}
    <div className="split"><label>HP actual<input type="number" placeholder={String(selected.hpCurrent)} value={hpOverride} onChange={(event) => onHpOverrideChange(event.target.value)} /></label><label>HP max<input type="number" placeholder={String(selected.hpMax)} value={hpMaxOverride} onChange={(event) => onHpMaxOverrideChange(event.target.value)} /></label></div>
    <button onClick={onGmSetHp}><HeartPulse size={16} /> Ajustar HP</button>
    <div className="status-row">
      <button onClick={() => onGmSetStatus("active")}>Activo</button>
      <button onClick={() => onGmSetStatus("disabled")}>0 HP</button>
      <button onClick={() => onGmSetStatus("dying")}>Moribundo</button>
      <button onClick={() => onGmSetStatus("stable")}>Estable</button>
      <button onClick={() => onGmSetStatus("dead")}>Muerto</button>
    </div>
    <div className="button-row"><button onClick={onGmClearOpportunities}>Limpiar AdO</button><button onClick={() => onGmForceOutcome("victory")}>Victoria</button><button onClick={() => onGmForceOutcome("tpk")}>TPK</button></div>
    <label>Nota al log<input value={gmNote} onChange={(event) => onGmNoteChange(event.target.value)} /></label>
    <button onClick={onGmAddNote}>Agregar nota</button>

    <Collapsible title={"Condiciones de " + selected.name} defaultOpen>
      {activeEffects.length === 0
        ? <div className="rules-box">{selected.name} no tiene efectos activos.</div>
        : <ul className="active-effects-list">
            {activeEffects.map((effect) => (
              <li key={effect.instanceId} className="active-effect-row">
                <div className="active-effect-info">
                  <strong>{effect.name}</strong>
                  <small>{effect.description}</small>
                  <small>{effect.durationLabel} · {effect.sourceLabel}</small>
                </div>
                <button className="icon-button" title={"Remover " + effect.name} onClick={() => onRemoveEffect(effect.instanceId)}><X size={16} /></button>
              </li>
            ))}
          </ul>}
      <div className="split">
        <label>Aplicar efecto
          <select value={effectToApplyId} onChange={(event) => onEffectToApplyChange(event.target.value)}>
            <option value="">Elegir...</option>
            {applicableEffects.map((option) => <option key={option.effectId} value={option.effectId}>{option.name}</option>)}
          </select>
        </label>
        <label>Duración
          <select value={effectDurationPreset} onChange={(event) => onEffectDurationPresetChange(event.target.value as "permanent" | "until_target_turn_end")}>
            <option value="permanent">Permanente</option>
            <option value="until_target_turn_end">Hasta fin de turno del objetivo</option>
          </select>
        </label>
      </div>
      <button disabled={!effectToApplyId} onClick={onApplyEffect}>Aplicar a {selected.name}</button>
    </Collapsible>
  </div></Collapsible>;
}
