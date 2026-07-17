import { Plus } from "lucide-react";
import { lifeStatus, lifeStatusLabel, Rules, type CombatRoom, type Combatant, type GameCatalog, type Participant, type StoredProfile } from "@dnd-tactical/shared";
import { Collapsible, CombatantPreview } from "../common";
import { SelectedInfo } from "../SelectedInfo/SelectedInfo";

export function CombatantsPanel({
  room,
  snapshot,
  catalog,
  active,
  selected,
  participant,
  savedHeroProfiles,
  savedEnemyProfiles,
  selectedProfileId,
  selectedHeroTemplateId,
  selectedEnemyTemplateId,
  canEditInitiative,
  canStartCombat,
  onProfileChange,
  onAddProfileCombatant,
  onHeroTemplateChange,
  onEnemyTemplateChange,
  onAddCatalogCombatant,
  onSelectCombatant,
  onSetInitiative,
  onSortInitiative,
  attackerId,
  canControlSelected,
  onDeclareDodgeTarget
}: {
  room: CombatRoom;
  snapshot: import("@dnd-tactical/shared").CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>;
  catalog: GameCatalog | null;
  active: Combatant | null;
  selected: Combatant | null;
  participant: Participant;
  savedHeroProfiles: StoredProfile[];
  savedEnemyProfiles: StoredProfile[];
  selectedProfileId: string;
  selectedHeroTemplateId: string;
  selectedEnemyTemplateId: string;
  canEditInitiative: (combatant: Combatant) => boolean;
  canStartCombat: boolean;
  onProfileChange: (value: string) => void;
  onAddProfileCombatant: () => void;
  onHeroTemplateChange: (value: string) => void;
  onEnemyTemplateChange: (value: string) => void;
  onAddCatalogCombatant: (category: "heroes" | "enemies") => void;
  onSelectCombatant: (id: string) => void;
  onSetInitiative: (combatant: Combatant, value: string) => void;
  onSortInitiative: () => void;
  attackerId?: string;
  canControlSelected: boolean;
  onDeclareDodgeTarget: (combatantId: string, dodgeTargetId: string | null) => void;
}) {
  return <aside className="panel roster">
    <Collapsible title="Combatientes" defaultOpen preview={room.phase === "active" && active ? <CombatantPreview combatant={active} context={snapshot} /> : undefined}>
      <div className="catalog-picker">
        <label>Perfiles guardados<select value={selectedProfileId} onChange={(event) => onProfileChange(event.target.value)}>
          <option value="">Elegir perfil</option>
          {savedHeroProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          {participant.role === "gm" && savedEnemyProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} (enemigo)</option>)}
        </select></label>
        <button onClick={onAddProfileCombatant} disabled={!selectedProfileId}><Plus size={16} /> Agregar perfil</button>
        <a className="ghost-link" href="/profiles">Editar perfiles</a>
        <label>Heroes<select value={selectedHeroTemplateId} onChange={(event) => onHeroTemplateChange(event.target.value)}>{catalog?.creatures.heroes.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <button onClick={() => onAddCatalogCombatant("heroes")} disabled={!selectedHeroTemplateId}><Plus size={16} /> Agregar heroe</button>
        {participant.role === "gm" && <><label>Enemigos<select value={selectedEnemyTemplateId} onChange={(event) => onEnemyTemplateChange(event.target.value)}>{catalog?.creatures.enemies.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <button onClick={() => onAddCatalogCombatant("enemies")} disabled={!selectedEnemyTemplateId}><Plus size={16} /> Agregar enemigo</button></>}
      </div>
      <div className="combatant-list">
        {room.combatants.map((combatant) => (
          <button key={combatant.id} className={"combatant-row " + (selected?.id === combatant.id ? "selected" : "")} onClick={() => onSelectCombatant(combatant.id)}>
            <span className={"token-dot " + combatant.type}>{combatant.icon}</span>
            <span><strong>{combatant.name}</strong><small>HP {combatant.hpCurrent}/{combatant.hpMax} - CA {Rules.totalArmorClass(snapshot, combatant).total} - {lifeStatusLabel(lifeStatus(combatant))}</small></span>
          </button>
        ))}
      </div>
    </Collapsible>
    <Collapsible title="Iniciativa manual">
      <div className="initiative-list">
        {room.combatants.map((combatant) => <label key={combatant.id}>{combatant.name}<input type="number" defaultValue={combatant.initiative ?? ""} disabled={!canEditInitiative(combatant)} onBlur={(event) => onSetInitiative(combatant, event.target.value)} /></label>)}
        <button className="primary" onClick={onSortInitiative} disabled={!canStartCombat}>Iniciar combate</button>
      </div>
    </Collapsible>
    {selected && <SelectedInfo combatant={selected} room={room} snapshot={snapshot} attackerId={attackerId} canControlSelected={canControlSelected} onDeclareDodgeTarget={onDeclareDodgeTarget} />}
  </aside>;
}
