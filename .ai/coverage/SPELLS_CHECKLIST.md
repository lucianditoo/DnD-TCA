# SPELLS_CHECKLIST — Cobertura de Conjuros (Manual del Jugador 3.5)

**Tipo de documento**: Auditoría analítica de cobertura para la Versión 1.0. No es una NDD ni un plan de implementación. No autoriza ningún cambio de código por sí mismo.

**Alcance y límite explícito** (siguiendo la disciplina del proyecto de declarar "qué no resuelve" un documento): este checklist cubre conjuros de nivel 0 a 9 con **aplicación directa en un encuentro de combate táctico por celdas** — daño, control de acción/movimiento, defensa activa, curación en combate y reposicionamiento. Quedan fuera, por no tener ningún efecto verificable en un motor de combate por celdas, los conjuros puramente de: conocimiento/adivinación pasiva (ej. *Detectar Magia*, *Identificar*), viaje/planificación fuera de combate (ej. *Puerta Dimensional* se incluye por su uso táctico de reposicionamiento, pero *Plano Cambiante* no), interacción social/ilusión no ofensiva (ej. *Sonido Fantasma*), y utilidad doméstica (ej. *Remendar*, *Mano de Mago*). Esta exclusión es la misma que aplica el propio enunciado del encargo ("aplicables a encuentros de combate táctico"), no una omisión.

**Clasificación por pipeline del servidor**, mapeada a `resolution.kind` de `SpellDefinition` (`packages/shared/src/spells/catalog.ts`):

| Categoría solicitada | `resolution.kind` correspondiente | Descripción |
|---|---|---|
| Toque / Rayo-Toque AC | `"attack-roll"` | Se resuelve con una tirada de ataque (cuerpo a cuerpo o a distancia) contra la AC del objetivo, como cualquier ataque con arma. |
| Efecto / Anula-o-Salva | `"effect"` | No hay tirada de ataque; se aplica una condición (`EffectDefinition`) y el objetivo intenta una salvación para anularla o reducirla. |
| Área Ráfaga / Cono / Línea | `"automatic-damage"` (con `target` de tipo área) | Daño automático sin tirada de ataque, con salvación por mitad de daño, proyectado sobre una plantilla geométrica (`target: "burst" \| "cone" \| "line"`). |
| *(cuarta categoría, no solicitada explícitamente pero presente en el motor)* | `"automatic-damage"` (con `target` de un único objetivo) | Daño automático sin tirada de ataque y sin salvación (ej. *Proyectil Mágico*). Se marca en notas como "Daño Automático Directo" para no confundirlo con el área. |
| Curación | `"healing"` | Restaura puntos de golpe; no tiene equivalente exacto en las tres categorías pedidas, se añade como columna propia. |

**Estado**: `[x]` implementado y verificado en `spells/catalog.ts` · `[ ]` no implementado.

---

## Nivel 0 (Trucos / Orisons)

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [x] | Rayo de Escarcha / Ray of Frost | Evocación [Frío] | Mago/Hechicero | Toque/Rayo-Toque AC | `srd_ray_of_frost`, 1d3 frío, `attack-roll` de toque a distancia. |
| [ ] | Salpicadura Ácida / Acid Splash | Conjuración [Ácido] | Mago/Hechicero | Toque/Rayo-Toque AC | Proyectil ácido de toque a distancia, 1d3. |
| [ ] | Aturdir / Daze | Encantamiento (Compulsión) [Mental] | Mago/Hechicero | Efecto/Anula-o-Salva | Anula la siguiente acción del objetivo si falla Voluntad. |
| [ ] | Repeler Muertos Vivientes / Disrupt Undead | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Rayo de toque a distancia, 1d6 solo contra no-muertos. |
| [ ] | Destello / Flare | Evocación | Mago/Hechicero | Efecto/Anula-o-Salva | Deslumbra brevemente si falla Reflejos. |
| [ ] | Fatiga / Touch of Fatigue | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo que inflige fatiga si falla Fortaleza; combina ataque de toque + salvación. |
| [ ] | Resistencia / Resistance | Abjuración | Clérigo, Mago/Hechicero, Druida | *(buff, sin pipeline de ataque)* | +1 a una salvación; no encaja en ninguna de las tres categorías, sería un modificador estático de buff temporal. |
| [ ] | Curar Heridas Leves (menor) / Cure Minor Wounds | Conjuración (Curación) | Clérigo, Druida | Curación | 1 PG fijo. |
| [ ] | Infligir Heridas Leves (menor) / Inflict Minor Wounds | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, 1 punto de daño fijo, sin salvación. |
| [ ] | Orientación / Guidance | Adivinación | Clérigo, Druida | *(buff, sin pipeline de ataque)* | +1 a una tirada de habilidad/ataque/salvación puntual. |
| [ ] | Virtud / Virtue | Transmutación | Clérigo | *(buff, sin pipeline de ataque)* | +1 punto de golpe temporal. |

