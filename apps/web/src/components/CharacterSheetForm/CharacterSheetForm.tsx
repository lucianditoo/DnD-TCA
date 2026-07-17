import { Save } from "lucide-react";
import type { Ability, CombatFeatureId, CreatureTypeId, EquipmentCatalog, EquipmentSlots, SizeCategory, StoredProfile } from "@dnd-tactical/shared";
import { applyDerivedEquipmentStats, summarizeProfileEquipment } from "../../profileEquipment";

function numberValue(value: string): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function CharacterSheetForm({ profile, editorRole, equipmentCatalog, abilities, onChange, onSave }: { profile: StoredProfile | null; editorRole: "gm" | "player"; equipmentCatalog: typeof EquipmentCatalog; abilities: Ability[]; onChange: (profile: StoredProfile) => void; onSave: (profile: StoredProfile) => void }) {
  if (!profile) return <section className="panel profile-form"><p>Elegí o creá un perfil para editar.</p></section>;
  const current = profile;
  const weapons = equipmentCatalog.getAllWeapons().filter((weapon) => !weapon.isAmmunition);
  const armors = equipmentCatalog.getAllArmors();
  const shields = equipmentCatalog.getAllShields().filter((shield) => shield.category === "shield");
  const catalogIdInSlot = (itemId: string | null) => current.inventory.find((item) => item.itemId === itemId)?.catalogId ?? "";
  const mainWeaponId = catalogIdInSlot(current.equipmentSlots.mainHandItemId) || weapons[0]?.id || "";
  const offHandId = catalogIdInSlot(current.equipmentSlots.offHandItemId);
  const armorId = catalogIdInSlot(current.equipmentSlots.armorItemId);
  const abilityIds = new Set(current.abilities ?? []);
  const derived = summarizeProfileEquipment(current);

  function update(next: Partial<StoredProfile>) {
    onChange({ ...current, ...next } as StoredProfile);
  }

  function updateNumber(key: keyof Pick<StoredProfile, "hpMax" | "baseAttackBonus" | "baseSpeedFeet">, value: string) {
    update({ [key]: numberValue(value) } as Partial<StoredProfile>);
  }

  function updateAbilityScore(key: "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma", value: string) {
    update({ abilityScores: { ...current.abilityScores, [key]: numberValue(value) } });
  }

  function updateIntrinsicDefense(key: keyof StoredProfile["intrinsicDefense"], value: string) {
    update({ intrinsicDefense: { ...current.intrinsicDefense, [key]: numberValue(value) } });
  }

  function updateType(type: "player" | "enemy") {
    update({ type, controller: type === "enemy" ? "gm" : "player", icon: type === "enemy" ? "E" : "H" });
  }

  function updateEquipmentSlot(slot: keyof EquipmentSlots, catalogId: string | null) {
    let inventory = current.inventory.map((item) => ({ ...item }));
    let itemId: string | null = null;
    if (catalogId) {
      const existing = inventory.find((item) => item.catalogId === catalogId);
      itemId = existing?.itemId ?? `${current.id}:item:${catalogId}:${inventory.length + 1}`;
      if (!existing) inventory = [...inventory, { itemId, catalogId }];
    }
    const profileWithEquipment = { ...current, inventory, equipmentSlots: { ...current.equipmentSlots, [slot]: itemId } } as StoredProfile;
    onChange(applyDerivedEquipmentStats(profileWithEquipment) as StoredProfile);
  }

  function toggleAbility(abilityId: string) {
    const next = new Set(abilityIds);
    if (next.has(abilityId)) next.delete(abilityId);
    else next.add(abilityId);
    update({ abilities: [...next] });
  }

  function updateSneakAttackDice(value: string) {
    const dice = Math.max(0, Math.min(10, Number(value) || 0));
    update({ featureIds: dice === 0 ? [] : [`srd_sneak_attack_${dice}d6` as CombatFeatureId] });
  }

  const sneakAttackDice = current.featureIds.reduce((highest, featureId) => {
    const match = /^srd_sneak_attack_(\d+)d6$/.exec(featureId);
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);

  return <section className="panel profile-form">
    <div className="panel-title">Ficha base</div>
    <div className="form-grid">
      <label>Nombre<input value={current.name} onChange={(event) => update({ name: event.target.value })} /></label>
      <label>Tipo<select value={current.type} onChange={(event) => updateType(event.target.value as "player" | "enemy")} disabled={editorRole !== "gm"}>
        <option value="player">Heroe/NPC aliado</option>
        <option value="enemy">Enemigo</option>
      </select></label>
      <label>Icono<input value={current.icon} maxLength={2} onChange={(event) => update({ icon: event.target.value.toUpperCase().slice(0, 2) || "?" })} /></label>
      <label>HP max<input type="number" value={current.hpMax} onChange={(event) => updateNumber("hpMax", event.target.value)} /></label>
      <label>BAB<input type="number" value={current.baseAttackBonus} onChange={(event) => updateNumber("baseAttackBonus", event.target.value)} /></label>
      <label>Velocidad base<input type="number" value={current.baseSpeedFeet} onChange={(event) => updateNumber("baseSpeedFeet", event.target.value)} /></label>
      <label>Tamaño<select value={current.sizeCategory} onChange={(event) => update({ sizeCategory: event.target.value as SizeCategory })}>
        <option value="fine">Fine</option><option value="diminutive">Diminutive</option><option value="tiny">Tiny</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="huge">Huge</option><option value="gargantuan">Gargantuan</option><option value="colossal">Colossal</option>
      </select></label>
      <label>Tipo de criatura<select value={current.creatureTypeId} onChange={(event) => update({ creatureTypeId: event.target.value as CreatureTypeId })}>
        <option value="humanoid">Humanoide</option><option value="undead">Muerto viviente</option><option value="construct">Constructo</option><option value="dragon">Dragón</option><option value="magical_beast">Bestia mágica</option><option value="animal">Animal</option><option value="aberration">Aberración</option><option value="elemental">Elemental</option><option value="fey">Feérico</option><option value="giant">Gigante</option><option value="monstrous_humanoid">Humanoide monstruoso</option><option value="ooze">Cieno</option><option value="outsider">Ajeno</option><option value="plant">Planta</option><option value="vermin">Alimaña</option>
      </select></label>
      <label>Ataque furtivo (d6)<input type="number" min="0" max="10" value={sneakAttackDice} onChange={(event) => updateSneakAttackDice(event.target.value)} /></label>
      <label>Rangos de Escapismo<input type="number" min="0" value={current.skillRanks.escape_artist} onChange={(event) => update({ skillRanks: { ...current.skillRanks, escape_artist: Math.max(0, Math.trunc(numberValue(event.target.value))) } })} /></label>
      <label>Fuerza<input type="number" value={current.abilityScores?.strength ?? 10} onChange={(event) => updateAbilityScore("strength", event.target.value)} /></label>
      <label>Destreza<input type="number" value={current.abilityScores?.dexterity ?? 10} onChange={(event) => updateAbilityScore("dexterity", event.target.value)} /></label>
      <label>Armadura natural<input type="number" value={current.intrinsicDefense.naturalArmorBonus} onChange={(event) => updateIntrinsicDefense("naturalArmorBonus", event.target.value)} /></label>
      <label>Desvío<input type="number" value={current.intrinsicDefense.deflectionBonus} onChange={(event) => updateIntrinsicDefense("deflectionBonus", event.target.value)} /></label>
      <label>Arma principal<select value={mainWeaponId} onChange={(event) => updateEquipmentSlot("mainHandItemId", event.target.value)}>{weapons.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}</select></label>
      <label>Mano secundaria / escudo<select value={offHandId} onChange={(event) => updateEquipmentSlot("offHandItemId", event.target.value || null)}><option value="">Ninguna</option>{weapons.filter((weapon) => weapon.handedness === "light" || weapon.handedness === "one-handed").map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}{shields.map((shield) => <option key={shield.id} value={shield.id}>{shield.name}</option>)}</select></label>
      <label>Armadura<select value={armorId} onChange={(event) => updateEquipmentSlot("armorItemId", event.target.value || null)}><option value="">Ninguna</option>{armors.map((armor) => <option key={armor.id} value={armor.id}>{armor.name}</option>)}</select></label>
    </div>
    <div className="equipment-summary">
      <span><small>CA derivada</small><strong>{applyDerivedEquipmentStats(current).normalArmorClassPreview}</strong></span>
      <span><small>Daño</small><strong>{derived.weaponDamage}</strong></span>
      <span><small>Daño base promedio</small><strong>{derived.averageWeaponDamage}</strong></span>
      <span><small>Critico</small><strong>{derived.weaponCritical}</strong></span>
      <span><small>Tipo</small><strong>{derived.weaponDamageType}</strong></span>
      <span><small>Alcance</small><strong>{derived.weaponRange}</strong></span>
      <span><small>Peso arma</small><strong>{derived.weaponWeight}</strong></span>
      <span><small>Armadura</small><strong>+{derived.armorBonus}</strong></span>
      <span><small>Escudo</small><strong>+{derived.shieldBonus}</strong></span>
      <span><small>Max Des</small><strong>{derived.maxDexBonus ?? "sin limite"}</strong></span>
      <span><small>Penalizador</small><strong>{derived.armorCheckPenalty}</strong></span>
      <span><small>Fallo arcano</small><strong>{derived.arcaneSpellFailurePercent}%</strong></span>
      <span><small>Velocidad</small><strong>{derived.armorAdjustedSpeedFeet} ft</strong></span>
    </div>
    <div className="ability-checks">
      <strong>Habilidades/conjuros</strong>
      {abilities.map((ability) => <label key={ability.id} className="inline-check"><input type="checkbox" checked={abilityIds.has(ability.id)} onChange={() => toggleAbility(ability.id)} /> {ability.name}</label>)}
    </div>
    <button className="primary" type="button" onClick={() => onSave(current)}><Save size={18} /> Guardar perfil</button>
  </section>;
}
