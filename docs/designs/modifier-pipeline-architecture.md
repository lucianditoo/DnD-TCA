# Sprint 044.2 — Arquitectura del Pipeline de Modificadores

## Estado y alcance

**Estado:** diseño arquitectónico completado; pendiente de revisión.

Este sprint responde una sola pregunta: **¿cómo modifica una regla existente otra regla del sistema sin duplicarla?** No autoriza implementación, migraciones, tests, nuevos Rule IDs ni sprints funcionales. Tampoco crea `implementation_plan.md`.

La respuesta se basa en el estado real del repositorio posterior al commit `8d1c042`, en la taxonomía de [reglas y modificadores](rule-and-modifier-classification.md), en la arquitectura vigente del [Combat Engine](../architecture/combat-engine.md), en la integración del [Rule Engine](../architecture/rule-engine-integration.md) y en el [Rule Registry](../rules/registry.md).

## 1. Problema

El motor ya cumple varias invariantes importantes:

- el servidor es autoritativo;
- el snapshot es fuente de evaluación y no almacena resultados escalares derivados;
- `EffectReducer` reduce deltas, overrides, traits y prohibiciones;
- Cover, flanqueo y disparo a melé se proyectan desde helpers compartidos;
- `DamageBundle` separa componentes multiplicables y no multiplicables;
- los handlers son la frontera de commit y los resolvers no mutan la sala.

Sin embargo, una regla puede alterar otra por rutas diferentes. Hoy una bonificación de ataque puede proceder de equipo/tamaño, ActiveEffects, un `Buff`, una dote, el contexto táctico, una elección de acción, el alcance o una rama local del resolver. Esas rutas no comparten todavía una proyección única ni una traza homogénea.

El riesgo no es solo duplicar fórmulas. También es:

1. aplicar dos veces una misma fuente;
2. aplicar stacking distinto según la ruta;
3. mostrar en React un preview diferente del resultado del servidor;
4. introducir conocimiento de dotes, conjuros o condiciones dentro de un resolver matemático;
5. crear variantes de una regla base (`ATTACK-FULL-V2`, `ATTACK-WITH-HASTE`) en vez de modificar la operación existente;
6. convertir `EffectDefinition` en un lenguaje universal de reglas con callbacks o semántica implícita.

## 2. Taxonomía operativa

La clasificación de este documento es obligatoria para decidir la sede de cada comportamiento.

### 2.1. Regla base

Una operación normativa autónoma con precondiciones, resolución y resultado propios. Ejemplos presentes o previstos: Attack, Full Attack, Movement, Charge, Run, Withdraw, Saving Throw, Spell Casting, Trip, Bull Rush, Grapple, Cover, Concealment, Threat y Opportunity Attack.

Que Cover afecte la CA de Attack no lo convierte en un “bonus suelto”: Cover sigue siendo una regla base con evaluación y resultado propios (`CoverAssessment`), cuyo resultado alimenta otra operación.

### 2.2. Modificador de regla

Una fuente que altera elegibilidad, estructura, contexto, valor efectivo, dados, consecuencias o recursos de una regla base sin sustituir su identidad. Ejemplos: Rapid Shot, Haste, Two-Weapon Fighting, Power Attack, Fighting Defensively, Combat Expertise, Sneak Attack, Dodge, Mobility, condiciones, equipo y tamaño.

Un modificador puede aportar más de una contribución especializada. Haste, por ejemplo, no es “+1 ATTACK”: afecta ataque, defensa, velocidad y la estructura de Full Attack. Esa pluralidad no justifica duplicar Attack ni crear un contrato universal.

### 2.3. Infraestructura

Transporta, reduce, resuelve o aplica datos, pero nunca es una regla: `CombatRulesSnapshot`, `EffectDefinition`, `EffectInstance`, `EffectReducer`, `EffectManager`, Tick Layer, Event Bus, `DamageBundle`, resolvers y handlers.

### 2.4. Fuente y estado aplicado

