# SPELLS_PHB_CHECKLIST — Matriz de Conjuros por Pipeline de Servidor

**Tipo de documento**: Auditoría analítica de cobertura para la V1.0, bajo el marco de `.ai/coverage/V1_LAUNCH_MANIFESTO.md`. No es una NDD ni un plan de implementación. No autoriza ningún cambio de código.

**Nota de relación con `.ai/coverage/SPELLS_CHECKLIST.md`**: mismo universo de conjuros, reclasificado aquí estrictamente por el pipeline de servidor que la instrucción de gobernanza nombra explícitamente (Toques/Rayos, Efecto/Salvación, Áreas de Efecto). El documento previo usaba una cuarta categoría separada para daño automático sin salvación (ej. *Proyectil Mágico*) y otra para curación; aquí se conservan como notas dentro de las tres categorías decretadas, ya que el motor no tiene una categoría de servidor distinta para ellas.

**Alcance**: conjuros de nivel 0 a 9 con efecto directo en un encuentro táctico (daño, control, defensa activa, curación, reposicionamiento), de las listas de Mago/Hechicero y Clérigo primariamente, con incorporaciones puntuales de Druida/Bardo en conjuros clásicos de combate compartidos. Fuera de alcance: conocimiento/adivinación pasiva, viaje/planificación sin uso táctico, ilusión no ofensiva, utilidad doméstica — mismo límite que el documento previo, consistente con "efectos en encuentros tácticos".

**Clasificación por pipeline** (mapeada a `resolution.kind` de `SpellDefinition`, `packages/shared/src/spells/catalog.ts`):

| Categoría decretada | `resolution.kind` / mecanismo | Descripción |
|---|---|---|
| **Toques/Rayos** | `"attack-roll"`, fuerza `AttackContext.targetAcType: "touch"` (`rules.ts:169`) | Tirada de ataque de toque, cuerpo a cuerpo o a distancia, contra la CA de toque del objetivo. Incluye como nota los conjuros de daño automático sin tirada ni salvación (ej. *Proyectil Mágico*), ya que comparten la ausencia de CA normal aunque no tiren ataque. |
| **Efecto/Salvación** | `"effect"` | Aplica una `EffectDefinition`/condición; el objetivo intenta una salvación para negarla o mitigarla. Incluye como nota los conjuros de curación (`"healing"`), que tampoco usan tirada de ataque ni salvación del objetivo. |
| **Áreas de Efecto** | `"automatic-damage"` con `target` de tipo `cone`/`line`/`burst`, proyectado vía `getCellsIntersectedByAoE` (`geometry/aoe.ts:12`) | Daño automático sin tirada de ataque, con salvación de mitad de daño, sobre una plantilla poligonal. |

**Estado**: `[x]` implementado y verificado en `spells/catalog.ts` (o en `effects/catalog.ts` como peligro ambiental invocable) · `[ ]` no implementado.

**Verificación de la cifra decretada**: la instrucción reporta 5 conjuros y peligros ya completados, citando como ejemplos (en el encargo original de cobertura) *Proyectil Mágico*, *Toque Impactante*, *Rayo de Escarcha*, *Curar Heridas Leves* y *Muro de Fuego*. La auditoría de código confirma que esos 5 en efecto están operacionales, pero el catálogo real contiene **más** entradas activas de las que nombra la cifra: 9 `SpellDefinition` completas (`srd_ray_of_frost`, `srd_magic_missile`, `srd_shocking_grasp`, `srd_cure_light_wounds`, `srd_haste`, `srd_hold_person`, `srd_burning_hands`, `srd_lightning_bolt`, `srd_fireball`) más 2 peligros ambientales del Reducer (`srd_wall_of_fire_hazard`, `srd_poison_gas_hazard` en `effects/catalog.ts`) = **11 entradas operacionales**, no 5. Se marcan las 11 con `[x]` abajo, y se anota la diferencia frente a la cifra decretada como hallazgo de auditoría, no como corrección de datos (no se modifica ningún archivo de código).

---

## A. Conjuros y peligros ya implementados (11 entradas operacionales)

