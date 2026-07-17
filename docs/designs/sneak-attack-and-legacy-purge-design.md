# NDD Sprint 012: Ataque Furtivo y Purga Total del Modelo Legacy

## Estado

- Fase: 6 — implementación y validación completadas.
- Implementación: aprobada mediante `Proceed` y cerrada con 225/225 tests, typecheck, build y 80/80 verificaciones WebSocket.
- Baseline: Sprint 011 cerrado con 221/221 pruebas, 80/80 verificaciones WebSocket y 2/2 escenarios Playwright.
- Invariantes: servidor autoritativo, perfiles basados en fuentes, catálogos como verdad y reglas puras fuera de React.

## 1. Objetivo

Sprint 012 tiene dos objetivos inseparables:

1. eliminar los últimos escalares derivados que todavía pueden quedar obsoletos o ser falsificados (`armorClass`, `attackModifier`, `damageBase` y, por la misma política, `speedFeet`); y
2. introducir Ataque Furtivo como el primer consumidor de un pipeline general de contribuciones de daño, capaz de distinguir daño base, daño de precisión y su comportamiento ante críticos.

No se añadirá un `if (sneakAttack)` dentro del resolvedor matemático. Las reglas compartidas decidirán elegibilidad; el servidor construirá contribuciones desde fuentes catalogadas; la resolución solo combinará componentes tipados.

## 2. Diagnóstico del repositorio

### 2.1. Lo que Sprint 010 ya dejó correctamente migrado

- `CreatureTemplate` y `StoredProfile` no declaran CA, ataque ni daño precalculados.
- `creatures.json` contiene características, BAB, tamaño, equipo, defensa intrínseca y anatomía explícita.
- el schema Zod actual es estricto y rechaza claves derivadas en perfiles V2;
- `Rules.totalArmorClass` exige `armorClassBreakdown` y ya no retorna una CA plana como fallback.

### 2.2. Deuda latente encontrada

| Área | Estado actual | Problema |
| --- | --- | --- |
| `CombatantSnapshot` | conserva `armorClass`, `attackModifier`, `damageBase` y `speedFeet` | son caches escalares que pueden divergir de sus fuentes y permiten fixtures no conformes |
| `EquipmentDerivedStats` | vuelve a producir esos cuatro escalares | mantiene una segunda representación de la misma regla |
| `Rules.totalAttackBonus` | si no recibe característica usa `combatant.attackModifier` | fallback prescriptivo y ambiguo |
| `Rules.totalSpeedFeet` | parte de `combatant.speedFeet` | conserva otro derivado estático fuera de las fuentes |
| resolver/UI | consumen `damageBase` como valor por defecto | el daño del arma puede quedar desincronizado del catálogo |
| tests | numerosos objetos literales construyen `Combatant` con resultados precalculados | las pruebas pueden validar estados imposibles en producción |
| `profileStorage.ts` | todavía interpreta V0/V1 y puede leer `armorClassBreakdown` legacy para reconstruir defensa | contradice la política de erradicación, aunque su salida sea V2 |
| `.ai/DO_NOT_BREAK.md` | aún ordena preservar CA/daño manual de monstruos | invariante obsoleta y contraria a Sprint 010/012 |
| `AttackResult` / `AttackThreatState` | usan `attackModifier` para un total calculado de la tirada | no es una fuente legacy, pero el nombre impide una auditoría inequívoca |
| daño crítico | guarda un único `normalDamage` y puede multiplicarlo completo | incorporaría incorrectamente dados de precisión al multiplicador crítico |

La purga no se considerará terminada si solo se limpian plantillas. Deben desaparecer los caches escalares del contrato de snapshot, sus consumidores y todos los fixtures de dominio.

## 3. Política de erradicación

### 3.1. Clasificación de datos

El modelo distinguirá tres categorías:

- **Fuentes persistibles:** características, BAB, velocidad base, tamaño, IDs de equipo, defensa intrínseca, tipo de criatura, IDs de rasgos de clase/dotes y anatomía.
- **Capacidades estructuradas derivadas:** `armorClassBreakdown`, `ThreatProfile`, traits de reglas y `sneakAttackDice`. Pueden asentarse en el snapshot porque conservan procedencia y semántica por componentes.
- **Resultados efímeros:** total de CA proyectada, total de ataque y daño resuelto. Solo existen como retorno de reglas/resolvers o como estado pendiente de una confirmación crítica; nunca como estadística del combatiente.