Equipo, tamaño, criatura, dote, feature, conjuro o elección táctica son **fuentes normativas**. Un `EffectInstance` o un `Buff` son **estado aplicado**. Ninguno debe confundirse con la regla base que recibe su contribución.

## 3. Auditoría del sistema actual

Se revisaron `docs/designs/`, `docs/architecture/`, `docs/rules/`, los documentos de control del proyecto y los consumidores reales en shared, servidor y UI. La tabla siguiente enumera las rutas actuales por las que una regla modifica otra.

| Ruta actual | Flujo real | Ejemplos comprobados | Clasificación | Dictamen |
|---|---|---|---|---|
| Derivación source-first | catálogos/perfil → helper derivado → `Rules` | equipo y tamaño en CA/ataque/velocidad; tipos de criatura en inmunidades; armas en reach | fuente → regla base | Conservar |
| ActiveEffects estáticos | `EffectDefinition.modifiers/traits/ruleOverrides` → `EffectReducer` → selector de regla | Fatigued, Stunned, Flat-Footed, Paralyzed | modificador declarativo | Conservar y completar trazas |
| ActiveEffects contextuales | `conditionalModifiers`/`conditionalTraits` → evaluadores privados de `rules.ts` | Prone, Squeezing, Grappling | modificador contextual | Consolidar stacking y traza con la proyección de ataque |
| Folds especializados de dotes | `FeatCatalog` → contribución tipada → helper consumidor | Diehard, Prone Eschewal, Precise Shot, Run, Improved Trip | modificador declarativo por dominio | Conservar; es el patrón correcto |
| Contexto táctico compartido | tablero + actores + delivery → assessment/resumen | flanqueo, disparo a melé, Cover | regla base contextual → contribución a Attack | Conservar y convertir en proyección canónica del intento |
| Elección de acción en handler | flags de turno/comando → suma o estado transitorio | Fighting Defensively -4; penalizador iterativo; Charge; Total Defense | modificador de una operación base | Debe dejar de ser suma anónima y entrar por una contribución especializada |
| Ajustes dentro del resolver | snapshot/fuente/target → suma local | rango, Aid, Helpless +4 melee, Sneak Attack | modificador de ataque/daño | Mantener la matemática, mover la decisión de aplicabilidad a la proyección previa |
| `Buff` escalar legacy | `Combatant.buffs` → suma directa + expiración paralela | Haste, Fighting Defensively, Total Defense, Charge, Aid | estado aplicado genérico | Debe desaparecer como bus general de estadísticas |
| Consultas directas por ID | `featIds.includes` o `effectId ===` dentro de consumidores | Dodge, Mobility, Combat Reflexes, Haste, Squeezing/Grappling en reconciliación | atajo de integración | Eliminar de matemática reusable; permitir IDs solo en creación/reconciliación del estado concreto |
| Rutina paralela | `getAttackRoutine` en servidor; `getEffectiveAttackRoutine` en UI | ataques iterativos; punto inerte para Rapid Shot/Haste | estructura de regla base | Consolidar en un único compositor efectivo |
| Restricciones especializadas | traits/overrides/vida/economía → gates | `CANNOT_ACT`, `CANNOT_MOVE`, `FORBID_RUN`, `FORBID_CHARGE`, AdO | modificación de elegibilidad | Conservar, normalizando su consumo en preflight |
| Daño por componentes | fuente/delivery/elegibilidad → `DamageBundle` → crítico/save | base, precision, energy; Sneak Attack `neverMultiply` | modificación del resultado de daño | Conservar |
| Consecuencias transaccionales | resultado puro → handler/`EffectManager`/Event Bus | Prone, Grappling, Squeezing, hazards, consumo de slot/munición | commit, no modificador matemático | Conservar fuera del resolver |
| Preview compartido | UI llama helpers shared | Cover, flanqueo, rutina efectiva, velocidad | lectura proyectiva | Conservar; prohibir reconstrucciones locales |

### 3.1. Hallazgos concretos por subsistema

#### Ataque y defensa

