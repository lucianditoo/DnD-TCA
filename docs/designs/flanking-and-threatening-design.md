# NDD Sprint 011: Flanqueo y Amenaza

## Estado

- Fase: 7 — cierre y walkthrough.
- Implementación: completada tras aprobación formal `Proceed`.
- Baseline final: Sprint 011 cerrado con 221/221 pruebas, 80/80 verificaciones E2E WebSocket y 2/2 pruebas UI.
- Regla normativa: Capítulo 8, especialmente `combat/08_ataques_de_oportunidad.txt`, `combat/10_modificadores_de_combate.txt` y las reglas de espacio/alcance de `combat/07_movimiento.txt`.

## 1. Objetivo

Formalizar una única infraestructura espacial para responder dos preguntas puras:

1. si un combatiente amenaza a un objetivo mediante una fuente cuerpo a cuerpo válida; y
2. si un ataque cuerpo a cuerpo obtiene el bonificador circunstancial de +2 por flanqueo.

La misma respuesta debe ser reutilizada por servidor, Ataques de Oportunidad y preview de UI. El servidor seguirá siendo la autoridad: la UI solo presenta una predicción derivada del último snapshot recibido, mientras que el servidor recalcula el contexto inmediatamente antes de resolver el ataque.

## 2. Diagnóstico del estado actual

El repositorio ya contiene un primer corte funcional en `rules.ts`:

- `threatensTarget` comprueba estado vital, facción, tipo de arma y distancia;
- `isOpposite1x1` implementa la oposición mediante `Math.sign`;
- `isFlanking` busca linealmente un aliado opuesto que también amenace;
- `getAttackContextModifiers` produce `attackBonus: 2` y `flanqueo +2`;
- `attackCommands.ts` lo inyecta en ataques básicos y AdO;
- `ActionsPanel.tsx` usa el helper para el preview;
- `tests/flanking.test.mjs` cubre el corte 1×1.

Sprint 011 no duplicará esa lógica. La convertirá en una frontera estable y corregirá estas brechas:

| Brecha | Consecuencia |
| --- | --- |
| `handedness` mezcla capacidad de amenazar con modo del ataque actual | Una daga arrojadiza adyacente puede amenazar en melee, pero un lanzamiento sigue siendo ranged y nunca debe recibir +2. |
| Ataques básicos/AdO consumen contexto, pero carga y aptitudes de ataque no | Shocking Grasp y una carga cuerpo a cuerpo pueden omitir un modificador espacial legítimo. |
| Los detectores de AdO todavía usan `isAdjacent` en rutas independientes | Armas naturales y alcance futuro no tienen una única fuente de verdad. |
| El trait existente `NO_THREAT` no participa en `threatensTarget` | Estados que impiden atacar pueden seguir concediendo flanqueo por accidente. |
| La geometría conoce solo el punto ancla 1×1 | No existe una frontera preparada para espacios de 10×10 ft o mayores. |

## 3. Reglas funcionales

### 3.1. Amenaza

`threatensTarget(room, attacker, target): boolean` devolverá `true` únicamente cuando:

- atacante y objetivo sean combatientes distintos y pertenezcan a facciones opuestas;
- el atacante esté consciente: `active` o `disabled`; `dying`, `stable` y `dead` no amenazan;
- ningún efecto aplicable aporte el trait `NO_THREAT`;
- el snapshot del atacante declare al menos una fuente de amenaza cuerpo a cuerpo válida: arma melee equipada, arma natural o ataque sin arma que cuente explícitamente como armado;
- la distancia mínima entre el espacio del atacante y el espacio del objetivo sea menor o igual al alcance de alguna de esas fuentes.

`CANNOT_MAKE_AOO` y `NO_THREAT` no son sinónimos. Por ejemplo, Flat-Footed impide realizar AdO, pero no borra automáticamente la capacidad de amenazar o ayudar a flanquear. Un estado que realmente impida atacar debe declarar `NO_THREAT` de forma explícita.

### 3.2. Capacidad de amenaza derivada

Las reglas no deben preguntar por IDs concretos como `dagger`, `canocrock-bite` o una futura dote. El snapshot normalizará las fuentes en una capacidad derivada:

```ts
interface MeleeThreatSource {
  sourceId: string;
  kind: "weapon" | "natural" | "unarmed" | "effect";
  maxReachFeet: number;
}

interface ThreatProfile {
  meleeSources: readonly MeleeThreatSource[];
}
```

