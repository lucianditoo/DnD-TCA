import { useState, type ReactNode } from "react";
import { lifeStatus, lifeStatusLabel, Rules, type Combatant, type CombatRulesSnapshot, type ProductionEffectId } from "@dnd-tactical/shared";

export function Stat({ icon, label, value, title }: { icon: ReactNode; label: string; value: string; title?: string }) {
  return <div className="stat" title={title}>{icon}<span>{label}</span><strong>{value}</strong></div>;
}

export function CombatantPreview({ combatant, context }: { combatant: Combatant; context: CombatRulesSnapshot<ProductionEffectId> }) {
  return <div className="collapse-preview">
    <span className={"token-dot " + combatant.type}>{combatant.icon}</span>
    <span><strong>{combatant.name}</strong><small>HP {combatant.hpCurrent}/{combatant.hpMax} - CA {Rules.totalArmorClass(context, combatant).total} - {lifeStatusLabel(lifeStatus(combatant))}</small></span>
  </div>;
}

export function RollControls({ d20, autoD20, damage, autoDamage, defaultDamage, onD20Change, onAutoD20Change, onDamageChange, onAutoDamageChange }: { d20: string; autoD20: boolean; damage: string; autoDamage: boolean; defaultDamage: number; onD20Change: (value: string) => void; onAutoD20Change: (value: boolean) => void; onDamageChange: (value: string) => void; onAutoDamageChange: (value: boolean) => void }) {
  return <div className="roll-grid">
    <D20Control value={d20} auto={autoD20} onValueChange={onD20Change} onAutoChange={onAutoD20Change} />
    <DamageControl value={damage} auto={autoDamage} defaultDamage={defaultDamage} onValueChange={onDamageChange} onAutoChange={onAutoDamageChange} />
  </div>;
}

export function D20Control({ value, auto, onValueChange, onAutoChange }: { value: string; auto: boolean; onValueChange: (value: string) => void; onAutoChange: (value: boolean) => void }) {
  return <div className="roll-control">
    <div className="roll-header"><span>d20</span><label className="inline-check"><input type="checkbox" checked={auto} onChange={(event) => onAutoChange(event.target.checked)} /> Auto</label></div>
    <input type="number" min="1" max="20" value={value} disabled={auto} onChange={(event) => onValueChange(event.target.value)} />
  </div>;
}

export function DamageControl({ value, auto, defaultDamage, onValueChange, onAutoChange }: { value: string; auto: boolean; defaultDamage: number; onValueChange: (value: string) => void; onAutoChange: (value: boolean) => void }) {
  return <div className="roll-control">
    <div className="roll-header"><span>Daño</span><label className="inline-check"><input type="checkbox" checked={auto} onChange={(event) => onAutoChange(event.target.checked)} /> Auto</label></div>
    <input type="number" min="0" placeholder={String(defaultDamage)} value={value} disabled={auto} onChange={(event) => onValueChange(event.target.value)} />
  </div>;
}

export function Collapsible({ title, children, defaultOpen = false, preview }: { title: string; children: ReactNode; defaultOpen?: boolean; preview?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={"collapsible " + (open ? "open" : "closed")}>
    <button type="button" className="collapsible-summary" onClick={() => setOpen((current) => !current)}><span>{title}</span><span className="collapsible-mark">{open ? "-" : "+"}</span></button>
    {!open && preview && <div className="collapsible-preview-body">{preview}</div>}
    {open && <div className="collapsible-body">{children}</div>}
  </section>;
}
