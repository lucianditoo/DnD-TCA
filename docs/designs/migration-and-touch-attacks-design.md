# NDD Sprint 010: Migración total y ataques de toque reales

## Estado

- Fase: 5 — implementación completada y validada.
- Implementación: aprobada mediante `Proceed` y cerrada el 2026-07-15.
- Alcance de este documento: sustituir la compatibilidad legacy de CA por datos fuente completos y habilitar ataques de toque cuya clasificación sea decidida exclusivamente por el servidor.

## 1. Objetivo y problema

Sprint 009 introdujo un cálculo multidimensional de CA capaz de proyectar CA normal, de toque, desprevenido y toque + desprevenido. Para conservar snapshots antiguos también dejó una rama que aceptaba `armorClass` como valor opaco y estimaba algunas variantes. Esa rama impide garantizar que el resultado procede de características, tamaño, dotes, equipo y efectos catalogados.

Sprint 010 elimina esa segunda fuente de verdad. Todo combatiente admitido en una sala deberá tener fuentes mecánicas completas y un `armorClassBreakdown` válido, derivado al crear su snapshot. Un perfil que no pueda migrarse de manera determinista no será aceptado silenciosamente ni perderá datos: quedará fuera del combate con un diagnóstico de migración explícito.

El mismo sprint incorporará acciones de ataque de toque reales. El cliente elegirá una acción conocida por su identificador, pero no podrá declarar qué CA atacar, qué característica usar ni qué bonificador aplicar. El servidor resolverá esos datos desde catálogos autoritativos.

## 2. Principios e invariantes

1. **Servidor autoritativo**: el cliente expresa intención y resultados de dados según el contrato actual; el servidor valida actor, propiedad, turno, acción conocida, alcance y perfil mecánico antes de mutar la sala.
2. **Una sola fuente de verdad**: perfiles persistidos y plantillas guardan entradas; no guardan CA, ataque o daño derivados como autoridades paralelas.
3. **Snapshot completo e inmutable**: el ingreso a combate resuelve catálogos y materializa todos los componentes necesarios. El Rule Engine no consulta perfiles ni `localStorage`.
4. **Migración sin estimaciones**: una CA plana nunca se utiliza para adivinar armadura, escudo, armadura natural, tamaño o Destreza.
5. **Fallo cerrado**: datos incompletos o referencias de catálogo desconocidas impiden crear el combatiente y producen un error tipado y descriptivo.
6. **Reglas puras**: tamaño, CA, ataque y daño se derivan mediante funciones compartidas y deterministas; la orquestación y la mutación permanecen en el servidor.

## 3. Arquitectura propuesta

### 3.1. Perfil V2: entradas mecánicas, no resultados

El esquema persistible V2 exigirá:

- `abilityScores` completas.
- `sizeCategory` semántica.
- `baseAttackBonus`, `baseSpeedFeet`, `hpMax` y demás entradas no derivables que ya representan progresión o anatomía del combatiente.
- `equipment` con ranuras explícitas y valores `null` cuando no estén ocupadas; cada identificador deberá existir en `EquipmentCatalog`.
- `featIds`, validados contra un catálogo declarativo mínimo de dotes.
- Para criaturas, `intrinsicDefense.naturalArmorBonus` y, cuando corresponda, referencias a ataques naturales catalogados. La anatomía no se representará mediante armaduras o armas ficticias.
- Acciones y aptitudes conocidas por identificador de catálogo.

Quedarán fuera del perfil V2 los resultados derivados `armorClass`, `armorClassBreakdown`, `attackModifier`, `damageBase` y `speedFeet`. El desglose pedido por el contrato de migración se incorpora al **snapshot**, no se persiste como autoridad en el perfil. Así, cambiar equipo o característica nunca deja una CA almacenada desincronizada.

`baseAttackBonus` permanece como entrada porque procede de dados de golpe/clases o estadísticas de criatura y no puede reconstruirse a partir del equipo. Del mismo modo, la armadura natural real es una entrada anatómica explícita, no una deducción desde la CA anterior.