Este contrato es conceptual hasta recibir `Proceed`. Se derivará en `combatSnapshot.ts` desde EquipmentCatalog, ataques naturales y futuras contribuciones catalogadas de dotes. Nunca será aceptado como verdad desde un perfil o comando cliente.

Consecuencias del modelo:

- una daga puede aportar una fuente melee aunque también pueda lanzarse;
- un arco no aporta fuente melee por defecto;
- el `unarmed_strike` de respaldo no convierte silenciosamente a todos en “armados”; solo un ataque natural, una clase/dote futura o un dato catalogado lo habilita para amenaza;
- múltiples fuentes podrán coexistir sin reescribir `threatensTarget`;
- el alcance sigue siendo un dato derivado y no un condicional por nombre de arma.

La zona interior no amenazada de armas de asta, cambios de empuñadura y descargas de conjuros de toque retenidas se dejan fuera de alcance, pero la colección de fuentes permite incorporar bandas `[minReachFeet, maxReachFeet]` posteriormente sin cambiar la API pública.

### 3.3. Flanqueo 1×1

Para el corte habilitado en Sprint 011, la oposición exacta se calcula así:

```ts
dxA = Math.sign(attacker.x - target.x)
dyA = Math.sign(attacker.y - target.y)
dxB = Math.sign(ally.x - target.x)
dyB = Math.sign(ally.y - target.y)

opposite = dxA === -dxB
        && dyA === -dyB
        && (dxA !== 0 || dyA !== 0)
```

`isFlanking(room, attacker, target)`:

1. comprueba que el atacante amenaza al objetivo;
2. itera solo aliados distintos del atacante;
3. comprueba que el aliado amenaza al mismo objetivo;
4. delega la geometría a `areOppositeForFlanking(...)`;
5. retorna en el primer aliado válido.

No se persiste un estado `isFlanking`: mover, caer inconsciente, cambiar de arma o recibir un efecto puede cambiar el resultado en cualquier instante.

### 3.4. Modificador tipado por clase de ataque

El helper conservará la firma solicitada de tres argumentos:

```ts
getAttackContextModifiers(room, attacker, target): AttackContextModifiers
```

Para impedir que un ataque ranged herede un bono calculado para melee, el resultado será tipado por clase de ataque:

```ts
interface TacticalModifierSummary {
  attackBonus: number;
  labelParts: readonly string[];
}

interface AttackContextModifiers {
  flanking: boolean;
  byAttackType: Readonly<Record<"melee" | "ranged", TacticalModifierSummary>>;
}
```

Cuando existe flanqueo:

- `byAttackType.melee` contiene `attackBonus: 2` y `flanqueo +2`;
- `byAttackType.ranged` contiene `attackBonus: 0` y ninguna etiqueta.

El orquestador selecciona la rama usando el `attackType` de la fuente autoritativa ya resuelta. Así, capacidad de amenaza y tipo del ataque actual permanecen separados: una daga puede ayudar a amenazar mientras un lanzamiento con esa daga no recibe el bono.

## 4. Geometría preparada para criaturas grandes

### 4.1. Frontera espacial

`isFlanking` y `threatensTarget` no calcularán directamente desde centros o anclas. Delegarán en dos primitivas internas:

- `distanceBetweenFootprintsFeet(room, attacker, target)`;
- `areOppositeForFlanking(room, attacker, ally, target)`.

Sprint 011 implementará el adaptador 1×1 con la fórmula obligatoria de signos. `Position` se documentará como el ancla de menor `x/y` del espacio ocupado. Para una criatura 1×1, ancla y única casilla coinciden.

Cuando el tablero soporte espacios múltiples, las primitivas obtendrán las casillas ocupadas desde `sizeCategory`, `SizeRulesCatalog.spaceFeet` y `board.cellSizeFeet`. La oposición general seguirá la regla oficial: alguna línea entre centros de casillas ocupadas por los dos flanqueadores debe atravesar lados opuestos —incluidas sus esquinas— del footprint del defensor. Si un flanqueador ocupa varias casillas, bastará cualquier casilla válida.

El cambio futuro quedará confinado al adaptador geométrico y a Board/colisiones. Las funciones públicas `threatensTarget`, `isFlanking` y `getAttackContextModifiers` no cambiarán.

### 4.2. Política mientras el tablero sea 1×1

El soporte visual y de colisiones para tokens multi-celda no forma parte de Sprint 011. No se fingirá precisión para tamaños grandes. El adaptador 1×1 será explícito y sus tests se limitarán a footprints de una casilla. El NDD deja fijadas la semántica del ancla y la frontera a sustituir cuando se habilite ocupación real.

