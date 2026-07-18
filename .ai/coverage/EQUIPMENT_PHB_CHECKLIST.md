# EQUIPMENT_PHB_CHECKLIST — Catálogo de Inventario por Ranuras V5/V6

**Tipo de documento**: Auditoría analítica de cobertura para la V1.0, bajo el marco de `.ai/coverage/V1_LAUNCH_MANIFESTO.md`. No es una NDD ni un plan de implementación. No autoriza ningún cambio de código.

**Nota de relación con `.ai/coverage/EQUIPMENT_CHECKLIST.md`**: mismo universo de equipo, reorganizado aquí estrictamente por las ranuras inmutables V5/V6 (`mainHand`, `offHand`, `armor`, `inventory`) decretadas por la instrucción de gobernanza, en vez de por familia de arma (sencilla/marcial/exótica).

**Ranuras V5/V6** (`packages/shared/src/types.ts:92-101`):

| Ranura | Campo en `EquipmentSlots`/`InventoryItem` | Ocupantes válidos hoy |
|---|---|---|
| `mainHand` | `mainHandItemId` | Cualquier arma (sencilla, marcial, exótica), a una o dos manos, cuerpo a cuerpo o a distancia. |
| `offHand` | `offHandItemId` | Arma secundaria ligera, escudo, o vacío. No existe una ranura de escudo separada — el escudo ocupa `offHand`. |
| `armor` | `armorItemId` | Armadura corporal (ligera/media/pesada). |
| `inventory` | `InventoryItem[]` (`itemId`, `catalogId`, `quantity?`) | Reserva de ítems no equipados activamente. Hoy solo referencia `catalogId` de armas/armaduras/escudos, porque `EquipmentCatalogItem` (`equipmentCatalog.ts:25-28`) solo admite las variantes `"weapon" | "armor" | "shield"`. |

**Estado**: `[x]` implementado en `equipmentCatalog.ts` / `data/equipment/*.ts` · `[ ]` no implementado.

**Verificación cruzada con `creatures.json`**: la muestra de datos reales usa `mainHandItemId` → `longbow`, `greatsword`, `dagger`; `offHandItemId` → `buckler`; `armorItemId` → `studded_leather`, `full_plate`, `chain_shirt`. Los siete IDs existen en los catálogos auditados abajo; no se detectó ninguna referencia rota.

---

## A. Ranura `mainHand` — Armas

### A.1 Armas Sencillas (`weapons.simple.ts`) — 19/19 implementadas

| Estado | Arma (ES / EN) | Notas |
|---|---|---|
| [x] | Guantelete / Gauntlet | `gauntlet`. |
| [x] | Golpe Desarmado / Unarmed Strike | `unarmed_strike`. |
| [x] | Daga / Dagger | `dagger`. |
| [x] | Guantelete con Púas / Spiked Gauntlet | `spiked_gauntlet`. |
| [x] | Hoz / Sickle | `sickle`. |
| [x] | Maza Ligera / Light Mace | `light_mace`. |
| [x] | Daga de Puño / Punching Dagger | `punching_dagger`. |
| [x] | Porra / Club | `club`. |
| [x] | Lucero del Alba / Morningstar | `morningstar`. |
| [x] | Maza Pesada / Heavy Mace | `heavy_mace`. |
| [x] | Lanza Corta / Shortspear | `shortspear`. |
| [x] | Bastón de Combate / Quarterstaff | `quarterstaff`. |
| [x] | Lanza / Spear | `spear`. |
| [x] | Pica Larga / Longspear | `longspear`. |
| [x] | Ballesta Ligera / Light Crossbow | `light_crossbow` + `crossbow_bolts_10`. |
| [x] | Ballesta Pesada / Heavy Crossbow | `heavy_crossbow`. |
| [x] | Dardo / Dart | `dart`. |
| [x] | Honda / Sling | `sling` + `sling_bullets_10`. |
| [x] | Jabalina / Javelin | `javelin`. |

### A.2 Armas Marciales (`weapons.martial.ts`) — 34/34 implementadas