| Estado | Conjuro / Peligro (ES / EN) | Nivel | Pipeline | Notas |
|---|---|---|---|---|
| [x] | Rayo de Escarcha / Ray of Frost | 0 | Toques/Rayos | `srd_ray_of_frost`, 1d3 frío, `attack-roll` de toque a distancia. |
| [x] | Proyectil Mágico / Magic Missile | 1 | Toques/Rayos *(daño automático sin tirada ni salvación)* | `srd_magic_missile`, 1d4+1, `automatic-damage` de objetivo único. |
| [x] | Toque Impactante / Shocking Grasp | 1 | Toques/Rayos | `srd_shocking_grasp`, 1d6, `attack-roll` de toque cuerpo a cuerpo. |
| [x] | Manos Ardientes / Burning Hands | 1 | Áreas de Efecto | `srd_burning_hands`, cono 15 ft, 1d4, Reflejos mitad, vía `getCellsIntersectedByAoE`. |
| [x] | Curar Heridas Leves / Cure Light Wounds | 1 | Efecto/Salvación *(curación, sin salvación del objetivo)* | `srd_cure_light_wounds`, 1d8+1, `resolution.kind: "healing"`. |
| [x] | Prisa / Haste | 3 | Efecto/Salvación *(sin salvación; ver nota arquitectónica)* | `srd_haste` declara `resolution.effectId: "srd_haste"`, pero no existe esa entrada en `effects/catalog.ts` — el buff real se aplica vía un `Buff` legado hardcodeado en `apps/server/src/combat/abilityResolver.ts`. Documentado en el NDD del Sprint 038; se marca `[x]` porque el conjuro sí resuelve mecánicamente. |
| [x] | Aferrar Persona / Hold Person | 3 *(discrepancia: PHB físico = nivel 2)* | Efecto/Salvación | `srd_hold_person` → `srd_paralyzed`, Voluntad niega. Nivel registrado en el catálogo no coincide con el PHB físico; anotado como hallazgo, sin corrección de código. |
| [x] | Rayo Relampagueante / Lightning Bolt | 3 | Áreas de Efecto | `srd_lightning_bolt`, línea 120×5 ft, 5d6, Reflejos mitad. |
| [x] | Bola de Fuego / Fireball | 3 | Áreas de Efecto | `srd_fireball`, ráfaga radio 20 ft, 5d6, Reflejos mitad. |
| [x] | Muro de Fuego / Wall of Fire | 4 | Áreas de Efecto *(como peligro ambiental, no como `SpellDefinition`)* | `srd_wall_of_fire_hazard` en `effects/catalog.ts`, anclado a `targetCells`, consumido por la orquestación de peligros del servidor. No existe una entrada equivalente en `spells/catalog.ts` con `castingTime`/objetivo/lanzador — es invocable como peligro de escenario, no como conjuro lanzado por un personaje con el pipeline estándar. |
| [x] | *(peligro ambiental adicional sin conjuro nombrado por la instrucción)* Nube de Gas Venenoso / Poison Gas Hazard | — | Áreas de Efecto *(peligro ambiental)* | `srd_poison_gas_hazard` en `effects/catalog.ts`, mismo mecanismo que Muro de Fuego. Se incluye aquí porque es la 11ª entrada operacional real, no una omisión de la auditoría. |

---

## B. Nivel 0 (Trucos) — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Salpicadura Ácida / Acid Splash | Toques/Rayos | Proyectil ácido de toque a distancia, 1d3. |
| [ ] | Aturdir / Daze | Efecto/Salvación | Anula la siguiente acción, Voluntad niega. |
| [ ] | Repeler Muertos Vivientes / Disrupt Undead | Toques/Rayos | Rayo de toque, 1d6, solo no-muertos. |
| [ ] | Destello / Flare | Efecto/Salvación | Deslumbra brevemente, Reflejos niega. |
| [ ] | Fatiga / Touch of Fatigue | Toques/Rayos | Toque cuerpo a cuerpo, fatiga si falla Fortaleza. |
| [ ] | Resistencia / Resistance | *(buff puntual, sin pipeline de ataque)* | +1 a una salvación. |
| [ ] | Infligir Heridas Leves (menor) / Inflict Minor Wounds | Toques/Rayos | Toque, 1 punto fijo, sin salvación. |
| [ ] | Orientación / Guidance | *(buff puntual, sin pipeline de ataque)* | +1 puntual. |
| [ ] | Virtud / Virtue | *(buff puntual, sin pipeline de ataque)* | +1 PG temporal. |