### 3.2. Contrato de snapshot fuente-first

`CombatantSnapshot` conservará las fuentes necesarias para que el servidor pueda revalidarlo:

```ts
interface CombatantRulesSources {
  baseAttackBonus: number;
  baseSpeedFeet: number;
  abilityScores: AbilityScores;
  sizeCategory: SizeCategory;
  equipment: CreatureEquipmentLoadout;
  intrinsicDefense: IntrinsicDefense;
  naturalAttackId?: string;
  creatureTypeId: CreatureTypeId;
  featureIds: CombatFeatureId[];
  featIds: FeatId[];
}
```

El snapshot no expondrá `armorClass`, `attackModifier`, `damageBase` ni `speedFeet`. También dejará de necesitar una copia de arma como fuente de verdad: un selector compartido resolverá el arma desde los IDs del snapshot y `EquipmentCatalog`/`NaturalAttackCatalog`.

Se conservarán y validarán:

```ts
armorClassBreakdown: ArmorClassBreakdown;
threatProfile: ThreatProfile;
sneakAttackDice: number;
ruleTraits: RuleTrait[];
```

### 3.3. Aserción fuerte de integridad

`assertCombatantSnapshotIntegrity(combatant)` se ejecutará siempre, no solo en desarrollo, al agregar un combatiente y al crear `CombatRulesSnapshot`:

1. valida todas las fuentes y referencias de catálogo;
2. vuelve a derivar breakdown, amenaza, rasgos, feature profile y velocidad base modificada por equipo;
3. compara estructuralmente los derivados asentados;
4. falla si falta un componente, hay un valor no finito, un ID desconocido o existe divergencia;
5. nunca corrige ni rellena silenciosamente el snapshot.

Ataque, daño y velocidad no requieren comparación de caches porque dejarán de persistirse: se calcularán en el punto de uso.

### 3.4. Persistencia: versión nueva, no mutación silenciosa de V2

Agregar `creatureTypeId` y `featureIds` obligatorios cambia el significado del perfil. Reutilizar el número de versión 2 sería una mutación incompatible del schema. El diseño propone un envelope V3, aunque los fixtures sigan el principio “V2 source-only” solicitado:

- V3 acepta exclusivamente fuentes explícitas y catálogos conocidos;
- V0/V1 dejan de migrarse y solo producen backup + issue de cuarentena;
- V2 puede migrar a V3 únicamente si ya contiene información inequívoca para tipo y features;
- no se inferirá que una criatura es humanoide por ser `player`, ni que carece de Ataque Furtivo porque un campo no exista;
- perfiles que requieran una decisión humana quedan en cuarentena/remediación visible.

Esta subida de versión es una consecuencia deliberada de “sin estimaciones”. El Lead Architect puede rechazar V3, pero entonces deberá autorizar explícitamente una inferencia para los nuevos campos; este NDD no recomienda hacerlo.

### 3.5. Tests y mocks

Los tests utilizarán un único builder de fuentes, por ejemplo `createTestProfileSources`, y siempre pasarán por `createCombatantSnapshotFromProfile`. Para expresar una CA concreta se declararán Destreza, tamaño, armadura y defensa intrínseca; para expresar ataque/daño se declararán BAB, característica y arma catalogada.

Solo los tests de frontera Zod pueden contener claves prohibidas, como objetos `unknown` destinados a comprobar su rechazo. Esos objetos no serán tipados ni reutilizados como combatientes.

Una auditoría automatizada bloqueará propiedades exactas prohibidas en contratos, datos y fixtures. Nombres de resultados inequívocos como `targetArmorClass` son válidos; `AttackResult.attackModifier` se renombrará `attackBonusTotal` para evitar falsos positivos y ambigüedad.

## 4. Modelado declarativo de tipo y rasgos

### 4.1. CreatureTypeCatalog

Se introducirá un catálogo mínimo de tipos de criatura:

```ts
type RuleTrait =
  | "IMMUNE_TO_CRITICAL_HITS"
  | "IMMUNE_TO_PRECISION_DAMAGE"
  | /* traits de estado existentes */;

interface CreatureTypeDefinition {
  id: CreatureTypeId;
  name: string;
  traits: readonly RuleTrait[];
}
```

Entradas mínimas: `humanoid`, `magical_beast`, `construct` y `undead`. Constructos y muertos vivientes aportarán declarativamente ambos traits de inmunidad. `canApplySneakAttack` comprobará `IMMUNE_TO_PRECISION_DAMAGE`, nunca IDs como `construct` o `undead`.