- `Rules.totalAttackBonus` compone BAB, característica efectiva, tamaño, `Buff.attackBonus`, modificadores estáticos y condicionales de ActiveEffects.
- `Rules.totalArmorClass` compone defensa derivada de equipo, DEX/tamaño, ActiveEffects, `Buff.acBonus`, Cover y reglas de Dodge/Mobility consultadas por ID.
- `getAttackContextModifiers` ya es una costura compartida correcta para flanqueo, disparo a melé y Cover.
- `attackCommands.ts` suma Fighting Defensively, el bonus táctico y el penalizador ordinal en un `finalModifier` sin identidad estructurada.
- `attackResolver.ts` vuelve a sumar alcance, Aid y Helpless, y decide Sneak Attack antes de construir `DamageBundle`.
- el servidor limita la rutina con `getAttackRoutine`, mientras la UI presenta `getEffectiveAttackRoutine`; cualquier ataque estructural extra quedaría divergente.

#### Movimiento

- `Rules.totalSpeedFeet` ya proyecta armadura, ActiveEffects y `Buff.speedBonusFeet` y respeta `CANNOT_MOVE`.
- `validateMovePath`, footprints, terreno, squeezing y amenazas forman un pipeline geométrico reusable.
- Run, Charge, Withdraw y Five-Foot Step reutilizan partes de ese pipeline, pero cada handler combina economía, presupuesto, exenciones y efectos propios.
- `commitSpatialTransition` identifica `srd_squeezing` por ID para reconciliar un estado concreto. Esta consulta es legítima en la frontera de estado, pero el cálculo del -4 no debe depender de ese ID fuera del catálogo/reducer.

#### Efectos

- `EffectReducer` aplica stacking determinista solo a modificadores numéricos estáticos.
- `conditionalModifiers` se suman en un evaluador paralelo y no aplican realmente la política de stacking; `stackingGroup` es opcional y no existe `stackingPolicy` en ese contrato.
- `Modifier.mechanic` y `Modifier.multiplier` existen en el tipo, pero el reducer no los proyecta.
- `EffectManager` agrega/remueve instancias y debe continuar libre de lógica normativa. `onStack`/`upgradeTo` están declarados, pero no son ejecutados por el manager actual.
- Tick Layer expira duraciones; no debe decidir ataque, movimiento ni consecuencias one-shot.

#### Amenaza y oportunidades

- `threatensTarget` deriva capacidad desde vida, traits, footprints y fuentes melee; es una regla base compartida.
- `findTriggeredOpportunityAttacksForPath` y el resolver de AdO consumen amenaza y `Rules.canMakeOpportunityAttack`.
- Combat Reflexes sigue consultado directamente por ID para calcular el límite; `preventOpportunityAttacks` sigue en `Buff`.
- la separación entre `NO_THREAT`, `CANNOT_MAKE_AOO` y límites por ronda es correcta y debe preservarse.

#### Conjuros, salvaciones y daño

- `SpellsCatalog` describe delivery, target AC, salvación y efecto; el servidor resuelve slots, ataque, save y commit.
- `Rules.calculateSpellSaveDC` y `Rules.totalSavingThrow` reutilizan características efectivas y ActiveEffects.
- Haste es la excepción más visible: se reconoce por ID y crea un `Buff` escalar incompleto.
- `DamageBundle` y `applySpellSaveToDamageBundle` ya permiten composición y mitigación sin introducir otro escalar de daño total como fuente.

#### Snapshot y UI

- el snapshot conserva fuentes y estado, no CA/ataque/velocidad derivados; esta frontera es correcta.
- la UI reutiliza helpers shared para varios previews, pero todavía inspecciona IDs concretos (`srd_dodge`) y formatea `Buff` como segunda representación mecánica.

## 4. Respuestas obligatorias

### 4.1. ¿Cuáles son hoy las rutas mediante las cuales una regla modifica otra?

Son trece rutas, agrupadas en seis familias:

1. **Fuentes derivadas:** equipo, tamaño, tipo de criatura y features alimentan los selectores efectivos.
2. **Estado declarativo:** ActiveEffects estáticos y contextuales alimentan deltas, overrides, traits y prohibiciones.
3. **Contribuciones catalogadas:** folds especializados de `FeatCatalog` modifican vida, acciones, ranged, Run y maniobras.
4. **Contexto efímero:** Cover, flanqueo, disparo a melé, alcance, target y delivery modifican el intento actual.
5. **Rutas locales:** handlers y resolvers suman elecciones, penalizadores ordinales, Aid, Helpless, rango y precisión.
6. **Estado paralelo:** `Buff` aporta escalares y expiración fuera de ActiveEffects/Tick.

Además, las consecuencias usan `DamageBundle`, `EffectManager`, inventario, slots y Event Bus. Esas son rutas de resultado/commit, no modificadores matemáticos.

### 4.2. ¿Cuáles deberían desaparecer?

1. **`Buff` como bolsa general de `attackBonus/acBonus/speedBonusFeet/preventsOpportunityAttacks`.** Duplica stacking, fuente, duración, traza y lifecycle. No se elimina de golpe: cada consumidor debe migrarse en su propio NDD. Aid puede requerir estado transitorio especializado; Haste debe convertirse en contribuciones tipadas y efecto temporal real.
2. **Números anónimos entre handler y resolver**, como `situationalAttackBonus`/`finalModifier`. Impiden saber qué se aplicó y facilitan doble conteo.
3. **Consultas directas por ID dentro de matemática reusable**, como Dodge, Mobility, Combat Reflexes y Haste. Los IDs son válidos al resolver catálogos o reconciliar una condición concreta, no como protocolo entre regla y consumidor.
4. **Dos rutinas efectivas de ataque.** El servidor y la UI deben consumir la misma lista estructurada.
5. **Lógica de aplicabilidad source-aware dentro de resolvers.** El resolver puede ejecutar la fórmula de rango, hit, miss chance, crítico y daño; no debe descubrir feats, spells, condiciones ni geometría.
6. **Stacking contextual por suma ciega.** Los modificadores condicionales deben respetar la misma semántica declarada de grupos/polaridades que los estáticos.
7. **Cálculo mecánico exclusivo de UI.** La UI puede elegir intención y renderizar una proyección, nunca reconstruir la regla.

### 4.3. ¿Cuáles deberían consolidarse?

- fuentes persistentes y temporales en selectores efectivos únicos por estadística;
- contexto espacial/relacional en assessments compartidos y trazables;
- forma de Full Attack y contribuciones estructurales en un solo compositor de rutina;
- deltas del intento actual en una proyección de ataque pre-roll, no en sumas dispersas;
- restricciones de vida, traits, overrides y economía en el preflight de la operación;
- daño adicional, crítico y mitigación alrededor de `DamageBundle`;
- preview y ejecución sobre la misma proyección shared, recalculada autoritativamente por el servidor;
- duración de efectos mecánicos en un solo lifecycle por fuente, evitando Buff + Tick en paralelo.

Consolidar no significa que todo pase por `EffectReducer`. Equipo, feats permanentes, decisiones tácticas y geometría tienen naturalezas distintas y conservan contratos especializados.

### 4.4. ¿Cuál debería ser el pipeline oficial?

El pipeline oficial es **Intención → Proyección → Resolución → Consecuencias → Commit**, con fases internas estrictas:

```text
1. Intención validada y snapshot autoritativo
   ↓
2. Preflight de elegibilidad y restricciones
   ↓
3. Operación base (forma normativa)
   ↓
4. Contribuciones estructurales del dominio
   ↓
5. Assessments de contexto efímero
   ↓
6. Proyección efectiva y trazable
   ↓
7. Resolver puro / dados autoritativos
   ↓
8. Plan de consecuencias y recursos
   ↓
9. Commit atómico + eventos + log
```

#### Fase 1 — Intención

El cliente expresa qué intenta hacer y las selecciones permitidas. Nunca envía CA objetivo, Cover, miss chance, bonus final, efectos a aplicar ni conclusiones de reglas. El servidor crea un snapshot fresco.

#### Fase 2 — Preflight

