# FEATS_PHB_CHECKLIST — Checklist de Dotes (Diseño V6)

**Tipo de documento**: Auditoría analítica de cobertura para la V1.0, bajo el marco de `.ai/coverage/V1_LAUNCH_MANIFESTO.md`. No es una NDD ni un plan de implementación. No autoriza ningún cambio de código.

**Nota de relación con `.ai/coverage/FEATS_CHECKLIST.md`**: este archivo reclasifica el mismo universo de dotes bajo la taxonomía de tres categorías del Diseño V6 (Modificadores Estáticos / Modificadores de Flujo (Traits) / Acciones Especiales), en vez de la taxonomía previa de dos subtipos de flujo. Ambos documentos coexisten porque auditan el mismo universo desde ángulos de clasificación ligeramente distintos; ninguno reemplaza al otro.

**Clasificación V6**:

| Categoría | Definición |
|---|---|
| **Modificadores Estáticos** | Bono/penalizador numérico a una tirada o a la CA, incondicional o condicional, sin alterar la disponibilidad de acciones. |
| **Modificadores de Flujo (Traits)** | Alteran un estado lógico o límite derivado (evitan AdO, cambian el coste de una acción, elevan el número máximo de reacciones). |
| **Acciones Especiales** | Añaden un botón/comando explícito a la UI que el jugador debe declarar, inyectando un delta condicional en el pipeline de resolución (ej. intercambiar ataque por daño, activar un ataque extra). |

**Estado**: `[x]` implementada y operacional en el motor · `[ ]` no implementada.

**Verificación de la cifra decretada**: la instrucción reporta 6 dotes ya implementadas y operacionales. La auditoría de código confirma exactamente **6**: `srd_dodge`, `srd_mobility`, `srd_combat_reflexes`, `srd_improved_trip`, `srd_diehard`, `srd_prone_eschewal`. Se marcan las seis con `[x]` a continuación, con la salvedad de que `srd_prone_eschewal` ("Levantarse Rápido") no corresponde a ninguna dota nombrada del PHB 3.5 core — es una extensión de diseño propia del proyecto que ocupa el mismo punto de extensión (`tacticalActionRules`) que usaría una dota real; se incluye en el conteo de "6" porque así la define el propio catálogo del motor y porque la instrucción de gobernanza la cita explícitamente como ejemplo de Modificador de Flujo ya implementado.

---

## A. Dotes ya implementadas (las 6 operacionales)

| Estado | Dote (ES / EN) | Clasificación V6 | Implementación verificada |
|---|---|---|---|
| [x] | Esquiva / Dodge | Modificador Estático (condicional) | `featCatalog.ts` (`srd_dodge`) + `rules.ts:388-397`: +1 CA contra el atacante designado en `combatant.dodgeTargetId`. |
| [x] | Movilidad / Mobility | Modificador Estático (condicional) | `featCatalog.ts` (`srd_mobility`) + `rules.ts:398-403`: +4 CA en AdO por movimiento (`isOpportunityAttack && isMovementProvoked`). |
| [x] | Reflejos de Combate / Combat Reflexes | Modificador de Flujo (Trait) | `rules.ts:516-519`: eleva `maxAooAllowed` a `1 + mod(Des)`. Chequeo inline, sin entrada en `FeatCatalog.definitions` (deuda documentada en `V1_LAUNCH_MANIFESTO.md`, Sección 3). |
| [x] | Derribo Mejorado / Improved Trip | Modificador de Flujo (Trait) | `featCatalog.ts` (`srd_improved_trip`): `avoidsOpportunityOn: ["trip"]`, vía `FeatCatalog.avoidsOpportunity`. |
| [x] | Duro de Pelar / Diehard | Modificador de Flujo (Trait) | `featCatalog.ts` (`srd_diehard`): `lifeRules` (`autoStabilizeNegativeHp`, `negativeHpActionState: "disabled"`, `bleedsWhileNegative: false`), vía `FeatCatalog.lifeRules`. |
| [x] | Levantarse Rápido / *(sin nombre PHB directo, `srd_prone_eschewal`)* | Modificador de Flujo (Trait) | `featCatalog.ts` (`srd_prone_eschewal`): `tacticalActionRules` para `"stand-up"` con `movementCost: "zero"` y sin provocar AdO, vía `FeatCatalog.tacticalActionRule`. |

