# NDD Sprint 018: Maniobras Tácticas Especiales — Derribo

## Estado

- Fase: 2 — diseño en curso.
- Implementación: bloqueada hasta recibir aprobación formal `Proceed`.
- Baseline: Sprint 017 cerrado; las aserciones TypeScript protegen `CombatantSnapshot`, `CreatureTemplate` y `StoredProfile` contra la reintroducción de caches escalares prohibidos.
- Invariantes: servidor autoritativo, estadísticas derivadas en caliente, snapshots inmutables, catálogos declarativos y una sola mutación observable por comando.

## 1. Objetivo

Sprint 018 introduce Derribo como primera maniobra especial formal y, al hacerlo, crea una infraestructura reutilizable para transacciones tácticas que combinan:

1. validación de intención y alcance;
2. una posible interrupción mediante Ataque de Oportunidad;
3. una tirada de ataque sin daño contra una proyección concreta de CA;
4. una prueba enfrentada con características y tamaño;
5. una consecuencia declarativa aplicada mediante ActiveEffects.

El resultado no será un `if (action === "trip")` incrustado entre mutaciones del handler. La capa compartida evaluará y resolverá la maniobra; el servidor autorizará la intención, obtendrá las tiradas, construirá un plan de resultado y realizará un único commit.

## 2. Mapeo obligatorio del repositorio

### 2.1. Condición `srd_prone`

`packages/shared/src/effects/catalog.ts` ya declara:

- trait `PRONE`;
- `onStack: "ignore"`;
- un modificador condicional de CA para melee;
- un modificador condicional de CA para ranged;
- un penalizador `−4` a los ataques melee del afectado.

La infraestructura es la correcta y debe reutilizarse: Derribo exitoso agrega una instancia de `srd_prone`; no crea buffs paralelos ni escribe penalizadores en el combatiente.

La auditoría detectó, sin embargo, una divergencia normativa previa a Sprint 018. El catálogo actual contiene:

```text
CA contra melee:  +4
CA contra ranged: -4
ataques melee:    -4
```

D&D 3.5 establece para un defensor tumbado:

```text
CA contra melee:  -4
CA contra ranged: +4
ataques melee:    -4
```

Por tanto, la implementación de Sprint 018 tendrá como precondición corregir los dos valores defensivos y sus tests. Aplicar el efecto sin esta corrección institucionalizaría una regla inversa. No se cambiará el modelado de `srd_prone`, solo sus datos normativos.

La maniobra rechazará un objetivo que ya posea el trait `PRONE`, evitando instancias duplicadas aunque `EffectManager` siga siendo la única capa autorizada para agregar efectos.

### 2.2. Modificador especial de tamaño

`SizeRulesCatalog.grappleModifier` ya contiene la progresión exacta requerida por las pruebas especiales de Fuerza:

| Tamaño | Modificador |
| --- | ---: |
| Fine | −16 |
| Diminutive | −12 |
| Tiny | −8 |
| Small | −4 |
| Medium | 0 |
| Large | +4 |
| Huge | +8 |
| Gargantuan | +12 |
| Colossal | +16 |

No se creará una segunda tabla de Derribo. Se expondrá un selector semántico como `getSpecialManeuverSizeModifier(sizeCategory)` que, en Sprint 018, delega en `getSizeRule(category).grappleModifier`. El nombre del campo existente queda encapsulado para que Grapple, Bull Rush, Overrun y Trip consuman la misma progresión sin acoplar todos sus resolvers al término “grapple”.

La restricción oficial de tamaño también se validará: solo puede derribarse a una criatura como máximo una categoría mayor que el atacante. La comparación usará un orden canónico de `SizeCategory`, no diferencias entre modificadores de CA.

### 2.3. Infraestructura reutilizable

- `Rules.totalArmorClass` ya soporta `targetAcType: "touch"`, ataque melee, cobertura y condiciones contextuales.
- `Rules.totalAttackBonus` ya aplica BAB, característica efectiva, tamaño, efectos y modificadores condicionales como Prone.
- `getAttackContextModifiers` ya produce el `+2` de flanqueo solo para melee.
- `threatensTarget` y `ThreatProfile` ya conocen alcance dinámico e intervalos de reach.
- `Rules.canMakeOpportunityAttack` y `threatensTarget` son los predicados compartidos para determinar si el defensor puede ejecutar la interrupción.
- `resolveAttack` y `resolveCriticalConfirmation` contienen la matemática vigente de impacto, daño, precisión y críticos.
- `EffectManager.add` es la frontera autorizada para agregar `srd_prone`.
- `canStandardAttack`, economía de acciones, ownership y `applyDisabledExertion` ya cubren las validaciones comunes del handler.

