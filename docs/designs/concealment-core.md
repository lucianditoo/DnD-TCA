# Sprint 046 — Concealment Core

## 1. Objetivo

Diseñar la vertical única `DEFENSE-CONCEALMENT`: una regla base de defensa que proyecta una posibilidad de fallo por ocultación desde contribuciones declarativas, expone el mismo assessment puro al servidor y a React, y deja la tirada porcentual exclusivamente bajo autoridad del servidor.

Este documento no autoriza código. Tampoco implementa Blinded, invisibilidad, oscuridad, niebla, iluminación, percepción, línea de visión, línea de efecto ni raycasting. Esas mecánicas serán fuentes o consumidores futuros de esta regla; no variantes de Attack ni de Concealment.

Recomendación de alcance: **Opción D — infraestructura primero**. La futura implementación debe resolver porcentajes ordinarios y totales (20%/50%) con fixtures internos, pero no incorporar fuentes productivas nuevas. Mientras falten targeting por casilla, percepción y la prohibición efectiva de AdO por ocultación total, `DEFENSE-CONCEALMENT` no podrá declararse completa.

## 2. Fuentes normativas auditadas

### 2.1. Corpus principal del repositorio

- `combat/10_modificadores_de_combate.txt:97-103`: definición, geometría general, 20%, no acumulación, ocultación total, 50%, AdO y grados variables.
- `combat/05_acciones.txt:185`: permite realizar la tirada porcentual simultáneamente con el ataque por rapidez, pero ordena ignorar el ataque si la ocultación produce fallo.
- `combat/10_modificadores_de_combate.txt:78-89`: Cover, Cover en melee/ranged y Total Cover; sirve para separar obstrucción física de imprecisión visual.
- `combat/10_modificadores_de_combate.txt:83`: Cover también impide AdO, pero por una regla distinta de la ocultación total.
- `combat/10_modificadores_de_combate.txt:88`: Total Cover impide atacar al objetivo.

### 2.2. SRD externo revisado