Los traits raciales y los provenientes de ActiveEffects compartirán el vocabulario `RuleTrait`. Un helper `hasRuleTrait(room, combatant, trait)` consolidará ambos orígenes sin obligar al EffectReducer a conocer tipos de criatura.

### 4.2. CombatFeatureCatalog

Ataque Furtivo es una feature de clase, no una estadística editable ni una dote. El perfil guardará `featureIds` y un catálogo declarará progresiones como `srd_sneak_attack_1d6`, `srd_sneak_attack_2d6`, etc. La derivación producirá el número solicitado en el snapshot:

```ts
sneakAttackDice: number;
```

No se persistirá el número de dados como verdad. El catálogo podrá declarar políticas de combinación para multiclass/prestige classes sin condicionales en el snapshot initializer.

Bane será el candidato demo para recibir una feature explícita; el resto de plantillas declarará `featureIds: []`. Las dotes futuras permanecerán en `featIds` y no se mezclarán semánticamente con features de clase.

## 5. Elegibilidad de Ataque Furtivo

### 5.1. Contexto de entrega

El snapshot de sala no conoce qué arma o aptitud está siendo usada en el comando actual. Inferir siempre desde el arma principal rompería rayos, conjuros de toque y armas con modos múltiples. Por ello se define:

```ts
interface AttackDeliveryContext {
  attackType: "melee" | "ranged";
  distanceFeet: number;
  sourceId: string;
  requiresAttackRoll: boolean;
  dealsDamage: boolean;
}
```

`canApplySneakAttack` será puro y tendrá un overload de tres argumentos para el ataque de arma equipado, además de la variante autoritativa usada por todos los handlers:

```ts
canApplySneakAttack(room, attacker, target): boolean;
canApplySneakAttack(room, attacker, target, delivery): boolean;
```

La resolución del servidor siempre pasará `delivery` construido desde `ResolvedAttackSource`; el overload corto no se usará para aptitudes. Esto conserva la firma pedida sin introducir una suposición irreversible sobre la fuente del ataque.

### 5.2. Predicados

El resultado será verdadero si y solo si:

1. `attacker.sneakAttackDice > 0`;
2. la acción requiere tirada de ataque y causa daño;
3. `attackType === "melee"`, o `attackType === "ranged"` y `distanceFeet <= 30`;
4. `isFlanking(room, attacker, target)` es verdadero, o el defensor posee el trait activo `NO_DEX_TO_AC`;
5. el defensor no posee `IMMUNE_TO_PRECISION_DAMAGE`;
6. atacante y objetivo son combatientes distintos y hostiles según las reglas existentes.

La pérdida de Destreza se detecta por trait, no comparando dos CA ni buscando específicamente `srd_flat_footed`. Una criatura con Destreza 8 sigue calificando como privada de su bono aunque la proyección numérica no disminuya.

Se expondrá además `evaluateSneakAttack(...)` con resultado trazable (`eligible`, `reasonCodes`, `diceExpression`) y `canApplySneakAttack` será su wrapper booleano. Esto permite preview y logs sin duplicar predicados.

## 6. Pipeline genérico de daño

### 6.1. Por qué el escalar actual no alcanza

El daño actual es un único número. Si se suma Ataque Furtivo antes de una confirmación crítica y luego se multiplica `normalDamage`, los dados de precisión se multiplican incorrectamente. Además, un solo número no puede representar energía, reducción, inmunidades parciales ni trazabilidad.

### 6.2. Contribuciones tipadas

```ts
interface DamageContributionSpec {
  sourceId: string;
  label: string;
  category: "base" | "precision" | "energy" | "conditional";
  diceExpression?: string;
  flatBonus?: number;
  damageType?: string;
  criticalPolicy: "multiply" | "never_multiply";
}

interface ResolvedDamageContribution extends DamageContributionSpec {
  rolledAmount: number;
}

interface DamageBundle {
  components: readonly ResolvedDamageContribution[];
  total: number;
}
```

Ataque Furtivo producirá una contribución `precision`, expresión `Nd6` y `criticalPolicy: "never_multiply"`. `resolveAttack` no buscará el ID `sneak_attack`; solo consumirá un bundle genérico.

### 6.3. Resolución por etapas

Para no tirar daño en un fallo ni introducir RNG dentro de una función pura:

```text
1. resolveAttackCheck(...)        → impacto, amenaza crítica, total y trazas
2. getDamageContributionSpecs(...)→ base + precisión/energía/condicionales elegibles
3. serverDiceRoller               → resuelve expresiones autorizadas por servidor
4. resolveDamageBundle(...)       → composición pura de componentes
5. applyAttackMutations(...)      → HP, stats, estados y logs
```

El valor `damage` que ya envía el cliente seguirá representando exclusivamente el componente base manual. El cliente no enviará `sneakAttackDice`, elegibilidad, expresión ni resultado de precisión. Cuando se use daño automático, los dados adicionales serán tirados por el servidor mediante un `DiceRoller` inyectable; los tests usarán una implementación determinista.

La UI mostrará `Ataque Furtivo potencial: +Nd6`, pero no decidirá si se aplica ni enviará flags mecánicos.

### 6.4. Críticos

`AttackThreatState.normalDamage` será reemplazado por componentes pendientes. Al confirmar:

- solo componentes `criticalPolicy: "multiply"` siguen la política crítica del arma;
- Ataque Furtivo se agrega exactamente una vez;
- cancelar la amenaza aplica el mismo bundle normal ya resuelto;
- el log separa, por ejemplo, `arma 1d4+2 = 5; Ataque Furtivo 2d6 = 7; total 12`.

El parámetro runtime `attackModifier` se renombrará `attackBonusTotal`; no se confunde así con la antigua estadística plana.

## 7. Servidor autoritativo y entry points

Un helper de orquestación construirá `AttackDeliveryContext` y las contribuciones para:

- ataque estándar/completo e iterativos;
- ataque de oportunidad;
- carga;
- Shocking Grasp y otros ataques de toque melee;
- Ray of Frost y otros rayos, respetando 30 ft.

Magic Missile no califica porque no requiere tirada de ataque. Ningún handler aceptará `isSneakAttack`, `sneakAttackDice`, `precisionDamage` o inmunidades desde la red.

`attackResolver.ts` seguirá sin importar geometría, catálogos raciales ni lógica de clase. Su única relación con esta feature será recibir y devolver estructuras genéricas de daño.

## 8. WebSocket y UI

### WebSocket

- Los comandos de ataque conservan el campo manual `damage`, documentado como daño base.
- No se agregan flags de Ataque Furtivo.
- `CombatRoom.activeAttackThreat` cambia internamente de escalar a bundle tipado; al viajar en `room-update` es un cambio aditivo/estructural que requiere actualizar tipos y E2E.
- Los schemas estrictos incorporarán tests que rechacen campos mecánicos inyectados.

### UI

- `ActionsPanel` usa `evaluateSneakAttack` con el delivery de la fuente seleccionada para preview.
- La ficha deriva CA, ataque, velocidad y daño sugerido mediante selectores compartidos; no lee caches escalares.
- El log muestra expresión, resultado y total de cada componente.
- La UI no tira ni envía los dados de precisión.

## 9. Design Review Checklist

### 9.1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería agregar `sneakAttackDamage` como otro número especial dentro de `AttackResult` o multiplicar un total indistinguible durante críticos. El diseño evita esa trampa mediante `DamageContributionSpec` y `DamageBundle`:

- dados y bonos planos comparten el mismo contrato;
- cada componente declara categoría, tipo de daño y política crítica;
- las condiciones se evalúan antes del resolver;
- el resolver no conoce nombres de dotes/clases;
- inmunidades pueden filtrar categorías sin inspeccionar la fuente concreta.

Así, **Craven/Golpe Sentido** agrega un componente plano de precisión, **Ranged Precision** aporta dados con otra política de alcance y **Skirmish** aporta dados condicionados al movimiento, sin alterar la matemática central.

La segunda decisión irreversible es el schema persistente. Por eso no se reinterpreta V2 en silencio: los nuevos campos semánticos exigen V3 o remediación explícita.

### 9.2. Complejidad accidental

La purga elimina cuatro representaciones duplicadas y simplifica el Rule Engine:

- ataque siempre es `BAB + modificador de característica de la fuente + tamaño + efectos`; desaparece el fallback a `combatant.attackModifier`;
- CA siempre nace de `armorClassBreakdown` y su proyección contextual; no existe `combatant.armorClass` para contradecirla;
- daño base siempre se resuelve desde el arma/aptitud catalogada y la característica; desaparece `combatant.damageBase`;
- velocidad parte de `baseSpeedFeet` y la armadura catalogada; desaparece `combatant.speedFeet`;
- tests dejan de fabricar combinaciones imposibles entre escalares y fuentes.

