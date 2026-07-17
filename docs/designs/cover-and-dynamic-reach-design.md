# NDD Sprint 013: Cobertura y Alcance Dinámico

## Estado

- Fase: 2 — diseño en curso.
- Implementación: bloqueada hasta recibir aprobación formal `Proceed`.
- Baseline: Sprint 012 cerrado con 225/225 tests, typecheck, build y 80/80 verificaciones WebSocket.
- Invariantes: servidor autoritativo, snapshots fuente-first, catálogos como verdad, reglas puras compartidas y ningún resultado táctico enviado por el cliente.

## 1. Objetivo

Sprint 013 introduce dos capacidades relacionadas, pero con responsabilidades separadas:

1. detectar cobertura viva elemental en la línea de ataque y proyectar un bono contextual no acumulable de `+4` a la CA del defensor; y
2. eliminar la suposición de alcance melee fijo de 5 pies mediante fuentes de amenaza derivadas de tamaño, anatomía y arma catalogada.

La cobertura no se persistirá en `CombatRoom`, no será un `ActiveEffect` y no alterará `armorClassBreakdown`. Es una relación efímera entre atacante, objetivo, fuente de ataque, posiciones y ocupantes de un snapshot concreto. El alcance, en cambio, sí es una capacidad estructurada derivada al crear el combatiente, porque procede de fuentes estables y catalogadas.

## 2. Diagnóstico del repositorio

### 2.1. Infraestructura reutilizable

- `AttackContext` ya transporta `attackType`, `targetAcType`, característica de ataque, estado Flat-Footed y atacante hacia `Rules.totalArmorClass`.
- `projectStructuredArmorClass` ya filtra componentes según Touch AC y pérdida de Destreza sin mutar el desglose persistido.
- `CombatRulesSnapshot` ofrece una vista inmutable común para servidor y React.
- `ThreatProfile.meleeSources`, `threatensTarget`, `isFlanking` y `distanceBetweenFootprintsFeet` ya forman la frontera espacial compartida.
- `SizeRulesCatalog` ya declara `spaceFeet` y `defaultReachFeet` por categoría.
- `EquipmentCatalog` distingue armas melee, arrojadizas y de alcance; `longspear` ya está catalogada con `isReach` y se traduce hoy a `meleeReachFeet: 10`.
- `getAttackContextModifiers` ya demuestra el patrón correcto: servidor y UI consumen el mismo selector táctico sin aceptar flags mecánicos por WebSocket.

### 2.2. Límites actuales

| Área | Estado actual | Riesgo |
| --- | --- | --- |
| CA | `ArmorClassBonusType` no contiene `cover` | sumar `+4` como `misc` perdería semántica y trazabilidad |
| Contexto | `AttackContext` no expresa intercepción | cada resolver podría inventar su propia condición |
| Geometría | no existe selector común de línea atacante–objetivo | servidor y React podrían discrepar |
| Amenaza | `MeleeThreatSource` solo declara `maxReachFeet` | una reach weapon también amenazaría incorrectamente a 5 ft |
| Derivación | el arma aporta 5/10 ft absolutos y el tamaño no participa | criaturas Large/Huge no escalan su alcance equipado |
| UI | overlays leen `weapon.meleeReachFeet` directamente | el preview puede divergir de `threatensTarget` |
| Resolver | `resolveWeaponAttackSource` usa alcance del arma sin selector de tamaño | la validación del ataque puede rechazar un objetivo que sí está amenazado |

El Sprint no debe colocar raycasting dentro de `totalArmorClass` ni resolver la deuda mediante más lecturas directas de `weapon.meleeReachFeet`.

## 3. Modelo de cobertura contextual

### 3.1. Resultado geométrico trazable

La API pública será una función pura compartida:

```ts
interface AttackLineInterception {
  readonly hasObstacleInterception: boolean;
  readonly blockerIds: readonly string[];
  readonly kind: "none" | "creature-cover";
}

getAttackLineInterception(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): AttackLineInterception;
```