## C. Nivel 1 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Infligir Heridas Leves / Inflict Light Wounds | Toques/Rayos | Toque, 1d8+1, sin salvación contra vivos. |
| [ ] | Armadura de Mago / Mage Armor | *(buff, sin pipeline de ataque)* | +4 CA de fuerza de campo. |
| [ ] | Escudo / Shield | *(buff, sin pipeline de ataque)* | +4 CA, anula proyectiles mágicos. |
| [ ] | Verdadero Golpe / True Strike | *(buff, sin pipeline de ataque)* | +20 a la siguiente tirada de ataque. |
| [ ] | Debilitar / Ray of Enfeeblement | Toques/Rayos | Rayo de toque + penalizador de Fuerza. |
| [ ] | Rociada de Color / Color Spray | Áreas de Efecto | Cono 15 ft, efectos por DG sin salvación bajo umbral. |
| [ ] | Sueño / Sleep | Efecto/Salvación | Área radio 10 ft por DG, Voluntad niega. |
| [ ] | Grasa / Grease | Efecto/Salvación | Terreno resbaladizo en área. |
| [ ] | Agrandar Persona / Enlarge Person | *(buff, sin pipeline de ataque)* | +Fuerza/-Destreza por tamaño. |
| [ ] | Reducir Persona / Reduce Person | *(buff, sin pipeline de ataque)* | Inverso de la anterior. |
| [ ] | Toque Frío / Chill Touch | Toques/Rayos | Toque cuerpo a cuerpo, 1d6 o daño negativo. |
| [ ] | Protección contra el Mal / Protection from Evil | *(buff, sin pipeline de ataque)* | +2 CA/salvaciones, bloqueo de control mental. |
| [ ] | Retirada Veloz / Expeditious Retreat | *(buff, sin pipeline de ataque)* | +30 ft velocidad. |
| [ ] | Caída de Pluma / Feather Fall | Efecto/Salvación *(reactivo, sin salvación)* | Anula daño por caída. |
| [ ] | Niebla Cegadora / Obscuring Mist | Áreas de Efecto | Ocultación total radio 20 ft, sin daño. |
| [ ] | Enredar / Entangle | Áreas de Efecto | Inmoviliza vegetación mágica, Reflejos evita. |
| [ ] | Bendición / Bless | *(buff de área, sin pipeline de ataque)* | +1 ataque/salvaciones contra miedo. |
| [ ] | Perdición / Doom | Efecto/Salvación | Penaliza ataque/daño/salvaciones, Voluntad niega. |
| [ ] | Orden / Command | Efecto/Salvación | Palabra de mando, Voluntad niega. |
| [ ] | Favor Divino / Divine Favor | *(buff, sin pipeline de ataque)* | Bono ataque/daño escalado. |
| [ ] | Arma Mágica / Magic Weapon | *(buff, sin pipeline de ataque)* | +1 ataque/daño de un arma. |
| [ ] | Escudo de la Fe / Shield of Faith | *(buff, sin pipeline de ataque)* | Bono de desviación a la CA. |
| [ ] | Santuario / Sanctuary | Efecto/Salvación | Atacantes deben superar Voluntad. |
| [ ] | Causar Miedo / Cause Fear | Efecto/Salvación | Huida o aturdimiento, Voluntad niega. |
| [ ] | Anatema / Bane | Efecto/Salvación | Penaliza ataque/salvaciones en área, Voluntad niega parcialmente. |