## 5. Flujo autoritativo de resolución

```text
ClientCommand expresa una acción y sus dados
  → servidor valida ownership, turno y fuente seleccionada
  → servidor obtiene attackType desde arma/aptitud catalogada
  → getAttackContextModifiers(snapshot, attacker, target)
  → selecciona byAttackType[attackType]
  → agrega otros modificadores del comando (carga, defensiva, iterativo)
  → resolveAttack recibe un único número general
  → servidor registra traza y publica el nuevo CombatRoom
```

`attackResolver.ts`:

- no importará `isFlanking`, `threatensTarget` ni geometría;
- no recorrerá combatientes para determinar posición táctica;
- no confiará en un bono enviado por el cliente;
- continuará recibiendo un `attackModifier` agregado y sus datos de fuente autoritativa.

Los cuatro entry points que usan `resolveAttack` deberán seleccionar la misma rama tipada:

- ataque estándar/completo;
- ataque de oportunidad;
- carga;
- aptitud con tirada de ataque, incluido Shocking Grasp; Ray of Frost seleccionará ranged y recibirá cero por flanqueo.

No se agrega ningún campo a `ClientCommand` ni a los schemas Zod para comunicar flanqueo.

## 6. Reutilización en Ataques de Oportunidad

Los detectores de AdO reemplazarán comprobaciones propias basadas exclusivamente en `isAdjacent` por `threatensTarget`:

- abandono de una casilla amenazada durante movimiento;
- uso de arma ranged dentro de una zona amenazada.

La disponibilidad de ejecutar el AdO se mantiene separada mediante `Rules.canMakeOpportunityAttack`. La secuencia correcta será:

```text
threatensTarget == true
AND canMakeOpportunityAttack == true
AND todavía no consumió su reacción permitida
```

Esto permite que Flat-Footed siga describiendo correctamente “amenaza, pero no puede efectuar AdO”, y prepara Combat Reflexes sin acoplarlo al algoritmo de flanqueo.

## 7. UI Preview

`ActionsPanel.tsx` seguirá usando el helper compartido sobre el `CombatRulesSnapshot` recibido. No implementará geometría ni decidirá qué posiciones flanquean.

La presentación mostrará `+2 Flanqueo` únicamente cuando la acción seleccionada tenga `attackType: melee`:

- ataque de arma melee;
- Shocking Grasp u otra aptitud melee futura;
- preview de carga cuando su posición final pueda evaluarse sin simular estado mutable.

Ray of Frost, arco y cualquier fuente ranged mostrarán cero aunque el combatiente esté situado en una relación espacial de flanqueo.

El preview es informativo. Si otro combatiente se mueve o cambia de estado antes de la confirmación, el resultado del servidor prevalece y el log mostrará el contexto realmente aplicado.

## 8. Design Review Checklist

### 8.1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería fijar que `Position` representa siempre el centro de una única casilla y dispersar `Math.sign` por consumidores. El diseño evita esa irreversibilidad mediante:

- semántica de ancla de footprint para `Position`;
- `SizeRulesCatalog.spaceFeet` como fuente del tamaño físico;
- `distanceBetweenFootprintsFeet` y `areOppositeForFlanking` como únicas fronteras geométricas;
- fórmula de signos encapsulada como implementación 1×1, no como contrato público;
- `isFlanking` expresado en términos de amenaza + oposición, sin conocer cuántas casillas ocupa nadie.

Para Large/Huge se sustituirá solo el adaptador por intersección de líneas con lados opuestos del footprint. No se reescribirán amenaza, búsqueda de aliados, aplicación del bono, resolver ni UI.

### 8.2. Complejidad accidental y ausencia de ciclos

La dependencia será un DAG estricto:

```text
getAttackContextModifiers
  → isFlanking
    → threatensTarget
      → ThreatProfile + EffectReducer + geometría de distancia
    → areOppositeForFlanking
```

`threatensTarget` nunca llama a `isFlanking`, a los resolvers de AdO ni a `getAttackContextModifiers`. `Rules.canMakeOpportunityAttack` tampoco participa en la definición de amenaza. Por tanto, buscar un aliado no dispara búsquedas anidadas de flanqueo ni recursión.

El coste es O(N × S) por consulta, donde N es el número de combatientes y S el pequeño número de fuentes melee del candidato. Se usa retorno temprano. No habrá cache global ni estado derivado persistido; si hiciera falta optimizar encuentros grandes, se podrá construir un índice efímero por snapshot sin alterar las APIs.

