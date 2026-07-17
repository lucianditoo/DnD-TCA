# NDD Sprint 019: Fundación de Conjuros y Gestión de Slots

## Estado

- Fase: 2 — diseño en curso.
- Implementación: bloqueada hasta recibir aprobación formal `Proceed`.
- Baseline: Sprint 018 cerrado con 251/251 tests y 80/80 verificaciones WebSocket.
- Invariantes: servidor autoritativo, catálogos como fuente única, estadísticas calculadas en caliente, snapshots defensivos y ninguna mutación observable antes de completar el preflight.

## 1. Objetivo

Sprint 019 reemplaza el tratamiento de los conjuros como “habilidades infinitas” por una base declarativa con tres responsabilidades separadas:

1. `SpellsCatalog` define qué es cada conjuro y cómo se resuelve;
2. el perfil o plantilla declara qué conjuros están preparados, sin guardar gasto de encuentro;
3. `CombatantSnapshot.preparedSpells` materializa slots individuales y consumibles durante el combate.

También incorpora la proyección pura de CD:

```text
CD = 10 + nivel del conjuro + modificador de característica mental efectiva
```

Este Sprint no implementa todavía tiradas de salvación. Construye la autoridad y el desglose que una salvación futura consumirá.

## 2. Mapeo del sistema actual

### 2.1. Pipeline de habilidades del servidor

`apps/server/src/commands/abilityCommands.ts` expone dos caminos:

- `handleUseAbility` para daño automático, curación y efectos;
- `handleResolveAbilityAttack` para conjuros con tirada de ataque.

Ambos validan fase, ownership, turno, disponibilidad, acción estándar, objetivo y alcance. El segundo reutiliza correctamente `resolveAttack`, Touch AC, flanqueo, críticos y el esfuerzo de un combatiente Disabled.

La debilidad no está en esa matemática, sino en la fuente del recurso: el servidor solo comprueba que `caster.abilities` contenga el ID. No existe preparación, slot ni gasto, por lo que el mismo conjuro puede lanzarse indefinidamente.

`abilityResolver.ts` mantiene además ramas específicas para Cure Light Wounds y Haste. Sprint 019 no añadirá otro `if` por conjuro. Los spell entries migrados conservarán una resolución discriminada y el orquestador seleccionará el resolver desde el catálogo.

### 2.2. Catálogo actual

`packages/shared/src/data/abilities.json` mezcla bajo `Ability`:

- Magic Missile;
- Shocking Grasp;
- Ray of Frost;
- Haste;
- Cure Light Wounds.

Los cinco son conjuros. `GameCatalog` entrega hoy `abilities` completas al cliente y `CombatantSnapshot` duplica las definiciones resueltas dentro de cada combatiente. Esto produce dos autoridades potenciales: el catálogo global y las copias embebidas.

Sprint 019 separará:

- `SpellsCatalog`: conjuros y su resolución;
- `AbilityCatalog`: reservado para aptitudes no mágicas o de clase;
- `preparedSpells`: referencias y estado de slots, no copias de definiciones.

### 2.3. Características efectivas

`rules.ts` ya contiene la matemática correcta en una función privada `getEffectiveAbilityScore(combatant, ability, reduced)`:

1. aplica un override de ActiveEffects si existe;
2. suma modificadores numéricos al score base;
3. limita el resultado mínimo a 1.

`getEffectiveAbilityModifier` la reutiliza para Fuerza y Destreza en Derribo. Para la CD de conjuros se necesita exponer una frontera pública basada en snapshot:

```ts
getEffectiveAbilityScore(snapshot, combatant, ability): number
```

La variante interna que recibe un `ReducedEffects` se renombrará como detalle privado. Ningún consumidor calculará un atributo efectivo leyendo directamente `abilityScores`.

### 2.4. Snapshot, perfiles y persistencia

El snapshot actual clona y congela defensivamente:

- características;
- equipamiento y breakdown de CA;
- features, traits y dotes;
- amenazas, efectos y habilidades.

`CreatureTemplate` y `StoredProfile V3` guardan IDs en `abilities`. Agregar un campo obligatorio sin migración pondría en cuarentena todos los perfiles existentes. Además, guardar `isExpended` en localStorage haría persistir accidentalmente gasto de una sala en futuras salas.

Por ello se distinguen explícitamente preparación fuente y estado de encuentro.

