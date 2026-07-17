import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredProfile } from "@dnd-tactical/shared";
import { CharacterSheetForm } from "../components/CharacterSheetForm/CharacterSheetForm";
import { ProfileList } from "../components/ProfileList/ProfileList";
import { useStoredProfiles } from "../hooks/useStoredProfiles";

export function ProfilesPage() {
  const { profiles, migrationIssues, equipmentCatalog, abilities, createProfile, saveProfile, duplicateProfile, deleteProfile } = useStoredProfiles();
  const [editorRole, setEditorRole] = useState<"gm" | "player">("gm");
  const visibleProfiles = useMemo(() => editorRole === "gm" ? profiles : profiles.filter((profile) => profile.type === "player"), [editorRole, profiles]);
  const [draft, setDraft] = useState<StoredProfile | null>(visibleProfiles[0] ?? null);
  const selected = draft ? profiles.find((profile) => profile.id === draft.id) : null;

  function create(type: "player" | "enemy") {
    const profile = createProfile(type);
    setDraft(profile);
  }

  function save(profile: StoredProfile) {
    saveProfile(profile);
    setDraft(profile);
  }

  function duplicate(profile: StoredProfile) {
    setDraft(duplicateProfile(profile));
  }

  function remove(profileId: string) {
    deleteProfile(profileId);
    if (draft?.id === profileId) setDraft(null);
  }

  return <main className="profiles-shell">
    <header className="topbar">
      <div><p className="eyebrow">Biblioteca local</p><h1>Perfiles</h1></div>
      <div className="button-row">
        <button type="button" onClick={() => window.history.back()}><ArrowLeft size={18} /> Volver</button>
        <a className="ghost-link" href="/"><ArrowLeft size={18} /> Volver al lobby</a>
      </div>
    </header>
    <section className="profiles-layout">
      <aside className="panel">
        <div className="panel-title">Perfiles guardados</div>
        <div className="segmented">
          <button type="button" className={editorRole === "gm" ? "active" : ""} onClick={() => setEditorRole("gm")}>GM</button>
          <button type="button" className={editorRole === "player" ? "active" : ""} onClick={() => setEditorRole("player")}>Jugador</button>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => create("player")}><Plus size={16} /> Heroe</button>
          {editorRole === "gm" && <button type="button" onClick={() => create("enemy")}><Plus size={16} /> Enemigo</button>}
        </div>
        {migrationIssues.length > 0 && <div className="rules-box error-text"><strong>Perfiles legacy bloqueados</strong><br />{migrationIssues.map((issue) => `${issue.profileName ?? issue.profileId ?? `Perfil ${issue.index + 1}`}: ${issue.message}`).join(" · ")}</div>}
        <ProfileList profiles={visibleProfiles} selectedId={draft?.id ?? selected?.id ?? null} onSelect={(profile) => setDraft(profile)} onDuplicate={duplicate} onDelete={remove} />
      </aside>
      <CharacterSheetForm profile={draft} editorRole={editorRole} equipmentCatalog={equipmentCatalog} abilities={abilities} onChange={setDraft} onSave={save} />
    </section>
  </main>;
}