- [Combat Modifiers — Concealment](https://www.d20srd.org/srd/combat/combatModifiers.htm#concealment): confirma 20%, no stacking, ataque a casilla para ocultación total, 50% y ausencia de AdO.
- [Combat Statistics — Attack Roll](https://www.d20srd.org/srd/combat/combatStatistics.htm#attackRoll): define 1/20 naturales y ataques de toque.
- [Rogue — Sneak Attack](https://www.d20srd.org/srd/classes/rogue.htm#sneakAttack): fuente fuera del Capítulo 8 que prohíbe Ataque Furtivo contra una criatura con concealment, aunque las demás condiciones de elegibilidad se cumplan.
- [Spell Descriptions — Aiming a Spell](https://www.d20srd.org/srd/magicOverview/spellDescriptions.htm#aimingASpell): fuente fuera del Capítulo 8 para targeted spells, áreas y línea de efecto.
- [Special Abilities — Rays](https://www.d20srd.org/srd/specialAbilities.htm#rays): confirma que un ray requiere ranged touch attack.
- [Special Abilities — Gaze Attacks](https://www.d20srd.org/srd/specialAbilities.htm#gazeAttacks): concealment puede evitar una gaze save con una tirada separada; no pertenece al pipeline de impacto de este sprint.

### 2.3. Contradicción normativa registrada

`combat/10_modificadores_de_combate.txt:101` describe correctamente la ocultación total y sus consecuencias, pero una frase la llama “cobertura total”. `docs/audits/combat-rules-deviations.md` ya registra el error como `D-02`. La lectura adoptada para este diseño es la confirmada por el encabezado, el resto del párrafo, la distinción de la línea 88 y el SRD: se trata de **ocultación total**, no de Total Cover.

Esto no corrige el corpus en este sprint. La aprobación debe confirmar que `D-02` continúa tratándose como error de etiqueta, no como una regla alternativa.

## 3. Regla oficial parafraseada

1. Concealment representa imprecisión visual sin una barrera física que detenga el ataque.
2. Si un ataque supera la CA, la ocultación ordinaria concede 20% de posibilidad de que no alcance al defensor.
3. Varias fuentes de concealment no se suman ni se componen probabilísticamente.
4. Con línea de efecto pero sin línea visual existe total concealment: no se selecciona directamente al oponente; se ataca una casilla estimada y, si está ocupada y la tirada de ataque acertaría, existe 50% de fallo.
5. No se puede realizar un AdO contra un oponente con total concealment.
6. El DM puede definir porcentajes intermedios. Por ello el porcentaje es dato explícito, no un booleano ni una fórmula deducida del `kind`.
7. El d20 y el porcentaje pueden tirarse simultáneamente en mesa, pero la semántica es secuencial: un fallo contra CA termina el intento; solo un impacto aparente se somete a miss chance; un fallo por concealment anula amenaza crítica, daño y consecuencias on-hit.

Convención de d100 propuesta: resultado entero `1..100`; falla por concealment si `roll <= missChancePercent`. Así, 1–20 fallan para 20% y 1–50 para 50%.

## 4. Matriz normativa de interacciones

| Interacción | Regla aplicable | Alcance Sprint 046 |
| --- | --- | --- |
| Melee adyacente | puede tener concealment si el espacio está completamente dentro de la fuente | assessment preparado; geometría/fuentes diferidas |
| Melee con alcance | usa criterio equivalente al ranged | porcentaje común; fuente geométrica diferida |
| Ranged | aplica concealment si la línea cruza una fuente | porcentaje común; raycasting diferido |
| Touch melee/ranged | sigue siendo attack roll; la Touch AC no elimina concealment | incluido en la resolución porcentual |
| Rays | son ranged touch attacks | incluido por la misma ruta de ataque |
| Natural 20 | acierta automáticamente contra CA, pero no evita miss chance | incluido; puede fallar y no amenaza crítico |
| Crítico | concealment se resuelve antes de crear la amenaza; la confirmación no vuelve a tirar concealment | incluido |
| Sneak Attack | cualquier concealment impide el daño de precisión, incluso si el porcentaje no falla | incluido como elegibilidad; fuente Rogue SRD |
| Flanqueo | puede seguir existiendo geométricamente; no supera concealment ni habilita Sneak Attack contra un objetivo concealed | incluido sin cambiar `ATTACK-FLANK` |
| Full Attack | cada entrada es un intento independiente y obtiene su propio assessment/roll | incluido |
| AdO | normal concealment usa miss chance; total concealment prohíbe originar ese AdO | miss chance incluida; prohibición total diferida |
| Targeted spell con attack roll | touch/ray usa miss chance | incluido |
| Targeted spell sin attack roll | requiere ver o tocar al objetivo; no usa esta miss chance | targeting diferido, no simulado |
| Area spell | concealment no evita un efecto de área por sí solo; aplican selección de origen y línea de efecto | fuera del pipeline de miss chance |
| Gaze attack | puede usar un porcentaje relacionado para evitar la salvación | fuera de alcance; no reutilizar el resultado del ataque |
| Bull Rush | no tiene attack roll en el flujo actual; el porcentaje no se aplica a la prueba opuesta | sin cambio; targeting total futuro |
| Trip/Grapple | su toque melee inicial sí usa concealment antes de la prueba opuesta | incluido |
| Cover + Concealment | Cover modifica CA; si aun así hay hit, luego se resuelve Concealment | incluido y separado |
| Total Cover | bloquea en preflight; no se tira d20 ni d100 | fuera de alcance, nunca representado por Concealment |

## 5. Estado real del motor

### 5.1. Contratos y efectos

- `packages/shared/src/effects/contracts.ts` contiene `Modifier.mechanic { rule: "CONCEALMENT"; percentage }`.
- Ninguna entrada de `packages/shared/src/effects/catalog.ts` produce hoy ese modifier.
- `EffectReducer.reduceEffectsForTarget` procesa `numeric` y `override`; cualquier `mechanic` cae por `modifier.type !== "numeric"` y se descarta.
- No existe consumidor productivo de `CONCEALMENT`.
- `EffectInstance` sí conserva `effectId`, `source`, `targets`, `targetCells`, duración y stacks. `cloneEffectInstances` los copia al `CombatRulesSnapshot`, de modo que el snapshot ya transporta la identidad necesaria; no transporta ni debe transportar el assessment derivado.
- Servidor y UI no pueden evaluarlo igual hoy porque el helper no existe. Ambos sí comparten snapshot y catálogo, por lo que pueden hacerlo sin ampliar WebSocket.

Respuesta directa a la auditoría: **productores: ninguno; consumidores: ninguno; el marker no se conserva como valor reducido, pero la instancia fuente sí llega al snapshot**.

### 5.2. Cover reutilizable, pero no fusionable

`CoverAssessment`, `getAttackLineInterception`, `buildCoverAssessment` y `getAttackContextModifiers` prueban el patrón correcto:

- geometría/efectos se evalúan de forma pura en shared;
- servidor y UI consumen el mismo resultado;
- el assessment es efímero;
- `totalArmorClass` solo recibe el resultado ya proyectado.

Se reutilizan la sede (`getAttackContextModifiers`), el patrón de assessment y la proyección por `attackType`. No se reutilizan `CoverAssessment`, `acBonus` ni la intercepción geométrica: Cover cambia CA por obstrucción física; Concealment añade un check posterior al hit por imprecisión visual. Fusionarlos rompería orden, stacking y Total Cover/Total Concealment.

### 5.3. Ataques y RNG

- `apps/server/src/combat/attackResolver.ts::resolveAttack` resuelve CA, hit, Sneak Attack, `DamageBundle` y amenaza crítica en una sola función.
- El punto requerido está entre `hits` y la creación de precisión/daño/amenaza.
- `AttackAttemptProjection` está diseñado en `modifier-pipeline-architecture.md`, pero no existe en TypeScript. No se justifica introducirlo solo para este sprint: `AttackContextModifiers` puede componer el nuevo assessment sin una migración global del ataque.
- `apps/server/src/combat/diceRoller.ts::rollDice(100)` ya produce `1..100` y representa `00` como 100.
- Persisten fallbacks locales con `Math.random()` en `resolveAttack`, handlers físicos y `ManeuverDiceSource`. La implementación debe enrutar el roller existente e inyectable; no añadir otro generador.
- El cliente actualmente puede aportar el d20 manual/automático según el comando. Eso no autoriza el d100: el porcentaje no se añade a `ClientCommand` ni a Zod.

### 5.4. Rutas reales que deben cubrirse

| Flujo | Ruta actual | Riesgo de bypass |
| --- | --- | --- |
| Attack/Full Attack | `attackCommands -> resolveAttack` por cada entrada | bajo si se integra en resolver |
| Opportunity Attack | `handleResolveOpportunityAttack -> resolveAttack` | bajo; requiere roller y assessment |
| Charge | `tacticalCommands -> resolveAttack` | bajo; hoy sin DI uniforme |
| Ability attack legacy | `handleResolveAbilityAttack -> resolveAttack` | medio; no expone options de roller |
| Spell ray/touch | `handleCastSpell -> resolveAttack` | medio; tiene `diceRoller` pero hoy no lo pasa al resolver |
| AoO interruptivo de maniobra | `specialManeuverCommands -> resolveAttack` | bajo para el AdO |
| Trip/Grapple touch | `resolveMeleeTouchManeuver` en shared | **alto**; no pasa por `resolveAttack` ni tiene RNG |
| Bull Rush contest | prueba opuesta sin attack roll | no debe recibir miss chance porcentual |
| Automatic/AoE spell | `resolveAbility`/saving throw sin attack roll | no debe recibir miss chance porcentual |

`applyAttackMutations` centraliza estadísticas, log y daño para impactos no críticos. La ruta crítica difiere el daño mediante `activeAttackThreat`; por eso un fallo por concealment debe impedir crear ese estado.

### 5.5. Respuestas cerradas de la auditoría del motor

| Pregunta | Respuesta basada en código real |
| --- | --- |
| ¿Quién produce hoy Concealment? | Nadie; el catálogo productivo no usa el marker. |
| ¿Existe consumidor? | No; el reducer lo descarta y ninguna regla lo consulta. |
| ¿Se conserva en snapshots? | La definición/porcentaje no; la `EffectInstance` con identidad, fuente y targets sí. |
| ¿Servidor y UI lo evalúan igual? | No hoy. Pueden hacerlo mediante un helper shared sin ampliar red. |
| ¿Existe percentile roller? | Sí, `rollDice(100)` devuelve `1..100`. |
| ¿Dónde ocurre la tirada? | En servidor, después del hit contra CA y antes de precisión/crítico/daño. |
| ¿Qué flujos evitan el handler principal? | Charge, ability/spell attacks y maniobras tienen handlers propios; Trip/Grapple touch evitan además `resolveAttack`. |
| ¿Hay resoluciones directas que lo ignorarían? | Sí: `resolveMeleeTouchManeuver`; además varios callers no propagan el roller inyectable. |
| ¿Qué se reutiliza de Cover? | Patrón de assessment puro, sede de contexto, consumo isomorfo y carácter efímero. |
| ¿Qué se mantiene separado? | Geometría, bonus de CA, stacking, timing, Total Cover y todas las consecuencias porcentuales. |

Event Bus, Tick Layer y `EffectManager` no requieren una nueva responsabilidad: continúan aplicando, retirando y expirando las instancias fuente. Concealment se proyecta desde el snapshot en cada intento y no genera un evento propio por el mero hecho de ser evaluado.

## 6. Rule ID y clasificación

- Rule ID canónico propuesto: `DEFENSE-CONCEALMENT`.
- Tipo: **regla base independiente**.
- Fuentes futuras: efectos, terreno, visión, condiciones, conjuros o equipo que aporten contribuciones declarativas.
- Infraestructura: snapshot, EffectReducer, resolver, Event Bus y handlers no son reglas.
- Prohibido crear `ATTACK-WITH-CONCEALMENT`, `BLINDED-ATTACK`, `FOG-ATTACK` o checks de IDs concretos.

No se agrega la fila al Registry durante diseño. Tras implementar la Opción D deberá registrarse como **Infraestructura solamente** (o `Parcial`, si el vocabulario del Registry se normaliza antes), nunca `Completo`.

## 7. Contrato de contribución especializado

El marker existente no es suficiente: carece de identidad, label, stacking key, perspectiva y distinción entre porcentaje y semántica total. Inferir `kind` desde 50% sería incorrecto porque una fuente puede conceder 50% sin impedir targeting o AdO.

Se propone reemplazar la variante dormida de `Modifier.mechanic` por una colección especializada en `EffectDefinition`:

```ts
interface ConcealmentContribution {
  readonly id: string;
  readonly label: string;
  readonly stackingKey: string;
  readonly perspective: "attacks_against_target" | "attacks_by_target";
  readonly kind: "partial" | "total";
  readonly missChancePercent: number;
}
```

Justificación de `perspective`:

- una protección sobre el defensor futuro aporta concealment a ataques contra ese target;
- una limitación visual sobre el atacante futuro aporta concealment a ataques hechos por ese target;
- el resolver nunca pregunta qué efecto, condición o conjuro originó la contribución.

Validaciones del reducer especializado:

- `id`, `label` y `stackingKey` no vacíos;
- porcentaje entero entre 1 y 100;
- catálogos desconocidos fallan explícitamente;
- orden determinista por `effectId`, `instanceId`, `contributionId`;
- no se persiste ningún total.

No existe productor actual ni dato guardado con el marker, por lo que retirarlo no exige migración de perfiles, snapshots o WebSocket. Sí exige una prueba estática que impida reintroducir ambos contratos en paralelo.

## 8. `ConcealmentAssessment` compartido

Forma propuesta:

```ts
type ConcealmentKind = "none" | "partial" | "total";

interface ConcealmentTrace {
  readonly effectId: string;
  readonly effectInstanceId: string;
  readonly contributionId: string;
  readonly sourceType: EffectSource["type"];
  readonly sourceId?: string;
  readonly label: string;
  readonly stackingKey: string;
  readonly kind: Exclude<ConcealmentKind, "none">;
  readonly missChancePercent: number;
  readonly status: "applied" | "suppressed";
  readonly reason?: "duplicate" | "lower_precedence";
}

interface ConcealmentAssessment {
  readonly applies: boolean;
  readonly kind: ConcealmentKind;
  readonly missChancePercent: number;
  readonly directTargetingAllowed: boolean;
  readonly requiresTargetSquare: boolean;
  readonly opportunityAttackAllowed: boolean;
  readonly labelParts: readonly string[];
  readonly traces: readonly ConcealmentTrace[];
}
```

Los flags de targeting y AdO expresan la norma, pero la Opción D **no conecta todavía sus consumidores productivos**. No se añade `targetSquare` al assessment: la casilla elegida es intención del comando futuro, no propiedad del efecto ni resultado de la defensa.

La composición se divide en dos funciones especializadas, no universales:

1. un colector contextual reúne candidatos desde ActiveEffects aplicados al atacante/target;
2. un compositor de `ConcealmentContribution` aplica deduplicación/precedencia y produce el assessment.

`getConcealmentAssessment(snapshot, attacker, target, delivery)` orquesta ambas de forma pura, sin RNG, mutaciones ni acceso a React/Node. Un reducer genérico especializado acepta catálogos de fixture; el helper productivo usa `effectsCatalog`. Cuando lleguen terreno o Vision, sus colectores producirán candidatos del mismo contrato y los entregarán al compositor: no duplicarán stacking ni resolución y no obligarán a cambiar la firma del resolver de ataque. Este sprint no implementa esos colectores.

`AttackContextModifiers.byAttackType.melee/ranged` incorporará el assessment junto a Cover, garantizando preview y servidor isomorfos.

El assessment no se serializa ni se guarda en `CombatRoom`, `Combatant`, perfiles o `AttackThreatState`. Se recalcula desde el snapshot para cada intento.

## 9. Stacking, deduplicación y precedencia

1. Agrupar por `stackingKey` y aplicar una sola contribución equivalente; las demás quedan `suppressed: duplicate`.
2. Entre grupos distintos no sumar porcentajes. Elegir el mayor `missChancePercent`.
3. En empate porcentual, `total` prevalece sobre `partial` por sus restricciones normativas adicionales.
4. El ganador queda `applied`; las demás contribuciones válidas quedan `suppressed: lower_precedence`.
5. Todas las trazas sobreviven en orden determinista.

Ejemplos:

| Fuentes | Resultado |
| --- | --- |
| 20 + 20 | 20; una aplicada y otra suprimida |
| 20 + 50 | 50; 20 suprimida |
| partial 50 + total 50 | total 50 |
| ninguna | none, 0, sin trazas |

No se calcula `1 - (1-p1)(1-p2)` ni se realizan varias tiradas.

## 10. Pipeline oficial de resolución

El orden auditado y confirmado es:

```text
Intención
→ Preflight (control, economía, target/range y prohibiciones conocidas)
→ Operación base / entrada de rutina
→ Contribuciones estructurales
→ Contexto (Cover + Concealment + flanqueo + delivery)
→ Proyección efectiva de ataque y CA
→ Tirada d20 contra CA
→ si falla CA: resultado final, sin d100
→ si supera CA: tirada d100 autoritativa de Concealment
→ si falla Concealment: resultado final consumido, sin on-hit
→ elegibilidad y dados de Sneak Attack / construcción de DamageBundle
→ amenaza y confirmación crítica
→ daño y demás consecuencias
→ commit atómico
```

Aunque mesa permita tirar d20 y d100 a la vez, el servidor no consume RNG porcentual si el d20 falla. Esto reduce aleatoriedad innecesaria, facilita tests deterministas y sigue la condición normativa “ataque con éxito”.

Un fallo por concealment consume el intento, acción, munición o slot según la operación base. Cuenta como miss, no como hit. No aplica daño, precisión, salvación derivada de un hit, condición on-hit ni interrupción por daño.

## 11. Critical, Sneak Attack y on-hit

### 11.1. Críticos

- Natural 20 supera CA automáticamente, luego enfrenta miss chance.
- Si el d100 falla, `threatened = false` y no se crea `activeAttackThreat`.
- Si el d100 supera concealment, se evalúa amenaza normalmente.
- La confirmación crítica no realiza un segundo d100: confirma el mismo impacto que ya superó concealment.
- La cancelación de una amenaza conserva el impacto normal ya validado.

### 11.2. Sneak Attack

Hay dos controles diferentes:

1. si concealment falla, no existe impacto y no se construye daño;
2. aunque el d100 tenga éxito, la mera presencia de concealment impide Sneak Attack según la clase Rogue.

Por tanto `canApplySneakAttack` debe recibir o consultar el assessment del mismo intento, no recalcular fuentes ni depender de un `effectId`. El preview React debe usar idéntica elegibilidad y dejar de anunciar `+Nd6` cuando `assessment.applies` sea verdadero.

### 11.3. Consecuencias on-hit

Todo daño, save disparado por hit, efecto aplicado al impactar, estadística `hits`, interrupción de movimiento por daño y futuro hook de arma se ejecuta después del éxito porcentual. Un concealment miss solo registra ataque consumido/miss y las consecuencias de gasto que pertenecen al intento, no al impacto.

## 12. Full Attack y ataques de oportunidad

- Full Attack no obtiene un único roll global. Cada entrada llama al mismo pipeline con snapshot/contexto vigente y d100 independiente si su d20 acierta.
- Cambiar de target entre iterativos recalcula assessment.
- Un miss por concealment no detiene por sí solo los ataques restantes.
- Un AdO permitido usa la misma resolución porcentual y un roll independiente.
- La prohibición de originar AdO contra total concealment pertenece al gate de Opportunity, anterior al ataque. Se expresa en el assessment, pero se difiere porque requiere targeting/visibilidad completos. Con Opción D no habrá fuentes productivas de total concealment que puedan producir una falsa autorización.
- Los AdO interruptivos de Trip/Grapple ya pasan por `resolveAttack`; el toque posterior de la maniobra necesita integración separada pero compartiendo el mismo resolver porcentual.

## 13. Touch, rays y maniobras

Touch AC solo elimina armor/shield/natural armor; no elimina concealment. `Ray of Frost`, otros rays y `Shocking Grasp` usan el assessment de su delivery melee/ranged y el mismo d100.

`resolveTripTouchAttack` y `resolveGrappleTouchAttack` no pasan por `attackResolver`. Tras `hits` contra Touch AC, el handler debe invocar la única resolución porcentual server-side antes de iniciar la prueba opuesta. El profile de maniobra puede transportar el assessment puro; nunca el roll.

No se moverá RNG a `rules.ts`. Tampoco se duplicará la comparación porcentual dentro de cada handler.

Bull Rush no tiene attack roll en el modelo actual: su oposición no recibe miss chance. Las restricciones de localizar/seleccionar a un defensor con total concealment quedan para el sprint de targeting/visión.

## 14. Servidor, UI y seguridad de RNG

### Servidor

- `rollDice(100)` es el default canónico.
- Los tests inyectan `(sides) => value` por las costuras existentes; los handlers que hoy no propagan esa dependencia deben hacerlo.
- El d100 jamás entra en `ClientCommand`, Zod o payload WebSocket.
- El resolver valida que el roller devuelva un entero dentro de `1..100` y falla antes del commit si viola la invariante.
- Un intento genera como máximo un d100.

### UI

- React consume `getAttackContextModifiers(...).byAttackType[type].concealment`.
- Muestra porcentaje, clase y labels de fuentes conocidas; no tira dados ni predice éxito.
- Sneak Attack preview consume el mismo assessment.
- No añade estado local derivado ni flags al comando.
- Total concealment puede mostrarse como información normativa en fixtures, pero no debe habilitar/deshabilitar targeting hasta que ese consumidor sea implementado.

## 15. Logging y privacidad de información

Resultado mínimo trazable:

- ataque contra CA y resultado aparente;
- `Concealment partial/total N%`;
- d100 del servidor;
- éxito o fallo por concealment;
- labels aplicadas y, en diagnóstico/test, contribuciones suprimidas.

El log de jugador no debe exponer IDs internos ni inferir si una casilla de total concealment estaba vacía. Cuando exista targeting por casilla, tanto “casilla vacía” como “fallo por 50%” deben poder producir un mensaje indistinguible para quien no tenga esa información. Ese problema no se simula en Opción D y queda como gate del sprint de targeting.

En amenazas críticas, el log porcentual se emite antes del estado de confirmación. No es necesario persistir el assessment en `AttackThreatState`.

## 16. Compatibilidad y migraciones

- No hay entradas productivas que usen `Modifier.mechanic/CONCEALMENT`.
- No hay perfiles ni snapshots con porcentajes persistidos.
- `EffectInstance` existente ya conserva identidad y fuente.
- No se modifica `ClientCommand`, esquema de perfiles ni versión de storage.
- La única migración contractual es compile-time: retirar el marker muerto al introducir `concealmentContributions` y corregir cualquier fixture de prueba nuevo para usar el contrato especializado.

No se añade fallback desde un porcentaje plano, buff legacy o flag de combatiente.

## 17. Comparación de alcance

| Opción | Valor | Riesgo | Dictamen |
| --- | --- | --- | --- |
| A — solo 20% | cierra concealment ordinario | no prepara total y fuerza una segunda migración | descartada |
| B — 20%/50% sin targeting | vertical visible | puede presentar total concealment como funcional cuando permite target directo/AdO | descartada como producto |
| C — Capítulo 8 completo | máxima fidelidad | requiere Vision, LOS/LOE, percepción, casilla objetivo y Opportunity; viola exclusiones | descartada |
| **D — infraestructura primero** | assessment y resolución reales 20%/50%, sin fuentes productivas | menor valor visible inmediato; exige status honesto | **recomendada** |

La Opción D no es “solo tipos”: incluye, después de `Proceed`, reducer, assessment, d100 autoritativo, integración de todas las rutas con attack roll, trace, logs, preview y tests mediante fixtures ausentes en producción. Lo diferido son fuentes productivas y los consumidores de targeting/percepción.

## 18. Infraestructura de tests sin contaminar producción

- Unitarios usan catálogos locales tipados pasados al reducer especializado.
- Handlers/resolvers reciben rollers inyectables; no aceptan d100 por red.
- E2E/Playwright pueden arrancar un harness bajo `TEST_MODE` que instale definiciones de fixture únicamente en el proceso de prueba. No se agregan IDs al catálogo productivo ni comandos WebSocket exclusivos de test.
- Si el harness no puede aislarse sin alterar producción, el `Proceed` debe detenerse y replantear la prueba; no se añadirá `srd_test_concealment` al catálogo oficial.

## 19. Alcance fuera del sprint

- Blinded, Invisible y condiciones nuevas.
- Fog, darkness, lighting, Vision, LOS, LOE y raycasting.
- Targeting por casilla, ocultación de información y búsqueda/percepción.
- Prohibición productiva de AdO por total concealment.
- Blind-Fight, Uncanny Dodge, Hide/Spot, detección y blindsight.
- Total Cover y spell targeting completo.
- Gaze attacks y Concentration.
- Fuentes de equipo, terreno o spells.
- Refactor global hacia `AttackAttemptProjection`.

## 20. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| presentar 50% como total concealment completo | Opción D + status “Infraestructura solamente”; targeting/AdO no se marcan implementados |
| confundir Cover y Concealment | assessments separados y orden CA → d100 |
| ignorar una ruta de ataque | matriz explícita y tests por standard/full/AoO/charge/ability/spell/manoeuvre touch |
| tirar precisión antes de concealment | mover elegibilidad y dados después del éxito porcentual |
| doble d100 en crítico | roll único antes de crear `activeAttackThreat`; no persistir callback/roller |
| divergencia UI/servidor | helper compartido; UI solo proyecta |
| fuente futura necesita perspectiva atacante | `perspective` declarativa desde el inicio |
| porcentaje 50 implica semántica total por accidente | `kind` y porcentaje independientes |
| tests crean API de producción | catálogo/harness local bajo TEST_MODE; WS sin campos nuevos |
| información oculta filtrada por logs | mensaje público no distingue casilla vacía/fallo cuando targeting exista |

## 21. Estrategia de tests posterior a `Proceed`

### Unitarios shared

- none, partial 20 y total 50;
- 20+20, 20+50 y empate partial/total 50;
- deduplicación, orden y trazas applied/suppressed;
- remoción de fuente;
- perspectiva attacker/target;
- Cover no cambia el porcentaje;
- snapshot conserva las instancias necesarias y no persiste assessment;
- mismo assessment consumido por servidor y UI.

### Resolver/handler

- hit contra CA + d100 dentro de umbral = miss final;
- hit + d100 fuera de umbral = impacto;
- fallo contra CA no consume d100;
- natural 20 puede fallar por concealment;
- concealment miss no daña, no aplica precisión/on-hit/save, no crea crítico;
- concealment presente pero superado sigue impidiendo Sneak Attack;
- crítico exitoso usa un solo d100;
- cada iterativo y AdO obtiene roll independiente;
- melee, ranged, touch, ray, Charge y maniobra touch;
- preflight rechazado no consume RNG ni muta;
- Bull Rush/AoE/automatic effects no usan miss chance.

### E2E WebSocket

- fixtures 20 y 50 bajo harness aislado;
- éxito/fallo y logs;
- Full Attack con resultados independientes;
- autoridad: payload con porcentaje/roll extra es rechazado por schema estricto;
- ninguna ampliación del contrato WS.

### Playwright

Un journey focalizado es justificable: preview muestra porcentaje y label, no genera d100, y el log muestra el resultado autoritativo. No cubre combinatoria ni targeting total.

## 22. Definition of Done de implementación futura

- `DEFENSE-CONCEALMENT` tiene un único assessment compartido, puro y trazable.
- No queda consumidor del marker dormido ni dos contratos paralelos.
- No existen checks de IDs concretos en reducer, rules, resolver o handlers.
- Cover y Concealment permanecen separados.
- d100 `1..100` es server-side, inyectable y único por intento que supera CA.
- Todas las rutas con attack roll aplican el mismo orden.
- Natural 20, críticos, Sneak Attack, on-hit, Full Attack y AdO cumplen la matriz.
- No hay fuente productiva nueva ni estado derivado persistido.
- Registry posterior a implementación dice “Infraestructura solamente”/“Parcial”, no “Completo”.
- Suites focales y gates globales quedan verdes antes de actualizar estado documental.

## 23. Preguntas abiertas para aprobación

1. ¿Se ratifica `D-02` como error de etiqueta del corpus y se autoriza usar la interpretación concordante con el SRD?
2. ¿Se aprueba la **Opción D** y el status futuro “Infraestructura solamente”, aun cuando el core soporte matemáticamente 20%/50%?
3. ¿Se aprueba retirar el marker dormido `Modifier.mechanic/CONCEALMENT` y sustituirlo por `concealmentContributions`, dado que no tiene productores ni consumidores?
4. ¿Se aprueba que los flags normativos de targeting/AdO formen parte del assessment, pero que sus consumidores queden explícitamente diferidos?
5. ¿Se confirma que la presencia de cualquier concealment suprime Sneak Attack aunque el d100 permita impactar, usando la fuente externa de la clase Rogue?
6. ¿Se aprueba no introducir `AttackAttemptProjection` durante esta vertical y componer el assessment en `AttackContextModifiers`?

**Pausa obligatoria:** sin `Proceed` no se modifica código, tests, Registry ni estado de implementación.