### 2.4. Límites encontrados

| Área | Estado actual | Consecuencia para Sprint 018 |
| --- | --- | --- |
| ataque | `resolveAttack` siempre construye daño mínimo y puede añadir precisión | no sirve directamente para el toque iniciador, que no causa daño |
| AdO | el flujo normal persiste `pendingOpportunityAttacks` y puede abrir `critical-confirmation` | no puede usarse como una pausa dentro de una maniobra atómica |
| características | `getEffectiveAbilityScore` es privado de `rules.ts` | la prueba enfrentada no debe recalcular efectos por su cuenta |
| dotes | `featIds` es `string[]` sin catálogo mecánico formal | no debe buscarse `"improved_trip"` mediante condicionales dispersos |
| armas | `WeaponEntry` conoce `isReach`, pero no capacidad de derribo | no toda arma con reach permite Trip y no toda arma de Trip tiene reach |
| handler | `use-tactical-action` acumula ramas por acción | seguir agregando ramas fragmentaría futuras maniobras |
| Prone | valores defensivos invertidos | debe corregirse antes de usar la condición como postcondición |

## 3. Decisiones arquitectónicas

### 3.1. Un comando de intención, no un protocolo por fase

Se introducirá un único contrato estable:

```ts
interface ResolveSpecialManeuverCommand {
  type: "resolve-special-maneuver";
  roomCode: string;
  actorId: string;
  combatantId: string;
  targetId: string;
  maneuverId: SpecialManeuverId;
}
```

Sprint 018 registra `maneuverId: "trip"`. Grapple, Bull Rush o Disarm ampliarán el catálogo/unión de IDs, no el dispatcher ni la forma del payload.

El cliente no envía:

- si provoca AdO;
- dote, arma o capacidad seleccionada;
- Touch AC ni `targetAcType`;
- característica defensiva elegida;
- modificadores de tamaño;
- resultado, efecto o flags de éxito;
- tiradas parciales que revelen o salten fases.

Para preservar la atomicidad, las tiradas de esta primera infraestructura serán obtenidas por el servidor mediante un `ManeuverDiceSource` inyectable. Producción usa una fuente de dados del servidor y tests una secuencia determinista. Esto evita convertir el WebSocket en una máquina de estados de tiradas. Un modo futuro de dados físicos podrá implementar otro `RollProvider`, pero no alterará los resolvers de reglas.

El schema Zod será estricto y rechazará campos mecánicos o roll bundles inyectados por el cliente.

### 3.2. Catálogo de maniobras

Se modelará un registro declarativo mínimo:

```ts
interface SpecialManeuverDefinition {
  readonly id: SpecialManeuverId;
  readonly label: string;
  readonly actionCost: "standard";
  readonly openingAttack?: OpeningAttackSpec;
  readonly interruptPolicy?: InterruptPolicy;
  readonly contest?: OpposedCheckSpec;
  readonly successOutcome: ManeuverOutcomeSpec;
}
```

La definición de Trip declara:

- interrupción potencial: ataque melee del objetivo;
- apertura: ataque melee de toque, sin daño, con Fuerza;
- oposición: Fuerza del atacante contra la mejor entre Fuerza/Destreza del defensor;
- escala de tamaño: modificador especial;
- resultado exitoso: aplicar `srd_prone` al defensor;
- coste inicial de Sprint 018: acción estándar.

No se pretende crear un lenguaje universal de reglas. El catálogo describe las fases y políticas comunes; validaciones específicas como el límite de una categoría de tamaño viven en un evaluador puro de Trip registrado bajo la misma interfaz.

### 3.3. Dotes y armas como capacidades declarativas

Se introducirá un `FeatCatalog` mínimo y estricto. `srd_improved_trip` aportará una capacidad mecánica como `avoidOpportunityOn: ["trip"]`. Los resolvers consultarán capacidades derivadas, nunca nombres ni IDs literales.

`WeaponEntry` incorporará una propiedad declarativa como:

```ts
specialManeuvers?: readonly SpecialManeuverId[];
```

Se marcarán únicamente las armas que la fuente normativa local identifica como aptas para Derribo —por ejemplo alabarda, bisarma, cadena armada, látigo y manguales correspondientes—. `isReach` no implica capacidad de Trip: una guja, longspear o lance no obtendrá la capacidad por compartir alcance.