Los bonus temporales de `Buff` no son estadísticas estáticas y permanecen dentro del alcance funcional actual; migrarlos por completo a ActiveEffects será un sprint independiente. Se renombrarán variables internas que hoy dicen `legacyBuffBonus` para no confundir esta deuda diferente con los caches purgados.

### 9.3. Matriz de reutilización

- **ActiveEffects:** reutiliza `NO_DEX_TO_AC`; el vocabulario común de `RuleTrait` permitirá inmunidades temporales futuras.
- **Pure Helpers:** reutiliza `isFlanking`, distancia, AttackContext, EffectReducer y selectores de equipo/tamaño.
- **Resolvers:** reciben contribuciones genéricas; no calculan flanqueo, Flat-Footed, clase ni tipo racial.

### 9.4. Regla de Tres

1. **Skirmish/Escaramuza:** crea precisión adicional condicionada a distancia movida sin cambiar el resolver.
2. **Ranged Precision/Precisión a Distancia:** reutiliza delivery, límites de alcance y contribuciones `never_multiply`.
3. **Craven/Golpe Sentido o Sniper's Eye:** agrega bono plano o modifica restricciones mediante datos/effects, sin un campo especial nuevo.

El mismo bundle habilita después daño energético crítico mediante `criticalPolicy`, y Coup de Grace puede consumirlo al forzar un crítico antes de la salvación.

### 9.5. Matriz de impacto

| Subsistema | Impacto Sprint 012 |
| --- | --- |
| Rule Engine | elimina fallback de ataque, deriva velocidad/daño y agrega evaluación pura de vulnerabilidad/precisión |
| CombatRoom / Snapshot | elimina caches escalares; agrega fuentes explícitas, `sneakAttackDice`, `ruleTraits` y bundle crítico |
| EquipmentCatalog | continúa como verdad para arma, daño, armadura y velocidad; selectores reemplazan copias estáticas |
| Creature/Feature catalogs | nuevos catálogos mínimos para tipo racial, inmunidades y progresión de Ataque Furtivo |
| ActiveEffects | comparte `RuleTrait` y reutiliza `NO_DEX_TO_AC`; sin efectos persistidos de flanqueo/furtivo |
| Ownership | sin cambios |
| WebSocket | sin flags cliente; cambia el estado de amenaza crítica serializado y se refuerzan schemas estrictos |
| UI | preview de elegibilidad/`Nd6`, selectores derivados y log por componentes |
| Tests | migración completa de fixtures, reglas de precisión, crítico no multiplicable, schemas, E2E y Playwright |

### 9.6. Qué no resuelve este sprint

- concealment/ocultación, aunque en D&D 3.5 puede impedir Ataque Furtivo;
- inmunidades por fortificación de armaduras;
- uncanny dodge e improved uncanny dodge;
- flanqueo multi-celda Large/Huge;
- reducción de daño, resistencias y vulnerabilidades elementales;
- selección entre múltiples armas/ataques naturales en un mismo comando;
- progresión completa de clases y niveles;
- Skirmish, Craven, Ranged Precision, Sniper's Eye y Coup de Grace propiamente dichos;
- migración total de Buffs legacy a ActiveEffects.

Estas exclusiones no tendrán fallbacks. La ausencia de la mecánica produce comportamiento explícitamente no implementado, no una estimación.

## 10. Alternativas rechazadas

### A. Añadir `sneakAttackDamage` a `AttackResult`

Rechazada: crea un campo especial por feature y no resuelve críticos ni futuras contribuciones.

### B. Sumar precisión al `damage` enviado por React

Rechazada: permite manipulación cliente, pierde trazabilidad y hace imposible aplicar inmunidades autoritativas.

### C. Detectar construct/undead por nombre o `type === "enemy"`

Rechazada: acoplamiento incorrecto; la inmunidad procede de traits catalogados.

### D. Inferir siempre la entrega desde el arma principal

Rechazada: falla con Ray of Frost, Shocking Grasp, armas arrojadizas y futuras fuentes múltiples.

### E. Mantener escalares derivados “solo para UI”

Rechazada: cualquier segundo valor termina divergiendo. React debe usar selectores compartidos.

### F. Cambiar el schema V2 sin subir versión