## D. Nivel 2 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Rayo Abrasador / Scorching Ray | Toques/Rayos | Uno o más rayos de toque, 4d6 cada uno. |
| [ ] | Flecha Ácida de Melf / Melf's Acid Arrow | Toques/Rayos | Rayo de toque + daño continuado. |
| [ ] | Telaraña / Web | Efecto/Salvación | Atrapa e inmoviliza, Reflejos evita. |
| [ ] | Polvo Deslumbrante / Glitterdust | Áreas de Efecto | Ciega (Reflejos niega) y revela invisibles. |
| [ ] | Ceguera/Sordera / Blindness/Deafness | Efecto/Salvación | Toque o rayo, Fortaleza niega. |
| [ ] | Imagen Especular / Mirror Image | *(buff defensivo, sin pipeline de ataque)* | Duplicados que absorben ataques. |
| [ ] | Invisibilidad / Invisibility | *(buff, sin pipeline de ataque)* | Trait de invisibilidad. |
| [ ] | Espantar / Scare | Áreas de Efecto | Huida en área, Voluntad niega. |
| [ ] | Nube de Niebla / Fog Cloud | Áreas de Efecto | Ocultación radio 20 ft, sin salvación. |
| [ ] | Curar Heridas Moderadas / Cure Moderate Wounds | Efecto/Salvación *(curación)* | 2d8+nivel (máx. +10). |
| [ ] | Infligir Heridas Moderadas / Inflict Moderate Wounds | Toques/Rayos | Toque, 2d8+nivel, sin salvación contra vivos. |
| [ ] | Oscuridad / Darkness | *(control de entorno, sin pipeline de ataque)* | Sin niveles de luz modelados. |
| [ ] | Restaurar Menor / Lesser Restoration | Efecto/Salvación *(curación no numérica)* | Revierte penalización temporal y fatiga. |
| [ ] | Silencio / Silence | *(control de área, sin pipeline de ataque)* | Anula sonido en área. |
| [ ] | Arma Espiritual / Spiritual Weapon | Toques/Rayos | Arma invocada autónoma; requiere entidad-arma no modelada. |

## E. Nivel 3 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Lentitud / Slow | Efecto/Salvación | Reduce ataques/velocidad/CA, Voluntad niega. |
| [ ] | Volar / Fly | *(buff, sin pipeline de ataque)* | Vuelo; sin movimiento vertical modelado. |
| [ ] | Nube Fétida / Stinking Cloud | Áreas de Efecto | Náusea por asalto, Fortaleza niega. |
| [ ] | Toque Vampírico / Vampiric Touch | Toques/Rayos | Toque cuerpo a cuerpo, drena y transfiere PG. |
| [ ] | Sopor Profundo / Deep Slumber | Efecto/Salvación | Versión de área de *Sueño*, Voluntad niega. |
| [ ] | Desplazamiento / Displacement | *(buff defensivo, sin pipeline de ataque)* | 50% de fallo de ataque contra el objetivo. |
| [ ] | Sugestión / Suggestion | Efecto/Salvación | Curso de acción razonable, Voluntad niega. |
| [ ] | Detener Muertos Vivientes / Halt Undead | Efecto/Salvación | Paraliza no-muertos, Voluntad niega. |
| [ ] | Curar Heridas Graves / Cure Serious Wounds | Efecto/Salvación *(curación)* | 3d8+nivel (máx. +15). |
| [ ] | Infligir Heridas Graves / Inflict Serious Wounds | Toques/Rayos | Toque, 3d8+nivel, sin salvación contra vivos. |
| [ ] | Oración / Prayer | *(buff/debuff de área, sin pipeline de ataque)* | +1/-1 en área. |
| [ ] | Círculo Mágico contra el Mal / Magic Circle against Evil | *(buff, sin pipeline de ataque)* | Versión de área de Protección contra el Mal. |
| [ ] | Luz Cegadora / Searing Light | Toques/Rayos | Rayo de toque, daño escalado, mayor contra no-muertos. |
| [ ] | Imponer Maldición / Bestow Curse | Toques/Rayos | Toque, penalización permanente hasta remover. |
| [ ] | Disipar Magia / Dispel Magic | *(contrarresto, sin pipeline propio)* | Sin sistema de contrarresto de `ActiveEffects`. |
| [ ] | Protección contra la Energía / Protection from Energy | *(buff, sin pipeline de ataque)* | Absorbe daño elemental hasta un total. |