---

## Nivel 1

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [x] | Proyectil Mágico / Magic Missile | Evocación [Fuerza] | Mago/Hechicero | Daño Automático Directo | `srd_magic_missile`, 1d4+1, `automatic-damage` sin salvación ni tirada de ataque. |
| [x] | Toque Impactante / Shocking Grasp | Evocación [Electricidad] | Mago/Hechicero | Toque/Rayo-Toque AC | `srd_shocking_grasp`, 1d6, `attack-roll` de toque cuerpo a cuerpo. |
| [x] | Manos Ardientes / Burning Hands | Evocación [Fuego] | Mago/Hechicero | Área Ráfaga/Cono/Línea | `srd_burning_hands`, cono de 15 ft, 1d4, Reflejos mitad. |
| [x] | Curar Heridas Leves / Cure Light Wounds | Conjuración (Curación) | Clérigo, Druida, Paladín | Curación | `srd_cure_light_wounds`, 1d8+1. |
| [ ] | Infligir Heridas Leves / Inflict Light Wounds | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque, 1d8+1, daño directo sin salvación contra vivos. |
| [ ] | Armadura de Mago / Mage Armor | Conjuración | Mago/Hechicero | *(buff, sin pipeline de ataque)* | +4 AC de fuerza de campo; modificador estático. |
| [ ] | Escudo / Shield | Abjuración | Mago/Hechicero | *(buff, sin pipeline de ataque)* | +4 AC y anula proyectiles mágicos; modificador estático + regla especial. |
| [ ] | Verdadero Golpe / True Strike | Adivinación | Mago/Hechicero | *(buff, sin pipeline de ataque)* | +20 a la siguiente tirada de ataque; modificador estático puntual. |
| [ ] | Debilitar / Ray of Enfeeblement | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Rayo de toque a distancia + penalizador de Fuerza (combina ataque de toque con efecto). |
| [ ] | Rociada de Color / Color Spray | Ilusión | Mago/Hechicero | Área Ráfaga/Cono/Línea | Cono de 15 ft, aturde/ciega/deja inconsciente según DG, sin salvación bajo cierto umbral. |
| [ ] | Sueño / Sleep | Encantamiento (Compulsión) [Mental] | Mago/Hechicero | Efecto/Anula-o-Salva | Área (radio 10 ft) de criaturas afectadas por DG, Voluntad niega. |
| [ ] | Grasa / Grease | Conjuración | Mago/Hechicero | Efecto/Anula-o-Salva | Terreno resbaladizo en un área; combina con reglas de terreno difícil no modeladas para conjuros. |
| [ ] | Agrandar Persona / Enlarge Person | Transmutación | Mago/Hechicero | *(buff, sin pipeline de ataque)* | Aumenta tamaño (+Fuerza/-Destreza); modificador estático compuesto. |
| [ ] | Reducir Persona / Reduce Person | Transmutación | Mago/Hechicero | *(buff, sin pipeline de ataque)* | Inverso de la anterior. |
| [ ] | Toque Frío / Chill Touch | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, 1d6 + penalización de Fuerza a no-muertos, o daño negativo. |
| [ ] | Protección contra el Mal / Protection from Evil | Abjuración [Bien] | Clérigo, Mago/Hechicero | *(buff, sin pipeline de ataque)* | +2 AC/salvaciones y bloqueo de control mental de criaturas malignas. |
| [ ] | Retirada Veloz / Expeditious Retreat | Transmutación | Mago/Hechicero | *(buff, sin pipeline de ataque)* | +30 ft de velocidad; modificador estático de movimiento. |
| [ ] | Caída de Pluma / Feather Fall | Transmutación | Mago/Hechicero | Efecto/Anula-o-Salva | Anula daño por caída del objetivo; efecto reactivo, sin salvación (activación automática). |
| [ ] | Niebla Cegadora / Obscuring Mist | Conjuración [Agua] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Nube de ocultación total en radio 20 ft; geometría de área sin daño (variante del pipeline de área). |
| [ ] | Enredar / Entangle | Transmutación | Druida | Área Ráfaga/Cono/Línea | Área que inmoviliza vegetación mágica; Reflejos para evitar quedar enredado. |
| [ ] | Bendición / Bless | Encantamiento (Compulsión) [Mental] | Clérigo | *(buff de área, sin pipeline de ataque)* | +1 ataque/salvaciones contra el miedo a los aliados en área. |
| [ ] | Perdición / Doom | Nigromancia [Miedo, Mental] | Clérigo | Efecto/Anula-o-Salva | Penaliza ataque/daño/salvaciones/habilidad del objetivo, Voluntad niega. |
| [ ] | Orden / Command | Encantamiento (Compulsión) [Mental, Sónico] | Clérigo | Efecto/Anula-o-Salva | Obliga una palabra de mando (caer, huir, soltar, detenerse, arrodillarse), Voluntad niega. |
| [ ] | Favor Divino / Divine Favor | Adivinación | Clérigo, Paladín | *(buff, sin pipeline de ataque)* | Bono de ataque/daño escalado por nivel; modificador estático. |
| [ ] | Arma Mágica / Magic Weapon | Transmutación | Clérigo | *(buff, sin pipeline de ataque)* | +1 a la tirada de ataque/daño de un arma. |
| [ ] | Escudo de la Fe / Shield of Faith | Abjuración | Clérigo | *(buff, sin pipeline de ataque)* | Bono de desviación a la AC, escalado por nivel. |
| [ ] | Santuario / Sanctuary | Abjuración | Clérigo | Efecto/Anula-o-Salva | Los atacantes deben superar Voluntad para atacar al objetivo protegido. |
| [ ] | Causar Miedo / Cause Fear | Nigromancia [Miedo, Mental] | Clérigo | Efecto/Anula-o-Salva | Provoca huida si falla Voluntad (o aturde a DG bajo). |
| [ ] | Anatema / Bane | Encantamiento (Compulsión) [Mental] | Clérigo | Efecto/Anula-o-Salva | Penaliza ataque y salvaciones contra el miedo en área enemiga, Voluntad niega parcialmente. |