### 3.2. Tamaño preparado para ataque, CA y Presa

Se introducirá un `SizeCategory` con las nueve categorías de D&D 3.5:

| Categoría | Ataque y CA | Presa | Espacio base |
| --- | ---: | ---: | ---: |
| Fine | +8 | -16 | derivado del catálogo |
| Diminutive | +4 | -12 | derivado del catálogo |
| Tiny | +2 | -8 | derivado del catálogo |
| Small | +1 | -4 | derivado del catálogo |
| Medium | 0 | 0 | 5 ft |
| Large | -1 | +4 | 10 ft |
| Huge | -2 | +8 | 15 ft |
| Gargantuan | -4 | +12 | 20 ft |
| Colossal | -8 | +16 | 30 ft o más, según catálogo |

El perfil almacenará únicamente la categoría. Un `SizeRulesCatalog` compartido expondrá propiedades distintas para `attackAndAcModifier`, `grappleModifier`, `spaceFeet` y `defaultReachFeet`. No se utilizará un único número de tamaño: el modificador de Presa no coincide con el de ataque/CA.

Alcance y forma corporal admitirán overrides catalogados en el futuro, ya que dos criaturas del mismo tamaño pueden tener distinto alcance. Este sprint prepara la representación, pero no implementa todavía ocupación multicelda ni Presa.

### 3.3. Snapshot como frontera de normalización

`combatSnapshot.ts` será la única frontera que convierte un perfil o plantilla validado en un `CombatantSnapshot` mecánicamente completo. La construcción deberá:

1. Resolver características, categoría de tamaño, dotes, equipo, defensa intrínseca y ataques conocidos.
2. Derivar de forma uniforme el modificador de característica, el modificador de tamaño y los bonus tipados de equipo/dotes.
3. Materializar un `armorClassBreakdown` obligatorio, finito y completo.
4. Materializar las opciones de ataque necesarias sin conservar los escalares legacy genéricos.
5. Clonar inmutablemente los datos resueltos para que una modificación posterior del perfil o catálogo no altere el combate en curso.

El `CombatantSnapshot` ya no tendrá una variante válida “sin breakdown”. Las fronteras de creación y restauración de sala usarán validación estructural; `totalArmorClass` recibirá siempre un snapshot normalizado.

### 3.4. Derivación de ataque y daño

La migración completa no se limita a CA. Los campos genéricos `attackModifier` y `damageBase` también deben desaparecer de perfiles V2 porque una misma criatura puede atacar con perfiles distintos.

Cada fuente de ataque declarará su modalidad y característica:

- ataque cuerpo a cuerpo fabricado: Fuerza por defecto;
- ataque a distancia fabricado: Destreza por defecto;
- ataque de toque cuerpo a cuerpo de conjuro: Fuerza;
- ataque de toque a distancia de conjuro: Destreza;
- excepciones: declaradas por el catálogo, nunca inferidas por la UI.

El bonus contextual será BAB + modificador de característica + tamaño + dotes/equipo/efectos aplicables. El daño se derivará de dados y reglas de la fuente seleccionada. Esto evita que el valor antiguo, válido quizá para un arma, contamine otra arma o un rayo.

### 3.5. Catálogo de acciones y contrato de ataques de toque

`Ability` dejará de depender de una combinación de campos opcionales ambiguos y tendrá una resolución discriminada. El diseño mínimo contempla:

- `automatic-damage`: no realiza tirada de ataque ni consulta CA.
- `attack-roll`: declara `attackType` (`melee` o `ranged`), `targetAcType` (`normal` o `touch`), característica de ataque, rango, daño y reglas de crítico.
- `healing`.
- `effect`: aplica un efecto catalogado.

**Corrección normativa importante**: `Magic Missile` no es un ataque de toque; permanece como `automatic-damage`. `Shocking Grasp` será un ataque de toque cuerpo a cuerpo y `Ray of Frost`, un ataque de toque a distancia.

