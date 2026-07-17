# NDD — Sprint 030 Grapple Core V2: Acciones en Agarre

## Estado y frontera de autorización

Implementado y validado. El diseño recibió `Proceed` formal y su alcance se cerró con la suite global en verde.

## Objetivo

Completar la primera capa de acciones autoritativas dentro de una Presa:

1. permitir que un participante intente escapar mediante una prueba de Presa o Escapismo;
2. retirar atómicamente el vínculo `srd_grappling` cuando el intento vence;
3. restringir los ataques físicos durante la Presa a armas ligeras o ataques naturales;
4. aplicar y explicar el penalizador circunstancial melee de `-4` desde el Rule Engine;
5. ofrecer en React el mismo preview compartido que usa el servidor.

El cliente declara intención, tipo de escape y, opcionalmente, su d20 manual. Nunca declara oponente, modificadores, rangos efectivos, resultado, instancia a eliminar ni penalizador de ataque.

## Hallazgos del repositorio

### Relación de Presa y oposición

Sprint 029 dejó una única `EffectInstance` `srd_grappling` con ambos participantes en `targets`. `resolveOpposedCheck` es el oráculo común de total, desempate por modificador y repetición del empate exacto. El servidor ya dispone de un bucle autoritativo que tira por el defensor y resuelve rerolls sin persistir estados intermedios.

La acción de Escape no necesita un segundo modelo relacional: debe localizar la instancia existente, validar que contiene exactamente dos participantes y usar su otro target como retenedor. Una relación ausente o malformada falla cerrada; nunca se adivina el captor.

### Inventario V5 y clasificación de armas

`CombatantSnapshot` conserva `inventory` y `equipmentSlots`; `mainHandItemId` referencia una instancia y `EquipmentCatalog` resuelve su definición. La clasificación canónica existente se llama `WeaponEntry.handedness`, cuyos valores incluyen `light`, `one-handed`, `two-handed` y `ranged`. No existe `handCategory` y añadirlo como espejo crearía dos fuentes de verdad.

Para Sprint 030, “categoría de mano ligera” se interpreta mediante `handedness === "light"`. Un ataque natural procede de `NaturalAttackCatalog` cuando el combatiente tiene `naturalAttackId` y no está usando un arma catalogada en mano principal. El helper devolverá una categoría normalizada efímera (`light_weapon` o `natural`) sin persistirla.

El comando ordinario de ataque no permite elegir una instancia concreta del inventario. Por ello V2 valida la fuente que el resolver actual selecciona: mano principal si existe; en su ausencia, ataque natural. Elegir una daga guardada sin equiparla queda fuera de alcance, pero reutilizará el mismo validador cuando exista selección explícita de fuente.

### Ausencia de rangos de habilidades

El modelo actual no posee rangos de habilidades. Guardar únicamente `escapeArtistRanks` en el snapshot o asumir cero al vuelo violaría el modelado source-first. Sprint 030 debe introducir una fuente mínima pero extensible:

```text
SkillId = "escape_artist"
SkillRanks = Record<SkillId, nonNegativeInteger>
```

`skillRanks` será obligatorio en `CreatureTemplate`, `StoredProfile` y `CombatantSnapshot`. El snapshot copiará la fuente de forma inmutable. StoredProfile subirá de V5 a V6; la migración V5→V6 asentará explícitamente `escape_artist: 0`, con backup e idempotencia. Este cero no estima una estadística derivada: representa la ausencia histórica inequívoca de rangos comprados en una habilidad que antes no existía en el modelo.

## Modelo de reglas compartidas

### Localización del vínculo

Una función pura `getGrappleLink(snapshot, combatantId)` devolverá un `RuleResult` con:

- `effectInstanceId`;
- `participantIds` en su orden estable;
- `opponentId`, derivado como el único target distinto del actor.

Invariantes:

- debe existir exactamente una instancia `srd_grappling` que incluya al actor;
- la instancia debe tener exactamente dos targets distintos y existentes;
- ambos targets deben conservar el trait `GRAPPLING` proyectado por esa instancia;
- múltiples vínculos o targets faltantes producen error explícito.

El servidor usa `effectInstanceId` solo durante el commit. No se añade `grappledWithId` a perfiles, snapshots o comandos.

### Preview del intento de escape

`getGrappleEscapePreview(snapshot, combatant, escapeType)` compondrá el vínculo y proyectará:

```text
grapple_check:
  BAB + modificador de Fuerza efectiva + grappleModifier por tamaño

escape_artist:
  modificador de Destreza efectiva + skillRanks.escape_artist

retenedor:
  BAB + modificador de Fuerza efectiva + grappleModifier por tamaño
```