## B. Dotes de Combate General y Competencia — pendientes

| Estado | Dote (ES / EN) | Clasificación V6 | Notas |
|---|---|---|---|
| [x] | Ataque Preciso a Distancia / Precise Shot | Modificador de Flujo (Trait) | **Sprint ATK-RANGED-INTO-MELEE**: `srd_precise_shot` en `featCatalog.ts` con `rangedAttackRules.ignoresFiringIntoMeleePenalty`, consumido declarativamente por `getRangedIntoMeleeAssessment` (fold `rangedAttackContribution`, cero condicionales inline). |
| [ ] | Disparo Rápido / Rapid Shot | Acción Especial + Modificador Estático | **Diseñada en Sprint 038** (punto de extensión `AttackRoutineContribution` inerte desde Sprint 036); pendiente de `Proceed`. |
| [ ] | Tiro Múltiple / Manyshot | Acción Especial | Ataque múltiple contra un único objetivo; sin equivalente. |
| [ ] | Ataque Preciso Mejorado / Improved Precise Shot | Modificador de Flujo (Trait) | Anularía cobertura parcial; el mecanismo `CONCEALMENT` existe pero sin dota que lo module. |
| [ ] | Tiro en Movimiento / Shot on the Run | Acción Especial | Secuencia mover-atacar-mover; sin flujo de comando compuesto. |
| [ ] | Puntería / Point Blank Shot | Modificador Estático | +1 ataque/daño a distancia corta; no implementada. |
| [ ] | Vista Larga / Far Shot | Modificador Estático | Reduce penalización por distancia; sin penalización de rango modelada. |
| [ ] | Recarga Rápida / Rapid Reload | Modificador de Flujo (Trait) | Sin modelado de tiempo de recarga. |
| [ ] | Desviar Flechas / Deflect Arrows | Modificador de Flujo (Trait) | Anula un ataque a distancia por ronda; no implementada. |
| [ ] | Atrapar Flechas / Snatch Arrows | Modificador de Flujo (Trait) | Depende de Deflect Arrows, no implementada. |
| [ ] | Arquería Montada / Mounted Archery | Modificador Estático | Sin sistema de monturas. |
| [ ] | Combate Montado / Mounted Combat | Modificador de Flujo (Trait) | Sin sistema de monturas. |
| [ ] | Cabalgada de Embestida / Ride-By Attack | Acción Especial | Sin sistema de monturas. |
| [ ] | Carga Espiritada / Spirited Charge | Modificador Estático | Sin sistema de monturas. |
| [ ] | Arrollar / Trample | Modificador de Flujo (Trait) | Sin sistema de monturas. |
| [ ] | Poderoso Golpe / Power Attack | Acción Especial | Intercambio declarado ataque↔daño; requiere nuevo parámetro de comando en `attackCommands.ts`. |
| [ ] | Arremetida / Cleave | Acción Especial | Ataque extra gratuito tras derribar; requiere hook post-daño letal. |
| [ ] | Arremetida Mayor / Great Cleave | Acción Especial | Depende de Cleave, no implementada. |
| [ ] | Pericia en Combate / Combat Expertise | Acción Especial | Intercambio declarado ataque↔CA; mismo patrón de comando pendiente que Power Attack. |
| [ ] | Ataque Aturdidor / Stunning Fist | Acción Especial | El trait de aturdido (`srd_stunned`) existe como efecto aplicable, pero sin dota/comando que lo dispare desde un golpe desarmado. |
| [ ] | Ataque en Torbellino / Whirlwind Attack | Acción Especial | Ataque contra cada adyacente; requiere iteración multi-objetivo en el comando de ataque. |
| [ ] | Ataque Relámpago / Spring Attack | Acción Especial | Mover-atacar-mover sin AdO del objetivo; no implementada. |
| [ ] | Embestida Mejorada / Improved Bull Rush | Modificador de Flujo (Trait) | Sin maniobra de empujón modelada. |
| [ ] | Desarme Mejorado / Improved Disarm | Modificador de Flujo (Trait) | Sin maniobra de desarme modelada. |
| [ ] | Amago Mejorado / Improved Feint | Acción Especial | Sin sistema de amago modelado. |
| [ ] | Presa Mejorada / Improved Grapple | Modificador de Flujo (Trait) | El trait `GRAPPLING` existe como estado resultante; sin dota que module el inicio de la maniobra. |
| [ ] | Derribo con Escudo Mejorado / Improved Shield Bash | Modificador Estático | Sin regla que module la conservación del bono de CA del escudo. |
| [ ] | Desbaratar Mejorado / Improved Sunder | Modificador de Flujo (Trait) | Sin maniobra de desbaratar modelada. |
| [ ] | Volteo Mejorado / Improved Overrun | Modificador de Flujo (Trait) | Sin maniobra de atropello modelada. |
| [ ] | Iniciativa Mejorada / Improved Initiative | Modificador Estático | +4 iniciativa; no implementada. |
| [ ] | Golpe Certero Mejorado / Improved Critical | Modificador Estático | Duplica rango de amenaza; no implementada. |
| [ ] | Ataque Desarmado Mejorado / Improved Unarmed Strike | Modificador Estático | Prerrequisito de Stunning Fist/Deflect Arrows; no implementada. |
| [ ] | Contrahechizo Mejorado / Improved Counterspell | Acción Especial | Sin sistema de lanzamiento reactivo. |
| [ ] | Pericia con Dos Armas / Two-Weapon Fighting | Modificador Estático | Reduce penalizador de doble arma; no implementada. |
| [ ] | Pericia con Dos Armas Mejorada / Improved Two-Weapon Fighting | Acción Especial | Otorga ataque adicional con mano no dominante; candidato natural para `AttackRoutineContribution.extraAttack`. |
| [ ] | Pericia con Dos Armas Superior / Greater Two-Weapon Fighting | Acción Especial | Otorga un tercer ataque; depende de las dos anteriores. |
| [ ] | Defensa con Dos Armas / Two-Weapon Defense | Modificador Estático | +1 CA (+2 contra flanqueo); no implementada. |
| [ ] | Finura en el Combate / Weapon Finesse | Modificador Estático | Usaría Destreza en el ataque; `abilityForAttack` de `AttackContext` es punto de extensión plausible. |
| [ ] | Enfoque en un Arma / Weapon Focus | Modificador Estático | +1 ataque con arma específica; no implementada. |
| [ ] | Enfoque en un Arma Superior / Greater Weapon Focus | Modificador Estático | Depende de la anterior. |
| [ ] | Especialización en un Arma / Weapon Specialization | Modificador Estático | +2 daño con arma específica; no implementada. |
| [ ] | Especialización en un Arma Superior / Greater Weapon Specialization | Modificador Estático | Depende de la anterior. |
| [ ] | Competencia con Armadura Ligera / Armor Proficiency (Light) | Modificador Estático | Sin penalizador de no-competencia modelado. |
| [ ] | Competencia con Armadura Media / Armor Proficiency (Medium) | Modificador Estático | Igual que la anterior. |
| [ ] | Competencia con Armadura Pesada / Armor Proficiency (Heavy) | Modificador Estático | Igual que la anterior. |
| [ ] | Competencia con Escudos / Shield Proficiency | Modificador Estático | Igual que la anterior. |
| [ ] | Competencia con Escudo Torre / Tower Shield Proficiency | Modificador Estático | Igual que la anterior. |
| [ ] | Competencia con Armas Sencillas / Simple Weapon Proficiency | Modificador Estático | Sin penalizador de no-competencia modelado. |
| [ ] | Competencia con Armas Marciales / Martial Weapon Proficiency | Modificador Estático | Igual que la anterior. |
| [ ] | Competencia con Armas Exóticas / Exotic Weapon Proficiency | Modificador Estático | Igual que la anterior. |
| [ ] | Desenvainado Rápido / Quick Draw | Modificador de Flujo (Trait) | Sin modelado de "acción de desenvainar" con coste. |
| [ ] | Ciego en Combate / Blind-Fight | Modificador de Flujo (Trait) | Sin implementar. |
| [ ] | Correr / Run | Modificador Estático | Sin implementar. |
| [ ] | Resistencia / Endurance | Modificador Estático | Sin impacto directo en combate por celdas. |
| [ ] | Voluntad de Hierro / Iron Will | Modificador Estático | +2 Voluntad; sin pipeline de bono declarativo por dote a salvaciones. |
| [ ] | Reflejos Rápidos / Lightning Reflexes | Modificador Estático | +2 Reflejos; mismo estado que la anterior. |
| [ ] | Gran Fortaleza / Great Fortitude | Modificador Estático | +2 Fortaleza; mismo estado que la anterior. |
| [ ] | Enfoque de Habilidad / Skill Focus | Modificador Estático | Fuera del alcance de combate directo. |