## 3. Invariantes de Sprint 019

1. Un slot es una identidad individual; dos preparaciones del mismo conjuro son dos slots distintos.
2. No existen contadores planos como `level1SlotsRemaining` o `magicMissileUses`.
3. Una plantilla/perfil no persiste `isExpended`; cada encuentro comienza con sus slots preparados disponibles.
4. El cliente selecciona un recurso, no declara qué conjuro, nivel, escuela, característica o CD tiene.
5. El servidor deriva el conjuro desde el slot y vuelve a consultar `SpellsCatalog`.
6. Un lanzamiento válido consume el recurso aunque falle su tirada de ataque, sea resistido o no produzca daño.
7. Un comando rechazado antes del commit no consume slot, acción ni altera la sala.
8. La CD nunca se almacena en perfil, slot ni snapshot; siempre se proyecta desde el estado actual.
9. Los slots se actualizan reemplazando el array y el objeto seleccionado; no se muta el objeto readonly en sitio.
10. La UI y el servidor consumen los mismos helpers y catálogo shared.

## 4. Modelo declarativo

### 4.1. `SpellsCatalog`

Se creará un catálogo inmutable en `packages/shared/src/spells/` con contratos semejantes a:

```ts
type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type MentalAbility = "intelligence" | "wisdom" | "charisma";
type SpellSchool =
  | "abjuration"
  | "conjuration"
  | "divination"
  | "enchantment"
  | "evocation"
  | "illusion"
  | "necromancy"
  | "transmutation"
  | "universal";

interface SpellDefinition {
  readonly id: string;
  readonly name: string;
  readonly level: SpellLevel;
  readonly school: SpellSchool;
  readonly castingTime: SpellCastingTime;
  readonly rangeFeet: number;
  readonly associatedAbility: MentalAbility;
  readonly target: "self" | "ally" | "enemy" | "creature";
  readonly resolution: AbilityResolution;
}
```

`castingTime` será discriminado y no texto libre, de modo que más adelante admita acción estándar, swift/immediate, asalto completo, rondas o minutos. En Sprint 019 los cinco conjuros existentes serán de acción estándar.

El catálogo ofrecerá `all`, `get` y `require`. Tanto el registro como sus entradas y ramas de resolución quedarán congelados. Zod validará nivel 0–9, IDs únicos, rango finito no negativo, escuela y característica mental.

Los campos `level` y `associatedAbility` son obligatorios por especificación. Sin embargo, los consumidores no leerán esos campos de forma dispersa: usarán un selector `getSpellCastingParameters(combatant, spellId)`. Inicialmente devuelve los valores canónicos del spell entry. Una futura tradición o lista de clase podrá sobrescribir nivel/característica sin cambiar `calculateSpellSaveDC`, el command handler ni la UI.

### 4.2. Migración desde `AbilityCatalog`

Los cinco conjuros actuales se moverán al nuevo catálogo conservando sus resoluciones autoritativas:

| Conjuro | Nivel inicial | Escuela | Característica inicial |
| --- | ---: | --- | --- |
| Ray of Frost | 0 | Evocation | Intelligence |
| Magic Missile | 1 | Evocation | Intelligence |
| Shocking Grasp | 1 | Evocation | Intelligence |
| Cure Light Wounds | 1 | Conjuration | Wisdom |
| Haste | 3 | Transmutation | Intelligence |

La tabla representa el contenido mínimo del producto, no una lista completa por clase. La variación de nivel por clase se resolverá después mediante perfiles de tradición, no duplicando conjuros.

`AbilityCatalog` podrá quedar vacío o contener solo aptitudes no mágicas. `GameCatalog` expondrá `spells` y `abilities` como dominios distintos.

### 4.3. Preparación persistida frente a slot de combate

Fuente en `CreatureTemplate` y `StoredProfile`:

```ts
interface PreparedSpellLoadoutEntry {
  readonly slotId: string;
  readonly spellId: string;
}
```

Estado en `CombatantSnapshot`:

```ts
interface PreparedSpellSlot {
  readonly slotId: string;
  readonly spellId: string;
  readonly isExpended: boolean;
}
```

`CreatureTemplate.preparedSpellLoadout` permite duplicados de `spellId`, pero exige `slotId` único dentro del perfil. `createCombatantSnapshotFromProfile` deriva:

```text
preparedSpellLoadout[i] → preparedSpells[i] con isExpended = false
```

El snapshot no copia la definición completa del conjuro. La definición se obtiene por `spellId` desde el catálogo.

### 4.4. Integridad del snapshot

`assertDerivedSnapshotIntegrity` verificará:

- array presente;
- objetos con exactamente `slotId`, `spellId`, `isExpended`;
- IDs de slot únicos;
- referencias existentes en `SpellsCatalog`;
- booleano de gasto válido;
- ausencia de propiedades escalares prohibidas relacionadas con slots.

`createCombatRulesSnapshot` clonará cada slot y el deep-freeze de desarrollo impedirá mutaciones accidentales sobre la proyección.

## 5. Persistencia y migración

### 5.1. StoredProfile V4

“Snapshot V3” describe la generación source-first actual del combatiente, pero el sobre de localStorage también se llama V3. Para evitar una modificación silenciosa de un esquema estricto, Sprint 019 elevará el almacenamiento a `StoredProfile V4`.

V4 agrega `preparedSpellLoadout` y mantiene `abilities` solo para aptitudes no mágicas.

### 5.2. Migración determinista V3 → V4

Para cada ID de `abilities` de un perfil V3:

- si existe en `SpellsCatalog`, se convierte en una entrada preparada;
- si existe en `AbilityCatalog`, permanece en `abilities`;
- si no existe en ninguno, el perfil queda en cuarentena con issue explícito.

El ID de slot migrado será estable y reproducible a partir de perfil, posición e ID del conjuro. El orden original se conserva y dos IDs repetidos producen dos slots distintos. Una segunda ejecución sobre V4 no cambia el resultado.

El backup pre-V4 se conserva antes de escribir la migración. El servidor valida nuevamente el perfil recibido por `add-profile-combatant`.

Las plantillas integradas se actualizarán de forma explícita; no dependerán del migrador de localStorage.

## 6. Rule Engine y CD pura

### 6.1. Selector efectivo compartido

Se expondrá:

```ts
export function getEffectiveAbilityScore(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  ability: keyof AbilityScores
): number
```

El helper ejecuta `EffectReducer.reduceEffectsForTarget` una vez y delega la aplicación de override/delta a la primitiva privada. `getEffectiveAbilityModifier` se amplía a las seis características y reutiliza el mismo selector.

### 6.2. Desglose y firma pública

La firma exigida será:

```ts
export function calculateSpellSaveDC(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  spellId: string
): number
```

Internamente compondrá un helper trazable:

```ts
interface SpellSaveDCBreakdown {
  readonly base: 10;
  readonly spellLevel: SpellLevel;
  readonly associatedAbility: MentalAbility;
  readonly effectiveAbilityScore: number;
  readonly abilityModifier: number;
  readonly contextualModifiers: readonly RuleTrace[];
  readonly total: number;
}
```

En Sprint 019 `contextualModifiers` estará vacío y el total será exactamente `10 + level + abilityModifier`. Se incluye el desglose para que UI, logs y futuros efectos no reconstruyan la fórmula.

Un `spellId` desconocido lanza error descriptivo. La función no exige que el conjuro esté preparado: es una proyección matemática sobre un conjuro catalogado. La autorización de lanzamiento pertenece a otra regla.

### 6.3. ActiveEffects y CDs futuras

Penalizadores o drains de Intelligence, Wisdom o Charisma ya fluyen por `EffectReducer` y reducen la CD en tiempo real.

Spell Focus no se codificará todavía. La extensión prevista es un stat contextual `SPELL_SAVE_DC` condicionado por escuela. El desglose aceptará esa contribución sin cambiar la firma pública ni persistir una CD derivada.

## 7. Validación y consumo autoritativo

### 7.1. Comando refinado

Los conjuros dejarán de entrar por comandos semánticamente llamados “ability”. Se diseñará un comando estable:

```ts
interface CastSpellCommand {
  readonly type: "cast-spell";
  readonly roomCode: string;
  readonly actorId: string;
  readonly casterId: string;
  readonly targetId: string;
  readonly resource: { readonly kind: "prepared-slot"; readonly slotId: string };
  readonly input: SpellResolutionInput;
}
```