El resultado incluirá componentes y totales por lado, acción requerida, identidad del retenedor y razones de invalidez. Fuerza y Destreza se obtienen mediante `getEffectiveAbilityModifier`; tamaño se obtiene exclusivamente mediante `getSpecialManeuverSizeModifier`.

Sprint 030 sigue literalmente la fórmula aprobada para Escapismo. Penalizador de armadura, sinergias y bonificadores de competencia quedan fuera de alcance hasta que exista un pipeline general de habilidades.

### Resolución del escape

`resolveGrappleEscapeCheck(preview, escapeRoll, defenderRoll)` alimentará `resolveOpposedCheck` sin mutar la sala. La política sigue siendo única:

- total mayor gana;
- empate de total favorece al modificador mayor;
- empate también de modificadores requiere nuevas tiradas autoritativas.

El servidor genera siempre la tirada del retenedor. En AUTO genera también la del escapista. Si una tirada manual desemboca en empate exacto, los rerolls posteriores son generados por el servidor, igual que en las maniobras existentes.

### Fuente de ataque permitida durante la Presa

Una función pura `getGrappleAttackEligibility(snapshot, attacker)` será la única frontera para servidor y React. Devolverá:

- si el atacante está en Presa;
- fuente resuelta, nombre e identidad catalogada;
- categoría efímera `light_weapon | natural | prohibited`;
- `allowed` y razón estructurada;
- penalizador contextual esperado y etiqueta.

Reglas V2:

- fuera de Presa: no añade restricciones;
- en Presa con arma de mano principal `handedness === "light"`: permitido;
- en Presa sin arma principal y con `naturalAttackId` válido: permitido;
- arma one-handed, two-handed, ranged, ammunition o fuente no resoluble: rechazada;
- el cliente no puede declarar que un arma pesada es ligera ni sustituir el catálogo.

La función aceptará internamente un descriptor de fuente resuelta, no un booleano “es ligera”. Esto deja preparado el uso futuro de una instancia seleccionada —por ejemplo una daga oculta— sin duplicar el validador.

### Penalizador declarativo y procedencia

`srd_grappling` incorporará un `conditionalModifier` de `ATTACK -4` para `attack_type: melee`, con grupo circunstancial y etiqueta `forcejeo en presa -4`. La restricción de fuente se valida antes del ataque; el modificador se proyecta después por `Rules.totalAttackBonus`.

Para conservar procedencia, `ConditionalModifier` incorporará una etiqueta declarativa y `evaluateConditionalModifiers` devolverá total más partes, en vez de un número opaco. Los modificadores actuales de Prone y Squeezing recibirán sus etiquetas explícitas. No se codificará un `if (GRAPPLING) -4` dentro de `attackResolver.ts`.

Este diseño implica que cualquier ataque melee permitido durante la Presa recibe el penalizador. Los checks de Escape no llaman a `totalAttackBonus`, por lo que no se penalizan accidentalmente.

## Contrato WebSocket

Se añadirá el comando estricto:

```text
{
  type: "resolve-grapple-escape",
  roomCode,
  actorId,
  combatantId,
  escapeType: "grapple_check" | "escape_artist",
  d20Roll: number | null,
  isAutoRoll?: boolean
}
```

Zod rechazará campos adicionales. No se aceptan `opponentId`, `effectInstanceId`, BAB, Fuerza, Destreza, tamaño, rangos, tirada defensora, resultado o targets.

No se agrega `ServerMessage`: el broadcast normal de la sala refleja consumo de acción, log y retirada del efecto.

## Secuencia transaccional del servidor

### Preflight

Antes de mutar:

- fase activa, ownership y control del turno;
- disponibilidad de acción y acción estándar no consumida;
- actor en estado vital apto;
- vínculo único y binario válido;
- retenedor existente y apto;
- `escapeType` y d20 manual válidos;
- fuentes de rangos y características completas.

### Resolve

1. crear snapshot de la sala;
2. obtener preview puro del tipo de escape;
3. resolver la oposición con la primitiva común y dados defensores autoritativos;
4. resolver rerolls exactos sin tocar la sala.

### Commit

Sobre un draft transaccional:

- consumir la acción estándar para todo intento válidamente resuelto;
- si vence el escapista, remover exactamente `effectInstanceId` mediante `EffectManager.remove`;
- si pierde, conservar la misma instancia sin reescribirla;
- aplicar esfuerzo Disabled, estadísticas/logs, outcome y sincronización de fase;
- hacer un único broadcast tras commit.

No se persisten “escape pendiente”, roll del defensor o resultado parcial. Un error de preflight deja sala, acción y efecto intactos.

## Integración del ataque físico

`handleResolveAttackDraft` consultará `getGrappleAttackEligibility` inmediatamente después del snapshot y antes de tirar dados, consumir munición, abrir AdO, gastar acción o mutar estadísticas. Un resultado prohibido aborta con mensaje explícito.