El booleano pedido por el contrato es una proyección del resultado, no la única información disponible. Los `blockerIds` permiten explicar el bono en logs y UI, evitan recalcular para obtener la causa y dejan una evolución directa hacia obstáculos de mapa. El resultado se crea de nuevo por evaluación y nunca se almacena en la sala.

Se agregará al contexto unificado:

```ts
interface AttackContext {
  // campos existentes
  readonly hasObstacleInterception?: boolean;
}
```

El comando de red no incorpora este campo. Solo el servidor y los selectores locales compartidos lo construyen desde el snapshot.

### 3.2. Modificador contextual de CA

`ArmorClassBonusType` incorporará `"cover"`. Un helper interno y genérico traducirá el contexto a contribuciones efímeras:

```ts
interface ContextualArmorClassModifier {
  readonly sourceId: string;
  readonly label: string;
  readonly bonusType: ArmorClassBonusType;
  readonly value: number;
}
```

Si `hasObstacleInterception === true`, producirá exactamente una contribución `{ sourceId: "creature-cover", label: "cobertura", bonusType: "cover", value: 4 }`. `totalArmorClass` plegará estas contribuciones después de proyectar el breakdown y antes de devolver el total y sus `parts`.

Propiedades de la regla:

- el bono se aplica a CA normal, Touch AC y Flat-Footed AC;
- no se suprime por pérdida de Destreza;
- varios combatientes interpuestos siguen otorgando `+4`, no `+4` por cada uno;
- no se escribe dentro de `armorClassBreakdown`, buffs o efectos;
- `totalArmorClass` no conoce coordenadas, facciones ni estados de vida.

### 3.3. Algoritmo elemental de intercepción

Sprint 013 opera sobre centros de casillas 1×1. Sean `A` el atacante, `B` el objetivo y `C` un tercer combatiente:

1. excluir atacante y objetivo;
2. aceptar como obstáculo vivo únicamente estados `active` o `disabled`;
3. exigir el mismo plano táctico (`zFeet`) que los extremos en esta primera versión;
4. comprobar colinealidad exacta con producto cruzado entero:

   `cross = (Bx - Ax) * (Cy - Ay) - (By - Ay) * (Cx - Ax)`;

5. comprobar que `C` está estrictamente dentro del segmento mediante producto punto:

   `0 < dot(A→C, A→B) < |A→B|²`;

6. si al menos un candidato cumple ambas condiciones, devolver intercepción.

La comprobación es determinista, independiente de píxeles y `O(n)` respecto de los combatientes. Detecta líneas ortogonales, diagonales y pendientes racionales cuyos centros coinciden exactamente con el segmento. No considera como cobertura una criatura meramente cercana a la línea.

La operación de segmento quedará detrás de un adaptador geométrico (`intersectsAttackSegment`) igual que la distancia entre footprints. Cuando se incorporen criaturas multicelda u obstáculos con volumen, se reemplazará ese adaptador por intersección segmento–footprint; los consumidores conservarán la misma API.

### 3.4. Servidor autoritativo

Antes de invocar `Rules.totalArmorClass`, la orquestación del servidor:

1. construye un único `CombatRulesSnapshot`;
2. resuelve la fuente de ataque desde catálogos;
3. llama a `getAttackLineInterception(snapshot, attacker, target)`;
4. proyecta `hasObstacleInterception` dentro de `AttackContext`;
5. calcula CA e impacto con ese mismo snapshot.

`resolveAttack` seguirá sin hacer raycasting. Recibirá el contexto de CA ya construido o un objeto de resolución autorizado; no aceptará un valor procedente de `ClientCommand`. Todos los entry points —ataque estándar/completo, carga, AdO y aptitudes con tirada— deben pasar por una única factory de contexto para evitar omisiones.

## 4. Modelo de alcance dinámico

### 4.1. Fuente frente a capacidad derivada

Las fuentes permanecen en los catálogos:

- `SizeRulesCatalog.defaultReachFeet`: alcance natural de la anatomía/tamaño soportado;
- `EquipmentCatalog`: `meleeReachFeet` base del arma para tamaño Medium y semántica `isReach`;
- `NaturalAttackCatalog`: alcance base y tipo de ataque natural;
- futuras features/effects: políticas explícitas de alcance.