`SpellResolutionInput` será una unión estricta para los modos actuales: ataque, cantidad manual o sin tirada. El servidor verifica que el tipo de input coincida con `SpellDefinition.resolution`. El cliente no puede enviar `spellId`, `level`, `school`, `associatedAbility`, `saveDC`, `attackType` ni `targetAcType`.

La envoltura `resource` evita atar el protocolo a magia preparada. En el futuro podrá admitir `{ kind: "spontaneous-pool", poolId }` o `{ kind: "item-charge", itemId, chargeId }` sin cambiar la intención `cast-spell`.

Los comandos `use-ability` y `resolve-ability-attack` permanecerán para aptitudes no mágicas durante la migración; dejarán de aceptar spell IDs.

### 7.2. Preflight

Sobre un único `CombatRulesSnapshot`:

1. validar fase, ownership y turno;
2. validar disponibilidad y coste de acción desde `castingTime`;
3. localizar exactamente un slot por `slotId`;
4. rechazar slot gastado;
5. derivar `spellId` desde el slot;
6. resolver definición y parámetros desde catálogos;
7. validar que el input corresponde a la resolución catalogada;
8. validar objetivo, alcance y geometría;
9. construir un plan sin modificar `room`.

Una entrada inválida no consume slot ni acción y no genera broadcast.

### 7.3. Resolve y commit

El resolver reutiliza los pipelines existentes:

- `resolveAttack` para Shocking Grasp y Ray of Frost;
- daño automático para Magic Missile;
- curación para Cure Light Wounds;
- efecto catalogado para Haste.

El plan final incluye el `slotId` consumido, acción, daño/curación/efectos, stats y logs. El commit reemplaza el slot seleccionado:

```text
caster.preparedSpells = caster.preparedSpells.map(slot =>
  slot.slotId === selectedSlotId ? { ...slot, isExpended: true } : slot
)
```

Se emite un único broadcast después de sincronizar fase y resultado.

### 7.4. Semántica exacta de consumo

“Lanzamiento resuelto con éxito” significa que el comando superó el preflight y el servidor comprometió el intento de lanzamiento. No significa que el conjuro impactó.

Por tanto:

- ataque fallido: consume;
- objetivo supera una futura salvación: consume;
- una futura SR bloquea el efecto: consume;
- amenaza crítica pendiente: consume inmediatamente antes de publicar esa fase;
- target/alcance/ownership/input inválido: no consume;
- error interno anterior al commit: no consume.

Esta semántica impide repetir un rayo hasta impactar y mantiene el recurso coherente durante confirmaciones críticas diferidas.

## 8. UI compartida

La UI no mantendrá un contador local. `ActionsPanel` derivará filas desde `selected.preparedSpells` y resolverá nombres, nivel y escuela mediante `catalog.spells`.

Cada fila mostrará:

- nombre y nivel;
- slotId como key estable;
- disponible o gastado;
- CD proyectada mediante el helper shared;
- rango y tiempo de lanzamiento;
- control de objetivo/tirada según la resolución catalogada.

Un slot gastado se representa en gris y queda deshabilitado. Tras `room-update`, React vuelve a pintar desde el snapshot del servidor; no realiza consumo optimista.

`calculateSpellSaveDCBreakdown` alimentará el preview. La UI no ejecutará `10 + level + mod` por su cuenta.

## 9. Design Review Checklist

### 9.1. Filtro de irreversibilidad a 20 sprints

La decisión más difícil de revertir sería identificar “lanzar conjuro” con “gastar PreparedSpellSlot”. Eso rompería Hechiceros, bardos, invocaciones, dominios, objetos y cargas.

El diseño separa tres conceptos:

1. `SpellDefinition`: identidad y reglas del conjuro;
2. `SpellcastingResource`: autorización/consumo del lanzamiento;
3. `SpellCastResolution`: ataque, salvación, SR y resultado.

Sprint 019 implementa el adapter `prepared-slot`. Un lanzador espontáneo añadirá un recurso estructurado por nivel —por ejemplo `SpontaneousSpellPool { poolId, spellLevel, maximum, expended }`— y un adapter que valida conocimiento y consume una unidad. No será un contador suelto: será una colección de pools con identidad, nivel y trazabilidad. El command handler y los resolvers seguirán recibiendo la misma intención `cast-spell`.

La Resistencia a Conjuros no pertenece al slot ni a la CD. Será una fase/gate posterior al ataque o selección de objetivo y anterior a aplicar el resultado, alimentada por `SpellDefinition` y traits del objetivo. El recurso ya estará comprometido aunque SR bloquee el efecto. Así se añade SR sin modificar la estructura del slot ni la fórmula de CD.