Si la fuente es válida:

- el ataque debe ser melee;
- `Rules.totalAttackBonus` recoge `forcejeo en presa -4` desde el efecto;
- el resolvedor ordinario conserva críticos, daño, ataque furtivo y logs;
- la parte etiquetada aparece en preview y resolución.

No se crea un segundo resolver “attack while grappling”. La Presa filtra la fuente y alimenta contexto al pipeline existente.

## UI isomorfa

ActionsPanel consumirá exclusivamente helpers shared:

- si el seleccionado está en Presa, mostrará “Escapar de la Presa” y selector Presa/Escapismo;
- el preview mostrará fórmula propia, fórmula del retenedor y acción estándar;
- el botón de ataque se deshabilitará y marcará en rojo cuando `getGrappleAttackEligibility` sea inválido;
- un ataque válido mostrará `forcejeo en presa -4`;
- el cliente enviará solo el tipo de escape y el d20 manual/AUTO.

React no inspeccionará `handedness`, `mainHandItemId` ni `naturalAttackId` con condicionales de reglas. Puede presentar los campos del resultado compartido, pero no derivarlos.

## Persistencia y migración V6

La incorporación de rangos afecta a fuentes permanentes:

- `CreatureTemplate`, criaturas catalogadas y editor de perfiles declaran `skillRanks`;
- `CombatantSnapshot` copia `skillRanks` y sus guards verifican enteros no negativos;
- Zod exige el registro cerrado de habilidades soportadas;
- `profileStorage.ts` eleva key/envelope a V6, conserva backup pre-V6 y migra V5 a rangos cero;
- lecturas V6 son estrictas e idempotentes;
- no se guardan modificadores efectivos de habilidad.

No se eleva la versión del estado WebSocket: el snapshot de sala ya se transmite como estado canónico y el cambio se valida en compile-time y E2E.

## Matriz de reutilización

| Capa | Reutilización / ampliación |
|---|---|
| ActiveEffects | misma instancia `srd_grappling`; nuevo modificador condicional etiquetado |
| Pure helpers | `getEffectiveAbilityModifier`, `getSpecialManeuverSizeModifier`, `resolveOpposedCheck`, EquipmentCatalog |
| Resolución | bucle autoritativo de oposición y transacción de sala existentes |
| Inventario | instancias V5 y `mainHandItemId`; sin ID de arma enviado por red |
| Persistencia | patrón de schema, backup, migración y cuarentena; nueva V6 source-first |
| React | previews shared para escape y elegibilidad de ataque |

## Matriz de impacto de subsistemas

- [x] **Rule Engine:** vínculo, preview de escape, elegibilidad de fuente y breakdown contextual etiquetado.
- [x] **CombatRoom / State Schema:** no añade estado de escape; `skillRanks` entra en cada combatiente como fuente.
- [x] **CombatSnapshot:** fuente inmutable `skillRanks`; sin resultados derivados.
- [x] **EquipmentCatalog:** reutiliza `handedness`; no crea `handCategory` redundante.
- [x] **Ownership:** mismo control de combatiente y turno.
- [x] **WebSocket:** nuevo comando estricto `resolve-grapple-escape`.
- [x] **UI:** acción de Escape, previews y bloqueo rojo de fuente inválida.
- [x] **Persistencia:** StoredProfile V6 y migración V5→V6.
- [x] **Tests:** unitarios, schema, handler, regresión de ataques, E2E y Playwright.

## Design Review Checklist

### 1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería acoplar “ataque permitido en Presa” al botón actual, a `mainHandItemId` o a un segundo booleano de catálogo. El diseño centraliza la decisión en un selector que recibe una fuente resuelta y consulta su clasificación catalogada. Hoy la fuente procede de la ranura V5; mañana una dote como Presa Defensiva puede aportar ajustes declarativos y una daga oculta puede suministrar otra instancia de inventario al mismo selector, sin copiar validadores ni cambiar `resolveAttack`.

No se agrega `handCategory`, porque `handedness` ya es la fuente canónica. La proyección normalizada es efímera. Tampoco se modela Escapismo como un escalar aislado: `SkillRanks` abre una frontera estable para más habilidades sin persistir totales derivados.

### 2. Complejidad accidental

React no debe decidir si un arco o espadón es válido. `getGrappleAttackEligibility(snapshot, combatant)` produce el mismo `RuleResult` usado por el preflight del servidor. ActionsPanel solo pinta el resultado: permitido, fuente, penalizador y razón; si es inválido, deshabilita el ataque y aplica la presentación roja. Cualquier cambio de catálogo, efecto o dote se refleja en ambas capas sin un `if` paralelo en TSX.