El intento elige autoritativamente la fuente equipada:

- si el arma principal posee `specialManeuvers: ["trip"]`, el toque usa esa arma, su intervalo de alcance y no provoca AdO;
- en caso contrario, el intento es un ataque sin arma, usa el alcance natural/unarmed y provoca salvo capacidad de Improved Trip;
- no se permite al cliente afirmar que usa otra arma ni aprovechar el alcance de un arma no equipada.

El `FeatCatalog` queda preparado para declarar en un sprint posterior el `+4` y el ataque gratuito completos de Improved Trip. Sprint 018 solo consume la excepción de AdO exigida por la especificación; el resto se registra explícitamente fuera de alcance.

### 3.4. Ataque de toque sin daño

Se extraerá de `resolveAttack` una primitiva pura `resolveAttackCheck` que calcule:

- alcance y tipo de entrega;
- bonus de ataque, flanqueo y condiciones del atacante;
- CA normal/touch con cobertura y efectos del defensor;
- 1/20 naturales;
- trazas y consumos contextuales.

`resolveAttack` seguirá componiendo daño, Ataque Furtivo y críticos sobre esa primitiva. Trip invocará `resolveAttackCheck` con una fuente autoritativa:

```text
attackType: melee
targetAcType: touch
abilityForAttack: strength
dealsDamage: false
canThreatenCritical: false
```

Así se reutiliza completamente Touch AC sin crear daño mínimo, Ataque Furtivo o amenaza crítica en el toque iniciador. El `+2` de flanqueo se aplica a esta tirada porque es un ataque melee; nunca se suma a la prueba enfrentada.

### 3.5. Resolver genérico de pruebas enfrentadas

La matemática común tendrá contratos trazables:

```ts
interface OpposedCheckOperand {
  readonly combatantId: string;
  readonly selectedAbility: "strength" | "dexterity";
  readonly abilityModifier: number;
  readonly sizeModifier: number;
  readonly contextualModifiers: readonly CheckModifierTrace[];
}

interface OpposedCheckResult {
  readonly rounds: readonly OpposedRollRound[];
  readonly winner: "initiator" | "responder";
  readonly initiator: OpposedCheckOperand;
  readonly responder: OpposedCheckOperand;
}
```

Para Trip:

```text
atacante = 1d20 + mod. Fuerza efectivo + grappleModifier(tamaño)
defensor = 1d20 + max(mod. Fuerza efectivo, mod. Destreza efectivo)
                  + grappleModifier(tamaño)
```

Las puntuaciones efectivas se obtienen a través de un selector público de `Rules`, reutilizando overrides y modificadores del EffectReducer. Fatigued, Paralyzed y futuros daños de característica afectan la maniobra automáticamente. No se leen puntuaciones base como si fueran efectivas ni se guardan totales en el snapshot.

Desempate conforme a pruebas enfrentadas:

1. gana el total mayor;
2. si empatan los totales, gana quien tenga el modificador total mayor;
3. si también empatan los modificadores, el `ManeuverDiceSource` genera una nueva ronda;
4. un guard técnico finito aborta sin mutación ante una fuente patológica que nunca deshaga el empate.

`CheckModifierTrace` permite añadir después estabilidad enana, cuatro o más patas, Improved Trip, carga o efectos sin cambiar la suma central.

## 4. Secuencia transaccional de Trip

### 4.1. Preflight sin mutaciones

Sobre un solo `CombatRulesSnapshot`:

1. validar `room.phase === "active"`, ownership y turno;
2. validar disponibilidad y coste de acción estándar;
3. validar atacante y defensor hostiles, presentes y en estado compatible;
4. rechazar objetivo ya `PRONE`;
5. validar que el defensor no supere al atacante por más de una categoría;
6. resolver la fuente de Trip desde equipo/dotes catalogados;
7. validar el intervalo melee de esa fuente mediante la infraestructura de Reach;
8. calcular preview autoritativo: AdO, flanqueo, Touch AC y modificadores enfrentados;
9. si cualquier validación falla, no consumir acción ni cambiar sala.

### 4.2. Resolución pura por etapas

```text
TripIntent validado
  → ¿provoca y el defensor puede realizar AdO?
      → no: continuar
      → sí: resolver ataque interruptor completo
           → daño final > 0: outcome = aborted_by_opportunity_damage
           → sin daño: continuar
  → resolver ataque melee de toque
      → falla: outcome = touch_miss
  → resolver prueba enfrentada
      → gana defensor: outcome = opposed_check_lost
      → gana atacante: outcome = success(apply srd_prone)
```