También se encapsulan `level` y `associatedAbility` detrás de un selector de parámetros. Las futuras listas de clase o tradiciones podrán cambiar esos valores para el mismo conjuro sin reescribir consumidores.

### 9.2. Complejidad accidental

La complejidad heredada es que `Ability` mezcla conjuros con aptitudes y que el snapshot duplica definiciones completas por combatiente. Agregar `isExpended` dentro de cada Ability agravaría esa mezcla.

La simplificación propuesta es:

- mover los spell entries a `SpellsCatalog`;
- mantener en el snapshot solo slots referenciales;
- resolver definiciones desde un único catálogo;
- centralizar preflight y consumo en `cast-spell`;
- dejar los resolvers de ataque, daño, curación y efectos como piezas reutilizables.

En React, el mismo `preparedSpells` que recibe del servidor genera la barra. El mismo catálogo aporta etiquetas y el mismo helper shared calcula la CD. No hay copia de slots, contador local ni fórmula duplicada.

### 9.3. Matriz de reutilización

1. **ActiveEffects:** los drains y overrides mentales alimentan la CD; futuros bonus por escuela podrán aportar `SPELL_SAVE_DC` contextual.
2. **Pure helpers:** se reutilizan `getEffectiveAbilityScore`, `getAbilityModifier`, rango, distancia, objetivo, acción y reglas de vida.
3. **Resolvers:** ataques de toque continúan en `resolveAttack`; daño, curación y efectos se componen bajo el nuevo preflight de recurso.

### 9.4. Regla de Tres

1. **Spell Focus:** añade +1 a la CD de una escuela mediante un modificador contextual y el desglose existente.
2. **Counterspell:** consulta catálogo, nivel/escuela, evento de lanzamiento y recurso antes del commit del resultado sin redefinir slots.
3. **Pergaminos, varitas y objetos consumibles:** implementan otro `SpellcastingResource` y reutilizan definición, alcance, DC y resolución.

También quedan habilitados pools espontáneos y Resistencia a Conjuros por la misma separación.

### 9.5. Matriz de impacto de subsistemas

- [x] **Rule Engine:** selector público de score efectivo, parámetros de lanzamiento y cálculo/desglose de CD.
- [x] **CombatRoom / State Schema:** `CombatantSnapshot.preparedSpells` contiene el gasto del encuentro.
- [x] **Persistencia:** StoredProfile V4 separa loadout preparado de gasto temporal y migra V3 determinísticamente.
- [x] **Spell/Ability Catalogs:** conjuros y aptitudes pasan a dominios distintos.
- [x] **Ownership:** el actor solo puede lanzar con el combatiente controlado; el slot se deriva del snapshot del servidor.
- [x] **WebSocket:** comando `cast-spell` con referencia de recurso, sin conclusiones mecánicas del cliente.
- [x] **UI:** slots desde snapshot, definición desde catálogo, estado gris gastado y CD desde helper shared.
- [x] **Tests:** catálogo, snapshot, persistencia, reglas, handlers, validación de red, E2E y Playwright.
- [ ] **EquipmentCatalog:** sin cambios en Sprint 019; objetos lanzadores quedan como extensión futura.

### 9.6. Qué no resuelve Sprint 019

- tiradas de salvación y aplicación de sus resultados;
- Resistencia a Conjuros y caster level checks;
- Spell Focus u otros bonus a CD;
- listas de clase, caster level, dominios y progresión diaria;
- pools espontáneos;
- componentes verbales, somáticos, materiales o foco;
- concentración, lanzamiento defensivo y AdO por conjurar;
- contraconjuros;
- pergaminos, varitas y objetos con cargas;
- preparación diaria, descanso o recuperación de slots;
- metamagia y slots de nivel ajustado;
- carga retenida de conjuros de toque;
- múltiples objetivos o proyectiles automáticos completos.

Los puntos anteriores no se simularán con flags o fallbacks silenciosos.

## 10. Riesgos y mitigaciones

### 10.1. Nivel y característica dependen de la clase

Riesgo: D&D 3.5 permite que un mismo conjuro tenga niveles diferentes según la lista y que la característica dependa del lanzador.