La complejidad heredada que se purga es la duplicación `isAdjacent + lifeStatus + arma` en distintos detectores de AdO.

### 8.3. Matriz de reutilización

- **ActiveEffects:** reutiliza el trait existente `NO_THREAT`; no modela flanqueo como efecto persistente. `CANNOT_MAKE_AOO` continúa siendo una capacidad distinta.
- **Pure Helpers:** reutiliza `lifeStatus`, `distanceFeet`, `SizeRulesCatalog`, `CombatRulesSnapshot` e infraestructura contextual de Sprint 008–010.
- **Resolvers:** no cambia la matemática de d20; solo recibe un modificador circunstancial agregado antes de resolver.

### 8.4. Regla de Tres

Tres mecánicas que reutilizarán inmediatamente esta infraestructura:

1. **Ataque Furtivo del Pícaro:** consulta `isFlanking` para habilitar dados adicionales sin recalcular geometría.
2. **Vexing Flanker / Adaptable Flanker:** modifica declarativamente la elegibilidad o magnitud del contexto, manteniendo la misma consulta espacial.
3. **Combat Reflexes:** reutiliza `threatensTarget` para detectar oportunidades y amplía únicamente el presupuesto de AdO según Destreza.

También quedan habilitados Prestar ayuda basado en amenaza, armas con alcance, cobertura para AdO y efectos `NO_THREAT` como parálisis o inconsciencia.

### 8.5. Matriz de impacto de subsistemas

| Subsistema | Impacto Sprint 011 |
| --- | --- |
| Rule Engine | Formaliza ThreatProfile, amenaza, oposición aislada y contexto tipado melee/ranged. |
| CombatRoom / Snapshot | Añade una capacidad de amenaza derivada e inmutable; no persiste `isFlanking`. |
| EquipmentCatalog | Conserva explícitamente capacidad melee y alcance al construir el snapshot. |
| ActiveEffects | Consume `NO_THREAT`; puede agregarlo a estados que impiden atacar. |
| Ownership | Sin cambios; cada handler mantiene los controles actuales. |
| WebSocket | Sin nuevos comandos ni flags; solo posible campo derivado aditivo dentro del snapshot emitido por servidor. |
| Servidor | Orquestadores calculan y seleccionan el contexto; `attackResolver` permanece espacialmente ignorante. |
| UI | Preview mediante el helper compartido; cero fórmulas de flanqueo en React. |
| Tests | Unitarios de capacidad/geometría/contexto, integración de todos los entry points, E2E y UI preview. |

### 8.6. Qué no resuelve este sprint

- ocupación, render, colisiones y movimiento de tokens de varias casillas;
- línea de visión, línea de efecto, cobertura u ocultación para amenaza;
- zona interior de armas de alcance y cambio explícito melee/ranged para armas de doble modo;
- conjuros de toque retenidos como fuente temporal de amenaza;
- Ataque Furtivo, Vexing Flanker o Combat Reflexes propiamente dichos;
- más de dos facciones o relaciones diplomáticas dinámicas;
- elevación 3D para determinar lados opuestos.

Estas exclusiones no se resuelven con fallbacks silenciosos. Cada una deberá entrar mediante datos catalogados o el adaptador geométrico definido.

## 9. Alternativas consideradas

### A. Calcular flanqueo dentro de `attackResolver`

Rechazada: acopla matemática de dados con espacio, dificulta tests y obliga al resolver a recorrer la sala.

### B. Enviar `isFlanking` o `flankingBonus` desde React

Rechazada: viola servidor autoritativo y permite manipulación del payload.

### C. Guardar `isFlanking` en cada combatiente

Rechazada: es estado derivable que queda obsoleto ante cualquier movimiento, caída, cambio de equipo o efecto.

### D. Usar solo `handedness !== ranged`

Rechazada: confunde capacidad de amenazar con tipo de ataque actual y falla con armas arrojadizas, naturales y ataques sin arma armados.

### E. Generalizar completamente Board multi-celda en este sprint

