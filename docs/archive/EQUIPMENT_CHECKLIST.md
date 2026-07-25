# EQUIPMENT_CHECKLIST — Cobertura de Equipo (Manual del Jugador 3.5)

> **Archivado (Sprint 054C)**: reemplazado por [`.ai/coverage/EQUIPMENT_PHB_CHECKLIST.md`](../../.ai/coverage/EQUIPMENT_PHB_CHECKLIST.md), el único inventario vivo de este universo. Este corte se conserva por su taxonomía de clasificación previa; no es autoridad vigente.

**Tipo de documento**: Auditoría analítica de cobertura para la Versión 1.0. No es una NDD ni un plan de implementación. No autoriza ningún cambio de código por sí mismo.

**Fuentes cruzadas para el estado de implementación**:
- `packages/shared/src/data/equipment/weapons.simple.ts`, `weapons.martial.ts`, `weapons.exotic.ts`, `armors.ts`, `shields.ts` (catálogos declarativos, leídos en su totalidad para este documento).
- `packages/shared/src/equipmentCatalog.ts` (API `EquipmentCatalog`): confirma que el motor solo reconoce tres tipos de ítem catalogado — `"weapon"`, `"armor"`, `"shield"` (`EquipmentCatalogItem`, líneas 25-28). No existe un cuarto tipo `"consumable"`/`"gear"`.
- `packages/shared/src/types.ts`: `EquipmentSlots { mainHandItemId, offHandItemId, armorItemId }` (líneas 92-96) y `InventoryItem { itemId, catalogId, quantity? }` (líneas 97-101). No hay un slot dedicado a escudo distinto de `offHandItemId` (los escudos ocupan la mano no dominante) ni un slot de "objeto consumible equipado".
- `packages/shared/src/data/creatures.json`: muestra de uso real confirmada por búsqueda directa — `mainHandItemId` referencia `longbow`, `greatsword`, `dagger`; `offHandItemId` referencia `buckler`; `armorItemId` referencia `studded_leather`, `full_plate`, `chain_shirt`. Todos los IDs usados en la muestra ya existen en los catálogos de armas/armaduras/escudos auditados abajo.

**Clasificación por slot** (según el criterio del encargo):

| Slot | Tipo de ítem que ocupa |
|---|---|
| `mainHand` | Armas de una o dos manos, a distancia o cuerpo a cuerpo. |
| `offHand` | Arma secundaria (pericia con dos armas), escudo, o vacío. |
| `armor` | Armadura corporal (ligera/media/pesada). |
| `inventory` | Cualquier ítem no equipado activamente — en este motor, solo aplica hoy a armas/armaduras/escudos de reserva, ya que no existe catálogo de objetos consumibles. |

**Estado**: `[x]` implementado (presente en los catálogos de `data/equipment/` y accesible vía `EquipmentCatalog`) · `[ ]` no implementado.

---

## A. Armas Sencillas (Simple Weapons) — `weapons.simple.ts`