---

## Nivel 2

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Rayo Abrasador / Scorching Ray | Evocación [Fuego] | Mago/Hechicero | Toque/Rayo-Toque AC | Uno o más rayos de toque a distancia, 4d6 cada uno. |
| [ ] | Flecha Ácida de Melf / Melf's Acid Arrow | Conjuración [Ácido] | Mago/Hechicero | Toque/Rayo-Toque AC | Rayo de toque a distancia con daño continuado en rondas siguientes. |
| [ ] | Telaraña / Web | Conjuración | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que atrapa e inmoviliza, Reflejos para evitar quedar enredado. |
| [ ] | Polvo Deslumbrante / Glitterdust | Conjuración | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que ciega (Reflejos niega ceguera) y revela invisibles. |
| [ ] | Ceguera/Sordera / Blindness/Deafness | Nigromancia | Mago/Hechicero, Clérigo | Efecto/Anula-o-Salva | Toque o rayo a distancia, Fortaleza niega. |
| [ ] | Imagen Especular / Mirror Image | Ilusión | Mago/Hechicero | *(buff defensivo, sin pipeline de ataque)* | Genera duplicados que absorben ataques; modificador de flujo táctico (probabilidad de desviar impacto). |
| [ ] | Invisibilidad / Invisibility | Ilusión | Mago/Hechicero | *(buff, sin pipeline de ataque)* | Otorga el trait de invisibilidad; interactúa con reglas de ataque furtivo/objetivo no visto no modeladas. |
| [ ] | Espantar / Scare | Nigromancia [Miedo, Mental] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que provoca huida, Voluntad niega. |
| [ ] | Nube de Niebla / Fog Cloud | Conjuración | Mago/Hechicero, Druida | Área Ráfaga/Cono/Línea | Niebla de ocultación en radio 20 ft, sin salvación (ocultación pasiva). |
| [ ] | Curar Heridas Moderadas / Cure Moderate Wounds | Conjuración (Curación) | Clérigo, Druida | Curación | 2d8+nivel (máx. +10). |
| [ ] | Infligir Heridas Moderadas / Inflict Moderate Wounds | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque, 2d8+nivel, sin salvación contra vivos. |
| [x] | Aferrar Persona / Hold Person | Encantamiento (Compulsión) [Mental] | Clérigo, Mago/Hechicero, Bardo | Efecto/Anula-o-Salva | `srd_hold_person` en `spells/catalog.ts`, resolución completa (`effect` → `srd_paralyzed`, Voluntad niega). **Discrepancia de nivel detectada**: el PHB 3.5 físico registra este conjuro como **nivel 2** en las cuatro listas citadas; el catálogo lo registra como `level: 3`. Se marca `[x]` implementado (el conjuro sí resuelve mecánicamente) y se señala la discrepancia de nivel como hallazgo de auditoría — ver sección de Hallazgos al final del documento. |
| [ ] | Oscuridad / Darkness | Evocación [Oscuridad] | Clérigo, Mago/Hechicero | *(control de entorno, sin pipeline de ataque)* | Reduce luz en área; sin modelado de niveles de luz/visión en el motor. |
| [ ] | Enjambre Convocado / Summon Swarm | Conjuración | Mago/Hechicero, Druida | *(invocación, fuera de pipeline directo)* | Requiere sistema de invocación de criaturas, no modelado. |
| [ ] | Restaurar Menor / Lesser Restoration | Conjuración (Curación) | Clérigo, Druida, Paladín | Curación | Revierte penalización de característica temporal y fatiga/cansancio; variante de curación no numérica. |
| [ ] | Escudo de Sonido / Silence | Ilusión | Clérigo, Bardo | *(control de área, sin pipeline de ataque)* | Anula sonido en área; sin modelado de componentes verbales, ver `SILENT SPELL` en dotes. |
| [ ] | Arma Espiritual / Spiritual Weapon | Adivinación [Fuerza] | Clérigo | Toque/Rayo-Toque AC | Arma invocada que ataca como un combatiente independiente; requiere una entidad-arma autónoma no modelada. |