Valida ownership, fase, vida, economía, recursos, targets, alcance básico y prohibiciones. Traits y `RuleOverride` se consumen aquí. Una prohibición normativa vence a cualquier bonus.

#### Fase 3 — Operación base

La regla base crea su forma mínima: un intento de ataque, la rutina BAB de Full Attack, una ruta de Movement, una salvación, un lanzamiento o una prueba de maniobra. Todavía no tira dados ni muta estado.

#### Fase 4 — Contribuciones estructurales

Modificadores que cambian la forma —ataques extra, ramas off-hand, sustitución de delivery, tasas de movimiento— se aplican antes de los números por entrada. Deben conservar fuente, identidad, stacking y orden determinista.

#### Fase 5 — Contexto efímero

Se evalúan relaciones que no deben persistirse: target, delivery, distancia, flanqueo, Cover, amenaza, disparo a melé y futuro Concealment/Vision. Cada regla contextual produce un assessment especializado; no modifica directamente la sala.

#### Fase 6 — Proyección efectiva

Combina, una sola vez, base derivada, equipo/tamaño, ActiveEffects con stacking, contribuciones de feats/spells, elección de acción y assessments contextuales. Produce valores finales y trazas. El output es inmutable y consumible por servidor y UI.

Para Attack, esta fase debe producir un único **Attack Attempt Projection** especializado: fuente/delivery, entrada de rutina, bonus de ataque, defensa aplicable, assessments y contribuciones de daño elegibles. No es un `GameModifier` universal ni un segundo resolver.

#### Fase 7 — Resolver

Consume la proyección y RNG inyectable. Resuelve d20, auto hit/fail, CA, futura miss chance, amenaza/confirmación, dados y mitigación. No itera el board ni consulta IDs de feats/effects.

#### Fase 8 — Consecuencias

Construye `DamageBundle`, efectos a aplicar/remover, movimiento forzado, consumo de munición/slot, reacciones y eventos. Las consecuencias one-shot no se codifican como callbacks en catálogos.

#### Fase 9 — Commit

El handler confirma que el preflight sigue vigente, aplica el plan una sola vez, publica eventos, sincroniza fase y emite log. Ninguna preview tiene autoridad para saltarse esta reevaluación.

### 4.5. ¿Qué contratos existentes ya sirven?

| Contrato existente | Reutilización oficial |
|---|---|
| `CombatRulesSnapshot` | contexto inmutable y autoritativo de todas las proyecciones |
| `EffectDefinition` / `EffectInstance` / `EffectSource` | estado temporal y declarativo, sin callbacks |
| `EffectReducer` / `ReducedEffects` / `ModifierTrace` | stacking y trazas de deltas estáticos, overrides, traits y prohibiciones |
| `Trait` / `RuleOverride` | capacidades, inmunidades y restricciones del preflight |
| `DurationPolicy` / Tick Layer / Event Bus | lifecycle y expiración, no matemática de operaciones |
| `FeatCatalog` y sus folds especializados | contribuciones permanentes tipadas por dominio |
| `EquipmentCatalog`, `SizeRulesCatalog`, `CreatureTypeCatalog`, `CombatFeatureCatalog` | fuentes canónicas y derivación source-first |
| `AttackContextModifiers` / `CoverAssessment` | patrón de assessment compartido servidor/UI |
| `AttackDeliveryContext` | descripción mínima de delivery para precisión y alcance |
| `DamageBundle` / `DamageComponent` | composición de daño, multiplicación selectiva y mitigación |
| `RuleResult` | gates puros con fallo explícito |
| `MeleeThreatSource`, footprints y threat helpers | contexto espacial para Attack, AoO y maniobras |
| resolvers puros + transacción de sala | resolución determinista y commit atómico |

`EffectManager`, snapshot, resolvers y handlers se reutilizan como infraestructura; no se registran ni tratan como reglas.

### 4.6. ¿Qué contratos realmente faltan?

Solo se justifican los siguientes contratos especializados. Este documento no los implementa.

#### A. `AttackAttemptProjection` — necesario