## F. Nivel 4 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Tormenta de Hielo / Ice Storm | Áreas de Efecto | Daño contundente + frío, sin salvación en primer asalto. |
| [ ] | Debilitación / Enervation | Toques/Rayos | Rayo de toque, niveles negativos, sin salvación. |
| [ ] | Tentáculos Negros de Evard / Evard's Black Tentacles | Áreas de Efecto | Agarra y daña por asalto. |
| [ ] | Confusión / Confusion | Áreas de Efecto | Aleatoriza acciones, Voluntad niega. |
| [ ] | Piel de Piedra / Stoneskin | *(buff, sin pipeline de ataque)* | Resistencia al daño físico hasta un total. |
| [ ] | Puerta Dimensional / Dimension Door | *(reposicionamiento, sin pipeline de ataque)* | Teletransporte de corto alcance. |
| [ ] | Escudo de Fuego / Fire Shield | *(buff reactivo, sin pipeline de ataque)* | Daña a quien golpee cuerpo a cuerpo. |
| [ ] | Asesino Fantasmal / Phantasmal Killer | Efecto/Salvación | Doble salvación (Voluntad, Fortaleza) o muerte. |
| [ ] | Curar Heridas Críticas / Cure Critical Wounds | Efecto/Salvación *(curación)* | 4d8+nivel (máx. +20). |
| [ ] | Infligir Heridas Críticas / Inflict Critical Wounds | Toques/Rayos | Toque, 4d8+nivel, sin salvación contra vivos. |
| [ ] | Poder Divino / Divine Power | *(buff, sin pipeline de ataque)* | Bono ataque/PG y ataques adicionales por BAB alto. |
| [ ] | Libertad de Movimiento / Freedom of Movement | *(buff, sin pipeline de ataque)* | Inmunidad a inmovilización/parálisis/presa. |
| [ ] | Veneno / Poison | Toques/Rayos | Toque, veneno en dos fases (Fortaleza). |

## G. Nivel 5 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Cono de Frío / Cone of Cold | Áreas de Efecto | Daño frío escalado, Reflejos mitad. |
| [ ] | Muro de Fuerza / Wall of Force | *(bloqueo de terreno, sin pipeline de ataque)* | Barrera impenetrable. |
| [ ] | Metamorfosis Maligna / Baleful Polymorph | Efecto/Salvación | Transforma en forma indefensa, Fortaleza niega. |
| [ ] | Debilitar Mente / Feeblemind | Efecto/Salvación | Reduce Inteligencia/Carisma a 1, Voluntad niega. |
| [ ] | Aferrar Monstruo / Hold Monster | Efecto/Salvación | Versión sin restricción de tipo de *Aferrar Persona*. |
| [ ] | Teletransporte / Teleport | *(reposicionamiento, sin pipeline de ataque)* | Traslado de largo alcance. |
| [ ] | Expulsión / Dismissal | Efecto/Salvación | Envía extraplanares a su plano, Voluntad niega. |
| [ ] | Llamarada Divina / Flame Strike | Áreas de Efecto | Columna de fuego, Reflejos mitad. |
| [ ] | Matar Viviente / Slay Living | Toques/Rayos | Toque, muerte instantánea o daño masivo. |
| [ ] | Poder Justiciero / Righteous Might | *(buff, sin pipeline de ataque)* | Aumenta tamaño/PG/ataque. |

## H. Nivel 6 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Desintegrar / Disintegrate | Toques/Rayos | Rayo de toque, daño masivo, Fortaleza mitiga. |
| [ ] | Cadena de Relámpagos / Chain Lightning | Toques/Rayos + Áreas de Efecto | Objetivo primario + saltos secundarios; combina pipelines. |
| [ ] | Círculo de la Muerte / Circle of Death | Áreas de Efecto | Mata sin salvación bajo umbral de DG. |
| [ ] | Globo de Invulnerabilidad / Globe of Invulnerability | *(buff defensivo, sin pipeline de ataque)* | Bloquea conjuros de nivel bajo entrantes. |
| [ ] | Dañar / Harm | Toques/Rayos | Toque, reduce a fracción mínima de PG actuales. |
| [ ] | Sanar / Heal | Efecto/Salvación *(curación)* | PG altos + cura condiciones negativas. |
| [ ] | Muralla de Cuchillas / Blade Barrier | Áreas de Efecto | Daño a quien la atraviese, Reflejos mitad. |
| [ ] | Destierro / Banishment | Efecto/Salvación | Expulsa extraplanares, Voluntad niega. |