El snapshot conserva una capacidad derivada, no una constante global:

```ts
interface MeleeThreatSource {
  readonly sourceId: string;
  readonly kind: "weapon" | "natural" | "unarmed" | "effect";
  readonly minReachFeet: number;
  readonly maxReachFeet: number;
}
```

`minReachFeet` cierra una incorrección latente: una lanza larga de alcance amenaza el anillo exterior, pero no la casilla adyacente. Para fuentes normales el mínimo es `0`; para reach weapons estándar es el alcance natural del portador, con límite inferior exclusivo.

### 4.2. Política declarativa de escalado

No se sumarán 5 o 10 pies mediante condicionales por ID. La traducción del catálogo expondrá una política de alcance:

```ts
interface WeaponReachProfile {
  readonly baseMeleeReachFeet: number;
  readonly mode: "standard" | "reach" | "absolute";
}
```

Para las armas SRD actuales:

- `standard`: `maxReachFeet = sizeRule.defaultReachFeet`;
- `reach`: factoriza `meleeReachFeet / SizeRulesCatalog.medium.defaultReachFeet` y aplica ese multiplicador al alcance natural del tamaño; `minReachFeet = sizeRule.defaultReachFeet`;
- `absolute`: reserva fuentes mágicas o efectos cuya distancia no escala con tamaño.

Así, una criatura Medium con longspear deriva `(5, 10]`; una Large con la misma política deriva `(10, 20]`; una espada normal conserva `(0, 5]` o `(0, 10]` según tamaño. El cálculo usa `meleeReachFeet` como dato de catálogo, no como resultado final universal.

Los perfiles Fine/Tiny y anatomías excepcionales requieren reglas raciales específicas y quedan fuera del demo del Sprint; el validador rechazará una combinación cuyo factor no pueda derivarse de forma inequívoca en lugar de inventar 5 ft.

### 4.3. Consumidores únicos

`deriveMeleeThreatSources` será la única vía de construcción del `ThreatProfile`. `assertCombatantSnapshotIntegrity` volverá a derivar y comparar los intervalos.

`threatensTarget` cambiará únicamente su predicado de distancia:

```text
distance > source.minReachFeet && distance <= source.maxReachFeet
```

`isFlanking` seguirá delegando en `threatensTarget`; no calculará alcance. Los overlays, la validación de ataque melee, la carga y los Ataques de Oportunidad consultarán un selector común de fuente/intervalo y dejarán de leer `weapon.meleeReachFeet` directamente.

La función `distanceBetweenFootprintsFeet` se mantendrá como frontera. Sprint 013 no implementa ocupación multicelda: prepara el alcance elástico sin afirmar que una criatura Large ya ocupa correctamente 2×2 casillas.

## 5. Contrato compartido de preview

Servidor y React consumirán una sola evaluación pura:

```ts
interface AttackSpatialContext {
  readonly interception: AttackLineInterception;
  readonly reach: {
    readonly inMeleeReach: boolean;
    readonly sourceId?: string;
    readonly minReachFeet?: number;
    readonly maxReachFeet?: number;
  };
}

getAttackSpatialContext(room, attacker, target): AttackSpatialContext;
```

La UI no reconstruirá productos cruzados ni factores de tamaño:

- `ActionsPanel` mostrará `Cobertura: +4 CA` y el/los bloqueadores para el objetivo actual;
- `viewModel.getHighlightedCells` obtendrá las casillas melee desde las fuentes derivadas;
- `Board` recibirá un modelo ya calculado para pintar la línea de ataque en rojo sólido o rojo afectado por cobertura;
- la memoización React se hará por snapshot/posiciones/selección, sin cachear el resultado en `CombatRoom`.

El color es presentación. La verdad mecánica siempre proviene del helper compartido y el servidor la vuelve a calcular al resolver.

## 6. Integración con pipelines existentes

### 6.1. ActiveEffects

La interposición no es un efecto con duración aplicado al defensor. Los traits sí podrán alterar en el futuro cómo una criatura bloquea o ignora líneas, pero Sprint 013 no crea un ActiveEffect de cobertura.