Se añadirá un comando discriminado específico para resolver ataques de aptitud/conjuro. Su payload contendrá solamente identificadores de actor, objetivo y aptitud, junto con los resultados de dados que el contrato del proyecto permita enviar. No contendrá `targetAcType`, `attackType`, característica, bonus de ataque ni desglose de daño.

El servidor hará lo siguiente:

1. Validar ownership, turno, recursos de acción, objetivo, que el actor conozca la aptitud y que la entrada de catálogo sea `attack-roll`.
2. Resolver un `ResolvedAttackProfile` interno desde el catálogo y el snapshot.
3. Validar rango y geometría con los helpers existentes.
4. Invocar el pipeline común de `resolveAttack` con esa fuente ya resuelta.
5. Publicar logs/eventos y mutar HP mediante la misma orquestación autoritativa usada por ataques de arma.

`resolveAttack` no aceptará un `targetAcType` suelto que un caller pueda reenviar desde red. Recibirá una fuente resuelta del servidor: las armas obtienen la proyección desde `EquipmentCatalog` y las aptitudes desde `AbilityCatalog`. El estado de amenaza crítica deberá usar un nombre neutral de fuente, no asumir que toda amenaza procede de `weaponName`.

### 3.6. Reutilización del pipeline contextual de Sprint 008/009

El pipeline existente ya separa dos ejes:

- `attackType` describe la geometría y permite aplicar efectos contextuales como Prone.
- `targetAcType` selecciona la proyección defensiva normal o touch.

Sprint 010 no crea otra fórmula de CA. El perfil autoritativo de la acción alimenta esos ejes en el mismo `AttackContext`; `totalArmorClass` continúa filtrando componentes por tipo y combinándolos con el estado real de Flat-Footed derivado de `ActiveEffects`. Por tanto, un rayo contra un objetivo desprevenido aplica simultáneamente Touch y la pérdida de Destreza/dodge sin ramas especiales.

La clasificación touch pertenece a la acción, no a un `ActiveEffect`. Los estados temporales continúan en `ActiveEffects`; las dotes permanentes se resuelven desde `featIds` y producen modificadores tipados en el snapshot/contexto.

## 4. Migración y persistencia

### 4.1. Esquemas Zod y versionado

`profileStorage.ts` dejará de hacer cast directo de JSON. Una unión Zod tratará la entrada como `unknown` y reconocerá:

- arreglo legacy sin sobre;
- sobre V1 `{ version: 1, profiles }`;
- sobre V2 `{ version: 2, profiles }`.

El migrador será puro, determinista e idempotente. Toda salida V2 se validará de nuevo, incluidas las referencias a catálogos. Una entrada V2 válida no sufrirá transformaciones semánticas al volver a cargarse.

La clave V1 se conservará como respaldo hasta que la escritura y relectura de V2 hayan finalizado correctamente. La migración será transaccional desde la perspectiva de la aplicación: nunca sobrescribirá ni descartará el único ejemplar de un perfil no migrable.

### 4.2. Política sin fallback

La migración podrá completar automáticamente un dato solo cuando exista una regla inequívoca y documentada. Por ejemplo, los perfiles creados por la versión que únicamente soportaba una casilla de 5 ft pueden migrar a `medium` porque esa era una invariante del producto, no una estimación deducida desde CA.

Está prohibido:

- seleccionar una armadura cuyo bonus “haga coincidir” el valor plano;
- deducir armadura natural, escudo, Destreza o tamaño desde `armorClass`;
- conservar el valor plano como `misc` para que las cifras coincidan;
- admitir el perfil a combate con componentes parciales.

Cuando falte una fuente necesaria, el migrador devolverá un `MigrationIssue` tipado con perfil, campo y alternativas válidas. El perfil quedará en cuarentena de migración y la UI solicitará completar los datos. Esto cumple la actualización automática para perfiles deterministas sin introducir una estimación silenciosa en perfiles opacos.

El servidor volverá a validar V2 en `add-profile-combatant`; confiar en que el navegador ya migró el dato violaría el servidor autoritativo.

### 4.3. Migración del catálogo integrado