## I. Nivel 7 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Bola de Fuego Retardada / Delayed Blast Fireball | Áreas de Efecto | Versión mejorada con detonación diferida. |
| [ ] | Rociada Prismática / Prismatic Spray | Áreas de Efecto | Efectos aleatorios por color; combina múltiples pipelines. |
| [ ] | Dedo de la Muerte / Finger of Death | Toques/Rayos | Toque, muerte instantánea o daño masivo. |
| [ ] | Olas de Agotamiento / Waves of Exhaustion | Áreas de Efecto | Agota (`EXHAUSTED`) sin salvación. |
| [ ] | Espada de Mordenkainen / Mordenkainen's Sword | Toques/Rayos | Arma de fuerza autónoma; requiere entidad no modelada. |
| [ ] | Destrucción / Destruction | Toques/Rayos | Toque, muerte + destrucción del cuerpo. |
| [ ] | Blasfemia / Blasphemy | Áreas de Efecto | Efectos escalonados según diferencia de DG. |
| [ ] | Repulsión / Repulsion | *(control de área, sin pipeline de ataque)* | Impide aproximación física; interactúa con `validateMovePath`. |
| [ ] | Regenerar / Regenerate | Efecto/Salvación *(curación)* | PG masivos + reintegra miembros. |

## J. Nivel 8 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Rayo Polar / Polar Ray | Toques/Rayos | Rayo de toque, daño de frío masivo + penalización de Fuerza. |
| [ ] | Marchitamiento Horrendo / Horrid Wilting | Áreas de Efecto | Daño masivo, Fortaleza mitad. |
| [ ] | Nube Incendiaria / Incendiary Cloud | Áreas de Efecto | Se desplaza y quema por asalto, Reflejos mitad cada ronda. |
| [ ] | Palabra de Poder, Aturdir / Power Word Stun | Efecto/Salvación *(sin salvación, umbral de PG)* | Aturde sin salvación bajo umbral de PG actuales. |
| [ ] | Tormenta de Fuego / Fire Storm | Áreas de Efecto | Daño masivo de fuego, Reflejos mitad. |
| [ ] | Terremoto / Earthquake | Áreas de Efecto | Devasta terreno; interactúa dinámicamente con obstáculos, no modelado. |

## K. Nivel 9 — pendientes

| Estado | Conjuro (ES / EN) | Pipeline | Notas |
|---|---|---|---|
| [ ] | Lluvia de Meteoros / Meteor Swarm | Áreas de Efecto | Cuatro ráfagas, Reflejos mitad por ráfaga. |
| [ ] | Aullido de la Banshee / Wail of the Banshee | Áreas de Efecto | Mata sin salvación si falla Fortaleza. |
| [ ] | Palabra de Poder, Matar / Power Word Kill | Efecto/Salvación *(sin salvación, umbral de PG)* | Muerte instantánea bajo umbral de PG actuales. |
| [ ] | Detener el Tiempo / Time Stop | *(acciones adicionales, sin pipeline de ataque)* | Requiere modelo de turnos fuera de secuencia. |
| [ ] | Locura / Weird | Áreas de Efecto | Versión de área de *Asesino Fantasmal*, doble salvación. |
| [ ] | Implosión / Implosion | Toques/Rayos *(sin tirada, contacto sostenido)* | Destruye un objetivo por asalto, Fortaleza niega. |
| [ ] | Sanación en Masa / Mass Heal | Efecto/Salvación *(curación de área)* | Versión de área de *Sanar*. |
| [ ] | Tormenta de Venganza / Storm of Vengeance | Áreas de Efecto | Tormenta masiva prolongada, efectos escalonados. |

---

## Resumen de cobertura

- **Conjuros y peligros auditados**: 11 (implementados) + 9 (nivel 0) + 25 (nivel 1) + 15 (nivel 2) + 16 (nivel 3) + 13 (nivel 4) + 10 (nivel 5) + 8 (nivel 6) + 9 (nivel 7) + 6 (nivel 8) + 8 (nivel 9) ≈ **130 entradas**.
- **Implementadas**: **11/130** (ver Sección A) — más de las 5 decretadas; ver nota de verificación arriba.
- **No implementadas**: **119/130**.
- **Hallazgos de auditoría reiterados** (ya documentados en `.ai/coverage/SPELLS_CHECKLIST.md`, sin cambio de código en ningún caso): referencia colgante de `srd_haste` a un `effectId` inexistente; discrepancia de nivel en `srd_hold_person` (catálogo: 3, PHB físico: 2); *Muro de Fuego* implementado solo como peligro ambiental, sin `SpellDefinition` propia; ausencia total de un pipeline de contrarresto/disipación de `ActiveEffects`.