Rechazada por alcance: exige rediseñar render, colisiones, pathfinding y selección. Se fija la frontera geométrica para hacerlo después sin contaminar la entrega 1×1.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Preview difiere del servidor por estado desactualizado | Mostrarlo como preview y recalcular siempre en el servidor antes de tirar. |
| Un ranged recibe +2 por consumir el valor agregado equivocado | Resultado indexado por `attackType`; tests para arco, daga lanzada y Ray of Frost. |
| Flat-Footed deja de ayudar a flanquear al reutilizar `canMakeOpportunityAttack` | Mantener `NO_THREAT` separado de `CANNOT_MAKE_AOO`; test explícito. |
| Stunned continúa amenazando | Añadir `NO_THREAT` al efecto que impide atacar y cubrirlo por regresión. |
| Cambio de snapshot rompe fixtures | Centralizar `ThreatProfile` por defecto en utilidades de tests; no rellenar manualmente docenas de objetos. |
| Algoritmo grande y Board difieren | No habilitar soporte live multi-celda hasta que render, colisión y geometría compartan footprint. |

## 11. Estrategia de pruebas

### Unitarias

- arma melee, ataque natural y fuente unarmed armada amenazan dentro de alcance;
- arco y unarmed no armado no amenazan;
- `dying`, `stable`, `dead` y `NO_THREAT` no amenazan; `disabled` sí;
- Flat-Footed conserva amenaza aunque no pueda realizar AdO;
- fuera de alcance y misma facción devuelven false;
- oposición N/S, E/O y diagonales opuestas; configuraciones ortogonales no opuestas;
- atacante y aliado deben amenazar realmente;
- contexto flanqueado produce melee +2 y ranged +0;
- orden de combatientes no altera el resultado;
- snapshot/original no son mutados.

### Integración de servidor

- ataque estándar y ataque completo reciben +2;
- carga melee y Shocking Grasp reciben +2;
- arco, daga resuelta como ranged y Ray of Frost reciben +0;
- AdO usa amenaza compartida y conserva la posición histórica de resolución;
- `attackResolver.ts` funciona únicamente con el número inyectado y no importa helpers espaciales.

### E2E WebSocket

- dos aliados opuestos atacan: total y log incluyen `flanqueo +2`;
- mover o incapacitar al aliado elimina el bono en la siguiente resolución;
- un ataque ranged en la misma formación no recibe el bono;
- payload con campos `isFlanking` o `flankingBonus` es rechazado por schemas estrictos;
- preview y resolución del caso estable coinciden.

### UI

- ActionsPanel muestra `+2 Flanqueo` para ataque melee seleccionado;
- no lo muestra para Ray of Frost/arco;
- al cambiar objetivo o posiciones, el preview se recalcula desde props sin estado duplicado.

## 12. Criterios de aceptación

- Existe una única implementación pura de amenaza compartida por flanqueo y detección de AdO.
- Solo una fuente melee válida y consciente puede amenazar.
- El atacante y al menos un aliado de la misma facción amenazan desde lados opuestos 1×1.
- El bono circunstancial es exactamente +2 para melee y exactamente 0 para ranged.
- `attackResolver.ts` no contiene ni importa lógica espacial.
- La UI usa el helper compartido y el servidor recalcula autoritativamente.
- No existe estado persistido de flanqueo ni flag cliente.
- La geometría 1×1 está encapsulada detrás de una frontera compatible con footprints futuros.
- Pruebas, documentación y Rule Registry describen el mismo comportamiento.

## 13. Secuencia tras aprobación

1. contratos derivados de amenaza y fixtures;
2. helpers puros y traits;
3. unificación de AdO;
4. integración en todos los entry points de ataque;
5. preview UI;
6. tests unitarios, integración, E2E y UI;
7. documentación y walkthrough.

La aprobación `Proceed` fue recibida. La secuencia quedó implementada y validada sin introducir campos de flanqueo en `ClientCommand` ni lógica espacial en `attackResolver.ts`.

## 14. Resultado de implementación

- El snapshot deriva y valida `ThreatProfile.meleeSources` desde equipo y ataques naturales catalogados.
- Amenaza y AdO comparten `threatensTarget`; `NO_THREAT` permanece separado de `CANNOT_MAKE_AOO`.
- La oposición 1×1 y la distancia están encapsuladas tras adaptadores geométricos reemplazables.
- Ataques básicos, iterativos, AdO, carga y aptitudes seleccionan contexto melee/ranged antes de invocar el resolver.
- ActionsPanel muestra el preview compartido para armas y aptitudes; el servidor vuelve a calcular siempre.
- La traza conserva por separado carga, defensiva, iterativos y `flanqueo +2`.
- Validación final: 221/221 pruebas, typecheck limpio, build completo, 80/80 verificaciones WebSocket y 2/2 pruebas UI.
