# Sprint 045 — Entangled: condición oficial y componible

**Estado:** diseño aprobado internamente para revisión; no implementado

**Alcance recomendado:** Opción B — Entangled Core, explícitamente parcial

**Rule ID propuesto:** `EFFECT-ENTANGLED` (no registrar hasta recibir `Proceed`)

**Pipeline rector:** [Arquitectura del pipeline de modificadores](modifier-pipeline-architecture.md)

## 1. Objetivo

Diseñar una única vertical oficial para **Entangled** sin crear variantes de Attack,
Movement, Run, Charge o Spell Casting. La condición debe contribuir a esas reglas a
través de contratos especializados y compartidos por servidor y UI.

Este documento separa deliberadamente:

- el núcleo táctico implementable con la infraestructura actual;
- la capacidad mínima nueva necesaria para representar velocidad fraccionaria;
- la dependencia de Concentration que impide declarar la condición completa;
- las reglas de escape, duración o inmovilización que pertenecen a la fuente concreta.

No forman parte del sprint Blinded, Dazzled, estados de miedo, Exhausted, Stunned,
Helpless Combat, Concealment, Vision ni Line of Effect.

## 2. Fuente normativa

### 2.1 Fuentes locales

La carpeta `combat/` es la referencia funcional del Capítulo 8. Sus tablas y reglas
confirman el efecto de los modificadores sobre ataque, Destreza, CA, salvaciones,
movimiento, terreno difícil y spellcasting, pero no contienen una definición completa
de Entangled:

- `combat/03_estadisticas_de_combate.txt`: efectos de Destreza sobre CA y Reflex.
- `combat/05_acciones.txt`: Concentration al lanzar bajo distracción.
- `combat/06_ataques.txt`: composición de los modificadores de ataque.
- `combat/08_ataques_de_oportunidad.txt`: interrupciones durante spellcasting.
- `combat/09_posicionamiento.txt`: coste por casilla, terreno difícil y movimiento mínimo.
- `combat/10_modificadores_de_combate.txt`: penalizadores por condición.

### 2.2 Dependencia normativa externa al corpus local

La definición completa se contrastó con el SRD 3.5 publicado en d20srd:

- [Condition Summary — Entangled](https://www.d20srd.org/srd/conditionSummary.htm#entangled).
- [Concentration](https://www.d20srd.org/srd/skills/concentration.htm).
- [Casting Spells — Entangled](https://www.d20srd.org/srd/magicOverview/castingSpells.htm#entangled).
- [Actions in Combat — 5-Foot Step](https://www.d20srd.org/srd/combat/actionsInCombat.htm#take5FootStep).
- [Movement](https://www.d20srd.org/srd/movement.htm).
- [The Basics — stacking and multipliers](https://www.d20srd.org/srd/theBasics.htm).
- [Entangle spell](https://www.d20srd.org/srd/spells/entangle.htm), usada únicamente
  para distinguir la condición de una fuente concreta.

Wizards mantiene como referencia de soporte los recursos SRD y errata de 3.5:
[D&D 3rd/3.5 rules resources](https://dnd-support.wizards.com/hc/en-us/articles/360000962623-Dungeons-Dragons-3rd-3-5-and-4th-Edition-Rules-Questions).

La fuente normativa determina el comportamiento. Las firmas y el orden del pipeline
que siguen son decisiones arquitectónicas del proyecto.

## 3. Regla oficial exacta, parafraseada

Un combatiente Entangled:

1. recibe **-2 a todas las tiradas de ataque**;
2. recibe **-4 a Destreza**;
3. se mueve a **la mitad de su velocidad**;
4. **no puede correr ni cargar**;
5. para lanzar un conjuro debe superar Concentration con **DC 15 + nivel del
   conjuro** o pierde el conjuro;
6. puede quedar completamente inmóvil si las ataduras están ancladas, pero esa
   restricción adicional depende de la fuente;
7. no adquiere por la condición una acción universal de escape.

La condición no prohíbe por sí misma el 5-foot step. La regla general sí lo prohíbe
si la velocidad efectiva es de 5 pies o menos, y el terreno difícil impide ejecutarlo.

Una red, el conjuro *Entangle* u otra fuente puede definir duración, salvación,
Strength/Escape Artist, anclaje y modo de remoción. Esos datos no se incorporan a
la definición universal `srd_entangled`.

## 4. Estado actual del motor

### 4.1 Infraestructura disponible

- `EffectDefinition.modifiers` y `EffectReducer` expresan penalizadores numéricos
  con stacking determinista y trazas.
- `EffectStat.ATTACK` alimenta `Rules.totalAttackBonus`.
- `EffectStat.DEXTERITY` alimenta `getEffectiveAbilityScore`; la CA, Reflex y los
  ataques basados en Destreza heredan el valor efectivo.
- `RuleOverride.FORBID_RUN` es consumido por `canRun`.
- `RuleOverride.FORBID_CHARGE` es consumido por
  `apps/server/src/combat/chargeResolver.ts::canCharge`.
- `Rules.totalSpeedFeet` es la frontera compartida que consumen movimiento, Run,
  previews y paneles de UI.
- `calculatePathStepCostsFeet` y `validateMovePath` modelan el coste por casilla y
  el terreno difícil sin alterar la velocidad del actor.
- `EffectInstance`, `EffectManager` y Tick Layer ya preservan fuente, objetivos,
  duración y expiración.
- Spellcasting posee `SpellsCatalog`, slots preparados y commit transaccional en
  `handleCastSpell`.

### 4.2 Capacidades ausentes

- `EffectStat.SPEED` solo expresa deltas planos; no puede representar “mitad de
  velocidad” sin degradar la regla.
- El reducer no proyecta factores racionales de movimiento.
- No existe dominio de Concentration: `SkillId` solo contiene `escape_artist`, el
  perfil persistido no guarda ranks de Concentration y spellcasting no evalúa la
  distracción Entangled.
- `canUseFiveFootStep` no aplica todavía la regla general “speed 5 ft or less”.
- La UI no presenta una lista canónica de ActiveEffects con desglose de velocidad.

No existe lógica productiva ni suite específica para Entangled.

## 5. Rule ID

`docs/rules/registry.md` no contiene hoy una entrada para Entangled. Tras `Proceed`
se propone registrar:

| Rule ID | Regla | Estado inicial |
|---|---|---|
| `EFFECT-ENTANGLED` | Condición Entangled | `Parcial — falta Concentration` |

El estado no será “Completo” mientras el chequeo de Concentration y la pérdida del
conjuro no formen parte del camino autoritativo. Este sprint de diseño no modifica
el Registry ni abre el Rule ID.

## 6. Clasificación como modificador

Entangled es un **modificador compuesto**, no una regla base y no infraestructura.
Contribuye a reglas ya existentes:

| Consecuencia | Regla base afectada | Etapa oficial |
|---|---|---|
| -2 ataque | Attack | Proyección efectiva |
| -4 DEX | Ability/AC/Reflex/Attack | Proyección efectiva |
| velocidad ×1/2 | Movement | Contribuciones estructurales → proyección |
| Run prohibido | Run | Preflight |
| Charge prohibido | Charge | Preflight |
| Concentration | Spell Casting | Preflight transaccional |

Ningún handler o resolver general debe consultar
`effectId === "srd_entangled"`.

## 7. Capas afectadas

```text
EffectInstance("srd_entangled", fuente, duración)
  → EffectDefinition
      ├─ numeric ATTACK -2
      ├─ numeric DEXTERITY -4
      ├─ movement rate 1/2
      ├─ FORBID_RUN
      └─ FORBID_CHARGE
  → proyecciones compartidas de ataque, abilities y movimiento
  → preflight compartido de Run/Charge/5-foot step
  → resolver de la regla base
  → log y commit autoritativos
```

La fuente crea o remueve la instancia. La definición aporta las consecuencias. La
operación base nunca conoce el ID de la condición.

## 8. Contratos existentes reutilizados

1. **`EffectDefinition.modifiers`** para ATTACK y DEXTERITY.
2. **`stackingGroup` / `stackingPolicy`** para evitar duplicar penalizadores de la
   misma condición.
3. **`ruleOverrides`** para `FORBID_RUN` y `FORBID_CHARGE`.
4. **`EffectReducer.reduceEffectsForTarget`** para proyección numérica, overrides y
   trazas.
5. **`getEffectiveAbilityScore`** para propagar DEX a CA, Reflex y ataques que la
   utilicen.
6. **`Rules.totalAttackBonus`** para consumir ATTACK sin una rama Entangled.
7. **`Rules.totalSpeedFeet`**, `canRun`, `canCharge`, `canUseFiveFootStep`,
   `validateMovePath` y `runSpeedBudgetFeet` como fronteras existentes.
8. **`EffectInstance.source`**, políticas de duración, `EffectManager` y Tick Layer
   para ciclo de vida definido por cada fuente.
9. **Combat snapshot** como estado autoritativo compartido con React.

No se propone `RuleModifier`, `UniversalModifier`, `GameModifier` ni una colección
anónima de multiplicadores.

## 9. Contrato nuevo estrictamente necesario

### 9.1 Contribución especializada de tasa de movimiento

Extender `EffectDefinition` con una contribución cerrada al dominio Movement:

```ts
interface MovementRateContribution {
  readonly id: string;
  readonly label: string;
  readonly stackingKey: string;
  readonly numerator: number;
  readonly denominator: number;
}

interface EffectDefinition {
  // contratos actuales…
  readonly movementRateContributions?: readonly MovementRateContribution[];
}
```

Restricciones:

- numerador y denominador son enteros positivos; el denominador no puede ser cero;
- `stackingKey` identifica la misma consecuencia normativa, no la instancia;
- varias instancias de Entangled comparten
  `condition:entangled:half-speed` y aportan un solo factor;
- consecuencias diferentes usan claves diferentes y se multiplican;
- dos definiciones que reutilicen una clave con razones distintas constituyen un
  conflicto de catálogo y deben fallar de forma explícita;
- la evaluación y las trazas se ordenan determinísticamente por clave e ID;
- el contrato solo afecta la velocidad efectiva, nunca el coste de casillas ni el
  multiplicador de Run.

No se extiende el `Modifier` universal: su semántica actual es una proyección
numérica por stat, mientras que una tasa debe componerse, deduplicarse y redondearse
con reglas propias.

### 9.2 Proyección compartida

La frontera recomendada es una función pura y especializada:

```ts
interface MovementSpeedProjection {
  readonly preRateFeet: number;
  readonly rateNumerator: number;
  readonly rateDenominator: number;
  readonly totalFeet: number;
  readonly parts: readonly string[];
  readonly applied: readonly MovementRateTrace[];
  readonly suppressed: readonly MovementRateTrace[];
}

getMovementSpeedProjection(snapshot, combatant): MovementSpeedProjection
```

`Rules.totalSpeedFeet` delegará en `projection.totalFeet`. Servidor y UI consumirán
la misma función. El trace permite explicar qué factor se aplicó y qué duplicado se
suprimió sin persistir resultados derivados.

La contribución pertenece a la definición del efecto; no se copia al snapshot, al
perfil ni al WebSocket.

## 10. Stacking y precedencia

### 10.1 Penalizadores numéricos

La futura entrada `srd_entangled` declarará:

- ATTACK `-2`, grupo `condition:entangled`, política `lowest_value`;
- DEXTERITY `-4`, grupo `condition:entangled`, política `lowest_value`.

El reducer separa internamente por stat, grupo y polaridad. Dos instancias Entangled
no suman `-4 ATTACK` ni `-8 DEX`; una única consecuencia queda aplicada. Las
instancias permanecen separadas para que fuente, duración y remoción sigan siendo
correctas.

Penalizadores sin tipo de condiciones diferentes se aplican todos, salvo una regla
específica más restrictiva:

- Fatigued + Entangled: STR -2 y DEX total -6; Run/Charge siguen prohibidos.
- Prone + Entangled, ataque melee: -4 de Prone y -2 de Entangled, total -6.
- otras penalizaciones ATTACK o DEX con distinto grupo: se suman.

### 10.2 Factores de velocidad

Orden canónico del cálculo:

1. `CANNOT_MOVE` produce 0 inmediatamente.
2. Se deriva la velocidad ya ajustada por tamaño/equipo/armadura.
3. Se aplican los deltas actuales de Buff y `EffectStat.SPEED` para preservar el
   comportamiento existente.
4. Se deduplican contribuciones de tasa por `stackingKey`.
5. Se multiplican los factores racionales distintos.
6. Se redondea una sola vez hacia abajo a pies enteros y se limita el resultado a
   un mínimo de 0.
7. La economía de acciones crea el presupuesto desde esa velocidad.
8. El terreno, squeezing y demás modificadores de trayecto calculan costes por paso.
9. Run y Charge ejecutan sus respectivos preflights; Entangled los rechaza.

Ejemplos:

| Caso | Resultado |
|---|---|
| speed 30 + Entangled | 15 ft |
| speed 20 por armadura + Entangled | 10 ft |
| speed 15 + Entangled | 7 ft; puede pagar una casilla de 5 ft |
| dos instancias Entangled | un único ×1/2 |
| Exhausted futuro ×1/2 + Entangled ×1/2 | ×1/4 |

No se adopta el redondeo especial de *Slow* al múltiplo de 5 porque la definición de
Entangled no contiene esa excepción. La regla general de fracciones redondea hacia
abajo; el grid limita después el desplazamiento a pasos pagables.

El orden actual entre bonos planos de velocidad y armadura se conserva en esta
vertical; corregir o generalizar Haste/equipment es otro problema normativo.

## 11. Movimiento y difficult terrain

Velocidad y coste son magnitudes distintas:

- Entangled reduce el presupuesto de movimiento mediante velocidad ×1/2.
- Difficult terrain aumenta el coste de las casillas atravesadas.
- Ambos se componen sin que `validateMovePath` consulte la condición.

Con speed 30, Entangled produce un presupuesto normal de 15 ft. Si cada casilla de
5 ft cuesta 10 ft por difficult terrain, solo puede pagarse una casilla. Esto equivale
a una cuarta parte del alcance habitual, pero surge de dos etapas diferentes.

La regla general de movimiento mínimo mediante acción de asalto completo ya aparece
en el corpus local, pero no tiene hoy una operación explícita en el motor. Entangled
puede hacer visible esa carencia en velocidades muy bajas; no se la absorberá de
forma silenciosa dentro de la condición.

### 11.1 5-foot step

Entangled no lo prohíbe por identidad. La implementación futura debe hacer que
`canUseFiveFootStep` consulte la proyección compartida y rechace cuando:

- `CANNOT_MOVE` esté activo;
- la velocidad efectiva sea igual o menor que `board.cellSizeFeet`;
- exista cualquier restricción ya vigente de economía de acciones;
- el camino de una casilla tenga difficult terrain u otra ilegalidad existente.

Esta corrección pertenece a la regla general del 5-foot step y se activa de manera
isomorfa para cualquier futura reducción de velocidad.

## 12. Run y Charge

Entangled declara `FORBID_RUN` y `FORBID_CHARGE`.

- `canRun` ya consume el primer override antes de construir el presupuesto.
- `canCharge` ya consume el segundo en el servidor.
- los rechazos deben ocurrir en preflight, antes de mutar turno, posición, efectos,
  logs de resolución o recursos.
- `runSpeedBudgetFeet` puede seguir siendo matemáticamente válido sobre la velocidad
  efectiva; nunca será ejecutable cuando `canRun` rechaza.

La UI debe presentar el mismo rechazo compartido y no inferirlo del ID del efecto.

## 13. Spellcasting / Concentration

### 13.1 Estado y recorte

El motor tiene catálogo de conjuros, slots y resolución transaccional, pero no un
check de Concentration ni persistencia de sus ranks. Por ello la **Opción B no
implementa esta consecuencia** y Entangled permanece parcial.

La DC normativa pertenece a la interacción Spell Casting + distracción Entangled:
`15 + spell.level`. No pertenece a `EffectInstance.source`, no es una DC universal y
no debe ser inventada por el cliente.

### 13.2 Dependencia futura mínima

Una vertical de Concentration deberá diseñar explícitamente:

- `concentration` dentro del dominio de skills;
- migración versionada de perfiles y fixtures, sin fallback silencioso;
- una evaluación compartida del check basada en ranks, CON efectiva y otros bonos;
- una contribución especializada de distracción de spellcasting con base DC 15 y
  suma del nivel del conjuro;
- múltiples distracciones distintas, cada una con su check cuando la norma lo exija;
- tirada autoritativa e inyectable en el servidor;
- semántica transaccional: en fallo se consume la acción y se pierde/expende el
  conjuro, pero no se aplican sus consecuencias;
- orden respecto de AdO interruptivos y Concentration por daño.

No se propone ese contrato en detalle aquí: hacerlo sin auditar todo Concentration
convertiría Entangled en un rediseño oculto de Spell Casting.

## 14. UI preview

La UI nunca calcula Entangled por su cuenta:

- `viewModel.ts` y `ActionsPanel.tsx` consumen
  `getMovementSpeedProjection`/`Rules.totalSpeedFeet` para rango y presupuesto.
- `SelectedInfo.tsx` muestra velocidad efectiva y el desglose
  `Entangled ×1/2`; el ataque mostrado ya incorpora ATTACK -2.
- Run y Charge se deshabilitan con la misma evaluación compartida de preflight y un
  motivo legible.
- el 5-foot step usa `canUseFiveFootStep`, no `effectInstances.some(...)`.
- la condición activa se presenta desde `effectInstances` + catálogo, incluyendo
  fuente/duración disponibles, sin duplicar sus reglas en React.

Playwright solo es necesario si se añade esa interacción visual crítica; la
matemática se cubre en shared y handlers.

## 15. Logging y trazabilidad

- La aplicación/remoción mantiene `instanceId`, `catalogId`, fuente y duración.
- La proyección de movimiento registra tasas aplicadas y suprimidas.
- El rechazo de Run/Charge conserva el motivo del `RuleResult`.
- Los logs de ataque usan el breakdown existente del cálculo; no necesitan un caso
  especial Entangled.
- Dos fuentes Entangled deben ser auditables como instancias distintas aunque solo
  una consecuencia mecánica se aplique.

No se amplía en esta vertical el contrato general de etiquetas para todos los
modificadores numéricos; es una mejora de presentación independiente.

## 16. Compatibilidad legacy

No se persiste velocidad derivada ni un flag `isEntangled`. Las salas y perfiles
existentes sin la condición mantienen el mismo resultado. El nuevo campo opcional de
`EffectDefinition` vive en el catálogo de código y no exige migración de snapshots o
localStorage.

La futura incorporación de Concentration sí requerirá una versión de perfil y una
migración explícita de `SkillRanks`; no forma parte de Entangled Core.

## 17. Simplificaciones y alcance parcial

### 17.1 Opciones evaluadas

| Opción | Ventaja | Riesgo | Decisión |
|---|---|---|---|
| A — completa | Cierra toda la norma en un sprint | Mezcla Movement con una nueva vertical de skills, Concentration, slots y AdO | Descartada ahora |
| B — Core | Entrega todos los efectos tácticos soportables y el contrato de velocidad correcto | Debe comunicarse y registrarse como parcial | **Recomendada** |
| C — solo infraestructura | Reduce el cambio inmediato | Aplaza valor aunque ataque/DEX/overrides ya están maduros | Descartada |

### 17.2 Recomendación

Implementar **Opción B — Entangled Core** tras `Proceed`:

- `-2 ATTACK`;
- `-4 DEXTERITY`;
- velocidad `×1/2` mediante contribución especializada;
- bloqueo declarativo de Run y Charge;
- composición con movimiento, terrain y 5-foot step;
- preview/logs compartidos;
- estado documental `Parcial — falta Concentration`.

No se presentará la condición como completa en UI, Registry, status ni walkthrough.

## 18. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Simular ×1/2 con delta fijo | Resultado incorrecto para speeds distintas | Factor racional especializado |
| Doble aplicación por múltiples fuentes | Penalizadores y velocidad excesivos | grupos numéricos + `stackingKey` |
| Confundir speed con terrain cost | Errores en Run, movimiento y preview | etapas y contratos separados |
| Redondear en cada factor | Pérdida acumulativa no normativa | componer racionales y redondear una vez |
| Check por `srd_entangled` | Acoplamiento en resolvers | catálogo declarativo y proyecciones |
| Declarar “completa” sin Concentration | Divergencia oficial visible | Rule ID y UI explícitamente parciales |
| Fuente universal de escape | Homebrew accidental | duración/remoción/escape en la fuente |
| Introducir Concentration sin modelo de skills | Datos inventados o slots corruptos | vertical dedicada y migración versionada |
| Speed ≤5 sin movimiento mínimo | Actor más restringido que la norma | registrar gap de Movement; no ocultarlo en Entangled |

### 18.1 Filtro de irreversibilidad a 20 sprints

El factor racional especializado admite Entangled, Exhausted y futuras reducciones
sin conocer condiciones concretas. Las fuentes siguen siendo instancias separadas;
el catálogo aporta comportamiento y el snapshot no persiste derivados. La misma
proyección sirve a servidor, React y futuros planners.

### 18.2 Complejidad accidental

Solo se añade un contrato porque el existente no expresa tasas. Ataque, DEX,
Run/Charge, duración, stacking numérico y Tick se reutilizan. No se generaliza un
sistema universal ni se modifica el resolver de ataque.

### 18.3 Regla de tres

La contribución de tasa desbloquea al menos:

1. Exhausted (mitad de velocidad, además de sus penalizadores propios).
2. efectos de *Slow* tras modelar su redondeo específico.
3. futuras fuentes oficiales que multiplican la velocidad sin alterar terreno o Run.

La futura vertical de Concentration desbloqueará Entangled completo, casting
defensivo y Concentration por daño, justificándose por separado.

## 19. Tests requeridos

### 19.1 Unitarios shared

- `tests/effects-reducer.test.mjs`
  - ATTACK -2 una sola vez;
  - DEXTERITY -4 una sola vez;
  - overrides Run/Charge presentes;
  - dos instancias no duplican penalizadores.
- nueva `tests/entangled-condition.test.mjs`
  - speed 30 →15, 20→10 y 15→7;
  - factores racionales se componen y redondean una sola vez;
  - dos Entangled aplican un solo ×1/2;
  - sin Entangled no cambia ningún resultado;
  - DEX efectiva baja 4 y propaga a CA/Reflex;
  - Prone + Entangled aplica ambos modificadores de ataque;
  - Fatigued + Entangled combina penalties sin duplicar overrides;
  - armor speed se resuelve antes del factor;
  - difficult terrain mantiene coste por casilla separado;
  - `canRun`, `canUseFiveFootStep` y sus razones normativas.
- `tests/conditions-v3.test.mjs`, `tests/run.test.mjs`,
  `tests/five-foot-step.test.mjs`, `tests/difficult-terrain.test.mjs`:
  regresiones focalizadas de las fronteras existentes.

### 19.2 Handler/integración

- actor Entangled no corre ni carga;
- movimiento ordinario consume el presupuesto proyectado;
- ataque aplica -2 una sola vez;
- todo rechazo de preflight deja sala, turno y logs sin mutación parcial;
- servidor y preview parten de la misma proyección.

### 19.3 Spellcasting

Fuera del alcance B. Los casos obligatorios para la futura dependencia son:

- Concentration exigida con DC 15 + spell level;
- éxito continúa el lanzamiento;
- fallo consume acción y conjuro/slot, sin aplicar el efecto;
- DC autoritativa y no aportada por cliente;
- error del roller no corrompe estado;
- interacción determinista con AdO y daño.

### 19.4 E2E y UI

- WebSocket: aplicar el efecto con la infraestructura de fixture existente; comprobar
  ataque, movimiento, Run/Charge, logs y ausencia de doble aplicación.
- Playwright: añadir journey solo si se implementa el indicador/desglose visual;
  verificar velocidad, condición activa y acciones deshabilitadas.

## 20. Definition of Done

Entangled Core estará terminado únicamente cuando:

- exista `EFFECT-ENTANGLED` en Registry con estado parcial explícito;
- `srd_entangled` sea declarativo y no haya checks por ID en reglas generales;
- el factor racional de movimiento tenga contrato, validación, trazas y stacking;
- `Rules.totalSpeedFeet` sea la única proyección numérica pública de velocidad;
- ataque, DEX, CA, Reflex, movement, Run, Charge y 5-foot step sean coherentes;
- servidor y UI consuman las mismas proyecciones;
- múltiples fuentes no dupliquen consecuencias y sí conserven su ciclo de vida;
- rechazo de acciones sea atómico;
- tests unitarios, integración, WebSocket y UI aplicables estén verdes;
- typecheck y build estén verdes;
- documentación de Registry, cobertura, desviaciones, deuda, status, roadmap, TODO,
  memoria y walkthrough refleje el alcance real;
- Concentration permanezca identificada como dependencia abierta;
- ninguna fuente de aplicación/escape se haya inventado dentro de la condición.

## Decisiones abiertas para aprobación

1. Aprobar la **Opción B** y el estado `Parcial — falta Concentration`.
2. Aprobar `MovementRateContribution` como contrato especializado mínimo.
3. Confirmar el redondeo general hacia abajo a pies enteros, sin importar la regla
   especial de *Slow*.
4. Aceptar que la acción de movimiento mínimo y Concentration se diseñen como
   dependencias separadas, sin ocultarlas dentro de Entangled.