| Estado | Arma (ES / EN) | Slot | Notas |
|---|---|---|---|
| [x] | Guantelete / Gauntlet | mainHand | `gauntlet`. |
| [x] | Golpe Desarmado / Unarmed Strike | mainHand | `unarmed_strike`. |
| [x] | Daga / Dagger | mainHand (o arrojadiza) | `dagger`. |
| [x] | Guantelete con Púas / Spiked Gauntlet | mainHand | `spiked_gauntlet`. |
| [x] | Hoz / Sickle | mainHand | `sickle`. |
| [x] | Maza Ligera / Light Mace | mainHand | `light_mace`. |
| [x] | Daga de Puño / Punching Dagger | mainHand | `punching_dagger`. |
| [x] | Porra / Club | mainHand (o arrojadiza) | `club`. |
| [x] | Lucero del Alba / Morningstar | mainHand | `morningstar`. |
| [x] | Maza Pesada / Heavy Mace | mainHand | `heavy_mace`. |
| [x] | Lanza Corta / Shortspear | mainHand (o arrojadiza) | `shortspear`. |
| [x] | Bastón de Combate / Quarterstaff | mainHand (dos manos) | `quarterstaff`. |
| [x] | Lanza / Spear | mainHand (dos manos) | `spear`. |
| [x] | Pica Larga / Longspear | mainHand (dos manos, alcance) | `longspear`. |
| [x] | Ballesta Ligera / Light Crossbow | mainHand (dos manos, a distancia) | `light_crossbow` + munición `crossbow_bolts_10`. |
| [x] | Ballesta Pesada / Heavy Crossbow | mainHand (dos manos, a distancia) | `heavy_crossbow`. |
| [x] | Dardo / Dart | mainHand (arrojadiza) | `dart`. |
| [x] | Honda / Sling | mainHand (a distancia) | `sling` + munición `sling_bullets_10`. |
| [x] | Jabalina / Javelin | mainHand (arrojadiza) | `javelin`. |

**Cobertura**: 19/19 armas sencillas del PHB 3.5 presentes.

---

## B. Armas Marciales (Martial Weapons) — `weapons.martial.ts`

| Estado | Arma (ES / EN) | Slot | Notas |
|---|---|---|---|
| [x] | Púas de Armadura / Armor Spikes | mainHand (secundaria) | `armor_spikes`. |
| [x] | Cachiporra / Sap | mainHand | `sap`. |
| [x] | Golpe con Escudo Ligero / Light Shield Bash | offHand (arma) | `light_shield_bash`. |
| [x] | Golpe con Escudo Ligero con Púas / Light Spiked Shield Bash | offHand (arma) | `light_spiked_shield_bash`. |
| [x] | Espada Corta / Short Sword | mainHand | `short_sword`. |
| [x] | Hacha Arrojadiza / Throwing Axe | mainHand (arrojadiza) | `throwing_axe`. |
| [x] | Hacha de Mano / Handaxe | mainHand | `handaxe`. |
| [x] | Kukri | mainHand | `kukri`. |
| [x] | Martillo Ligero / Light Hammer | mainHand (arrojadiza) | `light_hammer`. |
| [x] | Pico Ligero / Light Pick | mainHand | `light_pick`. |
| [x] | Cimitarra / Scimitar | mainHand | `scimitar`. |
| [x] | Golpe con Escudo Pesado / Heavy Shield Bash | offHand (arma) | `heavy_shield_bash`. |
| [x] | Golpe con Escudo Pesado con Púas / Heavy Spiked Shield Bash | offHand (arma) | `heavy_spiked_shield_bash`. |
| [x] | Espada Larga / Longsword | mainHand | `longsword`. |
| [x] | Estoque / Rapier | mainHand | `rapier`. |
| [x] | Hacha de Batalla / Battleaxe | mainHand | `battleaxe`. |
| [x] | Mangual / Flail | mainHand | `flail`. |
| [x] | Martillo de Guerra / Warhammer | mainHand | `warhammer`. |
| [x] | Pico Pesado / Heavy Pick | mainHand | `heavy_pick`. |
| [x] | Tridente / Trident | mainHand (arrojadiza) | `trident`. |
| [x] | Alabarda / Halberd | mainHand (dos manos, alcance) | `halberd`. |
| [x] | Espada Ancha / Falchion | mainHand (dos manos) | `falchion`. |
| [x] | Guadaña / Scythe | mainHand (dos manos) | `scythe`. |
| [x] | Guja / Glaive | mainHand (dos manos, alcance) | `glaive`. |
| [x] | Guisarma / Guisarme | mainHand (dos manos, alcance) | `guisarme`. |
| [x] | Maza Grande / Greatclub | mainHand (dos manos) | `greatclub`. |
| [x] | Hacha Grande / Greataxe | mainHand (dos manos) | `greataxe`. |
| [x] | Espadón / Greatsword | mainHand (dos manos) | `greatsword`. |
| [x] | Lanza de Caballería / Lance | mainHand (montada, dos manos) | `lance`. |
| [x] | Mangual Pesado / Heavy Flail | mainHand (dos manos) | `heavy_flail`. |
| [x] | Ranseur | mainHand (dos manos, alcance) | `ranseur`. |
| [x] | Arco Corto / Shortbow | mainHand (dos manos, a distancia) | `shortbow` + munición `arrows_20`. |
| [x] | Arco Corto Compuesto / Composite Shortbow | mainHand (dos manos, a distancia) | `composite_shortbow`. |
| [x] | Arco Largo / Longbow | mainHand (dos manos, a distancia) | `longbow`. |
| [x] | Arco Largo Compuesto / Composite Longbow | mainHand (dos manos, a distancia) | `composite_longbow`. |