---

## Nivel 3

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [x] | Bola de Fuego / Fireball | Evocación [Fuego] | Mago/Hechicero | Área Ráfaga/Cono/Línea | `srd_fireball`, ráfaga radio 20 ft, 5d6, Reflejos mitad. |
| [x] | Rayo Relampagueante / Lightning Bolt | Evocación [Electricidad] | Mago/Hechicero | Área Ráfaga/Cono/Línea | `srd_lightning_bolt`, línea 120 ft × 5 ft, 5d6, Reflejos mitad. |
| [x] | Prisa / Haste | Transmutación | Mago/Hechicero | Efecto/Anula-o-Salva *(sin salvación; ver nota)* | `srd_haste`, `resolution.effectId: "srd_haste"` — **referencia colgante confirmada**: no existe entrada `srd_haste` en `effects/catalog.ts`; el buff real de Prisa se aplica hoy mediante un `Buff` legado hardcodeado en `apps/server/src/combat/abilityResolver.ts` (líneas 24-28), fuera del sistema `ActiveEffects`. Documentado y aceptado como deuda en el NDD del Sprint 038 (`docs/designs/full-attack-v2-haste-rapid-shot-design.md`); se marca `[x]` porque el conjuro **sí resuelve** mecánicamente en combate, aunque por una vía distinta a la declarada en su propio `resolution`. |
| [ ] | Lentitud / Slow | Transmutación | Mago/Hechicero | Efecto/Anula-o-Salva | Contraparte directa de Prisa; reduce ataques/velocidad/AC, Voluntad niega. |
| [ ] | Volar / Fly | Transmutación | Mago/Hechicero | *(buff, sin pipeline de ataque)* | Otorga vuelo; sin modelado de movimiento vertical/aéreo en el tablero de celdas. |
| [ ] | Nube Fétida / Stinking Cloud | Conjuración [Veneno] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que náusea, Fortaleza niega por asalto. |
| [ ] | Toque Vampírico / Vampiric Touch | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, drena PG y los transfiere al lanzador. |
| [ ] | Sopor Profundo / Deep Slumber | Encantamiento (Compulsión) [Mental] | Mago/Hechicero, Bardo | Efecto/Anula-o-Salva | Versión de área ampliada de *Sueño*, Voluntad niega. |
| [ ] | Desplazamiento / Displacement | Ilusión | Mago/Hechicero | *(buff defensivo, sin pipeline de ataque)* | 50% de probabilidad de fallo de ataque contra el objetivo; modificador de flujo táctico. |
| [ ] | Sugestión / Suggestion | Encantamiento (Compulsión) [Mental, Lingüístico] | Mago/Hechicero, Bardo | Efecto/Anula-o-Salva | Obliga un curso de acción razonable, Voluntad niega. |
| [ ] | Detener Muertos Vivientes / Halt Undead | Nigromancia | Mago/Hechicero | Efecto/Anula-o-Salva | Paraliza no-muertos, Voluntad niega. |
| [ ] | Curar Heridas Graves / Cure Serious Wounds | Conjuración (Curación) | Clérigo, Druida | Curación | 3d8+nivel (máx. +15). No implementado; única curación presente en el catálogo es *Curar Heridas Leves* (nivel 1). |
| [ ] | Infligir Heridas Graves / Inflict Serious Wounds | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque, 3d8+nivel, sin salvación contra vivos. |
| [ ] | Oración / Prayer | Encantamiento (Compulsión) [Mental] | Clérigo | *(buff/debuff de área, sin pipeline de ataque)* | +1 a tiradas de aliados y -1 a enemigos en área. |
| [ ] | Círculo Mágico contra el Mal / Magic Circle against Evil | Abjuración [Bien] | Clérigo | *(buff, sin pipeline de ataque)* | Versión de área de *Protección contra el Mal*. |
| [ ] | Luz Cegadora / Searing Light | Evocación [Fuego] | Clérigo | Toque/Rayo-Toque AC | Rayo de toque a distancia, daño escalado por nivel (mayor contra no-muertos). |
| [ ] | Imponer Maldición / Bestow Curse | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo que impone una penalización permanente hasta ser removida. |
| [ ] | Disipar Magia / Dispel Magic | Abjuración | Clérigo, Mago/Hechicero | *(contrarresto de efectos, sin pipeline propio)* | Requiere un sistema de resolución de contrarresto contra efectos activos (`ActiveEffects`), no modelado. |
| [ ] | Protección contra la Energía / Protection from Energy | Abjuración | Clérigo, Mago/Hechicero, Druida | *(buff, sin pipeline de ataque)* | Absorbe un tipo de daño elemental hasta un total de puntos. |