| Estado | Arma (ES / EN) | Notas |
|---|---|---|
| [x] | Púas de Armadura / Armor Spikes | `armor_spikes`. |
| [x] | Cachiporra / Sap | `sap`. |
| [x] | Golpe con Escudo Ligero / Light Shield Bash | `light_shield_bash`. |
| [x] | Golpe con Escudo Ligero con Púas / Light Spiked Shield Bash | `light_spiked_shield_bash`. |
| [x] | Espada Corta / Short Sword | `short_sword`. |
| [x] | Hacha Arrojadiza / Throwing Axe | `throwing_axe`. |
| [x] | Hacha de Mano / Handaxe | `handaxe`. |
| [x] | Kukri | `kukri`. |
| [x] | Martillo Ligero / Light Hammer | `light_hammer`. |
| [x] | Pico Ligero / Light Pick | `light_pick`. |
| [x] | Cimitarra / Scimitar | `scimitar`. |
| [x] | Golpe con Escudo Pesado / Heavy Shield Bash | `heavy_shield_bash`. |
| [x] | Golpe con Escudo Pesado con Púas / Heavy Spiked Shield Bash | `heavy_spiked_shield_bash`. |
| [x] | Espada Larga / Longsword | `longsword`. |
| [x] | Estoque / Rapier | `rapier`. |
| [x] | Hacha de Batalla / Battleaxe | `battleaxe`. |
| [x] | Mangual / Flail | `flail`. |
| [x] | Martillo de Guerra / Warhammer | `warhammer`. |
| [x] | Pico Pesado / Heavy Pick | `heavy_pick`. |
| [x] | Tridente / Trident | `trident`. |
| [x] | Alabarda / Halberd | `halberd`. |
| [x] | Espada Ancha / Falchion | `falchion`. |
| [x] | Guadaña / Scythe | `scythe`. |
| [x] | Guja / Glaive | `glaive`. |
| [x] | Guisarma / Guisarme | `guisarme`. |
| [x] | Maza Grande / Greatclub | `greatclub`. |
| [x] | Hacha Grande / Greataxe | `greataxe`. |
| [x] | Espadón / Greatsword | `greatsword` — confirmada en uso real en `creatures.json` (`cedrick`). |
| [x] | Lanza de Caballería / Lance | `lance`. |
| [x] | Mangual Pesado / Heavy Flail | `heavy_flail`. |
| [x] | Ranseur | `ranseur`. |
| [x] | Arco Corto / Shortbow | `shortbow` + `arrows_20`. |
| [x] | Arco Corto Compuesto / Composite Shortbow | `composite_shortbow`. |
| [x] | Arco Largo / Longbow | `longbow` — confirmada en uso real en `creatures.json` (`elaen`). |
| [x] | Arco Largo Compuesto / Composite Longbow | `composite_longbow`. |

### A.3 Armas Exóticas (`weapons.exotic.ts`) — 19/19 implementadas

| Estado | Arma (ES / EN) | Notas |
|---|---|---|
| [x] | Kama | `kama`. |
| [x] | Nunchaku | `nunchaku`. |
| [x] | Sai | `sai`. |
| [x] | Siangham | `siangham`. |
| [x] | Espada Bastarda / Bastard Sword | `bastard_sword`. |
| [x] | Hacha de Guerra Enana / Dwarven Waraxe | `dwarven_waraxe`. |
| [x] | Látigo / Whip | `whip`. |
| [x] | Cadena con Púas / Spiked Chain | `spiked_chain`. |
| [x] | Espada de Doble Filo / Two-Bladed Sword | `two_bladed_sword`. |
| [x] | Hacha Doble Orca / Orc Double Axe | `orc_double_axe`. |
| [x] | Mangual Terrible / Dire Flail | `dire_flail`. |
| [x] | Martillo Ganchudo Gnomo / Gnome Hooked Hammer | `gnome_hooked_hammer`. |
| [x] | Urgrosh Enano / Dwarven Urgrosh | `dwarven_urgrosh`. |
| [x] | Ballesta de Mano / Hand Crossbow | `hand_crossbow`. |
| [x] | Ballesta Ligera Repetidora / Repeating Light Crossbow | `repeating_light_crossbow`. |
| [x] | Ballesta Pesada Repetidora / Repeating Heavy Crossbow | `repeating_heavy_crossbow` + `repeating_crossbow_bolts_5`. |
| [x] | Bolas | `bolas`. |
| [x] | Red / Net | `net`. |
| [x] | Shuriken | `shuriken_5`. |

## B. Ranura `offHand` — Armas Secundarias y Escudos (`shields.ts`) — 6/6 escudos + 3/3 accesorios

| Estado | Ítem (ES / EN) | Notas |
|---|---|---|
| [x] | Brocal / Buckler | `buckler` — confirmada en uso real en `creatures.json` (`bane`). |
| [x] | Escudo Ligero de Madera / Light Wooden Shield | `light_wooden_shield`. |
| [x] | Escudo Ligero de Acero / Light Steel Shield | `light_steel_shield`. |
| [x] | Escudo Pesado de Madera / Heavy Wooden Shield | `heavy_wooden_shield`. |
| [x] | Escudo Pesado de Acero / Heavy Steel Shield | `heavy_steel_shield`. |
| [x] | Escudo Torre / Tower Shield | `tower_shield`. |
| [x] | Guantelete Cerrado / Locked Gauntlet | `locked_gauntlet` (accesorio de `offHand`). |
| [x] | Púas de Escudo / Shield Spikes | `shield_spikes_accessory` (modificador de arma sobre un escudo en `offHand`). |

