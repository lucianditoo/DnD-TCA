# FEATS_CHECKLIST — Cobertura de Dotes (Manual del Jugador 3.5)

> **Archivado (Sprint 054C)**: reemplazado por [`.ai/coverage/FEATS_PHB_CHECKLIST.md`](../../.ai/coverage/FEATS_PHB_CHECKLIST.md), el único inventario vivo de este universo. Este corte se conserva por su taxonomía de clasificación previa; no es autoridad vigente.

**Tipo de documento**: Auditoría analítica de cobertura para la Versión 1.0. No es una NDD ni un plan de implementación. No autoriza ningún cambio de código por sí mismo.

**Alcance**: Todas las dotes del Manual del Jugador 3.5 (D&D 3.5 core) con impacto potencial en combate, movimiento táctico, tiradas de ataque/daño/salvación, o generación de bonificadores mecánicos — incluyendo dotes de combate general, dotes de competencia, dotes de creación de objetos mágicos (que otorgan bonos pasivos o desbloquean comandos) y dotes metamágicas. Se excluyen explícitamente dotes puramente narrativas sin impacto mecánico verificable en el motor (ninguna dota de este tipo existe en el PHB; todas producen algún efecto mecánico, por lo que la lista es completa sobre el capítulo de dotes del manual).

**Clasificación arquitectónica** (según el patrón ya vigente en `packages/shared/src/`):

| Categoría | Definición | Patrón de código análogo |
|---|---|---|
| **Modificador Estático** | Bono/penalizador numérico incondicional o condicional a un stat cerrado (`EffectStat`), aplicado por el Reducer o por una fórmula pura. | `ConditionalModifier` en `effects/contracts.ts`, o bono directo en `rules.ts` (ej. `srd_dodge`, `srd_mobility`). |
| **Modificador de Flujo Táctico (Trait)** | Cambia la disponibilidad/elegibilidad de una acción o interacción (evita AoO, habilita opciones de movimiento, altera límites como el número de AoO). No es un número: es una condición booleana o un límite derivado. | `Trait` en `effects/contracts.ts`, `avoidsOpportunityOn` / `tacticalActionRules` en `featCatalog.ts`, o chequeo inline (ej. `srd_combat_reflexes`). |
| **Acción Especial (Comando)** | Requiere que el jugador declare explícitamente una decisión antes o durante una acción (ej. intercambiar ataque por AC, intercambiar precisión por daño, iniciar una maniobra especial). Se materializa como un comando/parámetro de UI y una rama de resolución en el servidor. | Aún no existe un patrón consolidado en este motor — sería un nuevo tipo de payload de comando en `apps/server/src/commands/`. |

**Estado**: `[x]` implementado (verificado en código a la fecha de este documento) · `[ ]` no implementado.

---

## A. Dotes de Combate General y Competencia