**Cobertura**: 34/34 armas marciales del PHB 3.5 presentes.

---

## C. Armas Exóticas (Exotic Weapons) — `weapons.exotic.ts`

| Estado | Arma (ES / EN) | Slot | Notas |
|---|---|---|---|
| [x] | Kama | mainHand | `kama`. |
| [x] | Nunchaku | mainHand | `nunchaku`. |
| [x] | Sai | mainHand | `sai`. |
| [x] | Siangham | mainHand | `siangham`. |
| [x] | Espada Bastarda / Bastard Sword | mainHand (una o dos manos) | `bastard_sword`. |
| [x] | Hacha Arrojadiza Enana / Dwarven Waraxe | mainHand (una o dos manos) | `dwarven_waraxe`. |
| [x] | Látigo / Whip | mainHand (alcance sin daño letal por defecto) | `whip`. |
| [x] | Cadena con Púas / Spiked Chain | mainHand (dos manos, alcance) | `spiked_chain`. |
| [x] | Espada de Doble Filo / Two-Bladed Sword | mainHand (dos manos, doble arma) | `two_bladed_sword`. |
| [x] | Hacha Doble Orca / Orc Double Axe | mainHand (dos manos, doble arma) | `orc_double_axe`. |
| [x] | Mangual Terrible / Dire Flail | mainHand (dos manos, doble arma) | `dire_flail`. |
| [x] | Martillo Ganchudo Gnomo / Gnome Hooked Hammer | mainHand (dos manos, doble arma) | `gnome_hooked_hammer`. |
| [x] | Urgrosh Enano / Dwarven Urgrosh | mainHand (dos manos, doble arma) | `dwarven_urgrosh`. |
| [x] | Ballesta de Mano / Hand Crossbow | mainHand (a distancia) | `hand_crossbow`. |
| [x] | Ballesta Ligera Repetidora / Repeating Light Crossbow | mainHand (dos manos, a distancia) | `repeating_light_crossbow`. |
| [x] | Ballesta Pesada Repetidora / Repeating Heavy Crossbow | mainHand (dos manos, a distancia) | `repeating_heavy_crossbow` + munición `repeating_crossbow_bolts_5`. |
| [x] | Bolas | mainHand (arrojadiza) | `bolas`. |
| [x] | Red / Net | mainHand (arrojadiza) | `net`. |
| [x] | Shuriken | mainHand (arrojadiza) | `shuriken_5`. |

**Cobertura**: 19/19 armas exóticas del PHB 3.5 presentes (incluye las dos entradas de munición dedicada listadas junto a su arma anfitriona).

---

## D. Armaduras — `armors.ts`

