import { Copy, Pencil, Trash2 } from "lucide-react";
import { deriveEquipmentStats, type StoredProfile } from "@dnd-tactical/shared";

export function ProfileList({ profiles, selectedId, onSelect, onDuplicate, onDelete }: { profiles: StoredProfile[]; selectedId: string | null; onSelect: (profile: StoredProfile) => void; onDuplicate: (profile: StoredProfile) => void; onDelete: (profileId: string) => void }) {
  return <div className="profile-list">
    {profiles.length === 0 && <div className="rules-box">Todavia no hay perfiles guardados.</div>}
    {profiles.map((profile) => (
      <article key={profile.id} className={"profile-row " + (selectedId === profile.id ? "selected" : "")}>
        <button type="button" className="profile-main" onClick={() => onSelect(profile)}>
          <span className={"token-dot " + profile.type}>{profile.icon}</span>
          <span><strong>{profile.name}</strong><small>{profile.type === "enemy" ? "Enemigo" : "Heroe/NPC"} - HP {profile.hpMax} - CA {deriveEquipmentStats(profile).normalArmorClassPreview}</small></span>
        </button>
        <button type="button" title="Editar" onClick={() => onSelect(profile)}><Pencil size={16} /></button>
        <button type="button" title="Duplicar" onClick={() => onDuplicate(profile)}><Copy size={16} /></button>
        <button type="button" title="Eliminar" onClick={() => onDelete(profile.id)}><Trash2 size={16} /></button>
      </article>
    ))}
  </div>;
}
