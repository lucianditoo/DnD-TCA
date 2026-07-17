import { Footprints, HeartPulse } from "lucide-react";
import { type CombatOutcome, type CombatRoom, type Combatant, type LifeStatus } from "@dnd-tactical/shared";
import { Collapsible } from "../common";

export function GmPanel({ room, selected, gmMoveTarget, gmMoveMode, healAmount, hpOverride, hpMaxOverride, gmNote, onGmMoveTargetChange, onToggleGmMoveMode, onHealAmountChange, onHealSelected, onHpOverrideChange, onHpMaxOverrideChange, onGmSetHp, onGmSetStatus, onGmClearOpportunities, onGmForceOutcome, onGmNoteChange, onGmAddNote }: { room: CombatRoom; selected: Combatant; gmMoveTarget: Combatant | null; gmMoveMode: boolean; healAmount: string; hpOverride: string; hpMaxOverride: string; gmNote: string; onGmMoveTargetChange: (id: string) => void; onToggleGmMoveMode: () => void; onHealAmountChange: (value: string) => void; onHealSelected: () => void; onHpOverrideChange: (value: string) => void; onHpMaxOverrideChange: (value: string) => void; onGmSetHp: () => void; onGmSetStatus: (status: LifeStatus) => void; onGmClearOpportunities: () => void; onGmForceOutcome: (outcome: CombatOutcome) => void; onGmNoteChange: (value: string) => void; onGmAddNote: () => void }) {
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
  </div></Collapsible>;
}
