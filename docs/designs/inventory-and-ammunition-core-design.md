# Sprint 026 — Inventory & Ammunition Core

**Estado:** Fase 2 — diseño técnico pendiente de aprobación formal `Proceed`.

## 1. Objetivo

Sustituir el loadout V3, que mezcla ranuras con listas de armas y materializa un `WeaponProfile` dentro del combatiente, por un modelo V4 con dos únicas fuentes mecánicas:

- una mochila de instancias que solo referencia entradas del `EquipmentCatalog`;
- unas ranuras que apuntan a identidades de esa mochila.

Sobre esa base, el servidor validará y consumirá munición finita de forma autoritativa y transaccional. React mostrará el mismo estado proyectado por reglas, pero no decidirá compatibilidad, stock, tiradas ni consumo.

## 2. Estado actual verificado

### 2.1. Catálogo y equipo

- `EquipmentCatalog` separa armas, armaduras y escudos y convierte un `WeaponEntry` en `WeaponProfile`.
- El catálogo ya contiene `arrows_20`, `crossbow_bolts_10`, `repeating_crossbow_bolts_5` y `sling_bullets_10` con `isAmmunition`, pero las armas de proyectil no declaran qué familia consumen.
- `isMelee`, `isRanged` y `rangeIncrementFt` no distinguen inequívocamente un arma arrojadiza de una que requiere proyectiles. Esa decisión no debe inferirse por nombres.

### 2.2. Modelo V3

`CreatureEquipmentLoadout` conserva simultáneamente `mainWeapon`, `offHand`, `armor`, `shield` y una lista opcional `weapons`. Al crear el snapshot, `combatSnapshot.ts` copia ese loadout y además materializa:

- `weapon?: WeaponProfile`;
- `threatProfile` derivado del arma;
- `armorClassBreakdown` derivado de armadura y escudo.

Esas copias son coherentes al inicio del encuentro, pero quedarían obsoletas en cuanto `equip-item`, `unequip-item`, Desarmar o Romper un arma cambiasen una ranura. Actualizar cada cache desde cada handler produciría estados huérfanos y violaría la fuente única del catálogo.

### 2.3. Ataques y AUTO

- `handleResolveAttack` deriva tipo y fuente desde `attacker.weapon`, ejecuta `resolveAttack` y muta la sala en ramas distintas para impacto normal o amenaza crítica.
- La confirmación crítica es una fase diferida. Un proyectil debe gastarse al efectuar el ataque inicial, no al confirmar el crítico.
- Los esquemas Zod de ataque ya admiten `isAutoRoll?` y tiradas anulables, pero el tipo manual `ClientCommand` y algunos emisores React siguen enviando una tirada generada en el cliente. La frontera no está alineada todavía.
- El lanzamiento de conjuros ya posee un patrón de borrador y commit único. Esta infraestructura debe extraerse y reutilizarse en lugar de crear una segunda transacción incompatible.

### 2.4. Invariantes aplicables

La Regla 5 de `.ai/DO_NOT_BREAK.md` exige fuentes V3 completas y fallo descriptivo ante referencias inválidas. V4 conserva y endurece la regla: inventario y ranuras son fuentes; CA, ataque, daño, velocidad, alcance y amenaza son proyecciones. Nunca se acepta una estadística precalculada ni un objeto de catálogo incrustado.

## 3. Modelo declarativo V4

### 3.1. Contratos compartidos

```ts
export interface EquipmentSlots {
  readonly mainHandItemId: string | null;
  readonly offHandItemId: string | null;
  readonly armorItemId: string | null;
}

export interface InventoryItem {
  readonly itemId: string;
  readonly catalogId: string;
  readonly quantity?: number;
}
```

`CreatureTemplate`, `StoredProfile` y `CombatantSnapshot` declararán `inventory` y `equipmentSlots`; se elimina `equipment: CreatureEquipmentLoadout`. Los tres IDs de ranura son **IDs de instancia** (`itemId`), nunca IDs de catálogo. El escudo ocupa `offHand`; no se añade un cuarto slot paralelo.

Invariantes:

1. `itemId` es único dentro del combatiente y estable durante la vida del perfil/encuentro.
2. Todo `catalogId` existe en el catálogo unificado.
3. Toda ranura no nula referencia un ítem de la misma mochila y compatible con ella.
4. Un mismo `itemId` no puede ocupar dos ranuras.
5. Un arma a dos manos en `mainHand` bloquea analíticamente `offHand`; no se persiste un flag `offHandBlocked`.
6. Los elementos apilables/consumibles requieren `quantity` entero `>= 0`; los no apilables omiten `quantity`. Cero representa una pila agotada visible y no una referencia inválida.
7. El snapshot clona `inventory`, `equipmentSlots` y cada registro. No comparte arrays con perfil, catálogo ni sala origen.