La interrupción reutiliza `resolveAttack` y, si amenaza crítico, `resolveCriticalConfirmation` de forma interna con dados del servidor. No crea `activeAttackThreat`: toda confirmación necesaria se consume dentro de la misma evaluación. Daño, precisión, inmunidades, críticos y trazas siguen proviniendo de los resolvers existentes.

La regla de producto exigida para Sprint 018 es estricta: si el AdO causa daño final positivo, Trip se aborta. La fuente normativa local solo explicita esa cancelación para otras maniobras como Grapple/Disarm, no para Trip; se documentará como desviación deliberada del Sprint porque la instrucción de producto la exige.

### 4.3. Commit único

La evaluación devuelve un `ManeuverResolutionPlan` inmutable con:

- outcome y transcript de fases;
- mutación de HP/stats causada por el AdO, si existe;
- consumos de buffs de ataque/CA;
- consumo de acción del atacante;
- efecto a agregar en éxito;
- esfuerzo de Disabled;
- logs ordenados.

Solo después de resolver todas las fases el handler aplica el plan una vez:

1. consume la acción estándar para todo intento válido, aunque lo aborte el AdO;
2. aplica el daño legítimo del AdO y sus estadísticas;
3. agrega `srd_prone` mediante `EffectManager.add` solo en éxito;
4. aplica esfuerzo de Disabled, comprueba resultado del combate y sincroniza fase;
5. emite un solo `room-update`.

Atomicidad significa que no existe estado observable entre fases, no que se revierta el daño de una interrupción válida. El AdO que aborta la maniobra permanece aplicado en el estado final.

No se escriben `pendingTripState`, `pendingOpportunityAttacks` ni `activeAttackThreat` para esta transacción. Tampoco se realizan broadcasts antes del commit.

## 5. Preview compartido y UI

Se expondrá un helper puro:

```ts
evaluateSpecialManeuverIntent(
  snapshot,
  attacker,
  target,
  "trip"
): ManeuverIntentEvaluation;
```

El resultado incluye:

- `allowed` y reason codes;
- fuente seleccionada y rango permitido;
- `provokesOpportunityAttack` y causa de excepción;
- si el defensor puede ejecutar efectivamente ese AdO;
- `flankingBonus` aplicable al toque;
- Touch AC proyectada;
- modificadores enfrentados y característica elegida por el defensor;
- advertencias como objetivo demasiado grande o ya derribado.

`ActionsPanel` añadirá `Maniobra: Derribar` dentro del menú táctico y mostrará, antes de confirmar:

```text
Alcance: válido con Bisarma (10 ft)
AdO: no provoca — arma apta para Derribo
Toque melee: +2 por flanqueo contra Touch AC 12
Prueba: STR +3 / tamaño +0 vs mejor defensa DEX +2 / tamaño +0
```

La UI no replica fórmulas y no envía las conclusiones. El servidor vuelve a llamar al mismo helper sobre su snapshot actual inmediatamente antes de resolver.

## 6. Servidor, ownership y economía de acciones

- Un único `handleResolveSpecialManeuver` recibe todas las maniobras presentes y futuras.
- Un registro `SpecialManeuverResolvers` selecciona la definición/evaluador por ID con exhaustividad TypeScript.
- El dispatcher agrega un solo case estable.
- Ownership y turno se validan antes de obtener dados.
- Sprint 018 expone Trip como acción estándar completa. Sustituir ataques iterativos, ejecutar Trip como AdO o integrarlo dentro de un full attack queda fuera de alcance, pero `actionCost` evita fijar esa decisión dentro de la matemática enfrentada.
- La maniobra usa el mismo control de Disabled que otras acciones esforzadas.
- Si existe una fase crítica u oportunidad pendiente previa, el dispatcher conserva sus bloqueos actuales y no admite el comando.

## 7. Design Review Checklist

### 7.1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería crear un comando y handler distinto por cada paso de cada maniobra (`start-trip`, `resolve-trip-touch`, `resolve-trip-check`). Eso convertiría WebSocket y `CombatRoom` en una reproducción de las reglas de cada ataque especial.

El diseño usa:

1. un solo comando de intención `resolve-special-maneuver`;
2. un catálogo/registro de maniobras;
3. una transacción común `preflight → resolve → commit`;
4. primitivas reutilizables de ataque sin daño, interrupción atómica y prueba enfrentada;
5. operandos declarativos que seleccionan características, BAB, escala de tamaño y modificadores contextuales.