Mitigación: Sprint 019 cumple los campos canónicos requeridos, pero obliga a acceder a ellos mediante `getSpellCastingParameters`. La futura tradición podrá sobrescribirlos sin cambiar DC, red o UI.

### 10.2. Consumo parcial durante críticos

Riesgo: si el slot se gasta después de confirmar un crítico, el jugador podría desconectarse o cancelar dejando el conjuro sin gastar.

Mitigación: el slot se consume al aceptar el lanzamiento, antes de publicar `critical-confirmation`.

### 10.3. Doble comando sobre el mismo slot

Riesgo: dos mensajes rápidos podrían intentar gastar el mismo slot.

Mitigación: el servidor procesa comandos secuencialmente y cada handler crea un snapshot actual. El segundo comando observa `isExpended: true` y falla antes de mutar.

### 10.4. Dos autoridades de catálogo

Riesgo: conservar los mismos IDs en Ability y Spell permite resolverlos por caminos distintos.

Mitigación: la migración clasifica cada ID en exactamente un catálogo; schemas y tests impiden intersecciones.

## 11. Alternativas consideradas

### A. Agregar `remainingUses` a Ability

Rechazada. Es un contador opaco, no distingue slots duplicados y mezcla definición con estado.

### B. Guardar `isExpended` en StoredProfile

Rechazada. Filtra el estado de una sala hacia futuros encuentros y confunde preparación con consumo.

### C. Enviar `spellId` y `saveDC` desde React

Rechazada. Permite sustituir el conjuro del slot y manipular la matemática.

### D. Añadir `slotId` opcional a los dos handlers Ability existentes

Rechazada como contrato final. Mantiene dos caminos de lanzamiento y ata magia a Ability. La transición conservará esos comandos solo para aptitudes no mágicas.

### E. Catálogo único + recurso discriminado + comando `cast-spell`

Seleccionada. Separa datos, autorización y resolución; preserva autoridad del servidor y admite recursos futuros.

## 12. Estrategia de pruebas y Definition of Done

### Catálogo y schema

- catálogo profundamente inmutable;
- niveles fuera de 0–9, escuelas inválidas, IDs duplicados o rangos no finitos se rechazan;
- AbilityCatalog y SpellsCatalog no comparten IDs;
- el comando rechaza `spellId`, `saveDC`, `targetAcType`, `level` o `isExpended` inyectados.

### Snapshot y persistencia

- dos preparaciones del mismo conjuro producen dos slots independientes;
- todo snapshot inicia sus slots en `false` sin mutar el perfil;
- el snapshot defensivo clona/congela slots;
- V3 → V4 migra spells conocidos, conserva abilities no mágicas, mantiene orden y es idempotente;
- IDs desconocidos quedan en cuarentena;
- un perfil V4 no puede persistir gasto de encuentro.

### Rule Engine

- Intelligence 18 y spell level 1 producen CD 15;
- un drain efectivo a Intelligence 14 reduce la CD a 13;
- un override mental de ActiveEffects se refleja inmediatamente;
- Wisdom y Charisma usan su característica catalogada;
- spell ID desconocido falla cerrado;
- cálculo repetido no muta snapshot ni combatiente.

### Servidor

- slot disponible autoriza y se reemplaza por `isExpended: true`;
- segundo uso del mismo slot se rechaza;
- dos slots del mismo spell se consumen independientemente;
- slot gastado, ajeno o inexistente no consume acción;
- fallo de ataque consume slot;
- rango/target/input inválido no consume;
- amenaza crítica deja slot gastado antes de la confirmación;
- el servidor ignora/rechaza conclusiones mecánicas del cliente;
- existe un solo broadcast por lanzamiento aceptado.

### UI y E2E

- Playwright muestra slots disponibles y gastados en gris;
- la CD preview cambia al aplicar un efecto que reduzca la característica;
- E2E WebSocket lanza Ray of Frost desde un slot, confirma gasto y rechaza reutilización;
- las regresiones actuales de Touch AC, flanqueo, críticos y esfuerzo Disabled permanecen verdes.

### Gates de implementación

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
npm run test:ui
```

## 13. Criterio de aprobación

Tras aprobar este NDD con `Proceed`, la implementación seguirá el plan asociado. Cualquier cambio que introduzca pools espontáneos, salvaciones, SR o caster level ampliará el alcance y requerirá revisión de diseño.