### 3.2. Catálogo unificado y compatibilidad

`EquipmentCatalog` incorporará una consulta discriminada (`getItem`/`requireItem`) capaz de resolver arma, armadura o escudo sin que los consumidores repitan búsquedas por categoría. Las entradas conservarán su categoría de equipo y declararán compatibilidad de slot.

Para armas a distancia se añadirá metadata explícita, no inferida del nombre:

```ts
type RangedDelivery = "none" | "thrown" | "projectile";
type AmmunitionKind = "arrow" | "bolt" | "sling-bullet";

interface WeaponEntry {
  readonly rangedDelivery: RangedDelivery;
  readonly requiredAmmunitionKind?: AmmunitionKind;
  readonly ammunitionKind?: AmmunitionKind; // solo entradas de munición
}
```

- `projectile` exige `requiredAmmunitionKind` y consume una unidad compatible.
- `thrown` no busca una pila separada en este sprint. La futura pérdida/recuperación de la propia arma arrojada se apoyará en `quantity`, pero queda fuera de alcance.
- una entrada de munición declara `ammunitionKind` y es apilable.
- el arranque/test de catálogo falla si hay combinaciones incompletas o IDs duplicados.

La familia, en lugar de una pareja rígida arma→ID, permite flechas mágicas o virotes especiales sin modificar cada arco o ballesta. En V4 solo existe munición ordinaria; si hay varias pilas compatibles, el selector consume determinísticamente la de menor `itemId`. Una selección explícita de munición especial será una extensión posterior del comando, no una elección implícita del cliente.

### 3.3. Eliminación de caches dependientes del equipo

Para que el cambio de ranura sea seguro, V4 retirará de `CombatantSnapshot` los derivados dependientes de equipo:

- `weapon`;
- `threatProfile` materializado;
- `armorClassBreakdown` materializado.

En su lugar, selectores puros resolverán en caliente las fuentes:

- `getEquippedInventoryItem(combatant, slot)`;
- `getEquippedWeapon(combatant)`;
- `getArmorClassBreakdown(snapshot, combatant)`;
- `getMeleeThreatSources(snapshot, combatant)`;
- `getAmmunitionState(combatant, weapon)`.

`Rules.totalArmorClass`, `Rules.totalAttackBonus`, `Rules.totalSpeedFeet`, amenaza, alcance, daño medio, carga, AdO y resolvedores consumirán esos selectores. `intrinsicDefense`, características, tamaño, `naturalAttackId`, inventario y ranuras continúan siendo fuentes explícitas. Un combatiente sin arma de mano usa su ataque natural catalogado o el ataque sin arma reglamentario; no se reconstruye un arma faltante mediante estimaciones.

Los guards de compile-time se ampliarán para impedir la reintroducción de `weapon`, `threatProfile`, `armorClassBreakdown` y el antiguo `equipment` en los tres contratos protegidos. El desglose de CA seguirá existiendo como valor de retorno calculado por `Rules`, no como estado persistido.

## 4. Persistencia y migración V3→V4

La persistencia se elevará a versión 4 con clave propia, envelope Zod estricto, backup pre-V4 e idempotencia.

La migración es determinista:

1. Reúne todos los IDs de catálogo presentes en `mainWeapon`, `offHand`, `armor`, `shield` y `weapons`.
2. Normaliza duplicados por identidad mecánica y cantidad. Los IDs de instancia se generan con una función estable basada en `profile.id`, categoría, `catalogId` y ordinal; nunca con azar o fecha.
3. Materializa las pilas de munición conocidas con su cantidad de paquete (`20`, `10` o `5`) y conserva cantidades explícitas válidas.
4. Mapea `mainWeapon` a `mainHandItemId`, `offHand` o `shield` a `offHandItemId` y `armor` a `armorItemId`.
5. Si dos campos legacy compiten por el mismo slot o una referencia es desconocida, el perfil entra en cuarentena con diagnóstico; no se elige silenciosamente.
6. Valida el resultado V4 y lo escribe una sola vez, conservando el raw original en backup.

Las criaturas integradas migrarán directamente a `inventory` + `equipmentSlots`. El arquero incluirá arco y flechas explícitas. Las criaturas naturales conservarán manos/armadura nulas y mochila vacía, además de su `naturalAttackId`.

El inventario del `CombatantSnapshot` es estado del encuentro. El consumo en servidor no reescribe automáticamente el localStorage del perfil: no existe todavía un protocolo autoritativo de reconciliación postcombate. La persistencia permanente del botín y consumos entre encuentros queda delimitada fuera de este sprint.