Rechazada: hace que dos estructuras incompatibles declaren la misma versión y obliga a defaults silenciosos.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Migración masiva de fixtures oculta regresiones | builder único basado en fuentes y migración suite por suite sin borrar tests |
| Perfiles V2 carecen de tipo/feature explícitos | V3 + cuarentena/remediación; no inferir |
| Ataque Furtivo se multiplica en crítico | bundles con política por componente y tests de confirmación/cancelación |
| Ray o daga usa la modalidad equivocada | delivery explícito desde la fuente autoritativa del handler |
| Se tiran dados de precisión en un fallo | resolución por etapas: primero impacto, después bundle |
| UI y servidor discrepan | mismo evaluator compartido; servidor recalcula y prevalece |
| RNG vuelve impuras las reglas | DiceRoller solo en orquestación, inyectable en tests |
| Purga rompe visualizaciones | selectores compartidos reemplazan cada lectura escalar antes de retirar el campo |
| Invariante obsoleta vuelve a introducir manuales | actualizar `.ai/DO_NOT_BREAK.md`, memoria y documentación al implementar |

## 12. Estrategia de pruebas

### Purga

- schemas rechazan cada campo prohibido en perfiles y comandos;
- todo combatiente de tests nace de fuentes catalogadas;
- snapshot incompleto, divergente o con ID desconocido falla con error descriptivo;
- armor breakdown, ataque, daño y velocidad se recalculan correctamente desde fuentes;
- auditoría estática no encuentra propiedades exactas prohibidas fuera de tests de rechazo;
- fixtures originales no son mutados por la creación del snapshot.

### Ataque Furtivo

- melee flanqueado aplica `Nd6`;
- defensor con `NO_DEX_TO_AC` aplica furtivo sin necesidad de flanqueo;
- Destreza negativa + Flat-Footed sigue calificando;
- ranged a 30 ft aplica y a 35 ft no;
- construct y undead son inmunes por trait; humanoid/magical beast no;
- objetivo no vulnerable no aplica;
- atacante sin dados no aplica;
- natural 1/fallo no tira ni aplica precisión;
- Shocking Grasp puede aplicar; Ray of Frost solo hasta 30 ft; Magic Missile nunca;
- cada ataque iterativo reevalúa el contexto;
- crítico multiplica base pero nunca precisión;
- cancelación de amenaza conserva exactamente el bundle normal;
- log incluye expresión, tirada y total por componente.

### Integración

- E2E WebSocket con Bane flanqueando y aplicando daño base + furtivo;
- payload con `isSneakAttack`, `sneakAttackDice` o `precisionDamage` es rechazado;
- Playwright muestra/oculta `+Nd6 Ataque Furtivo` al cambiar fuente, distancia o objetivo.

## 13. Criterios de aceptación

- No existen `armorClass`, `attackModifier`, `damageBase` ni `speedFeet` como propiedades del perfil o combatiente.
- Los nombres runtime ambiguos se reemplazan por resultados explícitos como `attackBonusTotal`.
- Toda CA proviene de `armorClassBreakdown`; ataque, daño y velocidad se derivan desde fuentes en el punto de uso.
- Todo snapshot de producción y tests pasa la misma aserción de integridad.
- Ningún fixture de dominio fabrica resultados precalculados.
- Ataque Furtivo requiere feature, entrega válida, vulnerabilidad y ausencia de inmunidad.
- Ranged queda limitado a 30 ft; melee no usa ese límite.
- La inmunidad se deriva de traits catalogados, no de IDs rígidos.
- Daño de precisión no se multiplica en críticos.
- Cliente no decide elegibilidad, dados, inmunidades ni cantidad de precisión.
- Resolver no importa geometría, catálogos raciales ni lógica específica de Ataque Furtivo.
- Tests, typecheck, build, E2E y Playwright quedan verdes antes del cierre.

## 14. Secuencia después de `Proceed`

1. introducir catálogos de tipo/feature y schema de fuentes;
2. crear builder único de fixtures conformes;
3. eliminar caches escalares y adaptar selectores compartidos;
4. endurecer aserción de snapshots e inicializadores;
5. migrar suites existentes sin borrar cobertura;
6. implementar evaluación de vulnerabilidad y Ataque Furtivo;
7. introducir resolución de daño por componentes y adaptar críticos;
8. integrar todos los entry points, UI y red;
9. ejecutar auditoría estática y validación completa;
10. sincronizar documentación, deuda, registry, memoria y walkthrough.

Hasta recibir `Proceed`, este documento no autoriza modificaciones en `.ts`, `.tsx`, `.json`, `.mjs` ni schemas ejecutables.
