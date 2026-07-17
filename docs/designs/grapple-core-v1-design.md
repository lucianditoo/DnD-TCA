# NDD — Sprint 029 Grapple Core V1: Acceso y Agarre

## Estado y frontera de autorización

Fase 2 — diseño técnico. Este documento no autoriza cambios en archivos ejecutables. La implementación queda bloqueada hasta recibir `Proceed` explícito.

## Objetivo

Introducir el inicio autoritativo de Presa de D&D 3.5 como una transacción única:

1. AdO interruptivo del defensor;
2. ataque de toque melee contra Touch AC;
3. prueba enfrentada de Presa;
4. aplicación inmutable de `srd_grappling` a ambos participantes.

Grapple V1 debe reutilizar el orquestador de maniobras, el pipeline Touch AC, los atributos efectivos, el catálogo de tamaño y `EffectManager`. El cliente declara intención y, cuando corresponde, tiradas manuales del atacante; nunca envía CA, modificadores, resultado, tirada defensora ni efectos.

## Hallazgos del repositorio

### Orquestación actual

`specialManeuverCommands.ts` ya contiene las fases necesarias:

- Trip demuestra AdO → toque → oposición → efecto.
- Bull Rush demuestra preflight → oposición → proyección → commit espacial.
- `resolveInterruptingOpportunityAttack` ya resuelve daño y críticos del AdO antes de continuar.
- los empates exactos comparan modificadores y vuelven a tirar de forma autoritativa.

La deuda observable es local: existen resolvers y bucles de oposición específicos para Trip y Bull Rush. Grapple no debe añadir una tercera copia.

### Tamaño y características

`getSpecialManeuverSizeModifier(sizeCategory)` retorna directamente `SizeRulesCatalog[category].grappleModifier`. Esta es la única fuente válida para Trip, Bull Rush y Grapple.

La Fuerza debe proyectarse mediante `getEffectiveAbilityModifier`; así fatiga, drenajes y overrides del ActiveEffects alteran la prueba en tiempo real. BAB procede del snapshot source-first.

### Movimiento y CA

`Rules.totalSpeedFeet` ya retorna cero ante `CANNOT_MOVE`, pero `canUseMoveAction` todavía no produce un error semántico específico. Grapple V1 debe cerrar esa frontera para movimiento normal y paso de 5 pies.

`AttackContext` ya transporta `attackerId`, pero `NO_DEX_TO_AC` es hoy un trait incondicional. Usarlo directamente en `srd_grappling` negaría Destreza incluso contra el compañero de Presa, contradiciendo el alcance solicitado.

## Modelo declarativo del vínculo

### Una instancia, dos participantes

Una Presa exitosa crea una única `EffectInstance`:

```text
effectId: srd_grappling
source: { type: creature, id: initiatorId }
targets: [initiatorId, defenderId]
duration: permanent
```

`targets` funciona simultáneamente como conjunto afectado y membresía del vínculo. No se añade `grappledWithId`, contador, booleano ni relación duplicada a `CombatantSnapshot`. La instancia vive solo en `CombatRoom`, se copia al snapshot y se serializa por el contrato existente.

El orden de `targets` será determinista: iniciador primero y defensor segundo. V1 rechazará iniciar una Presa si cualquiera ya pertenece a una instancia `srd_grappling`; no intentará fusionar grupos ni crear cadenas ambiguas.

### Definición de `srd_grappling`

La definición declarará:

- trait incondicional `CANNOT_MOVE`;
- trait descriptivo nuevo `GRAPPLING` para consultas, previews y reglas futuras;
- trait condicional `NO_DEX_TO_AC` cuando `attackContext.attackerId` no pertenezca a los `targets` de la instancia aplicable;
- sin modificadores numéricos de tamaño, BAB o Fuerza;
- `onStack: ignore` como defensa secundaria, mientras la validación de membresía protege la relación V1.

Se ampliará el contrato de efectos con `conditionalTraits`, paralelo a `conditionalModifiers`, y una condición cerrada y exhaustiva:

```text
attacker_outside_effect_targets: true
```

La evaluación recibe la instancia concreta además del `AttackContext`. Por ello puede comparar `attackerId` con su conjunto de participantes sin codificar IDs en el catálogo.

Reglas de contexto:

- atacante externo y `attackerId` presente: se proyecta `NO_DEX_TO_AC`;
- atacante miembro de la misma instancia: no se niega Destreza por Grapple;
- consulta genérica sin atacante: no inventa vulnerabilidad contextual;
- todo resolver autoritativo de ataque debe aportar `attackerId`, como ya hace el pipeline productivo.

El `EffectReducer` conserva su responsabilidad context-free: reduce traits incondicionales, overrides y estadísticas. La proyección de traits condicionales será un helper puro adyacente al evaluador contextual, no lógica dentro del handler.

## Contrato de la maniobra

### Red

`SpecialManeuverId` y la unión discriminada de Zod incorporarán `grapple`. El payload previsto es:

```text
{
  type: grapple,
  attackerId,
  targetId,
  d20TouchRoll: number | null,
  d20OpposedRoll: number | null,
  isAutoRoll?: boolean
}
```

El servidor genera la tirada defensora. En AUTO genera también las tiradas del atacante. El schema estricto rechaza `targetAcType`, BAB, Fuerza, tamaño, tirada defensora, participantes del efecto o resultado declarado.

### Preview puro

`validateSpecialManeuver(..., "grapple")` producirá un resultado discriminado con:

- distancia y alcance melee efectivo;
- si provoca AdO y si el defensor puede ejecutarlo;
- Touch AC derivada con intercepción y `attackerId`;
- BAB, Fuerza efectiva y tamaño de cada participante;
- total de modificador de Presa por lado;
- razones estructuradas de invalidez, incluida membresía previa en una Presa.

La UI consume este preview; no recalcula fórmula ni riesgo.

## Secuencia transaccional

### 1. Preflight

Antes de cualquier mutación:

- fase activa, ownership y turno;
- acción estándar disponible;
- atacante y objetivo distintos y hostiles;
- estados de vida aptos;
- objetivo dentro del alcance melee entre footprints;
- ninguno pertenece ya a `srd_grappling`;
- comando y tiradas manuales válidos.

### 2. AdO interruptivo

La iniciación provoca AdO del defensor. El helper existente se renombrará y parametrizará para cualquier maniobra. Si el ataque impacta y aplica daño mayor que cero, Grapple aborta antes del toque y la oposición.

Improved Grapple se integrará en un sprint posterior mediante `FeatCatalog.avoidsOpportunity(featIds, "grapple")`; V1 deja preparado el punto de extensión, pero no cataloga aún la dote salvo aprobación expresa en implementación.

### 3. Toque melee

Un resolver puro genérico de toque para maniobras reutilizará:

- `Rules.totalAttackBonus` con Fuerza y `attackType: melee`;
- modificadores tácticos compartidos, incluido flanqueo;
- `Rules.totalArmorClass` con `targetAcType: touch`, `attackerId` e intercepción viva;
- reglas de 1 y 20 natural.

Trip migrará a la misma primitiva para evitar una implementación paralela.

### 4. Prueba enfrentada

Cada lado proyecta:

```text
BAB + modificador de Fuerza efectiva + getSpecialManeuverSizeModifier(sizeCategory)
```

Un `resolveOpposedCheck` puro recibirá componentes ya derivados y tiradas. La política existente se conserva: total mayor gana; en empate gana el modificador mayor; si también empatan los modificadores se repite con dados autoritativos.

### 5. Commit

Solo después de resolver todas las fases se muta la sala:

- consumir acción estándar;
- aplicar mutaciones del AdO si existió;
- actualizar estadísticas y logs;
- si el atacante gana, crear una única instancia `srd_grappling` con ambos targets mediante `EffectManager.add`;
- aplicar esfuerzo Disabled, outcome y broadcast.