---

## Nivel 4

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Tormenta de Hielo / Ice Storm | Evocación [Frío] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Ráfaga de granizo, daño contundente + frío sin salvación en el primer asalto. |
| [x] | Muro de Fuego / Wall of Fire *(ver nota de mecanismo)* | Evocación [Fuego] | Mago/Hechicero, Druida | Área Ráfaga/Cono/Línea *(como peligro ambiental)* | Existe `srd_wall_of_fire_hazard` en `effects/catalog.ts` como `EnvironmentalHazard` anclado a celdas (`targetCells`), consumido por la orquestación de peligros del servidor. **No existe una entrada `SpellDefinition` correspondiente en `spells/catalog.ts`** — es decir, el efecto está implementado como peligro de escenario invocable por el DM/servidor, no como un conjuro lanzable con el pipeline estándar de `resolution.kind`. Se marca `[x]` porque el efecto mecánico sí existe en el motor, con la salvedad arquitectónica anotada. |
| [ ] | Debilitación / Enervation | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Rayo de toque a distancia que impone niveles negativos, sin salvación. |
| [ ] | Tentáculos Negros de Evard / Evard's Black Tentacles | Conjuración | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que agarra y daña por asalto; combina con reglas de presa (`GRAPPLING`) no vinculadas a conjuros. |
| [ ] | Confusión / Confusion | Encantamiento (Compulsión) [Mental] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que aleatoriza acciones, Voluntad niega. |
| [ ] | Piel de Piedra / Stoneskin | Abjuración | Mago/Hechicero | *(buff, sin pipeline de ataque)* | Resistencia al daño físico hasta absorber un total de puntos. |
| [ ] | Puerta Dimensional / Dimension Door | Conjuración (Teletransporte) | Mago/Hechicero | *(reposicionamiento táctico, sin pipeline de ataque)* | Teletransporte de corto alcance; interactúa con reglas de movimiento por celdas de forma no lineal, no modelada. |
| [ ] | Escudo de Fuego / Fire Shield | Evocación [Fuego o Frío] | Mago/Hechicero | *(buff + daño reactivo, sin pipeline de ataque directo)* | Daña a quien golpee al lanzador cuerpo a cuerpo; modificador de flujo táctico reactivo. |
| [ ] | Asesino Fantasmal / Phantasmal Killer | Ilusión | Mago/Hechicero | Efecto/Anula-o-Salva | Provoca miedo mortal, doble salvación (Voluntad luego Fortaleza) o muerte. |
| [ ] | Curar Heridas Críticas / Cure Critical Wounds | Conjuración (Curación) | Clérigo, Druida | Curación | 4d8+nivel (máx. +20). |
| [ ] | Infligir Heridas Críticas / Inflict Critical Wounds | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque, 4d8+nivel, sin salvación contra vivos. |
| [ ] | Poder Divino / Divine Power | Transmutación | Clérigo | *(buff, sin pipeline de ataque)* | Bono de ataque/PG temporales y ataques adicionales por BAB alto; **relevante como precedente de diseño para el punto de extensión `AttackRoutineContribution` del Sprint 036/038**. |
| [ ] | Libertad de Movimiento / Freedom of Movement | Abjuración | Clérigo, Bárbaro, Explorador | *(buff, sin pipeline de ataque)* | Inmunidad a inmovilización/parálisis/presa; interactúa con los traits `IMMOBILIZED`/`GRAPPLING`/`PRONE` sin dote/conjuro que los anule actualmente. |
| [ ] | Veneno / Poison | Nigromancia | Clérigo, Druida | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo que inflige veneno con daño de característica en dos fases (Fortaleza). |