Los efectos de alcance futuros podrán producir fuentes `kind: "effect"` mediante la misma derivación tipada. No modificarán `threatensTarget`.

### 6.2. Rule Engine

Se agregan selectores puros de intercepción y contexto espacial. `totalArmorClass` solo consume una lista contextual tipada. `threatensTarget` consume intervalos derivados. No hay llamadas recursivas entre cobertura, amenaza y flanqueo.

### 6.3. Resolvers

Los handlers construyen el contexto espacial y pasan sus números/trazas al resolver. El roller no conoce geometría, tamaños ni IDs de armas. La cobertura modifica la CA objetivo; el alcance determina legalidad/tipo de entrega, pero no cambia la matemática del d20.

## 7. Design Review Checklist

### 7.1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería convertir `hasObstacleInterception` en un booleano de red o en un `if (+4)` sin procedencia dentro de `totalArmorClass`. Se evita mediante tres capas:

1. la geometría devuelve un resultado trazable con nivel y fuentes;
2. `AttackContext` transporta una proyección autoritativa y extensible sin cambiar la firma de `totalArmorClass`;
3. la CA pliega contribuciones contextuales tipadas, en lugar de conocer cada mecánica.

La Cobertura Total no se representará como una CA enorme: será un resultado futuro de legalidad (`attackAllowed: false`, razón `TOTAL_COVER`) evaluado antes de tirar. Cobertura normal seguirá siendo una contribución `cover +4`. Precise Shot, conforme a D&D 3.5, no elimina cobertura: elimina el penalizador por disparar a melee; se integrará como una política de modificadores de ataque basada en feature y contexto. Improved Precise Shot podrá ignorar ciertos grados de cobertura mediante la misma etapa de políticas. Ninguno exige cambiar la firma matemática de `totalArmorClass`.

Para alcance, la decisión irreversible sería guardar un único número final o asumir que todas las armas amenazan desde 0 hasta su máximo. Los intervalos `min/max` y una política de escalado separada permiten tamaños Large/Huge, armas de asta, cadenas que sí amenazan adyacente y fuentes absolutas sin reescribir `threatensTarget`.

### 7.2. Complejidad accidental

La consulta visual no vivirá en React. `getAttackLineInterception` y `getAttackSpatialContext` estarán en `packages/shared/src/rules.ts` (con primitivas geométricas puras si conviene separarlas) y serán usados por:

- el servidor al construir el `AttackContext` autoritativo;
- `ActionsPanel` para la etiqueta de cobertura;
- `viewModel`/`Board` para la línea roja y los overlays;
- tests unitarios con el mismo snapshot.

Esto elimina dos fuentes actuales de complejidad: las lecturas directas de `weapon.meleeReachFeet` en la UI y la tentación de repetir raycasting en cada handler. Una pasada lineal `O(n)` obtiene todos los bloqueadores; `totalArmorClass` queda `O(1)` respecto del tablero y el EffectReducer no participa.

### 7.3. Matriz de reutilización

| Capa | Reutilización |
| --- | --- |
| ActiveEffects/datos | traits futuros pueden alterar bloqueo; fuentes de alcance por efecto usan `kind: "effect"`; cobertura actual no se persiste como efecto |
| Helpers puros | reutiliza `lifeStatus`, snapshot, distancia/footprint, `threatensTarget`, `isFlanking` y proyección tipada de CA |
| Resolvers | reciben contexto espacial ya evaluado; solo aplican CA, legalidad, modificador y trazas |

### 7.4. La Regla de Tres

1. Ataques de Oportunidad avanzados y `Combat Reflexes` con gujas, lanzas largas y otras armas de asta.
2. `Precise Shot` / `Improved Precise Shot`, separando penalizador por disparar a melee de grados de cobertura ignorables.
3. Ocultación, línea de efecto y Cobertura Total, reutilizando la consulta geométrica y el resultado trazable sin convertirlos en CA plana.

### 7.5. Matriz de impacto de subsistemas