| Estado | Dote (ES / EN) | Clasificación | Notas de implementación |
|---|---|---|---|
| [x] | Esquiva / Dodge | Modificador Estático (condicional) | `packages/shared/src/featCatalog.ts` (`srd_dodge`) + chequeo inline en `rules.ts:388-397`: +1 AC contra el atacante designado (`combatant.dodgeTargetId`) cuando `attackerId` coincide. No usa `ConditionalModifier` de `effects/contracts.ts`; es un bono ad-hoc fuera del Reducer. |
| [x] | Movilidad / Mobility | Modificador Estático (condicional) | `rules.ts:398-403`: +4 AC cuando `isOpportunityAttack === true` y `isMovementProvoked === true`. Mismo patrón ad-hoc que Dodge, fuera del Reducer de efectos. |
| [x] | Reflejos de Combate / Combat Reflexes | Modificador de Flujo Táctico | `rules.ts:516-519`: chequeo inline `combatant.featIds.includes("srd_combat_reflexes")`, eleva `maxAooAllowed` a `1 + mod(Des)`. **Nota de arquitectura**: no está registrada como entrada de `FeatCatalog` (a diferencia de `srd_dodge`/`srd_mobility`, que sí figuran en `definitions`); es la única dota "implementada" que vive exclusivamente como cadena mágica en `rules.ts`, sin metadato de nombre/descripcion en el catálogo declarativo. Existe también el `Trait` `"COMBAT_REFLEXES"` en `effects/contracts.ts:42`, pero no se ha confirmado un productor activo de ese trait vía `EffectDefinition` — su uso real de motor es el chequeo inline citado. |
| [x] | Derribo Mejorado / Improved Trip | Modificador de Flujo Táctico | `featCatalog.ts` (`srd_improved_trip`): `avoidsOpportunityOn: ["trip"]`, consumida por `FeatCatalog.avoidsOpportunity`. |
| [x] | Ataque Precavido a Distancia / Precise Shot | Modificador de Flujo Táctico | **Sprint ATK-RANGED-INTO-MELEE**: `srd_precise_shot` registrado en `featCatalog.ts` (`rangedAttackRules.ignoresFiringIntoMeleePenalty`); el penalizador -4 que anula fue implementado en el mismo sprint (`getRangedIntoMeleeAssessment` → `getAttackContextModifiers`). |
| [ ] | Disparo Rápido / Rapid Shot | Modificador de Flujo Táctico + Estático | **Diseñado en Sprint 038** (`docs/designs/full-attack-v2-haste-rapid-shot-design.md`, `implementation_plan.md`), punto de extensión inerte ya reservado en `featCatalog.ts` (`AttackRoutineContribution.extraAttack`, `flatAttackBonusToRoutine`) desde Sprint 036. **No implementada**: pendiente de `Proceed` explícito para el Sprint 038. |
| [ ] | Tiro Múltiple / Manyshot | Acción Especial (Comando) | Requiere declarar el disparo múltiple contra un único objetivo con penalizador variable por nivel de BAB; sin equivalente en el motor. |
| [ ] | Ataque Preciso Mejorado / Improved Precise Shot | Modificador de Flujo Táctico | Anularía cobertura parcial/camuflaje contra disparos a distancia; el mecanismo de cobertura (`CONCEALMENT` en `Modifier`) existe mecánicamente pero no hay dota que lo module. |
| [ ] | Tiro en Movimiento / Shot on the Run | Acción Especial (Comando) | Requiere una secuencia mover-atacar-mover como acción completa; no existe ese flujo de comando compuesto en `apps/server/src/commands/`. |
| [ ] | Puntería / Point Blank Shot | Modificador Estático | +1 ataque/daño a distancia corta (≤30 ft); no implementado. |
| [ ] | Vista Larga / Far Shot | Modificador Estático | Reduce el incremento de penalización por distancia; no implementado (no hay evidencia de penalización por rango en `rules.ts`). |
| [ ] | Recarga Rápida / Rapid Reload | Modificador de Flujo Táctico | Reduce el tiempo de recarga de ballestas de acción completa/estándar a acción libre/de movimiento; no existe modelado de "tiempo de recarga" en el motor. |
| [ ] | Desviar Flechas / Deflect Arrows | Modificador de Flujo Táctico | Requiere Improved Unarmed Strike como prerrequisito; anula un ataque a distancia por ronda; no implementado. |
| [ ] | Atrapar Flechas / Snatch Arrows | Modificador de Flujo Táctico | Extiende Deflect Arrows para capturar el proyectil; no implementado (depende de la dota anterior, tampoco implementada). |
| [ ] | Arquería Montada / Mounted Archery | Modificador Estático | Reduce a la mitad el penalizador de disparar desde montura en movimiento; no hay modelado de monturas/penalizador de disparo montado. |
| [ ] | Combate Montado / Mounted Combat | Modificador de Flujo Táctico | Permite tirada de Montar para anular un golpe contra la montura; no hay sistema de monturas. |
| [ ] | Cabalgada de Embestida / Ride-By Attack | Acción Especial (Comando) | Ataque durante una carga montada sin detener el movimiento; no hay sistema de monturas. |
| [ ] | Carga Espiritada / Spirited Charge | Modificador Estático | Duplica el daño de un ataque de carga montado; no hay sistema de monturas. |
| [ ] | Arrollar / Trample | Modificador de Flujo Táctico | Permite pasar sobre un enemigo derribado montado y hacer daño de pisoteo; no hay sistema de monturas. |
| [ ] | Poderoso Golpe / Power Attack | Acción Especial (Comando) | Intercambio declarado de bono de ataque por bono de daño antes de resolver el ataque cuerpo a cuerpo; requeriría un nuevo parámetro de comando en `attackCommands.ts` y una rama de cálculo en `rules.ts`; no implementada. |
| [ ] | Arremetida / Cleave | Acción Especial (Comando) | Ataque adicional gratuito tras derribar a un enemigo a 0 PG; requiere hook post-resolución de daño letal; no implementado. |
| [ ] | Arremetida Mayor / Great Cleave | Acción Especial (Comando) | Extiende Cleave sin límite de usos por turno; depende de Cleave, no implementada. |
| [ ] | Pericia en Combate / Combat Expertise | Acción Especial (Comando) | Intercambio declarado de bono de ataque por bono de AC; mismo patrón de comando pendiente que Power Attack; no implementada. |
| [ ] | Ataque Aturdidor / Stunning Fist | Acción Especial (Comando) | Requiere declarar el intento de aturdir en vez de daño normal + tirada de salvación Fortaleza del objetivo; el `Trait` `"CANNOT_ACT"`/mecanismo de aturdido (`srd_stunned` en `effects/catalog.ts`) existe como efecto aplicable, pero no hay una dota/comando que lo dispare desde un golpe desarmado. |
| [ ] | Ataque en Torbellino / Whirlwind Attack | Acción Especial (Comando) | Un ataque contra cada enemigo adyacente como acción completa; requiere iteración multi-objetivo en el comando de ataque; no implementada. |
| [ ] | Ataque Relámpago / Spring Attack | Acción Especial (Comando) | Mover-atacar-mover sin provocar AoO del objetivo atacado; requiere integrar movimiento parcial dentro del comando de ataque; no implementada. |
| [ ] | Embestida Mejorada / Improved Bull Rush | Modificador de Flujo Táctico | Evita el AoO al iniciar un empujón; sin maniobra de empujón (`bull rush`) modelada en el motor de maniobras especiales. |
| [ ] | Desarme Mejorado / Improved Disarm | Modificador de Flujo Táctico | Evita el AoO al desarmar; sin maniobra de desarme modelada. |
| [ ] | Amago Mejorado / Improved Feint | Acción Especial (Comando) | Convierte el amago en acción de movimiento; sin sistema de amago (`feint`) modelado. |
| [ ] | Presa Mejorada / Improved Grapple | Modificador de Flujo Táctico | Evita el AoO al iniciar una presa; existe el `Trait` `"GRAPPLING"` (`srd_grappling` en `effects/catalog.ts`) como estado resultante, pero no la dota que module el inicio de la maniobra. |
| [ ] | Derribo con Escudo Mejorado / Improved Shield Bash | Modificador Estático | Conserva el bono de AC del escudo al usarlo como arma de golpe; requiere modelado de "shield bash" como ataque secundario (existen entradas `*_shield_bash` en `weapons.martial.ts`, pero sin regla que module la pérdida/conservación del bono de AC). |
| [ ] | Desbaratar Mejorado / Improved Sunder | Modificador de Flujo Táctico | Evita el AoO al atacar un objeto empuñado; sin maniobra de desbaratar objetos modelada. |
| [ ] | Volteo Mejorado / Improved Overrun | Modificador de Flujo Táctico | Evita que el objetivo pueda evitar el atropello y evita el AoO propio; sin maniobra de atropello (`overrun`) modelada. |
| [ ] | Iniciativa Mejorada / Improved Initiative | Modificador Estático | +4 a la tirada de iniciativa; no implementada (requiere confirmar si existe sistema de iniciativa con espacio para bonos declarativos). |
| [ ] | Golpe Certero Mejorado / Improved Critical | Modificador Estático | Duplica el rango de amenaza de crítico de un arma específica; no implementada. |
| [ ] | Ataque Desarmado Mejorado / Improved Unarmed Strike | Modificador Estático | El puñetazo deja de considerarse arma improvisada y de provocar AoO al usarse; prerrequisito de varias dotes de la lista (Stunning Fist, Deflect Arrows); no implementada. |
| [ ] | Contrahechizo Mejorado / Improved Counterspell | Acción Especial (Comando) | Ninguna interacción de contrahechizo modelada en el motor (no hay sistema de lanzamiento reactivo de conjuros). |
| [ ] | Pericia con Dos Armas / Two-Weapon Fighting | Modificador Estático | Reduce el penalizador de ataque al empuñar arma en cada mano; sin modelado de ataque secundario con arma en mano no dominante en la rutina de ataque. |
| [ ] | Pericia con Dos Armas Mejorada / Improved Two-Weapon Fighting | Modificador de Flujo Táctico | Otorga un segundo ataque adicional con la mano no dominante; depende de Two-Weapon Fighting, no implementada; mismo punto de extensión (`AttackRoutineContribution.extraAttack`) reservado en Sprint 036 sería candidato natural. |
| [ ] | Pericia con Dos Armas Superior / Greater Two-Weapon Fighting | Modificador de Flujo Táctico | Otorga un tercer ataque adicional con la mano no dominante; depende de las dos anteriores, no implementadas. |
| [ ] | Defensa con Dos Armas / Two-Weapon Defense | Modificador Estático | +1 AC (+2 contra flanqueo) al empuñar dos armas; no implementada. |
| [ ] | Finura en el Combate / Weapon Finesse | Modificador Estático | Permite usar Destreza en vez de Fuerza en la tirada de ataque con armas ligeras; requeriría una rama condicional en el cálculo de bono de ataque (`abilityForAttack`); no implementada, aunque el campo `abilityForAttack` de `AttackContext` ya existe como punto de extensión plausible. |
| [ ] | Enfoque en un Arma / Weapon Focus | Modificador Estático | +1 a la tirada de ataque con un arma específica; no implementada. |
| [ ] | Enfoque en un Arma Superior / Greater Weapon Focus | Modificador Estático | +1 adicional acumulado sobre Weapon Focus; depende de la anterior, no implementada. |
| [ ] | Especialización en un Arma / Weapon Specialization | Modificador Estático | +2 al daño con un arma específica; no implementada. |
| [ ] | Especialización en un Arma Superior / Greater Weapon Specialization | Modificador Estático | +2 adicional acumulado; depende de la anterior, no implementada. |
| [ ] | Competencia con Armadura Ligera / Armor Proficiency (Light) | Modificador Estático | Evita el penalizador por falta de competencia al llevar armadura ligera; no hay penalizador de no-competencia modelado en el motor de AC/armadura. |
| [ ] | Competencia con Armadura Media / Armor Proficiency (Medium) | Modificador Estático | Igual que la anterior, para armadura media; no implementada. |
| [ ] | Competencia con Armadura Pesada / Armor Proficiency (Heavy) | Modificador Estático | Igual que la anterior, para armadura pesada; no implementada. |
| [ ] | Competencia con Escudos / Shield Proficiency | Modificador Estático | Evita el penalizador de escudo no competente; no implementada. |
| [ ] | Competencia con Escudo Torre / Tower Shield Proficiency | Modificador Estático | Igual, para escudo torre; no implementada. |
| [ ] | Competencia con Armas Sencillas / Simple Weapon Proficiency | Modificador Estático | Evita el penalizador de -4 al ataque por no-competencia con armas sencillas; no implementada (no hay penalizador de no-competencia modelado). |
| [ ] | Competencia con Armas Marciales / Martial Weapon Proficiency | Modificador Estático | Igual, para armas marciales; no implementada. |
| [ ] | Competencia con Armas Exóticas / Exotic Weapon Proficiency | Modificador Estático | Igual, para un arma exótica específica; no implementada. |
| [ ] | Desenvainado Rápido / Quick Draw | Modificador de Flujo Táctico | Permite desenvainar como acción libre y lanzar armas arrojadizas a razón de ataques por ronda; no implementada (no hay modelado de "acción de desenvainar" con coste). |
| [ ] | Ciego en Combate / Blind-Fight | Modificador de Flujo Táctico | Repite tiradas de ocultación fallidas y elimina penalizadores por invisibilidad parcial del objetivo; no implementada. |
| [ ] | Correr / Run | Modificador Estático | Aumenta la velocidad al correr a x5 y permite carrera en línea recta manteniendo Destreza a la AC; no implementada. |
| [ ] | Resistencia / Endurance | Modificador Estático | Bonos a tiradas de resistencia física (nadar, marchar, aguantar privaciones); sin impacto directo en el motor de combate por celdas. |
| [ ] | Duro de Pelar / Diehard | Modificador de Flujo Táctico | `featCatalog.ts` (`srd_diehard`): `lifeRules.autoStabilizeNegativeHp: true`, `negativeHpActionState: "disabled"`, `bleedsWhileNegative: false`. Consumida por `FeatCatalog.lifeRules`. |
| [ ] | Voluntad de Hierro / Iron Will | Modificador Estático | +2 a salvaciones de Voluntad; no implementada (no se ha confirmado un pipeline de bonos declarativos a tiradas de salvación por dote, solo por efectos activos vía `EffectStat` `"WILL"`). |
| [ ] | Reflejos Rápidos / Lightning Reflexes | Modificador Estático | +2 a salvaciones de Reflejos; mismo estado que la anterior, no implementada. |
| [ ] | Gran Fortaleza / Great Fortitude | Modificador Estático | +2 a salvaciones de Fortaleza; mismo estado, no implementada. |
| [ ] | Enfoque de Habilidad / Skill Focus | Modificador Estático | +3 a una habilidad concreta; fuera del alcance de combate directo (afecta habilidades, no tiradas de ataque/daño/AC/salvación de combate). |