---

## Nivel 5

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Cono de Frío / Cone of Cold | Evocación [Frío] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Cono de daño frío escalado, Reflejos mitad. |
| [ ] | Muro de Fuerza / Wall of Force | Evocación [Fuerza] | Mago/Hechicero | *(bloqueo de terreno, sin pipeline de ataque)* | Barrera impenetrable; interactúa con `isImpassable`/geometría de obstáculos, no modelado como conjuro. |
| [ ] | Metamorfosis Maligna / Baleful Polymorph | Transmutación | Mago/Hechicero, Druida | Efecto/Anula-o-Salva | Transforma al objetivo en una forma indefensa, Fortaleza niega. |
| [ ] | Debilitar Mente / Feeblemind | Encantamiento | Mago/Hechicero, Druida | Efecto/Anula-o-Salva | Reduce Inteligencia/Carisma a 1, Voluntad niega. |
| [ ] | Aferrar Monstruo / Hold Monster | Encantamiento (Compulsión) [Mental] | Mago/Hechicero | Efecto/Anula-o-Salva | Versión de *Aferrar Persona* sin restricción de tipo humanoide. |
| [ ] | Teletransporte / Teleport | Conjuración (Teletransporte) | Mago/Hechicero | *(reposicionamiento, sin pipeline de ataque)* | Traslado de largo alcance; fuera del modelo de movimiento por celdas del tablero táctico. |
| [ ] | Expulsión / Dismissal | Conjuración | Mago/Hechicero, Clérigo | Efecto/Anula-o-Salva | Envía a un extraplanar de vuelta a su plano, Voluntad niega. |
| [ ] | Llamarada Divina / Flame Strike | Evocación [Fuego] | Clérigo | Área Ráfaga/Cono/Línea | Columna de fuego, daño mixto (mitad fuego/mitad divino), Reflejos mitad. |
| [ ] | Matar Viviente / Slay Living | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, muerte instantánea o daño masivo si supera Fortaleza. |
| [ ] | Poder Justiciero / Righteous Might | Transmutación | Clérigo | *(buff, sin pipeline de ataque)* | Aumenta tamaño/PG/ataque temporalmente. |

---

## Nivel 6

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Desintegrar / Disintegrate | Transmutación | Mago/Hechicero | Toque/Rayo-Toque AC | Rayo de toque a distancia, daño masivo, Fortaleza para reducir a polvo o mitad de daño. |
| [ ] | Cadena de Relámpagos / Chain Lightning | Evocación [Electricidad] | Mago/Hechicero | Toque/Rayo-Toque AC *(objetivo primario)* + Área *(saltos secundarios)* | Ataque a distancia contra el objetivo primario (sin tirada, Reflejos mitad) que salta a objetivos secundarios; combina pipelines, no modelado. |
| [ ] | Círculo de la Muerte / Circle of Death | Nigromancia | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que mata criaturas de pocos DG sin salvación por debajo del umbral, Fortaleza para las demás. |
| [ ] | Globo de Invulnerabilidad / Globe of Invulnerability | Abjuración | Mago/Hechicero | *(buff defensivo, sin pipeline de ataque)* | Bloquea conjuros de nivel bajo dirigidos al lanzador; requiere un sistema de niveles de conjuro entrante, no modelado. |
| [ ] | Dañar / Harm | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, reduce al objetivo a una fracción mínima de sus PG actuales. |
| [ ] | Sanar / Heal | Conjuración (Curación) | Clérigo, Druida | Curación | Restaura PG hasta un máximo alto y cura varias condiciones negativas simultáneamente. |
| [ ] | Muralla de Cuchillas / Blade Barrier | Evocación [Fuerza] | Clérigo | Área Ráfaga/Cono/Línea | Muro de hojas giratorias, daño a quien lo atraviese, Reflejos mitad. |
| [ ] | Destierro / Banishment | Abjuración | Clérigo | Efecto/Anula-o-Salva | Expulsa criaturas extraplanares del plano actual, Voluntad niega (agravado por objetos afines). |