Falta una salida pre-roll única que reemplace el `situationalAttackBonus` anónimo y la reconstrucción parcial entre handler/resolver/UI. Debe agrupar contratos ya existentes, no reemplazarlos:

- fuente y delivery resueltos;
- entrada de rutina efectiva;
- breakdown de ataque y CA;
- `AttackContextModifiers` y `CoverAssessment`;
- futuro `ConcealmentAssessment`;
- elegibilidad de componentes de daño;
- trazas aplicadas y suprimidas.

Su primer NDD funcional debe fijar la forma exacta. No debe incluir estado mutable, dados ya tirados ni callbacks.

#### B. Extensión de `AttackRoutineContribution` — necesaria antes del primer ataque estructural extra

El contrato existe, pero `extraAttack` es singular y carece de fuente, arma/branch, delivery, stacking key y prioridad. Debe evolucionar a una colección trazable consumida por un solo compositor. Es una extensión, no una abstracción nueva.

#### C. Stacking contextual trazable — necesario antes de ampliar condiciones

`ConditionalModifier` debe declarar semántica de stacking equivalente a la ruta estática, y su evaluación debe reutilizar trazas/políticas del reducer sin convertir al reducer en motor espacial. La forma preferida es una reducción especializada para contexto de ataque o una extensión acotada de entrada; la elección exacta queda abierta hasta su NDD.

#### D. `ConcealmentAssessment` — necesario cuando se abra Concealment

Debe seguir el patrón de Cover: aplicabilidad, porcentaje, fuentes y traza. La tirada de miss chance permanece en el servidor. No se crea en este sprint.

#### E. Contribución de tasa de movimiento — necesaria cuando llegue el primer consumidor

Blinded, Entangled y Exhausted requieren media velocidad; `EffectStat.SPEED` solo expresa deltas planos. Se necesita una operación racional especializada con orden y redondeo explícitos. No se propone un `UniversalMultiplier`.

No faltan —y por tanto no deben crearse— `RuleModifier`, `UniversalModifier`, `GameModifier`, un catálogo runtime duplicado del Registry ni un callback genérico dentro de `EffectDefinition`.

### 4.7. ¿Qué decisiones desbloquea este diseño?

- **Conditions:** cada condición declara estado/deltas/restricciones y alimenta proyecciones existentes; no crea versiones nuevas de Attack o Movement. Los efectos contextuales tendrán stacking y traza definidos.
- **Concealment:** obtiene una sede paralela a Cover y un punto exacto del resolver, sin acoplar Blinded, Invisible, oscuridad o niebla al ataque.
- **Vision:** puede producir assessments de percepción/line of effect consumidos por contexto, sin convertirse en flags persistidos de hit.
- **Feats:** Dodge, Mobility, Combat Reflexes, Rapid Shot, TWF y similares aportan contribuciones tipadas; el core deja de importar IDs.
- **Spells:** Haste puede aportar contribuciones a varias proyecciones desde una única fuente temporal; Spell Focus modifica la CD sin duplicar Spell Casting; SR y metamagia pueden ubicarse en preflight/contexto/estructura según su naturaleza.
- **Equipment:** las propiedades del catálogo continúan derivando fuente, delivery, reach, defensa y daño; efectos temporales de objetos entran como ActiveEffects, no como caches escalares.

## 5. Arquitectura propuesta por dominio

### 5.1. Attack y Full Attack

Attack es la operación base. Full Attack reutiliza el mismo intento por cada entrada de una rutina efectiva. Rapid Shot, Haste, TWF y naturales modifican la rutina; Fighting Defensively y Power Attack modifican valores/consecuencias; Cover y Concealment aportan assessments; Sneak Attack aporta un componente de daño. Ninguno crea otro Attack.

Orden específico:

1. gate de acción y fuente;
2. rutina base y contribuciones estructurales;
3. por entrada: delivery/arma/target;
4. assessments de contexto;
5. ataque y defensa efectivos;
6. hit contra CA;
7. Concealment si corresponde;
8. amenaza/confirmación;
9. `DamageBundle` y mitigación;
10. consecuencias/commit.