## 5. Preflight y consumo autoritativo de munición

### 5.1. Proyección pura

```ts
interface AmmunitionState {
  readonly required: boolean;
  readonly ammunitionKind?: AmmunitionKind;
  readonly availableQuantity: number;
  readonly selectedItemId?: string;
}

getAmmunitionState(combatant, weapon): AmmunitionState
validateAttackAmmunition(combatant, weapon): RuleResult<AmmunitionState>
consumeInventoryQuantity(combatant, itemId, amount): CombatantSnapshot
```

`getAmmunitionState` y `validateAttackAmmunition` son puros y compartidos. El segundo devuelve un error explícito como `No quedan flechas compatibles para Arco largo`. El cliente puede usar la proyección para presentar disponibilidad; el servidor siempre repite la validación sobre el snapshot autoritativo.

`consumeInventoryQuantity` devuelve un nuevo combatiente, un nuevo array y un nuevo registro solo para la pila modificada. No muta el argumento ni realiza una copia JSON que pierda tipos. Rechaza cantidades negativas, faltantes o consumo excesivo.

### 5.2. Semántica temporal

Una unidad se consume cuando el servidor acepta y resuelve el **intento de ataque inicial**, independientemente de impacto, fallo, 1 natural o amenaza crítica. Es la regla física de haber disparado el proyectil.

No se consume si falla ownership, turno, economía de acciones, rango, objetivo, slot, catálogo, stock o cualquier otra validación previa. La confirmación crítica no consume otra unidad. Cancelar una amenaza crítica aplica el impacto normal y tampoco devuelve la munición ya disparada. En ataque completo, cada ataque iterativo aceptado consume exactamente una unidad.

### 5.3. Transacción

El patrón local de `commitCombatRoomTransaction` usado por conjuros se extraerá a una utilidad de servidor reutilizable. `handleResolveAttack` trabajará sobre un borrador:

1. **Preflight:** auth, ownership, fase, turno, acción, fuente equipada, rango y munición; no hay mutaciones.
2. **Resolve:** tiradas, ataque, daño y posible amenaza crítica sobre snapshot del borrador.
3. **Stage:** crea el combatiente con cantidad `−1` y prepara los demás cambios de ataque.
4. **Commit:** reemplaza la sala una sola vez, sincroniza fase y emite un único broadcast.

Si cualquier etapa arroja error, el borrador se descarta y la sala original, incluida la munición, permanece intacta. El log de ataque añade la munición restante. Este refactor reduce la deuda DT-001 en el flujo normal sin exigir convertir todos los handlers durante el mismo sprint.

## 6. Gestión de ranuras y contrato WebSocket

Los ejemplos del PM se entienden como payloads de dominio dentro del envelope común. Para enrutar y validar control de forma segura, los comandos completos serán:

```ts
{ type: "equip-item", roomCode, actorId, combatantId, itemId, slot }
{ type: "unequip-item", roomCode, actorId, combatantId, slot }
```

con `slot: "mainHand" | "offHand" | "armor"`.

No se acepta `catalogId`, estadísticas, cantidad, compatibilidad ni objeto de equipo desde red. El servidor valida Zod temprano, control con `requireCombatantControl`, pertenencia del ítem, compatibilidad, ocupación a dos manos y fase.

Semántica de acción V1:

- durante `preparation`, cualquier slot puede gestionarse sin coste de turno;
- durante combate activo, cambiar `mainHand`/`offHand` consume una acción de movimiento mediante un perfil compartido de cambio de equipo;
- equipar o quitar armadura en combate se rechaza en V1, porque su tiempo no equivale a una acción de movimiento;
- el perfil deja el punto de extensión para Quick Draw sin flags enviados por el cliente.

La mutación reemplaza inmutablemente `equipmentSlots`; no toca CA, ataque o amenaza porque esas magnitudes se recalculan al consultarse. `unequip-item` no borra la instancia de la mochila.

## 7. AUTO autoritativo y UI

### 7.1. Contrato de tiradas

Se alineará el tipo manual de `ClientCommand` con Zod. Para conservar el requisito `isAutoRoll: true`:

- con `isAutoRoll === true`, `d20Roll` y `damage` deben ser `null` o se ignoran/rechazan; el servidor genera d20 y dados de arma mediante un roller inyectable;
- con `isAutoRoll !== true`, Zod exige una tirada d20 válida y conserva el flujo manual de daño;
- la confirmación crítica y los AdO aplican la misma discriminación;
- el servidor registra las tiradas generadas y nunca acepta una cifra cliente como “automática”.