---

## Nivel 7

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Bola de Fuego Retardada / Delayed Blast Fireball | Evocación [Fuego] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Versión mejorada de *Bola de Fuego* con detonación diferida opcional, Reflejos mitad. |
| [ ] | Rociada Prismática / Prismatic Spray | Evocación | Mago/Hechicero | Área Ráfaga/Cono/Línea | Cono con efectos aleatorios por color (daño, ceguera, muerte, transposición planar); combina múltiples pipelines. |
| [ ] | Dedo de la Muerte / Finger of Death | Nigromancia | Mago/Hechicero | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, muerte instantánea o daño masivo si supera Fortaleza. |
| [ ] | Olas de Agotamiento / Waves of Exhaustion | Nigromancia | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que agota (`EXHAUSTED`) sin salvación. |
| [ ] | Espada de Mordenkainen / Mordenkainen's Sword | Evocación [Fuerza] | Mago/Hechicero | Toque/Rayo-Toque AC | Arma de fuerza invocada que ataca de forma autónoma; requiere entidad-arma independiente no modelada. |
| [ ] | Destrucción / Destruction | Nigromancia | Clérigo | Toque/Rayo-Toque AC | Toque cuerpo a cuerpo, muerte instantánea + destrucción del cuerpo, Fortaleza para daño masivo en su lugar. |
| [ ] | Blasfemia / Blasphemy | Evocación [Mal] | Clérigo | Área Ráfaga/Cono/Línea | Efectos escalonados contra criaturas no afines en área, según diferencia de DG. |
| [ ] | Repulsión / Repulsion | Abjuración | Clérigo, Mago/Hechicero | *(control de área, sin pipeline de ataque)* | Impide la aproximación física al lanzador en un área; interactúa con `validateMovePath`, no modelado. |
| [ ] | Regenerar / Regenerate | Conjuración (Curación) | Clérigo | Curación | Restaura PG masivos y reintegra miembros perdidos. |

---

## Nivel 8

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Rayo Polar / Polar Ray | Evocación [Frío] | Mago/Hechicero | Toque/Rayo-Toque AC | Rayo de toque a distancia, daño de frío masivo + penalización de Fuerza. |
| [ ] | Marchitamiento Horrendo / Horrid Wilting | Nigromancia | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que drena agua/vida de criaturas, daño masivo, Fortaleza mitad. |
| [ ] | Nube Incendiaria / Incendiary Cloud | Conjuración [Fuego] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Nube que se desplaza y quema por asalto, Reflejos mitad cada ronda. |
| [ ] | Palabra de Poder, Aturdir / Power Word Stun | Encantamiento (Compulsión) [Mental] | Mago/Hechicero | Efecto/Anula-o-Salva *(sin salvación, umbral de PG)* | Aturde sin salvación si el objetivo está bajo un umbral de puntos de golpe actuales. |
| [ ] | Tormenta de Fuego / Fire Storm | Evocación [Fuego] | Clérigo, Druida | Área Ráfaga/Cono/Línea | Área masiva de daño de fuego, Reflejos mitad. |
| [ ] | Terremoto / Earthquake | Evocación | Clérigo, Druida | Área Ráfaga/Cono/Línea | Devasta el terreno en área (derriba estructuras, crea grietas); interactúa con el sistema de terreno/obstáculos de forma dinámica, no modelado. |

---

## Nivel 9