Las criaturas de `creatures.json` se migrarán mediante un manifiesto de contenido revisable que use los identificadores reales de `EquipmentCatalog` (por ejemplo, `leather`, no nombres inventados con prefijo).

Los datos actuales permiten asignaciones explícitas como `chain_shirt` + `buckler` a Bane y `studded_leather` a Elaen. Cedrick recibirá el equipo que determine el contenido canónico, aunque su CA derivada no coincida con el escalar anterior: la prioridad es una ficha explicable, no preservar una cifra opaca.

Canocrock no tiene hoy características ni equipo suficientes. Antes de implementar su migración, Product Owner/Lead Architect deberán aprobar sus puntuaciones, tamaño, armadura natural y ataque natural. Esa decisión quedará en el manifiesto; no se reconstruirá desde CA 22, ataque +3 o daño 13. La ausencia de esa fuente es un gate de contenido previo a integrar el cambio, no una licencia para reintroducir fallback.

## 5. Purga de complejidad accidental

### 5.1. `rules.ts`

Se eliminarán:

- la rama que retorna `combatant.armorClass` cuando falta el breakdown;
- la estimación Touch `10 + Dex`;
- la resta retroactiva de Destreza sobre una CA plana para Flat-Footed;
- las etiquetas y partes de cálculo “legacy/estimated”;
- aliases de tipos de bonus mantenidos solo por compatibilidad;
- el tratamiento conservador de bonus de CA sin tipo que los hacía sobrevivir a todas las proyecciones.

Los modificadores defensivos deberán tener grupo/tipo válido. `totalArmorClass` asertará un breakdown completo y finito. En desarrollo emitirá un error descriptivo; en cualquier entorno, una frontera de servidor impedirá que un snapshot corrupto avance. Producción tampoco calculará una aproximación.

### 5.2. Normalización de equipo

Se eliminará la bifurcación que preserva escalares cuando no existe equipo o “CA estructurada”. Todos los combatientes recorren la misma derivación; equipo vacío es un conjunto explícito de ranuras vacías, no una señal de formato legacy.

### 5.3. `EffectReducer`

La auditoría no encontró un fallback de CA legacy dentro del reducer, por lo que no se atribuirá una purga inexistente. El reducer seguirá siendo genérico y puro. La simplificación consiste en endurecer sus entradas: todo modificador de CA deberá estar tipado, y el Rule Engine consumirá las trazas sin una rama para bonus desconocidos. La ausencia legítima de un stat en un efecto no se convertirá en error.

## 6. Design Review Checklist obligatorio

### 6.1. Filtro de irreversibilidad a 20 sprints

La decisión más costosa de revertir sería codificar tamaño como un único bonus o asumir que todas las criaturas ocupan 5x5 ft. Se evita guardando una categoría semántica y resolviendo propiedades independientes en `SizeRulesCatalog`: ataque/CA, Presa, espacio y alcance. Ataque y CA consumen ahora `attackAndAcModifier`; una futura maniobra de Presa consumirá `grappleModifier` sin cambiar perfiles ni contratos. Espacio y alcance quedan preparados para mapas multicelda sin acoplar anatomía a la CA.

### 6.2. Complejidad accidental

La deuda que debe resolverse primero es la coexistencia de campos derivados planos y breakdown opcional. Al hacer obligatorio el snapshot estructurado se purgan de `rules.ts` todas las ramas de retorno, resta y estimación legacy, y de la normalización la detección “structured vs legacy”. En `EffectReducer` no existe hoy ese fallback; solo se elimina la tolerancia aguas abajo a bonus defensivos sin tipo. Esta distinción evita introducir cambios artificiales en una capa que ya está correctamente separada.

### 6.3. Matriz de reutilización

1. **ActiveEffects**: conserva estados como Flat-Footed, Prone y buffs/debuffs temporales con modificadores tipados; no representa la naturaleza touch de la acción.
2. **Pure helpers**: reutiliza `totalArmorClass`, `AttackContext`, modificadores de característica, distancia y reglas de apilamiento. Se agrega derivación declarativa de tamaño, no un helper específico por conjuro.
3. **Resolvers**: `resolveAttack` continúa siendo el punto matemático común. Armas y aptitudes le entregan un perfil de ataque que el servidor resolvió desde catálogos.