### 5.2. Movement y acciones derivadas

Movement conserva una proyección de ruta única. Run, Charge, Withdraw y Five-Foot Step no duplican geometría: aportan presupuesto, forma de ruta, restricciones, exenciones de AdO o consecuencias. La tasa de velocidad se resuelve antes del presupuesto; terrain/squeezing se evalúan por paso; AdO se proyectan desde la transición; `commitSpatialTransition` reconcilia estado después de validar.

### 5.3. Saving Throw y Spell Casting

Spell Casting resuelve catálogo, recurso, target, range y concentración futura; calcula DC desde característica efectiva; dispara Attack o Saving Throw según delivery; después aplica `DamageBundle`/efecto y consume el recurso atómicamente. Spell Focus altera la proyección de DC, no crea otro resolver de salvación. SR será un assessment/check especializado entre preflight y consecuencias.

### 5.4. Conditions

Una condición es fuente de modificaciones y, a veces, de consecuencias one-shot. Su definición puede declarar traits, deltas, overrides y mechanics cerradas. Caer objetos, movimiento obligatorio o elección de acciones pertenece a un plan de consecuencias/turno especializado, nunca a callbacks ejecutables en el catálogo.

## 6. Invariantes del pipeline oficial

1. Una regla oficial tiene una identidad estable; sus modificadores no crean versiones.
2. El cliente solo declara intención y selección permitida.
3. Toda proyección de ejecución se recalcula en servidor desde un snapshot fresco.
4. UI y servidor consumen el mismo helper/proyección; la UI no envía conclusiones.
5. Cada contribución tiene dominio, fuente e identidad; no existen números anónimos en la frontera del resolver.
6. El stacking se resuelve una vez por stat/contexto y deja traza de aplicado/suprimido.
7. Los resolvers no conocen board, IDs concretos ni estado mutable de sala.
8. Los handlers no reimplementan matemática; orquestan y hacen commit.
9. `EffectManager` no ejecuta lógica de juego.
10. Snapshot persiste fuentes/estado, nunca totales efectivos ni contextos efímeros.
11. Una fuente temporal usa un único lifecycle.
12. Los contratos se especializan por dominio; no se crea una plataforma universal antes de tener consumidores reales.

## 7. Impacto

| Subsistema | Impacto futuro del diseño |
|---|---|
| shared rules | selectores/proyecciones canónicas por operación, sin duplicar reglas |
| effects | stacking contextual trazable; manager y tick mantienen sus fronteras |
| attack resolver | recibe proyección consolidada y deja de descubrir fuentes concretas |
| movement resolver | conserva ruta única; acciones aportan políticas especializadas |
| damage | mantiene `DamageBundle` como sede de componentes y mitigación |
| cover/concealment/vision | assessments independientes y componibles en contexto |
| threat/opportunity | permanecen reglas base reutilizadas, no “bonuses de Attack” |
| server handlers | preflight, RNG, consequence plan y commit; sin sumas mecánicas locales |
| React | renderiza la proyección shared; no consulta IDs para reproducir fórmulas |
| persistence/network | sin nuevos campos derivados ni flags de conclusiones tácticas |
| Rule Registry | sin cambios en este sprint; continúa como identidad documental canónica |

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación arquitectónica |
|---|---|
| convertir `AttackAttemptProjection` en un objeto dios | limitarlo a un intento de ataque y componer assessments/contratos existentes |
| doble aplicación durante migración | una fuente migra completa por vertical; tests futuros deben comparar traza y total |
| stacking distinto entre estático y contextual | exigir política explícita y un solo paso de reducción contextual |
| preview obsoleto entre click y commit | servidor recalcula; la preview es informativa |
| costo por múltiples reducciones del mismo target | reducción efímera memoizable dentro de una proyección, nunca persistida |
| trazas demasiado grandes por WebSocket | preview resumida; traza completa solo en resultado/log cuando sea necesaria |
| hacer que todo sea ActiveEffect | conservar catálogos/folds/assessments especializados según naturaleza |
| migración big-bang de `Buff` | migrar Haste, Aid, defensa, carga y similares por NDD independientes |
| romper semántica de IDs directos legítimos | distinguir creación/reconciliación de estado concreto de matemática reusable |