*(Nota: las armas listadas en A.2 marcadas como "golpe con escudo" ocupan `offHand` como arma cuando el escudo se usa ofensivamente; se listan en A.2 para no duplicar la entrada.)*

## C. Ranura `armor` — Armaduras (`armors.ts`) — 12/12 implementadas

| Estado | Armadura (ES / EN) | Categoría | Notas |
|---|---|---|---|
| [x] | Acolchada / Padded | Ligera | `padded`. |
| [x] | De Cuero / Leather | Ligera | `leather`. |
| [x] | De Cuero Tachonado / Studded Leather | Ligera | `studded_leather` — confirmada en uso real en `creatures.json` (`elaen`). |
| [x] | Camisa de Malla / Chain Shirt | Ligera | `chain_shirt` — confirmada en uso real en `creatures.json` (`bane`). |
| [x] | De Piel / Hide | Media | `hide`. |
| [x] | De Escamas / Scale Mail | Media | `scale_mail`. |
| [x] | Cota de Malla / Chainmail | Media | `chainmail`. |
| [x] | Coraza / Breastplate | Media | `breastplate`. |
| [x] | Malla Astillada / Splint Mail | Pesada | `splint_mail`. |
| [x] | Malla Bandeada / Banded Mail | Pesada | `banded_mail`. |
| [x] | Media Placa / Half-Plate | Pesada | `half_plate`. |
| [x] | Placa Completa / Full Plate | Pesada | `full_plate` — confirmada en uso real en `creatures.json` (`cedrick`). |

*(Accesorio de esta ranura: Púas de Armadura / `armor_spikes_accessory`, ya contabilizado junto a los accesorios de escudo en la Sección B.)*

## D. Ranura `inventory` — Objetos Consumibles y Bienes de Aventura (Tablas 7-7/7-8 del PHB) — 0/14, sin catálogo

`InventoryItem.catalogId` solo puede resolver hoy contra `weapons`/`armors`/`shields` (`EquipmentCatalog.getItem`, `equipmentCatalog.ts:30-38`). No existe una variante de catálogo para objetos de un solo uso, por lo que **ningún** ítem de esta sección tiene ranura real que ocupar todavía; se listan como candidatos a una futura ranura `inventory` de tipo consumible.

| Estado | Objeto (ES / EN) | Notas |
|---|---|---|
| [ ] | Ácido (frasco) / Acid | Arma arrojadiza, 1d6 ácido. |
| [ ] | Fuego de Alquimista / Alchemist's Fire | Arma arrojadiza, daño continuado. |
| [ ] | Antitóxico / Antitoxin | Bono a salvación contra veneno. |
| [ ] | Antorcha Perpetua / Everburning Torch | Fuente de luz permanente. |
| [ ] | Agua Bendita / Holy Water | Arma arrojadiza contra no-muertos/extraplanares malignos. |
| [ ] | Barra de Sol / Sunrod | Fuente de luz de combate. |
| [ ] | Bolsa Enredadora / Tanglefoot Bag | Inmoviliza (trait `IMMOBILIZED` ya existe; falta el objeto que lo produzca). |
| [ ] | Piedra del Trueno / Thunderstone | Aturde en área (mecanismo de aturdido `srd_stunned` ya existe; falta el objeto). |
| [ ] | Varilla Encendedora / Tindertwig | Utilidad de encendido, impacto de combate mínimo. |
| [ ] | Vara Inamovible / Immovable Rod | Utilidad de anclaje táctico ocasional. |
| [ ] | Abrojos / Caltrops | Peligro de área por celda; podría reutilizar `EnvironmentalHazard` si se modelara como objeto colocable. |
| [ ] | Antorcha / Torch | Fuente de luz básica. |
| [ ] | Poción (genérica) / Potion | Activaría una `Ability`/`EffectDefinition` desde `inventory`; bloquea también las dotes `Brew Potion`/`Scribe Scroll`. |
| [ ] | Pergamino (genérico) / Scroll | Activaría un `SpellDefinition` sin preparación previa; mismo bloqueo estructural que Poción. |

---

## Resumen de cobertura

- **`mainHand`**: 72/72 armas (19 sencillas + 34 marciales + 19 exóticas).
- **`offHand`**: 6/6 escudos + 3/3 accesorios de escudo/armadura = 9/9.
- **`armor`**: 12/12 armaduras corporales.
- **Total ranuras equipables**: **93/93 implementadas**.
- **`inventory` (consumibles)**: **0/14** — brecha estructural completa, causa raíz: `EquipmentCatalogItem` carece de una variante `"consumable"`. Registrada como candidata a una NDD futura; ningún cambio de código realizado en este documento.