### 6.4. Regla de tres

El pipeline habilita inmediatamente:

1. **Touch of Fatigue**: ataque de toque cuerpo a cuerpo seguido de un efecto catalogado.
2. **Ray of Enfeeblement**: ataque de toque a distancia seguido de un debuff catalogado.
3. **True Strike**: efecto propio con bonus de insight consumible en el siguiente ataque. No ataca Touch AC, pero reutiliza el mismo contexto autoritativo y demuestra que los modificadores de ataque no están codificados por conjuro.

### 6.5. Matriz de impacto de subsistemas

- [x] **Rule Engine**: breakdown y fuentes obligatorias; derivación de tamaño/ataque; eliminación total del fallback; reuse del contexto Touch + Flat-Footed.
- [x] **CombatRoom / State Schema**: snapshot V2 completo y validado; amenazas críticas neutrales respecto de arma/conjuro.
- [x] **EquipmentCatalog**: referencias obligatorias y validación; armaduras y armas naturales permanecen en dominios explícitos.
- [x] **Ownership**: sin relajación. El servidor comprueba que el actor controlado conoce y puede usar la aptitud seleccionada.
- [x] **WebSocket**: nuevo comando discriminado para ataques de aptitud, sin campos que permitan elegir CA o bonus desde el cliente; errores tipados de validación/migración.
- [x] **UI**: editor/flujo de migración para perfiles incompletos y controles de acciones derivados del catálogo; presentación de CA siempre mediante Rules.
- [x] **Tests**: unitarios para esquema/migración/cálculos y E2E para autoridad y ataque de toque real.

### 6.6. Qué no resuelve este sprint

Quedan fuera:

- preparación, slots, componentes, concentración, resistencia a conjuros y salvaciones;
- mantener la carga de un conjuro de toque fallido;
- ataques de oportunidad provocados por lanzar conjuros;
- múltiples rayos/proyectiles y selección múltiple de objetivos;
- ocupación multicelda y alcance efectivo en el mapa, aunque el modelo de tamaño quede preparado;
- resolución de Presa;
- automatización completa de precisión, Sneak Attack y Dodge contra un objetivo designado.

No se acepta deuda de fallback. Un perfil opaco no migrable queda explícitamente bloqueado hasta que sus fuentes sean completadas.

## 7. Alternativas consideradas y rechazadas

1. **Enviar `isTouch` o `targetAcType` desde el cliente**: rechazado porque permite manipular la defensa objetivo y duplica reglas en UI.
2. **Persistir `armorClassBreakdown` junto con el equipo en V2**: rechazado por crear dos autoridades susceptibles de divergir. El breakdown vive en el snapshot derivado.
3. **Inferir equipo desde la CA plana**: rechazado porque múltiples combinaciones producen la misma cifra y ocultan errores de contenido.
4. **Convertir la diferencia en bonus `misc`**: rechazado; perpetúa exactamente el dato opaco que Sprint 010 elimina.
5. **Agregar campos opcionales de tirada al comando genérico `use-ability`**: rechazado porque permite estados inválidos. Un comando discriminado expresa claramente una aptitud con ataque.
6. **Modelar armadura natural o ataques naturales como equipo fabricado**: rechazado por mezclar anatomía e inventario y bloquear futuras reglas de desarme, polimorfia o formas alternativas.

## 8. Riesgos y mitigaciones

| Riesgo | Consecuencia | Mitigación de diseño |
| --- | --- | --- |
| Datos canónicos insuficientes para criaturas opacas | Migración imposible sin inventar estadísticas | Gate de contenido y manifiesto aprobado; fallo cerrado |
| Perfiles locales se pierden o sobrescriben | Pérdida de datos del usuario | Backup V1, migración pura, escritura/relectura V2 y cuarentena por perfil |
| Catálogos y snapshots divergen | Resultados no reproducibles | Resolver y clonar en la frontera de snapshot; IDs validados |
| El cliente intenta forzar Touch | Ventaja mecánica indebida | Payload sin tipo de CA; selección exclusiva del catálogo del servidor |
| Refactor de ataque rompe críticos o logs | Regresión transversal | Fuente de ataque neutral y suite de regresión común |
| Tamaño se acopla a una sola regla | Reescritura para Presa/mapa | Catálogo con propiedades independientes |