No se persisten estados “touch conectado” u “oposición pendiente”. Un error previo al commit no deja efecto, acción ni vínculo parcial.

## Restricción de movimiento

`CANNOT_MOVE` mantiene `Rules.totalSpeedFeet(...) === 0`. Además:

- `canUseMoveAction` rechazará explícitamente movimiento voluntario;
- el paso de 5 pies reutilizará el mismo guard;
- carga queda bloqueada por velocidad cero y por el guard de movimiento;
- forced movement no se considera voluntario y queda fuera de esta prohibición;
- movimiento GM conserva autoridad administrativa y queda fuera de alcance funcional.

No se añadirá un `SPEED = 0` numérico ni un if por `srd_grappling` en handlers.

## UI

ActionsPanel/TacticalMenu añadirá “Maniobra: Presa”. El preview mostrará:

- alcance y Touch AC;
- advertencia de AdO interruptivo;
- fórmula por lado: BAB + FUE + tamaño;
- bloqueo si alguno ya está en Presa.

Tras el commit, ambos tokens mostrarán el estado `srd_grappling`. V1 no superpone tokens ni dibuja una cuerda persistente entre ellos; esa visualización dependerá de futuras reglas espaciales de arrastre.

## Matriz de reutilización

| Capa | Reutilización |
|---|---|
| ActiveEffects | una instancia `srd_grappling`, `CANNOT_MOVE`, trait contextual y `EffectManager` |
| Pure helpers | footprints, distancia, alcance, Touch AC, atributos efectivos y tamaño especial |
| Resolución | AdO interruptivo, toque melee genérico y oposición genérica |
| Servidor | mismo command handler y commit único de maniobras |
| React | mismo preview de `validateSpecialManeuver` |

## Matriz de impacto de subsistemas

- [x] **Rule Engine:** preview Grapple, check BAB/FUE/tamaño, traits condicionales y guard `CANNOT_MOVE`.
- [x] **CombatRoom / State Schema:** una `EffectInstance` existente con dos targets; sin campos nuevos en snapshot o perfil.
- [x] **WebSocket:** nuevo discriminante `grapple` dentro del comando existente; sin mensaje servidor nuevo.
- [x] **UI:** tarjeta de Presa, preview y estado visible.
- [x] **Tests:** unitarios, schema, handler transaccional, E2E WebSocket y Playwright.
- [ ] **EquipmentCatalog:** sin cambios en V1.
- [ ] **Persistencia de perfiles:** sin migración.
- [ ] **Ownership:** reutiliza control y turno actuales.

## Design Review Checklist

### 1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería persistir `grappledWithId` en cada combatiente o asumir para siempre una pareja rígida. Se evita usando una única instancia de efecto cuyo conjunto `targets` expresa membresía. El handler solo solicita una transición de estado; no conoce cómo se implementarán Pin, Escape o grupos ampliados.

Improved Grapple podrá suprimir el AdO desde `FeatCatalog`; armas naturales secundarias podrán consultar membresía y restricciones mediante `GRAPPLING`; Escape podrá localizar la instancia, ejecutar el mismo resolver opuesto y removerla atómicamente con `EffectManager`. Si más adelante se admite Grapple multiparticipante, la relación puede ampliar `targets` mediante una operación formal del manager sin migrar `CombatantSnapshot` ni cambiar el comando base.

### 2. Complejidad accidental

No se duplicará la fórmula de tamaño ni se introducirán tablas en el efecto. Trip, Bull Rush y Grapple consumen `getSpecialManeuverSizeModifier`, que delega al único `grappleModifier` del catálogo. BAB permanece fuente del snapshot y Fuerza efectiva se deriva tras `EffectReducer`; el efecto describe estado, no matemáticas de la prueba.

La complejidad heredada que sí debe reducirse es la repetición de oposición y toque en el handler. Antes de conectar Grapple se extraerán primitivas puras de toque y check opuesto, conservando resolvers delgados y discriminados.

### 3. Regla de tres