La inyección de roller hace deterministas los tests sin exponer semillas ni resultados al cliente.

### 7.2. React

`ActionsPanel` consumirá selectores shared:

- lista de pilas de flechas, virotes y balas con nombre y cantidad;
- indicador rojo cuando el arma de proyectil equipada no tiene stock compatible;
- botón de resolver ataque gris/deshabilitado cuando el preflight local falla por munición;
- checkbox AUTO envía `isAutoRoll: true` y campos de tirada nulos; no tira dados en el navegador;
- tras `room-update`, la cantidad renderizada proviene del snapshot confirmado por servidor.

React no inspecciona strings de IDs, no decide si un arma es de proyectil y no decrementa optimistamente. Un cliente alterado que habilite el botón seguirá bloqueado por el servidor.

La pantalla de perfiles migrará sus selectores de loadout a la misma mochila/ranuras. El usuario elige instancias poseídas; el formulario no incrusta entradas del catálogo.

## 8. Secuencias principales

### Ataque con proyectil

1. UI proyecta arma, alcance y stock desde shared.
2. Cliente envía intención de ataque y modo de tirada.
3. Servidor valida comando, control, fuente equipada y munición.
4. Resuelve sobre borrador; el proyectil se marca para consumo.
5. Commit único aplica ataque, cantidad y fase; luego broadcast.
6. Si hay amenaza crítica, la cantidad ya refleja el disparo; confirmar/cancelar no vuelve a consumir.

### Equipar

1. Cliente envía `itemId` y slot deseado.
2. Servidor resuelve el `catalogId` desde el inventario del combatiente.
3. Regla pura valida compatibilidad, manos y economía.
4. Handler reemplaza `equipmentSlots` y sincroniza la sala.
5. Todas las vistas de CA, ataque, alcance y amenaza cambian automáticamente por derivación.

## 9. Design Review Checklist

### 9.1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería usar IDs de catálogo como identidad física o conservar caches derivados junto a ranuras mutables. Sunder necesita destruir **una instancia**; Desarmar necesita mover **esa instancia** fuera del slot sin destruirla. Por eso las ranuras apuntan a `itemId`, el ítem apunta a `catalogId` y el estado de condición/durabilidad futuro pertenecerá a la instancia, no a la definición global.

Al eliminar `weapon`, `threatProfile` y `armorClassBreakdown` del snapshot, Sunder o Desarmar solo realizan una transición de inventario/slot. `Rules` vuelve a resolver catálogo, CA, ataque, daño, velocidad y amenaza en la siguiente consulta. No hay cinco caches que mantener ni riesgo de que un personaje desarmado siga amenazando con el arma anterior.

La familia de munición evita acoplar cada arco a una única flecha y permite proyectiles mágicos futuros. La identidad de instancia permite luego durabilidad, objetos malditos, mejoras y ownership sin cambiar la firma de las ranuras.

### 9.2. Complejidad accidental

La arquitectura actual obliga a `combatSnapshot.ts` a normalizar y clonar el mismo loadout, llamar `deriveEquipmentStats` y copiar `weapon`, `threatProfile` y `armorClassBreakdown`, además de revalidarlos reconstruyendo un `CreatureTemplate` artificial. V4 elimina ese ciclo.

El inicializador solo valida y copia fuentes: inventario, ranuras, anatomía, tamaño, características y defensa intrínseca. Los consumidores consultan un único selector de catálogo. También desaparecen `resolveWeapon`, `selectedOffHand`, la lista paralela `weapons` y los fallbacks entre `mainWeapon` y `weapons.find(equipped)`.

La segunda complejidad heredada es que la transacción de sala vive privada dentro de `abilityCommands.ts`. Se extrae para reutilizarla en ataques y evitar un “commit de inventario” ad-hoc.

### 9.3. Matriz de reutilización

- **ActiveEffects:** no modela posesión ni cantidad. Efectos temporales futuros podrán modificar capacidad de equipar/usar, pero inventario sigue siendo estado estructural.
- **Pure helpers:** se reutilizan `RuleResult`, catálogo, snapshots, economía de acciones, rango, ataque, CA y amenaza. Los nuevos selectores alimentan a esos mismos pipelines.
- **Resolvers:** `resolveAttack` continúa resolviendo matemática; el preflight de equipo/munición y el commit pertenecen al handler transaccional. No recibe cantidades desde red.

### 9.4. Regla de tres