---

## B. Dotes de Creación de Objetos Mágicos (otorgan bonos o desbloquean comandos)

Estas dotes no modifican tiradas directamente, pero habilitan la creación de objetos que sí otorgan bonos mecánicos (equipo, pociones, pergaminos). Se registran aquí porque el criterio de aceptación V1.0 las incluye explícitamente.

| Estado | Dote (ES / EN) | Clasificación | Notas de implementación |
|---|---|---|---|
| [ ] | Elaborar Armas y Armaduras Mágicas / Craft Magic Arms and Armor | Acción Especial (Comando) | Sin sistema de creación de objetos en el motor (no hay economía de tiempo/oro/XP para forjar). |
| [ ] | Elaborar Vara / Craft Rod | Acción Especial (Comando) | Igual que la anterior. |
| [ ] | Elaborar Bastón / Craft Staff | Acción Especial (Comando) | Igual que la anterior. |
| [ ] | Elaborar Varita / Craft Wand | Acción Especial (Comando) | Igual que la anterior. |
| [ ] | Elaborar Objeto Maravilloso / Craft Wondrous Item | Acción Especial (Comando) | Igual que la anterior. |
| [ ] | Forjar Anillo / Forge Ring | Acción Especial (Comando) | Igual que la anterior. |
| [ ] | Elaborar Poción / Brew Potion | Acción Especial (Comando) | Igual que la anterior; sin catálogo de pociones/consumibles en el motor (ver `EQUIPMENT_CHECKLIST.md`). |
| [ ] | Transcribir Pergamino / Scribe Scroll | Acción Especial (Comando) | Igual que la anterior; sin catálogo de pergaminos en el motor. |