La complejidad heredada adicional es que los modificadores condicionales pierden su procedencia y aparecen como “condicional”. Se corrige en el Core con breakdown etiquetado, en lugar de concatenar manualmente `forcejeo en presa -4` en servidor y UI.

### 3. Regla de tres

1. **Inmovilizar / Pin:** reutiliza vínculo, acción estándar y check opuesto, cambiando únicamente la transición de efecto.
2. **Infligir daño de Presa con Fuerza:** reutiliza membresía, preview de modificador y transacción, sin arma ordinaria.
3. **Usar o extraer objetos ligeros:** reutiliza la clasificación de fuentes/instancias V5 y la disponibilidad de acciones durante Presa.

También quedan preparados Improved Grapple, Presa Defensiva, dagas ocultas seleccionables y futuras pruebas de habilidades mediante `SkillRanks`.

## Alternativas descartadas

### `escapeArtistRanks` aislado u opcional

Sería un campo ad hoc y forzaría `?? 0` silencioso. Se reemplaza por una fuente formal de rangos y migración V6.

### Añadir `handCategory` al catálogo

Duplicaría `handedness` y permitiría contradicciones como `handedness: two-handed` junto a `handCategory: light`.

### Validar armas dentro de `attackCommands.ts` y repetir en React

Generaría dos oráculos. Se usa un helper puro compartido antes de cualquier mutación.

### Nuevo resolver de ataque durante Presa

Duplicaría críticos, daño, precisión, munición y logs. El pipeline ordinario se conserva y recibe restricciones/modificadores declarativos.

### Remover todas las instancias `srd_grappling` del actor

Ocultaría corrupción relacional y podría romper otras relaciones. El preflight exige una instancia única y el commit elimina exclusivamente su ID.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| cliente elige captor o modificadores | servidor deriva vínculo y ambos perfiles desde snapshot |
| media mutación al escapar | draft transaccional y un solo `EffectManager.remove` |
| arma pesada ataca antes del guard | preflight antes de dados, acción, munición y AdO |
| clasificación de arma duplicada | `handedness` como SSOT y categoría efímera |
| natural confundido con inventario | descriptor de fuente discriminado y catálogos separados |
| UI diverge del servidor | mismo helper shared y test UI |
| perfiles previos carecen de rangos | migración V5→V6 explícita, backup e idempotencia |
| modificador -4 pierde explicación | partes etiquetadas desde `ConditionalModifier` |
| relación de Presa corrupta | validación binaria fail-closed antes de resolver |

## Qué no resuelve Sprint 030

- Pin, constrict o daño directo de Presa;
- incorporación de terceros o relaciones multiparticipante;
- arrastrar al oponente o compartir/reconciliar posición;
- seleccionar una segunda arma o daga guardada desde el comando de ataque;
- sacar objetos de mochila durante Presa;
- Improved Grapple, Presa Defensiva o Freedom of Movement como contenido catalogado;
- penalizador de armadura, sinergias, take 10/20 o pipeline general de checks de habilidad;
- ataques naturales secundarios o rutinas multiataque dentro de Presa;
- escapar mediante magia, teleportación o intervención de terceros.

## Estrategia de pruebas proyectada

1. localizar vínculo único y rechazar relaciones ausentes, múltiples o malformadas;
2. `grapple_check` usa BAB + Fuerza efectiva + tamaño;
3. `escape_artist` usa Destreza efectiva + rangos explícitos;
4. retenedor usa siempre BAB + Fuerza efectiva + tamaño;
5. empate conserva la política única y rerolls autoritativos;
6. victoria elimina exactamente una instancia dual y restaura movimiento;
7. derrota conserva vínculo y consume acción estándar;
8. error de preflight no consume acción ni toca efecto;
9. arma ligera y ataque natural son válidos; longsword, greatsword y longbow son rechazados;
10. ataque válido recibe exactamente `forcejeo en presa -4` una vez;
11. schema rechaza oponente, instancia, tirada defensora, stats y campos extra;
12. migración V5→V6 inserta rangos cero, conserva backup y es idempotente;
13. E2E verifica escape ganado/perdido y bloqueo de arma pesada;
14. Playwright verifica preview de escape y botón rojo/deshabilitado.

## Criterios de aceptación del diseño

- el vínculo existente es la única fuente de identidad del retenedor;
- ambos tipos de escape reutilizan `resolveOpposedCheck`;
- todos los modificadores son derivados por el servidor;
- rangos de Escapismo son una fuente persistida y validada, no un fallback;
- `handedness` sigue siendo la única clasificación de mano del catálogo;
- servidor y React consumen la misma elegibilidad de ataque;
- el `-4` se origina en `srd_grappling` y conserva su etiqueta;
- no existe estado intermedio persistente;
- no se modifica código ejecutable antes de `Proceed`.