1. **Carga y penalizadores por peso:** el inventario y las entradas catalogadas permiten sumar peso y alimentar velocidad, Acrobacias y carga máxima.
2. **Quick Draw y Desarmar/Sunder:** el perfil de cambio de ranura y la identidad por instancia soportan desenfundado rápido, objetos en el suelo, destrucción y recuperación.
3. **Pociones, pergaminos y varitas:** `quantity` y procedencia catalogada permiten consumibles con usos o cargas sin incrustar su definición en el combatiente.

También quedan preparados flechas mágicas, recuperación de armas arrojadas y loot persistente.

### 9.5. Matriz de impacto

| Subsistema | Impacto |
| --- | --- |
| Rule Engine | selectores de inventario/ranuras, desglose dinámico, compatibilidad y preflight de munición |
| CombatRoom / Snapshot | V4 añade `inventory` y `equipmentSlots`; retira loadout y caches derivados de equipo |
| EquipmentCatalog | consulta unificada, categoría de entrega y familia de munición |
| Persistencia | StoredProfile V4, schema estricto, backup, migrador determinista y cuarentena |
| WebSocket | comandos equip/unequip; alineación AUTO para ataque, confirmación y AdO |
| Servidor | handler de equipo, ataque en borrador y commit único con consumo |
| UI | inventario/stock, ranuras, deshabilitado predictivo y AUTO realmente servidor |
| Tests | migración, invariantes, consumo hit/miss/crítico, rollback, auth, E2E y UI |

## 10. Estrategia de pruebas

### Unitarias

- validación de item IDs únicos, referencias de slot, categoría y dos manos;
- migración V3→V4 idempotente, cantidades de paquetes y cuarentena ambigua;
- arco/ballesta/honda requieren su familia; daga/jabalina arrojada no consume flechas;
- stock cero devuelve `RuleResult` fallido;
- consumo devuelve copias nuevas, resta exactamente uno y no muta el original;
- CA, ataque, velocidad y amenaza cambian al cambiar ranuras sin actualizar caches;
- guards estáticos impiden estructuras V3 y derivados incrustados.

### Integración y E2E

- un disparo impactado, fallado y con 1 natural consume una unidad cada uno;
- amenaza crítica consume solo al ataque inicial; confirmación/cancelación consume cero adicional;
- ataque completo consume una unidad por iteración aceptada;
- error de rango/turno/ownership/stock no consume ni muta sala;
- fallo durante resolución descarta borrador completo;
- equip/unequip valida control y compatibilidad;
- AUTO ignora entradas cliente y usa roller servidor determinista.

### UI

- cantidades visibles se actualizan tras `room-update`;
- ataque de proyectil agotado aparece rojo y deshabilitado;
- armas melee/arrojadizas no se bloquean por ausencia de flechas;
- AUTO envía intención sin generar d20/daño local.

La validación de Fase 5 deberá ejecutar, en orden: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs` y `npm run test:ui`.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| consumo doble por crítico | consumir en ataque inicial; confirmación carece de paso de munición |
| mutación parcial antes de un error | borrador de sala y commit único reutilizable |
| perfil V3 ambiguo | migración cerrada con diagnóstico y cuarentena, nunca selección silenciosa |
| UI y servidor divergen | ambos consumen selectores shared; servidor repite preflight |
| arma a dos manos y offhand simultáneos | invariante de ranuras derivada del catálogo |
| stats obsoletos tras equipar | eliminar caches dependientes del equipo y calcular desde fuentes |
| IDs de paquete confundidos con cantidad | metadata catalogada y migración explícita de 20/10/5 unidades |

## 12. Fuera de alcance

- botín en el suelo, comercio, monedas y transferencia entre combatientes;
- persistir automáticamente en localStorage el consumo ocurrido en una sala;
- recuperación, rotura o pérdida de armas arrojadas;
- selección manual de munición mágica y efectos especiales de proyectiles;
- recarga de ballestas y cadencia específica de armas;
- tiempos completos de poner/quitar armadura durante combate;
- Sunder, Disarm, carga por peso y Quick Draw como reglas jugables;
- inventarios compartidos, contenedores anidados y límites de volumen.

## 13. Criterios de aceptación del diseño

- perfiles, templates y snapshots solo guardan `inventory`, `equipmentSlots` y referencias de catálogo;
- ninguna estadística derivada de equipo se persiste o debe sincronizarse al equipar;
- munición de proyectil se valida antes de mutar y se consume una vez por intento aceptado;
- el ataque completo, los críticos y AUTO tienen semántica inequívoca;
- los nuevos comandos incluyen routing, combatiente y ownership autoritativos con Zod temprano;
- React proyecta disponibilidad, pero no decide reglas ni dados;
- no se modifica código ejecutable hasta recibir `Proceed`.