| Estado | Conjuro (ES / EN) | Escuela | Lista principal | Pipeline | Notas |
|---|---|---|---|---|---|
| [ ] | Lluvia de Meteoros / Meteor Swarm | Evocación [Fuego] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Cuatro ráfagas de impacto + fuego en distintos puntos, Reflejos mitad por ráfaga. |
| [ ] | Aullido de la Banshee / Wail of the Banshee | Nigromancia [Miedo, Sónico, Muerte] | Mago/Hechicero | Área Ráfaga/Cono/Línea | Área que mata sin salvación si el objetivo falla Fortaleza. |
| [ ] | Palabra de Poder, Matar / Power Word Kill | Nigromancia [Muerte] | Mago/Hechicero | Efecto/Anula-o-Salva *(sin salvación, umbral de PG)* | Muerte instantánea sin salvación si el objetivo está bajo un umbral de puntos de golpe actuales. |
| [ ] | Detener el Tiempo / Time Stop | Transmutación | Mago/Hechicero | *(acciones adicionales, sin pipeline de ataque)* | Concede varios asaltos de acciones libres para el lanzador; requiere un modelo de turnos "fuera de secuencia" no existente. |
| [ ] | Locura / Weird | Ilusión | Mago/Hechicero | Área Ráfaga/Cono/Línea | Versión de área de *Asesino Fantasmal*, doble salvación por objetivo. |
| [ ] | Implosión / Implosion | Evocación | Clérigo | Toque/Rayo-Toque AC *(sin tirada, por contacto sostenido)* | Destruye un objetivo por asalto durante varios asaltos consecutivos, Fortaleza niega. |
| [ ] | Sanación en Masa / Mass Heal | Conjuración (Curación) | Clérigo | Curación | Versión de área de *Sanar* para varios objetivos simultáneos. |
| [ ] | Tormenta de Venganza / Storm of Vengeance | Conjuración [Electricidad, Ácido, Sónico] | Clérigo, Druida | Área Ráfaga/Cono/Línea | Tormenta de área masiva y prolongada con efectos escalonados por asalto. |

---

## Resumen de cobertura

- **Conjuros auditados**: 11 (nivel 0) + 29 (nivel 1) + 17 (nivel 2, descontando filas de referencia cruzada/eliminadas) + 20 (nivel 3, descontando filas de referencia cruzada) + 14 (nivel 4) + 10 (nivel 5) + 8 (nivel 6) + 9 (nivel 7) + 6 (nivel 8) + 8 (nivel 9) ≈ **132 entradas** con aplicación directa en combate táctico, a través de los niveles 0-9 de las listas de Mago/Hechicero y Clérigo (con incorporaciones puntuales de Druida/Bardo cuando el conjuro es un clásico de combate compartido).
- **Implementadas y verificadas en `spells/catalog.ts`**: 6 (`srd_ray_of_frost`, `srd_magic_missile`, `srd_shocking_grasp`, `srd_burning_hands`, `srd_cure_light_wounds`, `srd_fireball`, `srd_lightning_bolt` — **corrección de conteo: son 7**, ver lista exacta en la sección de hallazgos) + 1 con referencia colgante pero mecánicamente activa vía sistema legado (`srd_haste`) + 1 implementada solo como peligro ambiental sin `SpellDefinition` propia (*Muro de Fuego*).
- **No implementadas**: el resto — **123 entradas**.

### Hallazgos de auditoría (solo observación, ningún cambio de código realizado)

1. **`srd_haste` con `resolution.effectId` colgante**: no existe `srd_haste` en `effects/catalog.ts`; el efecto real de Prisa se resuelve mediante un `Buff` legado hardcodeado en `abilityResolver.ts`, no a través del pipeline `"effect"` declarado por el propio conjuro. Documentado ya en el NDD del Sprint 038.
2. **Discrepancia de nivel en `srd_hold_person`**: registrado como nivel 3 en el catálogo; el PHB 3.5 físico lo sitúa en nivel 2 para Clérigo, Mago/Hechicero y Bardo. No se modifica aquí — es una observación para un futuro sprint de corrección de datos con su propia NDD.
3. **Muro de Fuego (`srd_wall_of_fire_hazard`) no tiene contraparte como `SpellDefinition`**: el efecto de daño por celda existe y es invocable como peligro ambiental, pero el conjuro en sí (con coste de lanzamiento, objetivo, `castingTime`, etc.) no está modelado como entrada de `spells/catalog.ts`. Si el motor necesita que un lanzador conjure Muro de Fuego como cualquier otro conjuro (en vez de que el DM/servidor lo coloque directamente como peligro de escenario), sería una brecha real a cerrar en un sprint futuro.
4. **Ausencia total de Disipar Magia / contrarresto**: ningún conjuro de la lista que dependa de interactuar con `ActiveEffects` ya aplicados (disipar, contrahechizo, romper encantamiento) tiene camino de resolución en el motor actual — no hay una operación de "remover efecto activo por conjuro" expuesta.