## C. Dotes de Creación de Objetos Mágicos — pendientes

| Estado | Dote (ES / EN) | Clasificación V6 | Notas |
|---|---|---|---|
| [ ] | Elaborar Armas y Armaduras Mágicas / Craft Magic Arms and Armor | Acción Especial | Sin sistema de creación de objetos. |
| [ ] | Elaborar Vara / Craft Rod | Acción Especial | Igual. |
| [ ] | Elaborar Bastón / Craft Staff | Acción Especial | Igual. |
| [ ] | Elaborar Varita / Craft Wand | Acción Especial | Igual. |
| [ ] | Elaborar Objeto Maravilloso / Craft Wondrous Item | Acción Especial | Igual. |
| [ ] | Forjar Anillo / Forge Ring | Acción Especial | Igual. |
| [ ] | Elaborar Poción / Brew Potion | Acción Especial | Bloqueada además por la ausencia total de catálogo de consumibles (ver `EQUIPMENT_PHB_CHECKLIST.md`). |
| [ ] | Transcribir Pergamino / Scribe Scroll | Acción Especial | Mismo bloqueo que la anterior. |

## D. Dotes Metamágicas — pendientes

| Estado | Dote (ES / EN) | Clasificación V6 | Notas |
|---|---|---|---|
| [ ] | Aumentar Conjuro / Empower Spell | Modificador Estático | Sin mecanismo de conjuro con metamagia aplicada. |
| [ ] | Agrandar Conjuro / Enlarge Spell | Modificador Estático | Alteraría `rangeFeet`. |
| [ ] | Extender Conjuro / Extend Spell | Modificador Estático | Sin campo de duración propio en `SpellDefinition`. |
| [ ] | Aumentar Nivel de Conjuro / Heighten Spell | Modificador Estático | Alteraría `level`/DC. |
| [ ] | Maximizar Conjuro / Maximize Spell | Modificador Estático | Alteraría la expresión de daño a su máximo fijo. |
| [ ] | Acelerar Conjuro / Quicken Spell | Acción Especial | Alteraría `castingTime`; sin tipos de acción de lanzamiento distintos al estándar. |
| [ ] | Conjuro Silencioso / Silent Spell | Modificador de Flujo (Trait) | Sin modelado de componentes verbales. |
| [ ] | Conjuro Quieto / Still Spell | Modificador de Flujo (Trait) | Sin modelado de componente somático. |
| [ ] | Ensanchar Conjuro / Widen Spell | Modificador Estático | Alteraría el radio/área vía `getCellsIntersectedByAoE`; sin mecanismo composable. |
| [ ] | Penetración de Conjuros / Spell Penetration | Modificador Estático | Sin Resistencia a Conjuros modelada. |
| [ ] | Penetración de Conjuros Superior / Greater Spell Penetration | Modificador Estático | Depende de la anterior. |
| [ ] | Enfoque de Conjuros / Spell Focus | Modificador Estático | Sin cálculo de DC derivado de dotes en `SpellDefinition`. |
| [ ] | Enfoque de Conjuros Superior / Greater Spell Focus | Modificador Estático | Depende de la anterior. |
| [ ] | Maestría de Conjuros / Spell Mastery | Modificador de Flujo (Trait) | Sin relevancia de combate por celdas. |
| [ ] | Lanzar Conjuros en Armadura / Combat Casting | Modificador Estático | Sin tiradas de Concentración modeladas. |

---

## Resumen de cobertura

- **Total de dotes auditadas**: **84 entradas** (Secciones A-D), cubriendo el universo de dotes generales/combate, creación de objetos y metamágicas del PHB 3.5 con impacto potencial en combate/movimiento.
- **Implementadas**: **7/84** — las 6 originales más `srd_precise_shot` (Sprint ATK-RANGED-INTO-MELEE), con la salvedad de nomenclatura de `srd_prone_eschewal` ya señalada.
- **No implementadas**: **77/84**.