Grapple podrá declarar toque + prueba con BAB/Fuerza/tamaño especial; Bull Rush podrá declarar Fuerza contra mejor Fuerza/Destreza y desplazamiento; Disarm podrá usar operandos de tirada de ataque enfrentada. Ninguno necesita un nuevo protocolo WebSocket ni duplicar el handler.

### 7.2. Complejidad accidental

El pipeline actual de AdO está diseñado para interacción manual diferida: persiste oportunidades y puede abrir confirmación crítica. Intentar reutilizarlo literalmente obligaría a introducir `pendingTripState` y una lógica de reanudación sensible a desconexiones, GM clear, muerte y cambios de fase.

Sprint 018 reutiliza su matemática, no su pausa de UI. El AdO del defensor se resuelve como interrupción interna completa sobre el snapshot. Todas las tiradas se obtienen antes del commit, el plan se calcula sin tocar la sala y se publica una sola transición final. Un error de validación o de fuente de dados anterior al commit deja el estado idéntico.

Esto también evita la contradicción del diseño anterior, que encolaba un AdO y al mismo tiempo continuaba con el toque sin conocer si aquel había causado daño.

### 7.3. Matriz de reutilización

| Capa | Reutilización |
| --- | --- |
| ActiveEffects | `srd_prone` es la única postcondición; `EffectManager` realiza la inyección |
| Pure Helpers | Touch AC, ataque contextual, flanqueo, alcance, amenaza, habilidades efectivas y tamaño |
| Resolvers | `resolveAttackCheck`, ataque/confirmación existentes y `resolveOpposedCheck` genérico |
| Catálogos | SizeRules, Equipment, Feats y SpecialManeuvers aportan capacidades, nunca resultados enviados por el cliente |

### 7.4. La Regla de Tres

1. **Improved Trip:** evita la interrupción; después podrá aportar `+4` y ataque gratuito mediante contribuciones/políticas catalogadas.
2. **Dwarf Stability / anatomía con más de dos patas:** añade `+4` trazable a defensa contra Trip y Bull Rush sin alterar `resolveOpposedCheck`.
3. **Bull Rush:** reutiliza la selección STR contra mejor STR/DEX, el modificador especial de tamaño, contribuciones de estabilidad y la transacción de interrupción/resultado.

La misma infraestructura habilita además Grapple y las tiradas de ataque enfrentadas de Disarm.

### 7.5. Matriz de impacto de subsistemas

- [x] **Rule Engine:** selector público de característica efectiva, tamaño especial, evaluación de intención y prueba enfrentada.
- [x] **CombatRoom / State Schema:** no agrega estado pendiente; solo recibe el efecto `srd_prone` y mutaciones normales ya soportadas.
- [x] **EquipmentCatalog:** agrega capacidades explícitas de maniobra; no infiere Trip desde `isReach`.
- [x] **FeatCatalog / Profile:** formaliza `srd_improved_trip` y valida referencias sin estadísticas precalculadas.
- [x] **Ownership:** el handler valida control del atacante; el defensor no autoriza las decisiones mecánicas del servidor.
- [x] **WebSocket:** un comando genérico nuevo, sin comandos por fase ni resultados mecánicos del cliente.
- [x] **UI:** opción, preview de alcance/AdO/flanqueo y transcript final.
- [x] **Tests:** unitarios, integración transaccional, schemas, WebSocket E2E y Playwright.

## 8. Alternativas consideradas

### A. Reutilizar `pendingOpportunityAttacks` y guardar `pendingTripState`

Rechazada. Introduce estados intermedios, reanudación compleja y contradice la atomicidad solicitada.

### B. Enviar toque, oposición y AdO en un único roll bundle del cliente

Rechazada. El payload revelaría la estructura particular de Trip, crecería de forma distinta para cada maniobra y permitiría enviar resultados de fases que el servidor podría determinar que no existen.

### C. Implementar todo dentro de `tacticalCommands.ts`

Rechazada. Duplicaría matemática, impediría preview isomórfico y fragmentaría el handler.

### D. Inferir armas de Trip por `isReach` o texto de notas

Rechazada. Longspear/glaive/lance y armas de Trip no comparten una equivalencia mecánica. La capacidad debe ser catálogo explícito.

### E. Transacción autoritativa con dados inyectables y commit único

Seleccionada. Mantiene un comando estable, pruebas deterministas, una sola transición observable y reutilización del core matemático.