| Estado | Armadura (ES / EN) | Categoría | Slot | Notas |
|---|---|---|---|---|
| [x] | Acolchada / Padded | Ligera | armor | `padded`. |
| [x] | De Cuero / Leather | Ligera | armor | `leather`. |
| [x] | De Cuero Tachonado / Studded Leather | Ligera | armor | `studded_leather` — confirmada en uso real en `creatures.json` (`elaen`). |
| [x] | Camisa de Malla / Chain Shirt | Ligera | armor | `chain_shirt` — confirmada en uso real en `creatures.json` (`bane`). |
| [x] | De Piel / Hide | Media | armor | `hide`. |
| [x] | De Escamas / Scale Mail | Media | armor | `scale_mail`. |
| [x] | Cota de Malla / Chainmail | Media | armor | `chainmail`. |
| [x] | Coraza / Breastplate | Media | armor | `breastplate`. |
| [x] | Malla Astillada / Splint Mail | Pesada | armor | `splint_mail`. |
| [x] | Malla Bandeada / Banded Mail | Pesada | armor | `banded_mail`. |
| [x] | Media Placa / Half-Plate | Pesada | armor | `half_plate`. |
| [x] | Placa Completa / Full Plate | Pesada | armor | `full_plate` — confirmada en uso real en `creatures.json` (`cedrick`). |

**Cobertura**: 12/12 armaduras corporales del PHB 3.5 presentes (4 ligeras, 4 medias, 4 pesadas).

---

## E. Escudos y Accesorios de Escudo — `shields.ts`

| Estado | Escudo/Accesorio (ES / EN) | Slot | Notas |
|---|---|---|---|
| [x] | Brocal / Buckler | offHand | `buckler` — confirmada en uso real en `creatures.json` (`bane`). |
| [x] | Escudo Ligero de Madera / Light Wooden Shield | offHand | `light_wooden_shield`. |
| [x] | Escudo Ligero de Acero / Light Steel Shield | offHand | `light_steel_shield`. |
| [x] | Escudo Pesado de Madera / Heavy Wooden Shield | offHand | `heavy_wooden_shield`. |
| [x] | Escudo Pesado de Acero / Heavy Steel Shield | offHand | `heavy_steel_shield`. |
| [x] | Escudo Torre / Tower Shield | offHand | `tower_shield`. |
| [x] | Guantelete Cerrado / Locked Gauntlet | offHand (accesorio) | `locked_gauntlet`. |
| [x] | Púas de Escudo (accesorio) / Shield Spikes | offHand (modificador de arma) | `shield_spikes_accessory`. |
| [x] | Púas de Armadura (accesorio, referencia cruzada con Sección B) / Armor Spikes | armor (modificador) | `armor_spikes_accessory`. |

**Cobertura**: 6/6 escudos base + 3/3 accesorios de escudo/armadura del PHB 3.5 presentes.

---

## F. Objetos Consumibles y Bienes de Aventura (Tablas 7-7 y 7-8 del PHB) — **sin cobertura**

El capítulo de Equipo del Manual del Jugador 3.5 incluye, además de armas/armaduras/escudos, una tabla de "Bienes de Aventurero" (Adventuring Gear) y una tabla de "Sustancias y Objetos Especiales" (Special Substances and Items) con aplicación directa en combate táctico (venenos de contacto, bombas de alquimista, trampas portátiles, etc.). **Ninguna de estas entradas existe en el motor**: la búsqueda exhaustiva confirmó que no hay ningún archivo de catálogo de consumibles bajo `packages/shared/src/data/equipment/`, y `EquipmentCatalogItem` solo admite `"weapon" | "armor" | "shield"` — no existe una cuarta variante `"consumable"` ni un slot de inventario diferenciado para objetos de un solo uso.