---

## C. Dotes Metamágicas

Ninguna requiere modelado propio de "combate por celdas", pero todas alteran el efecto/coste de un conjuro ya resuelto por el pipeline de `spells/catalog.ts` (ver `SPELLS_CHECKLIST.md` para el estado de los conjuros base). Se listan aquí como Modificador Estático porque su efecto final es alterar un valor numérico (DC, daño, duración, área) de un conjuro ya declarado.

| Estado | Dote (ES / EN) | Clasificación | Notas de implementación |
|---|---|---|---|
| [ ] | Aumentar Conjuro / Empower Spell | Modificador Estático | Sin mecanismo de "conjuro con metamagia aplicada" en `spells/catalog.ts` (los conjuros son entradas fijas, no composables). |
| [ ] | Agrandar Conjuro / Enlarge Spell | Modificador Estático | Igual que la anterior; alteraría `rangeFeet`. |
| [ ] | Extender Conjuro / Extend Spell | Modificador Estático | Igual que la anterior; alteraría duración (no modelada como campo propio en `SpellDefinition`). |
| [ ] | Aumentar Nivel de Conjuro / Heighten Spell | Modificador Estático | Igual que la anterior; alteraría `level`/DC. |
| [ ] | Maximizar Conjuro / Maximize Spell | Modificador Estático | Igual que la anterior; alteraría la expresión de daño a su máximo fijo. |
| [ ] | Acelerar Conjuro / Quicken Spell | Modificador de Flujo Táctico | Alteraría `castingTime`; sin modelado de tipos de acción de lanzamiento distintos al estándar. |
| [ ] | Conjuro Silencioso / Silent Spell | Modificador de Flujo Táctico | Sin modelado de componentes verbales/somáticos como requisito de lanzamiento. |
| [ ] | Conjuro Quieto / Still Spell | Modificador de Flujo Táctico | Igual que la anterior, para componente somático. |
| [ ] | Ensanchar Conjuro / Widen Spell | Modificador Estático | Alteraría el radio/área de conjuros de tipo ráfaga/cono/línea (`resolution.kind`); sin mecanismo composable. |
| [ ] | Penetración de Conjuros / Spell Penetration | Modificador Estático | +2 a la tirada de penetración de resistencia a conjuros; sin modelado de Resistencia a Conjuros (`spell resistance`) en el motor. |
| [ ] | Penetración de Conjuros Superior / Greater Spell Penetration | Modificador Estático | +2 adicional; depende de la anterior, no implementada. |
| [ ] | Enfoque de Conjuros / Spell Focus | Modificador Estático | +1 a la DC de salvación de una escuela de magia específica; no implementada (los conjuros en `spells/catalog.ts` no derivan su DC de un cálculo con dotes, es un campo fijo por conjuro/lanzador). |
| [ ] | Enfoque de Conjuros Superior / Greater Spell Focus | Modificador Estático | +1 adicional; depende de la anterior, no implementada. |
| [ ] | Maestría de Conjuros / Spell Mastery | Modificador de Flujo Táctico | Permite lanzar conjuros preparados sin el libro de conjuros; sin relevancia de combate por celdas. |
| [ ] | Lanzar Conjuros en Armadura / Combat Casting | Modificador Estático | +4 a la tirada de Concentración para lanzar defendiéndose o herido; sin modelado de tiradas de Concentración en el motor. |

