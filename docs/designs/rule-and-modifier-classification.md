# Sprint 045 — Clasificación de reglas, modificadores y condiciones restantes

## Estado y alcance

Documento de pre-diseño. No autoriza cambios de código ni tests. El análisis parte del `HEAD` real `40e90d29cd8ba509c5d98c16eb5a294601e4f3b9` en `master`, sincronizado con `origin/master` al iniciar la auditoría.

La conclusión principal es doble:

1. `ATTACK-FULL` debe representar únicamente la regla base de Ataque Completo. Rapid Shot, Haste, Two-Weapon Fighting, rutinas naturales y Cleave/Great Cleave son reglas oficiales independientes que reutilizan o reaccionan a esa base; no son “componentes” de una Rule ID monolítica.
2. “Condiciones Restantes” no es un sprint implementable como lote fiel. Varias condiciones requieren primero Ocultación/Concealment, visión, velocidad multiplicativa, Concentración, movimiento obligatorio o caída real de objetos.

## Fuentes y método

Cadena de evidencia aplicada: normativa → Registry → diseños → código → tests → comportamiento documentado.

- Fuente funcional principal de Capítulo 8: `combat/05_acciones.txt`, `combat/06_ataques.txt`, `combat/07_movimiento.txt`, `combat/08_ataques_de_oportunidad.txt`, `combat/10_modificadores_de_combate.txt`, `combat/13_heridas_y_muerte.txt`.
- El corpus local contiene las reglas de ataque completo y tablas de modificadores, pero no define exhaustivamente todas las condiciones. La dependencia externa oficial se declara mediante el [SRD 3.5 Condition Summary](https://www.d20srd.org/srd/conditionSummary.htm).
- Rapid Shot, Cleave/Great Cleave y Two-Weapon Fighting: [SRD 3.5 Feats](https://www.d20srd.org/srd/feats.htm).
- Haste: [SRD 3.5 Haste](https://www.d20srd.org/srd/spells/haste.htm).
- Ataques naturales: [SRD 3.5 Special Abilities](https://www.d20srd.org/srd/specialAbilities.htm) y [Reading the Monster Entries](https://www.d20srd.org/srd/monsters/intro.htm).

No se modificó `combat/` ni se reinterpretó una ausencia del corpus como permiso para inventar reglas.

## Taxonomía obligatoria

### 1. Regla base

Una operación canónica que existe por sí misma y posee precondiciones, economía de acciones, resolución y consecuencias estables. Ejemplos: `ATTACK-BASIC`, `ATTACK-FULL`, `MOVE-BASIC`, `MANEUVER-GRAPPLE`, `DEFENSE-COVER`.

Una regla base puede exponer puntos de composición, pero no debe importar IDs concretos de dotes, conjuros o condiciones.

### 2. Modificador de regla

Una contribución tipada que altera una proyección de una regla base sin reemplazarla ni duplicar su resolver. Puede:

- añadir o reemplazar entradas de una rutina;
- aportar deltas tipados a ataque, defensa, salvaciones o daño;
- cambiar una tasa de movimiento;
- imponer o levantar una restricción;
- aportar contexto como cobertura u ocultación;
- reaccionar a un resultado ya resuelto.

Rapid Shot modifica una rutina durante `ATTACK-FULL`; no crea otra variante de Ataque Completo. Prone modifica ataque/defensa, mientras que levantarse sigue siendo una acción separada.

### 3. Infraestructura

Capacidad técnica reusable sin identidad normativa propia: `CombatRulesSnapshot`, ActiveEffects, catálogo de efectos, `EffectReducer`, Tick Layer, Event Bus, compositor de rutinas, pipeline de modificadores y `DamageBundle`.

Las filas `EFFECTS-SYS-*` del Registry son deliberadamente infraestructura, no reglas del manual.

### 4. Fuente normativa

Explica por qué existe una contribución: `core_combat_rule`, `feat`, `spell`, `condition`, `equipment` o `creature_trait`. Es identidad y trazabilidad, no un segundo pipeline matemático.

El contrato runtime existente `EffectSource` ya cubre procedencia de instancias (`creature`, `object`, `spell`, `aura`, `terrain`, `environment`, `system`). No debe reemplazarse; cuando una contribución no sea un `EffectInstance`, necesita una referencia equivalente y estable a Rule ID/source ID para logs y deduplicación.

### 5. Estado aplicado

Representación concreta y serializable durante el combate: `EffectInstance`, traits, modificadores, restricciones, duración, fuente y targets. No es la definición normativa ni la regla consumidora.

`EffectDefinition` declara qué proyecta una condición; `EffectInstance` declara quién la tiene, desde qué fuente y hasta cuándo; `EffectReducer` produce deltas; la regla base interpreta los traits/deltas pertinentes.

## Auditoría canónica de `ATTACK-FULL`

La base oficial cubre: acción de asalto completo, ataques iterativos por BAB, orden descendente, selección de objetivo ataque a ataque, compatibilidad con un paso de 5 pies y posibilidad de luchar a la defensiva. Esa base existe sin ninguna dote o conjuro.

### Rapid Shot

1. **¿Intrínseco a Full Attack?** No.
2. **¿Regla independiente?** Sí, es una dote que añade un ataque ranged al bono más alto y aplica -2 a todos los ataques del asalto; exige la acción de ataque completo.
3. **¿Modifica ataque estándar?** No; su beneficio requiere Full Attack.
4. **Rule ID propia:** propuesta `FEAT-RAPID-SHOT`.
5. **Contrato reusable:** contribución estructural a rutina con fuente, ámbito `full_attack`, delivery `ranged`, entrada extra al bono mayor y delta global -2.
6. **Infraestructura existente:** `FeatCatalog.attackRoutineRules` y `getEffectiveAttackRoutine`, hoy desconectados; `attackCommands.ts` aún gatea con `getAttackRoutine` crudo.

### Haste

1. **¿Intrínseco a Full Attack?** No.
2. **¿Regla independiente?** Sí, es un conjuro con varios efectos: ataque extra solo al usar Full Attack, además de +1 a ataques, CA de esquiva, Reflejos y velocidad aumentada.
3. **¿Modifica ataque estándar?** El +1 a la tirada sí; el ataque extra no.
4. **Rule ID propia:** propuesta `SPELL-HASTE`.
5. **Contrato reusable:** una definición de efecto temporal con modificadores numéricos tipados y una contribución estructural de rutina no acumulable con efectos similares.
6. **Infraestructura existente:** catálogo de conjuros, slots y duración; pero la resolución real de Haste usa un `Buff` hardcodeado en `abilityResolver.ts`, con +10 ft en vez del aumento oficial y sin CA/Reflejos/ataque extra. El diseño de Sprint 038 conserva esa deuda y no es una base aprobable para implementación fiel.

### Two-Weapon Fighting

1. **¿Intrínseco a Full Attack?** No. Combatir con dos armas es una regla especial independiente; Full Attack es la acción que permite explotar sus ataques adicionales.
2. **¿Regla independiente?** Sí, con ramas primary/off-hand, penalizadores dependientes de arma ligera y progresiones Improved/Greater.
3. **¿Modifica ataque estándar?** Un ataque estándar puede efectuarse con una de las armas; la secuencia adicional y sus penalizadores pertenecen a la elección de combatir con dos armas en la rutina completa.
4. **Rule ID propia:** propuesta `ATTACK-TWO-WEAPON`; las dotes `FEAT-TWO-WEAPON-FIGHTING`, `FEAT-IMPROVED-TWO-WEAPON-FIGHTING` y `FEAT-GREATER-TWO-WEAPON-FIGHTING` modifican esa regla.
5. **Contrato reusable:** ramas de rutina con `sourceItemId`, mano, penalizador, progresión y fuente normativa; no basta un único `extraAttack?: { penalty }`.
6. **Infraestructura existente:** inventario V5, `mainHandItemId`/`offHandItemId`, catálogo de armas y resolver por arma principal. Falta que cada entrada de rutina identifique su arma/delivery y que el resolver consuma esa entrada.

### Ataques naturales múltiples

1. **¿Intrínsecos a Full Attack?** No. Son reglas de armas naturales y anatomía; la secuencia completa se usa durante Full Attack.
2. **¿Regla independiente?** Sí: primarios/secundarios, -5 secundario (-2 con Multiattack), daño y multiplicador de Fuerza por fuente.
3. **¿Modifican ataque estándar?** Sí: un ataque estándar puede escoger un arma natural; una secundaria conserva su penalizador normativo incluso como ataque único.
4. **Rule ID propia:** propuesta `ATTACK-NATURAL-WEAPONS`; `FEAT-MULTIATTACK` como modificador separado.
5. **Contrato reusable:** colección de fuentes anatómicas, cada una con cantidad, rol primary/secondary, dados, reach y multiplicador de Fuerza, proyectada a entradas de rutina.
6. **Infraestructura existente:** `NaturalAttackCatalog`, `MeleeThreatSource` y `naturalAttackId`; el snapshot solo admite un ID natural singular y el resolver actual elige una única fuente.

### Cleave y Great Cleave

1. **¿Intrínsecos a Full Attack?** No; son excepciones explícitas al límite normal de ataques y pueden dispararse fuera de Full Attack.
2. **¿Reglas independientes?** Sí, dotes reactivas al derribar una criatura con daño melee.
3. **¿Modifican ataque estándar?** Sí; pueden dispararse después de un ataque melee válido que haga caer al objetivo, incluido un ataque estándar.
4. **Rule IDs propias:** `FEAT-CLEAVE` y `FEAT-GREAT-CLEAVE`.
5. **Contrato reusable:** reacción post-daño `target_dropped`, misma arma y mismo bono, otro objetivo dentro de alcance, sin paso de 5 pies; Cleave una vez por asalto, Great Cleave sin ese límite.
6. **Infraestructura existente:** transacción de ataque, `DamageBundle`, estado de vida, reach y selección de objetivo. Falta un evento/result trigger autoritativo y una fase de selección de reacción; no deben ser entradas anticipadas de la rutina ordinaria.

### Recomendación exacta para el Registry

No modificarlo en esta fase. En el siguiente sprint documental autorizado:

- conservar `ATTACK-FULL` como regla base y mantener **Parcial** solo por gaps intrínsecos demostrables de esa acción;
- retirar de su lista de “componentes pendientes” las cinco familias anteriores;
- crear las Rule IDs independientes propuestas con estado `No iniciado` o `Parcial` según evidencia real;
- enlazar cada una a `ATTACK-FULL` como regla base consumida, no como subcomponente absorbido.

## Auditoría del modelo real de modificadores

### Dónde se compone hoy

- `getAttackRoutine`: forma BAB-only (`primary`, `iterative`).
- `getEffectiveAttackRoutine`: envuelve esa forma con `Rules.totalAttackBonus`; no consume `FeatCatalog.attackRoutineContribution`.
- `attackCommands.ts`: usa nuevamente `getAttackRoutine` para longitud y penalizador, por lo que el read-model de UI y el gate autoritativo ya están separados.
- `getAttackContextModifiers`: compone flanqueo, disparo a melé y Cover por target/delivery.
- `Rules.totalAttackBonus`: BAB, característica, tamaño, `Buff.attackBonus`, modificadores del `EffectReducer` y condicionales por `attackType`.
- `attackResolver.ts`: añade alcance, ayuda, `situationalAttackBonus` y el +4 de Helpless; luego resuelve CA y daño.

### Capacidades actuales

| Necesidad | Implementación real | Dictamen |
|---|---|---|
| Agregar ataques | Ningún consumidor productivo; `AttackRoutineContribution` es inerte y solo admite una entrada opcional | Falta composición |
| Penalizadores de ataque | EffectReducer, conditional modifiers, buffs, contexto táctico, handler y resolver | Cinco rutas solapadas |
| Modificar daño | fuente de arma/conjuro, `DamageBundle`, precisión y crítico | Buen contrato de componentes, sin modificador general de daño |
| Restricciones | traits, `RuleOverride`, gates puros y validaciones directas de handlers | Reusable, pero mensajes y consumo están dispersos |
| Stacking | `EffectReducer` por stat/grupo/polaridad/policy | Determinista solo para modificadores numéricos de ActiveEffects |
| Duración | `EffectInstance.duration` + Tick Layer; `Buff.remainingTurns`/anclas en pipeline paralelo | Dos ciclos de vida |
| Trazabilidad | `ModifierTrace` para numeric modifiers | No cubre condicionales, traits, mechanics, buffs ni rutina |

### Hardcoding y solapamientos verificados

- Haste se identifica por `effectId` en `abilityResolver.ts` y crea un `Buff` plano.
- Fighting Defensively aplica -4 directamente en `attackCommands.ts` y crea otro `Buff` para +2 CA.
- Helpless se interpreta directamente en `attackResolver.ts` para el +4 melee.
- Dodge y Mobility se consultan por ID dentro de `Rules.totalArmorClass`.
- Combat Reflexes se consulta mediante `featIds.includes` dentro del evaluador.
- Squeezing y Grappling aún tienen consultas directas por `effectId` en helpers espaciales/de presa, además de traits/modificadores declarativos.

Esto no significa que todo condicional por ID sea un bug: algunos comandos instancian legítimamente una condición concreta. El problema aparece cuando la matemática reusable importa la identidad de una dote/conjuro en vez de consumir una contribución tipada.

## Contratos: reutilizar, extender o diferir

### Reutilizar sin cambios conceptuales

- `EffectDefinition` + `EffectInstance` + `EffectSource` para condiciones temporales.
- `Modifier.numeric`, `Modifier.override`, `ConditionalModifier`, traits y `RuleOverride` para deltas/restricciones ya expresables.
- `DamageBundle` para composición y multiplicación selectiva de daño.
- `CoverAssessment`/`AttackContextModifiers` como patrón de proyección contextual compartida servidor/UI.
- `DurationPolicy` y Tick Layer para expiración por turno/asalto.

### Extensiones justificadas, no parte del Sprint 045 recomendado

#### `AttackRoutineModifier`

Problema real: `AttackRoutineContribution.extraAttack` es singular, pierde fuente/arma/branch y no puede componer Rapid Shot + Haste + off-hand + naturales. Consumidores: compositor compartido, servidor y UI. Debe ser una colección de contribuciones trazables y producir una sola rutina efectiva. No se propone un `RuleModifier` universal; esa abstracción sería prematura.

#### Proyección multiplicativa de movimiento

Problema real: `EffectStat.SPEED` solo produce deltas planos, mientras Blinded, Entangled y Exhausted exigen media velocidad. Consumidores: `Rules.totalSpeedFeet`, budgets de movimiento y UI. La futura extensión debe representar una tasa racional/operación tipada y definir redondeo; no reutilizar `value: -50` como porcentaje implícito.

#### Evento de aplicación y caída de objetos

Problema real: Stunned/Panicked deben soltar objetos al adquirir el estado. `EffectManager.add` no ejecuta consecuencias y el modelo no representa objetos en el suelo. Consumidores: handler transaccional de aplicación, inventario, tablero y log. No debe añadirse un callback ejecutable a `EffectDefinition`; se requiere una consecuencia cerrada y orquestada.

#### `ConcealmentAssessment`

Problema real: `Modifier.mechanic { rule: "CONCEALMENT" }` existe pero el reducer lo descarta y el ataque no realiza miss chance. Consumidores: contexto de ataque compartido, resolver autoritativo, UI y logs. Debe seguir el patrón de `CoverAssessment`, con porcentaje, fuentes, aplicabilidad y trazas; la tirada pertenece al servidor.

### No crear todavía

- `RuleDefinition` runtime: el Registry documental ya identifica reglas; no existe un consumidor que justifique otro catálogo.
- `AttackModifier`/`DefenseModifier` genéricos: numeric/conditional modifiers y `AttackContextModifiers` ya cubren el problema inmediato.
- `ActionRestriction` nuevo: traits y `RuleOverride` bastan; primero debe normalizarse su consumo.
- `ThreatModifier` nuevo: `NO_THREAT` y `CANNOT_MAKE_AOO` ya separan amenaza de capacidad de AdO.
- `VisionModifier` genérico antes de modelar visión: `BLIND` puede clasificar el estado y una futura `VisionAssessment` deberá derivar consecuencias.

## Principios de composición propuestos

1. **Preflight:** vida, control, economía y restricciones. Una prohibición vence a cualquier bonus.
2. **Forma base:** la regla seleccionada crea la operación base; para Full Attack, la rutina BAB.
3. **Modificadores estructurales:** reemplazos de rutina y luego ataques añadidos, con fuente, stacking key y orden determinista. Ninguna fuente puede desaparecer de la traza.
4. **Proyección por entrada:** arma/delivery/ability/BAB de cada ataque; no asumir una sola arma para toda la rutina.
5. **Modificadores numéricos:** base derivada → equipo/tamaño → ActiveEffects según stacking → elecciones de acción → contexto target/delivery. El valor efectivo se calcula una vez y se entrega consolidado al resolver.
6. **Defensa:** CA normal/touch/flat-footed y contexto (Cover). Los bonus tipados respetan sus reglas de stacking/supresión.
7. **Ocultación:** después de que la tirada alcance la CA, antes de confirmar impacto/amenaza crítica, se resuelve una única miss chance autoritativa.
8. **Daño:** componentes base/adicionales → crítico solo sobre componentes multiplicables → mitigación → mutación de HP.
9. **Reacciones:** eventos post-resolución como `target_dropped` habilitan Cleave; nunca se anticipan como ataques BAB.
10. **Deduplicación:** identidad `(sourceKind, sourceId, ruleId, contributionId)`; las políticas no acumulables deben suprimir con traza, no elegir silenciosamente la primera.
11. **Duración:** una fuente temporal debe usar un único ciclo de vida. No añadir nuevos `Buff` planos para reglas que requieran stacking, source o varias estadísticas.
12. **Logs:** cada componente aplicado/suprimido expone etiqueta, Rule ID, fuente y valor/efecto. El resolver consume el consolidado y no conoce feats, spells, conditions, tablero ni historial de turno.

El ejemplo objetivo se resuelve como una sola rutina: BAB crea entradas; Haste y Rapid Shot añaden entradas; TWF añade ramas off-hand; Fighting Defensively, Rapid Shot y condiciones aportan deltas; equipo determina cada arma. La rutina resultante es la única que leen servidor y UI.

## Fichas de condiciones candidatas

Las estimaciones son relativas: **S** (1–2 capas), **M** (3–4 capas), **L** (cross-cutting o nueva infraestructura), **XL** (varios subsistemas/decisiones normativas).

### Blinded — `EFFECT-BLINDED` (propuesta)

- **Fuente:** SRD Condition Summary; las tablas de `combat/10_modificadores_de_combate.txt` confirman -2 CA y pérdida de Destreza.
- **Efectos:** no ve; -2 CA; pierde Destreza a CA; media velocidad; -4 Search y mayoría de skills de Fuerza/Destreza; checks visuales fallan; todos los oponentes tienen total concealment (50%).
- **Reglas modificadas:** defensa, movimiento, skills/percepción, attack context/concealment.
- **Traits/stats/restricciones:** `BLIND`, `NO_DEX_TO_AC`, AC -2; futura tasa de movimiento 1/2 y visión nula.
- **Duración/eventos:** depende de la fuente; Tick Layer existente basta para expirar. No requiere tick propio.
- **Reuso:** ActiveEffects, AC, traits, duration.
- **Faltantes:** Concealment consumidor, visión, media velocidad, Search/Spot/skills.
- **Cobertura actual:** trait declarado; cero definición productiva/tests.
- **Riesgo/estimación:** alto, **L**. No implementar antes de `DEFENSE-CONCEALMENT`.

### Entangled — `EFFECT-ENTANGLED` (propuesta)

- **Fuente:** SRD Condition Summary y tabla local de modificadores.
- **Efectos:** media velocidad, no Run/Charge, -2 ataques, -4 DEX, Concentration DC 15 + nivel al lanzar.
- **Reglas modificadas:** ataque, defensa derivada de DEX, movimiento, Run/Charge, spellcasting.
- **Traits/stats/restricciones:** ATTACK -2, DEX -4, `FORBID_RUN`, `FORBID_CHARGE`, movimiento ×1/2.
- **Duración/eventos:** fuente; expiración normal. Concentration se evalúa al lanzar, no en Tick.
- **Reuso:** numeric modifiers, overrides, spell command preflight.
- **Faltantes:** multiplicador de velocidad y sistema de Concentration.
- **Cobertura actual:** ninguna.
- **Riesgo/estimación:** medio-alto, **L** si se exige completa.

### Dazzled — `EFFECT-DAZZLED` (propuesta)

- **Fuente:** SRD Condition Summary y tabla local.
- **Efectos:** -1 ataques, Search y Spot.
- **Reglas modificadas:** ataque y skills/percepción.
- **Traits/stats/restricciones:** ATTACK -1; no bloquea acciones.
- **Duración/eventos:** fuente; expiración estándar.
- **Reuso:** numeric ATTACK y Tick Layer.
- **Faltantes:** Search/Spot.
- **Cobertura actual:** ninguna.
- **Riesgo/estimación:** bajo para combate parcial, **M** para cierre fiel. No marcar Completo sin skills.

### Shaken — `EFFECT-SHAKEN` (propuesta)

- **Fuente:** SRD Condition Summary y tabla local.
- **Efectos:** -2 ataques, saves, skills y ability checks.
- **Reglas modificadas:** ataque, salvaciones, skills/checks; escala de miedo.
- **Traits/stats/restricciones:** ATTACK/FORTITUDE/REFLEX/WILL -2; futuro descriptor `FEAR`/mind-affecting.
- **Duración/eventos:** fuente; repetición de miedo puede escalar por regla de stacking de miedo.
- **Reuso:** reducer para ataque/saves, duration.
- **Faltantes:** skills/ability checks y transición de severidad; `onStack: upgrade_to` se declara pero `EffectManager.add` no lo ejecuta.
- **Cobertura actual:** ninguna.
- **Riesgo/estimación:** medio, **M**.

### Frightened — `EFFECT-FRIGHTENED` (propuesta)

- **Fuente:** SRD Condition Summary.
- **Efectos:** penalizadores de Shaken; debe huir de la fuente por el mejor medio, puede luchar si no puede huir.
- **Reglas modificadas:** las de Shaken, selección/economía de acciones, pathfinding y UI/AI.
- **Traits/stats/restricciones:** mismos deltas; estado de miedo con fuente direccional y política de acción obligatoria.
- **Duración/eventos:** fuente; TurnStarted/command preflight para obligación de huida.
- **Reuso:** `EffectSource`, movimiento/path validation, reducer.
- **Faltantes:** oráculo de “puede huir”, acción obligatoria, pathfinding desde fuente, skills/ability checks y escalado de miedo.
- **Cobertura actual:** ninguna.
- **Riesgo/estimación:** alto, **L**.

### Panicked — `EFFECT-PANICKED` (propuesta, sí corresponde)

- **Fuente:** SRD Condition Summary; es el grado superior oficial de miedo y no debe omitirse al diseñar la cadena.
- **Efectos:** suelta lo sostenido, huye a máxima velocidad por ruta aleatoria, no realiza otras acciones, -2 saves/skills/ability checks; Cowering si queda acorralado.
- **Reglas modificadas:** inventario, acción obligatoria, movimiento/pathfinding, saves/skills y transición a Cowering.
- **Traits/stats/restricciones:** future fear severity, restricción “solo huir”, deltas de saves; consecuencia on-apply de drop.
- **Duración/eventos:** aplicación, TurnStarted, expiración y detección de acorralamiento.
- **Reuso:** Event Bus, movement, EffectSource, reducer.
- **Faltantes:** objetos en suelo, consecuencias on-apply, RNG/path determinista, Cowering productivo, skills y escalado.
- **Cobertura actual:** ninguna.
- **Riesgo/estimación:** muy alto, **XL**.

### Exhausted — `EFFECT-EXHAUSTED` (propuesta)

- **Fuente:** SRD Condition Summary.
- **Efectos:** media velocidad, -6 STR/DEX; una hora de descanso completo la transforma en Fatigued; recibir Fatigue estando fatigado produce Exhausted.
- **Reglas modificadas:** características, movimiento, descanso y stacking/transición.
- **Traits/stats/restricciones:** `EXHAUSTED`, STR/DEX -6, movimiento ×1/2.
- **Duración/eventos:** `until_rest` no expresa por sí solo “tras 1h cambia a Fatigued”; requiere evento/acción de descanso con upgrade/downgrade.
- **Reuso:** traits, numeric modifiers, `srd_fatigued`, `onStack/upgradeTo` declarados.
- **Faltantes:** reducer de multiplicadores de velocidad, consumo real de `onStack`, evento de descanso/transformación.
- **Cobertura actual:** trait declarado; sin efecto/tests.
- **Riesgo/estimación:** medio-alto, **L**.

### Stunned — `EFFECT-STUNNED` (existente, Parcial)

- **Fuente:** SRD Condition Summary y tabla local.
- **Efectos:** suelta todo lo sostenido, no actúa, -2 CA, pierde Destreza a CA.
- **Reglas modificadas:** acciones, defensa, amenaza/AdO e inventario.
- **Traits/stats/restricciones:** ya proyecta `CANNOT_ACT`, `NO_DEX_TO_AC`, `NO_THREAT`, `CANNOT_MAKE_AOO`, AC -2.
- **Duración/eventos:** duración existente; el drop ocurre una sola vez al aplicarse.
- **Reuso:** implementación y tests actuales cubren todo salvo caída de objetos.
- **Faltantes:** consecuencia transaccional on-apply y representación de objetos en suelo; desequipar sin sacar el objeto del inventario no equivale a soltarlo.
- **Cobertura actual:** fuerte unit/E2E para acción/CA/duración; cero para drop.
- **Riesgo/estimación:** medio, **M**.

### Helpless Combat — `COMBAT-HELPLESS` y `ACTION-COUP-DE-GRACE` (propuestas)

- **Fuente:** SRD Condition Summary y `combat/13_heridas_y_muerte.txt`/tablas locales.
- **Efectos del estado:** DEX efectiva 0, +4 a ataques melee, ningún bonus especial ranged, Sneak Attack permitido.
- **Consecuencia separada:** Coup de Grace es una acción full-round: melee o arco/ballesta adyacente, auto-hit, crítico automático, sneak attack aplicable, Fort DC 10 + daño si sobrevive y provoca AdO. Existe una discrepancia que debe resolverse antes de código: `combat/10_modificadores_de_combate.txt:93`, fuente funcional primaria del proyecto, dice que no se puede dar Coup de Grace a criaturas inmunes a críticos; el SRD externo formula que esas criaturas no reciben daño crítico ni realizan la salvación. No se selecciona silenciosamente una de las dos lecturas en este pre-diseño.
- **Reglas modificadas:** defensa, ataque, precisión, crítico, saves, action economy y AdO.
- **Traits/stats/restricciones:** `HELPLESS` clasifica; la fuente de helplessness debe proyectar DEX 0. Coup de Grace consulta el trait, no pertenece a `EffectDefinition`.
- **Duración/eventos:** la fuente controla duración; Coup de Grace consume acción y usa pipeline transaccional.
- **Reuso:** `HELPLESS`, override de DEX en Paralyzed, +4 melee en resolver, `DamageBundle`, crítico, saves, AdO.
- **Faltantes:** `canApplySneakAttack` no consulta `HELPLESS`; no existe comando/resolver/UI de Coup de Grace; falta dictamen normativo sobre la discrepancia de inmunidad anterior. Además, `srd_paralyzed` solo fuerza DEX 0 aunque la definición oficial también fija STR 0; la fila `EFFECT-PARALYZED` requiere reauditoría antes de conservar “Completo”.
- **Cobertura actual:** test formal de DEX 0/+4 melee; sin sneak helpless ni Coup de Grace.
- **Riesgo/estimación:** medio-alto, **L** como vertical completa.

## Propiedad por capa: condición frente a consecuencia

| Capa | Responsabilidad |
|---|---|
| `EffectDefinition` | Traits, deltas, overrides, mechanic markers y política de stacking declarativa; nunca callbacks ni mutación de sala |
| Rule Layer | Proyectar estadísticas, disponibilidad, contexto, tasas y elegibilidad desde snapshot + definiciones |
| Action Handler | Autoridad, preflight, dados, aplicación/retirada de efectos, commits atómicos y consecuencias one-shot |
| Attack Context | Relación atacante–target–delivery: flanqueo, Cover, firing into melee y futuro Concealment |
| Vision/Concealment | Percepción/line of sight y miss chance; Blinded aporta `BLIND`, pero no duplica el resolver de ocultación |
| Tick Layer/Event Bus | Expiración y transiciones disparadas por eventos explícitos; no cálculo de ataque ni decisiones tácticas |

## Comparación de recortes para Sprint 045

| Opción | Rule IDs | Dependencias/impacto | Riesgo y tests | Dictamen |
|---|---|---|---|---|
| A. Una condición completa | Dazzled parece la menor | Falta Search/Spot; cualquier otra tiene gaps mayores | M; reducer + ataque + skills | Descartada: “completa” sería falso sin skills |
| B. Dos con mismo pipeline | Entangled + Exhausted comparten media velocidad/DEX | Requieren multiplicador de movimiento; además Concentration vs descanso/upgrade divergen | L; reglas, movimiento, spells/rest | Descartada: similitud superficial, dos verticales distintas |
| C. Infraestructura mínima | Attack Routine Composer o speed multiplier | Hay carencias reales, pero ninguna única infraestructura cierra por sí sola el lote de condiciones | M–L; tests contractuales | Diferir y diseñar por primer consumidor, evitando plataforma abstracta |
| D. Cerrar Stunned | `EFFECT-STUNNED` | Exige drop real, estado de objetos en suelo y hook on-apply | M; inventario, efecto, transacción, E2E | No es tan pequeño como aparenta; diferir hasta diseño de drop |
| E. Helpless vertical | `COMBAT-HELPLESS`, `ACTION-COUP-DE-GRACE` | Buena reutilización, pero cruza ataque, crítico, saves, AdO y UI | L; unit + server + E2E/UI | Candidato posterior autocontenido, no el menor riesgo |
| F. Concealment primero | `DEFENSE-CONCEALMENT` | Contrato mechanic ya existe; falta evaluación y tirada autoritativa. Desbloquea Blinded, Invisible, oscuridad y niebla | M; reducer/context, resolver, preview, deterministic RNG | **Recomendada** |

## Sprint 045 recomendado

**Opción F: `DEFENSE-CONCEALMENT` como vertical slice única, antes de Blinded.**

Recorte:

- normal y total concealment (20%/50%) como `ConcealmentAssessment` compartido;
- una sola miss chance autoritativa después de superar CA;
- trazabilidad de fuente y porcentaje en resultado/log/UI;
- consumo del mechanic declarativo existente o corrección explícita de ese contrato si la NDD dedicada demuestra que no es la sede adecuada;
- pruebas puras de stacking/selección de porcentaje, resolver con RNG inyectado, integración servidor y preview UI.

Fuera de alcance:

- Blinded, Invisible, oscuridad, niebla y line-of-sight como fuentes concretas;
- Blind-Fight;
- Total Cover;
- refactor global de Buffs;
- compositor de Full Attack;
- cualquier condición del lote auditado.

La elección entrega una regla oficial concreta, no infraestructura especulativa, y crea el prerequisito que permite implementar Blinded sin omitir su consecuencia de 50% miss chance. Requiere una NDD específica y un `Proceed` explícito antes de código; este pre-diseño no autoriza implementarla.

## Decisiones de Design Review

### Filtro de irreversibilidad a 20 sprints

No introducir un `RuleModifier` universal ni hacer que `ATTACK-FULL` conozca fuentes. Las fronteras duraderas son: regla base estable, contribuciones tipadas por dominio y una salida consolidada con source trace. Esto permite sumar Haste, Rapid Shot, TWF y naturales sin cambiar el resolver.

### Complejidad accidental

La mayor complejidad actual proviene de pipelines paralelos (`Buff`, ActiveEffects, contexto, handler y resolver). La corrección no es una mega-abstracción: migrar una regla a la vez hacia el contrato ya consumido por su dominio, con un único compositor efectivo por cálculo.

### Regla de tres

- `ConcealmentAssessment`: Blinded, Invisible y niebla/oscuridad.
- `AttackRoutineModifier`: Rapid Shot, Haste y Two-Weapon Fighting (además de naturales).
- tasa de movimiento: Blinded, Entangled y Exhausted.

## Gate de salida

- No se modifica código, tests, `combat/` ni Registry.
- No se marca ninguna regla como Completa.
- El próximo paso permitido es aprobar o rechazar el recorte `DEFENSE-CONCEALMENT` y, si se aprueba, redactar/confirmar su NDD de implementación antes de tocar TypeScript.