| Estado | Objeto (ES / EN) | Uso táctico en combate | Notas |
|---|---|---|---|
| [ ] | Ácido (frasco) / Acid | Arma arrojadiza de daño (1d6 ácido) | Sin entrada en ningún catálogo. |
| [ ] | Fuego de Alquimista / Alchemist's Fire | Arma arrojadiza de daño continuado (1d6 + 1d6 por 1 asalto) | Sin entrada. |
| [ ] | Antitóxico / Antitoxin | Bono a salvación contra veneno, consumible reactivo | Sin entrada. |
| [ ] | Antorcha Perpetua / Everburning Torch | Fuente de luz permanente, relevante para reglas de visión no modeladas | Sin entrada. |
| [ ] | Agua Bendita / Holy Water | Arma arrojadiza contra no-muertos/extraplanares malignos (2d4) | Sin entrada. |
| [ ] | Barra de Sol / Sunrod | Fuente de luz de combate, sin daño | Sin entrada. |
| [ ] | Bolsa Enredadora / Tanglefoot Bag | Inmoviliza al objetivo (interactúa con el trait `IMMOBILIZED`, ya modelado para otros orígenes, pero sin objeto que lo produzca) | Sin entrada. |
| [ ] | Piedra del Trueno / Thunderstone | Aturde en área por sonido (interactúa con el mecanismo de aturdido ya existente, `srd_stunned`, pero sin objeto que lo produzca) | Sin entrada. |
| [ ] | Varilla Encendedora / Tindertwig | Utilidad de encendido rápido, sin impacto directo en resolución de combate | Sin entrada. |
| [ ] | Vara Inamovible / Immovable Rod | Utilidad de anclaje, uso táctico ocasional como plataforma/bloqueo | Sin entrada. |
| [ ] | Abrojos / Caltrops | Terreno de área que daña e inmoviliza brevemente al pisarlos, sin tirada de ataque | Interactúa con el sistema de peligros ambientales por celdas (`EnvironmentalHazard`, ya usado por `srd_wall_of_fire_hazard`/`srd_poison_gas_hazard`) pero no existe una entrada de catálogo de objeto equipable/arrojable que lo coloque. |
| [ ] | Antorcha / Torch | Fuente de luz básica, relevante solo si se modela iluminación | Sin entrada; impacto de combate mínimo. |
| [ ] | Poción (genérica, cualquier efecto) / Potion | Consumible de un uso que aplica un `Ability`/`EffectDefinition` sobre el propio combatiente | Sin sistema de pociones; el `Ability`/hechizo debería poder activarse desde un ítem de inventario, mecanismo no existente. Bloquea también las dotes `Brew Potion`/`Scribe Scroll` del `FEATS_CHECKLIST.md`. |
| [ ] | Pergamino (genérico, cualquier conjuro) / Scroll | Consumible de un uso que activa un `SpellDefinition` sin necesidad de prepararlo | Mismo bloqueo estructural que Poción. |

**Cobertura**: 0/14 objetos consumibles/bienes de aventura de aplicación combativa auditados. Esta es la brecha de cobertura más amplia y estructural del motor respecto al PHB 3.5: no falta un ítem puntual, falta el tipo de dato completo (`EquipmentCatalogItem` de variante `"consumable"`) y su slot de uso (activación desde `inventory` sin pasar por `mainHand`/`offHand`/`armor`).

---

## Resumen de cobertura

- **Armas**: 19 (sencillas) + 34 (marciales) + 19 (exóticas) = **72/72 implementadas**.
- **Armaduras**: **12/12 implementadas**.
- **Escudos y accesorios**: **9/9 implementados**.
- **Total de ítems equipables (armas + armaduras + escudos) del PHB 3.5**: **93/93 implementados** — cobertura completa confirmada por lectura íntegra de los cinco archivos fuente.
- **Objetos consumibles y bienes de aventura de aplicación combativa**: **0/14 implementados** — categoría completa sin cobertura, con causa raíz arquitectónica identificada (`EquipmentCatalogItem` no tiene variante de consumible).
- **Verificación cruzada con `creatures.json`**: los tres slots de equipo (`mainHandItemId`, `offHandItemId`, `armorItemId`) usados en la muestra real de datos referencian exclusivamente IDs ya presentes en los catálogos auditados (`longbow`, `greatsword`, `dagger`, `buckler`, `studded_leather`, `full_plate`, `chain_shirt`) — no se detectó ningún ID de creatura apuntando a un ítem inexistente en el catálogo.