## 9. Estrategia de testing y Definition of Done

### Catálogos y reglas previas

- `srd_prone` queda en `−4 CA melee`, `+4 CA ranged`, `−4 ataque melee`;
- los nueve valores de `grappleModifier` permanecen exactos;
- arma de Trip explícita evita AdO; un arma reach no apta no lo evita;
- Improved Trip evita AdO por capacidad catalogada, no por string hardcodeado.

### Preflight

- objetivo aliado, muerto, ya prone, fuera de alcance o demasiado grande se rechaza sin mutación ni consumo;
- alcance unarmed y de arma de Trip usa los intervalos derivados correctos;
- estados que impiden actuar o AdO se respetan;
- no hay tiradas antes de completar validación.

### Secuencia

- AdO que falla o no causa daño permite continuar;
- AdO que causa daño se aplica y aborta antes del toque;
- crítico de AdO se confirma internamente sin crear fase pendiente;
- Improved Trip o arma apta omiten por completo la fase de AdO;
- toque melee usa Touch AC, cobertura, Prone y `+2` de flanqueo;
- fallo del toque termina sin prueba enfrentada;
- éxito del toque ejecuta la oposición;
- defensor elige automáticamente el mayor modificador efectivo STR/DEX;
- tamaño usa `grappleModifier`, no el modificador normal de ataque/CA;
- empate usa mayor modificador y, si persiste, una nueva ronda;
- victoria aplica exactamente una instancia de `srd_prone`;
- derrota no aplica condición y no ejecuta contra-derribo.

### Atomicidad

- ningún resultado crea `pendingTripState`, `pendingOpportunityAttacks` o `activeAttackThreat`;
- existe un solo broadcast por comando válido;
- un fallo antes del commit deja una comparación estructural idéntica de la sala;
- el daño de un AdO que aborta sí permanece en el único estado final;
- acción estándar, stats, logs, efectos y evento quedan coherentes en la misma transición.

### Red y UI

- schema estricto rechaza `provokesAoo`, `touchAc`, modifiers, effect IDs y roll bundles enviados por el cliente;
- E2E cubre éxito, aborto por AdO y excepción por Improved Trip/arma;
- Playwright muestra preview de AdO y flanqueo antes de confirmar;
- preview y servidor producen los mismos reason codes para el mismo snapshot.

### Gates posteriores a `Proceed`

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
npm run test:ui
```

Los conteos finales se documentarán desde la salida real.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| usar `resolveAttack` causa daño en el toque | extraer `resolveAttackCheck` sin daño y componer el resolver actual sobre él |
| divergencia preview/servidor | ambos llaman `evaluateSpecialManeuverIntent` sobre snapshots |
| arma reach tratada como arma de Trip | capacidad explícita en EquipmentCatalog |
| características ignoran Fatigued/Paralyzed | selector efectivo público que reutiliza EffectReducer |
| empate infinito con fuente determinista defectuosa | rondas trazadas y guard finito sin commit |
| duplicar `srd_prone` | preflight por trait y aplicación exclusiva mediante EffectManager |
| AdO abre estado crítico pendiente | confirmación interna en la transacción |
| mutación parcial antes de un error | resolución sobre plan inmutable y commit único |
| perfil contiene feat desconocida | schema/catalog validation y cuarentena conforme a la política source-first |
| regla de Prone previa está invertida | corrección normativa y regresión antes de integrar Trip |

## 11. Fuera de alcance

- contra-derribo cuando el atacante pierde;
- `+4` y ataque melee gratuito completos de Improved Trip;
- estabilidad enana, más de dos patas, monturas y prueba de Ride;
- criaturas voladoras, sin extremidades o inmunes a ser derribadas;
- Trip como sustitución de un ataque iterativo, Ataque de Oportunidad o full attack;
- levantarse, su AdO asociado y remoción voluntaria de `srd_prone`;
- seleccionar otra arma equipada durante el comando;
- Grapple, Bull Rush, Overrun, Disarm y Sunder;
- modo de dados físicos/manuales para la transacción multietapa.

Estos límites se documentarán en la matriz normativa. No se simularán mediante fallbacks ni campos planos.

## 12. Frontera de aprobación

Este NDD reemplaza el borrador previo que combinaba un roll bundle del cliente con un AdO diferido incompatible con la atomicidad. Autoriza únicamente diseño y planificación. No se modificarán archivos `.ts`, `.js`, JSON, schemas ni tests antes de recibir la palabra formal `Proceed`.