## 9. Alternativas descartadas

### A. Un `RuleModifier`/`GameModifier` universal

Descartado. Un ataque extra, media velocidad, inmunidad, miss chance y componente de daño no comparten una semántica segura. El contrato acabaría lleno de opcionales, orden implícito y casts.

### B. Expresar toda regla mediante `EffectDefinition`

Descartado. Equipo, tamaño, feats permanentes, geometría, decisiones de acción y reacciones no son necesariamente efectos temporales. Introducir callbacks convertiría el catálogo en un segundo motor.

### C. Mantener la suma en handlers

Descartado. Es autoritativa pero no compartible ni trazable; obliga a la UI a adivinar y dispersa stacking.

### D. Hacer que el resolver descubra todo

Descartado. Acoplaría RNG/matemática con board, catálogos, IDs y estado de sala, rompiendo pureza y reutilización.

### E. Persistir totales efectivos o contexto

Descartado. Cover, flanqueo, DEX efectiva, reach y bonuses cambian con cada snapshot; persistirlos crea caches inválidos y reabre la deuda ya purgada.

### F. Crear una Rule ID por combinación

Descartado. `ATTACK-FULL-WITH-HASTE` o `ATTACK-PRONE` duplicarían la regla base y harían combinatoria la cobertura.

### G. Migrar todas las rutas en un único sprint

Descartado. `Buff`, rutina, Concealment, tasas de movimiento y consecuencias one-shot tienen riesgos y consumidores diferentes. Este documento fija destino y orden, no autoriza una reescritura masiva.

## 10. Decisiones abiertas y deliberadamente postergadas

1. forma TypeScript exacta y ubicación física de `AttackAttemptProjection`;
2. política de identidad/traza runtime y si debe enlazar Rule IDs documentales;
3. forma exacta de reducción contextual sin convertir `EffectReducer` en motor espacial;
4. orden de migración de Haste, Aid, Fighting Defensively, Total Defense y Charge fuera de `Buff`;
5. semántica completa de composición de Rapid Shot, Haste, TWF y ataques naturales;
6. contrato concreto de `ConcealmentAssessment` y tirada de miss chance;
7. operación racional y redondeo para media velocidad;
8. mecanismo de consecuencias one-shot como soltar objetos o movimiento obligatorio;
9. nivel de detalle de trazas que viaja por red frente al que queda solo en logs;
10. eventual partición de `rules.ts` por dominios, que no es requisito para adoptar el pipeline.

Cada punto necesita su propio consumidor y NDD antes de modificar contratos o código.

## 11. Decisiones arquitectónicas tomadas

- Pipeline oficial: **Intención → Preflight → Operación base → Contribuciones estructurales → Contexto → Proyección efectiva → Resolver → Consecuencias → Commit**.
- Una regla base nunca se duplica para representar una combinación de modificadores.
- La frontera duradera es una proyección especializada por operación, no un modificador universal.
- ActiveEffects sigue siendo el sistema de estado temporal declarativo, no el lenguaje de todas las reglas.
- Resolvers consumen proyecciones consolidadas; handlers orquestan; UI previsualiza con los mismos helpers.
- `DamageBundle`, Cover, snapshot, reducer, manager, Tick, catálogos y folds existentes se reutilizan.
- `Buff` se considera deuda de integración a retirar de forma incremental como ruta general.
- No se modifica el Rule Registry ni se abren Rule IDs en Sprint 044.2.

## 12. Validación documental

- enlaces relativos revisados contra archivos existentes;
- terminología alineada con `rule-and-modifier-classification.md` y `combat-engine.md`;
- no se crea `implementation_plan.md`;
- no se modifica código, tests, schemas, catálogos ni Registry;
- las decisiones abiertas están separadas de las decisiones ratificadas por este documento.