1. **Inmovilizar / Pin:** transición de la relación Grapple a un estado más restrictivo mediante otra oposición.
2. **Daño con arma ligera o ataque natural dentro de la Presa:** selección de acciones y fuentes permitidas usando la membresía del efecto.
3. **Agarre mejorado / Improved Grab:** entrada automática tras un ataque natural sin duplicar la relación ni el check opuesto.

También quedan habilitados Escape Artist para escapar, Improved Grapple para evitar AdO y arrastre del oponente mediante forced movement.

## Alternativas descartadas

### Dos efectos independientes, uno por combatiente

Facilita consultas individuales, pero puede dejar media Presa si falla una mutación y no expresa inequívocamente quién está vinculado con quién.

### Campos `isGrappling` / `grappledWithId`

Duplican ActiveEffects, exigen sincronización bidireccional, contaminan snapshot/perfiles y dificultan grupos futuros.

### `NO_DEX_TO_AC` incondicional

Es simple, pero niega Destreza también contra el otro participante. Se rechaza por incorrección reglamentaria respecto de la especificación aprobada.

### Lógica de Presa dentro de `resolveAttack`

Acopla una maniobra transaccional al ataque ordinario y fragmenta los handlers. El ataque solo debe proveer la primitiva de toque.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| efecto aplicado a un solo participante | una instancia con ambos targets y un solo `EffectManager.add` |
| Destreza negada al compañero de Presa | trait condicional evaluado contra targets de la instancia |
| cliente manipula la oposición | servidor deriva todos los modificadores y tira por el defensor |
| duplicación Trip/Bull Rush/Grapple | extraer oposición y toque genéricos antes de conectar Grapple |
| movimiento con velocidad cero produce errores confusos | guard explícito de `CANNOT_MOVE` en reglas compartidas |
| relaciones múltiples ambiguas | V1 rechaza participantes ya vinculados |
| pérdida de atomicidad por AdO crítico | resolver completamente el interrupt antes del commit de Grapple |

## Qué no resuelve Sprint 029

- escapar de la Presa o romper el vínculo;
- Pin, daño dentro de Grapple, armas ligeras y ataques naturales secundarios;
- Improved Grapple, Improved Grab o constrict como contenido catalogado;
- incorporación de terceros a una Presa existente;
- mover/arrastrar la relación o reconciliar distancia posterior;
- compartir casilla, overlays de enlace persistente o reglas espaciales de Grapple;
- penalizadores completos de ataque/acciones permitidas durante Grapple;
- freedom of movement, Escape Artist y modificadores circunstanciales raciales.

No se acepta deuda de fallbacks, flags escalares o mutaciones parciales. La restricción consciente de V1 es una sola relación binaria por combatiente.

## Estrategia de pruebas proyectada

1. fórmula exacta `d20 + BAB + FUE efectiva + grappleModifier` para ambos lados;
2. reutilización de Small/Medium/Large sin tabla paralela;
3. AdO con daño aborta toque, oposición y efecto;
4. toque fallido no ejecuta oposición;
5. victoria crea una sola instancia con ambos targets en orden determinista;
6. derrota y empate resuelto no dejan estado parcial;
7. atacante externo niega Destreza; el compañero de Presa no la niega;
8. `CANNOT_MOVE` produce velocidad cero y bloquea movimiento/paso de 5 pies;
9. schema rechaza tirada defensora, CA, modificadores y targets manipulados;
10. E2E verifica comando, efecto dual y rechazo de movimiento;
11. Playwright verifica preview y estado de ambos combatientes.

## Criterios de aceptación del diseño

- una instancia representa la relación completa;
- tamaño procede exclusivamente de `SizeRulesCatalog`;
- Fuerza es efectiva y BAB source-first;
- Touch AC y AdO reutilizan pipelines existentes;
- la vulnerabilidad de Destreza distingue miembros y terceros;
- movimiento voluntario queda bloqueado declarativamente;
- no hay estado intermedio persistente;
- no se modifica código antes de `Proceed`.