## 9. Estrategia de implementación

1. Introducir contratos V2, catálogos de tamaño/dotes/ataques naturales y esquemas Zod sin activar aún la migración.
2. Migrar reglas puras y construcción de snapshots a fuentes obligatorias; eliminar escalares derivados y fallbacks.
3. Crear y validar el manifiesto de criaturas integrado, incluida la aprobación de los datos faltantes de Canocrock.
4. Implementar migración transaccional V1→V2, cuarentena y UI de reparación.
5. Introducir el contrato discriminado de aptitudes y las entradas de Shocking Grasp/Ray of Frost; conservar Magic Missile automático.
6. Conectar el nuevo comando al pipeline común de ataque autoritativo.
7. Actualizar UI, pruebas y documentación afectada.

El orden es deliberadamente “migration first”: no se eliminará la rama legacy hasta que todos los datos integrados y fixtures puedan producir snapshots V2, pero el merge final no conservará ambas rutas.

## 10. Plan de verificación

### Unitarios

- parseo de arreglo legacy, sobre V1 y sobre V2;
- migración determinista, idempotencia, backup y cuarentena sin pérdida;
- rechazo de IDs desconocidos, datos parciales y escalares derivados en V2;
- validación de todas las criaturas integradas y breakdown obligatorio en sus snapshots;
- tabla completa de tamaños: ataque/CA, Presa, espacio y alcance;
- error descriptivo ante breakdown ausente, parcial o no finito;
- Touch, Flat-Footed y combinación con Destreza positiva/negativa y efectos tipados;
- Shocking Grasp como melee touch, Ray of Frost como ranged touch y Magic Missile sin tirada;
- rechazo de aptitud desconocida/no conocida y ausencia de cualquier override cliente de `targetAcType`;
- críticos y daño por fuente de ataque neutral.

### Integración y E2E

- un mismo resultado de d20 falla contra CA normal y acierta contra Touch cuando lo determina el catálogo;
- un objetivo Flat-Footed usa la proyección combinada correcta;
- un payload malicioso con campos mecánicos extra es rechazado/ignorado según el esquema estricto, sin cambiar la CA seleccionada;
- un perfil V1 válido migra, se agrega a sala y conserva sus fuentes explícitas;
- un perfil opaco muestra el flujo de reparación y no puede ingresar a combate;
- ownership, turno, alcance, amenaza crítica y logs permanecen correctos.

### Validación final obligatoria tras `Proceed`

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. Servidor activo + `node scripts/e2e-websocket.mjs`
5. `npm run test:ui` cuando corresponda al flujo de migración.

## 11. Criterios de aceptación

- No existe una ruta de ejecución que calcule CA desde `armorClass` plano o estime componentes faltantes.
- Todo combatiente de una sala posee fuentes V2 válidas y `armorClassBreakdown` obligatorio.
- Ninguna criatura integrada depende de campos planos derivados.
- Los perfiles migrables se actualizan sin pérdida; los opacos quedan bloqueados con diagnóstico accionable.
- El servidor, y solo el servidor, determina normal vs touch desde la fuente seleccionada.
- Shocking Grasp y Ray of Frost atraviesan el resolver común; Magic Missile sigue siendo impacto automático.
- Pruebas y documentación describen exactamente el mismo sistema.

## 12. Tratamiento de deuda técnica

Este diseño mitigó de raíz DT-017 y su dependencia con DT-004: eliminó la compatibilidad opaca en vez de extenderla. Ambas deudas quedaron **resueltas** en `docs/technical-debt.md` después de migrar los datos y superar 218/218 pruebas unitarias, typecheck, build y 80/80 verificaciones E2E WebSocket.