- [x] **Rule Engine:** nuevos helpers geométricos, contribución contextual `cover` e intervalos de amenaza.
- [x] **CombatRoom / State Schema:** no se persiste cobertura, pero `ThreatProfile` evoluciona de máximo escalar a intervalo derivado dentro del `CombatantSnapshot`.
- [x] **WebSocket Contract:** `room-update` transportará el `ThreatProfile` evolucionado; no se agrega ningún flag mecánico a `ClientCommand` ni un mensaje específico de cobertura.
- [x] **UI Presentation:** preview de `+4 Cobertura`, línea visual compartida y overlays de alcance dinámico.
- [x] **Automatización:** unitarios de geometría/CA/alcance, integración de resolvers, E2E WebSocket y Playwright de preview.

## 8. Casos de prueba y Definition of Done propuesto

### Cobertura

- intercepción horizontal, vertical y diagonal exacta otorga una sola vez `+4`;
- una criatura fuera del segmento, detrás de un extremo o en otra altura no otorga cobertura;
- `active` y `disabled` bloquean; `dying`, `stable` y `dead` no;
- aliado o enemigo puede ser obstáculo vivo;
- varios bloqueadores no acumulan el bono;
- el bono se conserva contra normal, touch, flat-footed y touch + flat-footed;
- melee con alcance y ranged usan la misma regla;
- comandos que intenten enviar flags espaciales son rechazados por schemas estrictos;
- servidor y preview devuelven idénticos `blockerIds` para el mismo snapshot.

### Alcance

- arma normal Medium amenaza a 5 ft y no a 10 ft;
- longspear Medium amenaza a 10 ft y no a 5 ft;
- arma arrojadiza conserva su fuente melee normal al usarse adyacente;
- fuente normal Large usa su alcance derivado de tamaño;
- reach weapon Large escala mediante política catalogada, no por ID;
- `threatensTarget`, `isFlanking`, carga, AdO, validación de ataque y overlay coinciden en los límites mínimo/máximo;
- snapshot alterado o con intervalos no finitos/incoherentes falla cerrado.

### Gates

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
```

Se añadirá Playwright para verificar que la selección de un objetivo interpuesto muestra `Cobertura +4` y que el overlay de la lanza larga coincide con dos casillas de alcance.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| El booleano pierde la causa | el helper devuelve además `blockerIds` y `kind`; el booleano solo proyecta hacia `AttackContext` |
| Divergencia servidor/UI | ambos importan el mismo helper y usan el mismo snapshot; React no implementa geometría |
| Cobertura duplicada por varios ocupantes | contribución única no acumulable por categoría contextual |
| Reach weapon amenaza adyacente por usar solo máximo | intervalo con mínimo exclusivo y máximo inclusivo |
| Escalado por tamaño depende de constantes ocultas | política de catálogo validada contra `SizeRulesCatalog.medium` |
| Handlers olvidan pasar cobertura | factory única de contexto autoritativo y tests por entry point |
| Línea exacta no cubre todas las reglas SRD | alcance explícito de Sprint 013 y adaptador sustituible por supercover/footprints |
| Recalcular preview en cada render | selector puro memoizado por snapshot y selección, sin persistencia duplicada |

## 10. Fuera de alcance

- Cobertura Total y bloqueo efectivo de la acción.
- cobertura por muros, puertas, mobiliario o terreno del mapa;
- raycasting supercover, elección de esquinas SRD y cobertura parcial por footprints;
- concealment, miss chance, línea de visión e iluminación;
- alturas distintas, vuelo y volumen tridimensional;
- ocupación multicelda real para Large/Huge;
- ataques contra esquinas, squeezing y soft cover por criaturas de tamaños relativos;
- implementación de Precise Shot/Improved Precise Shot;
- cambio de arma o selección de una fuente de amenaza alternativa durante el turno.

Estas exclusiones no se simulan mediante fallbacks. Los casos no representables se mantienen fuera del catálogo/demo hasta disponer de su modelo explícito.

## 11. Frontera de aprobación

Este documento autoriza únicamente el diseño. No se modificarán `types.ts`, `rules.ts`, catálogos, snapshots, servidor, React, schemas ni tests hasta recibir la palabra formal `Proceed`.