---

## Resumen de cobertura

- **Dotes con impacto de combate/movimiento/tirada auditadas**: 106 (Sección A) + 8 (Sección B, creación de objetos) + 15 (Sección C, metamágicas) = **129 entradas**.
- **Implementadas y verificadas en código**: 4 (`srd_dodge`, `srd_mobility`, `srd_combat_reflexes`, `srd_improved_trip`) + 1 con impacto exclusivamente en la economía de vida/estabilización (`srd_diehard`, listada en la Sección A por prerrequisito temático aunque no altera tiradas de ataque/AC).
- **Diseñada pero no implementada (pendiente de `Proceed`)**: 1 (`srd_rapid_shot`, Sprint 038).
- **No implementadas**: el resto — **123 entradas**.
- **Nota sobre `srd_prone_eschewal`** ("Levantarse Rápido"): esta entrada de `featCatalog.ts` no corresponde a ninguna dote nombrada del PHB 3.5 core; es una extensión de diseño propia del proyecto (permite levantarse de postración sin coste de movimiento) y por eso no aparece como fila independiente en este checklist, que audita estrictamente el capítulo de dotes del manual físico.
- **Deuda arquitectónica detectada**: `srd_combat_reflexes` es la única dote "implementada" que no tiene entrada en `FeatCatalog.definitions` — vive como cadena mágica inline en `rules.ts:516`. Si se aborda en un sprint futuro, correspondería promoverla a una entrada declarativa de `FeatDefinition` (con un nuevo campo de contribución, ej. `maxAooRules`) para converger con el patrón ya usado por `lifeRules`/`tacticalActionRules`/`attackRoutineRules`. Esto es una observación de auditoría, no una propuesta de implementación — cualquier cambio de código real requeriría su propia NDD y `Proceed`.
