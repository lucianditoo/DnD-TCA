# NDD — Penalizador por Disparar a Combate Cuerpo a Cuerpo (Ranged Into Melee)

## 0. Estado y Rule ID

- **Estado**: Fase 2/3 — diseño y plan, pendiente de ✅ `Proceed`. Ningún archivo TypeScript modificado.
- **Rule ID propuesto**: **`ATK-RANGED-INTO-MELEE`** (estilo descriptivo consistente con `ATK-REFLEXES` del registro existente; la sede canónica del registro sigue pendiente de la decisión de gobernanza anotada en `core-rules-consolidation.md` §6).
- **Fuente normativa**: PHB 3.5 pág. 140; corpus local `combat/06_ataques.txt` línea 58 y `combat/10_modificadores_de_combate.txt` línea 12.

## 1. Definición normativa del contrato

### 1.1. Cuándo aplica el penalizador

Un ataque con arma arrojadiza o de proyectil (`attackType: "ranged"`) contra un objetivo *enzarzado en combate cuerpo a cuerpo* con un personaje amistoso del atacante sufre **-4** a la tirada de ataque.

**Definición de "enzarzado en cuerpo a cuerpo"** (contrato de este diseño): el objetivo y un personaje amistoso del atacante están enzarzados cuando:
1. son enemigos entre sí (en este motor: `CombatantType` distinto, `types.ts:6`), y
2. **al menos uno de los dos amenaza al otro** según la relación táctica vigente (`threatensTarget`, `rules.ts:1330`), que ya absorbe alcance de armas (min/max), alcance natural, footprints multicelda y el trait `NO_THREAT` (`rules.ts:1288`).

**No** se modela como adyacencia simple ni como amenaza estrictamente mutua.

**Hallazgo normativo derivado (registrar en la auditoría del corpus como D-11)**: la transcripción local dice "están amenazándose **mutuamente**" (`combat/06:58`), pero el texto oficial en inglés dice *"are enemies of each other and **either** threatens the other"* — basta una dirección de amenaza. La formulación mutua del corpus es una imprecisión de traducción: haría desaparecer el penalizador exactamente en el caso arquetípico (un arquero enemigo trabado por mi aliado espadachín: el aliado lo amenaza, él no amenaza de vuelta — RAW sigue considerándolo enzarzado). Este NDD adopta la formulación "al menos uno amenaza al otro" y propone la enmienda del corpus como acción documental (ver §8).

**Exclusión de indefensos**: un personaje inconsciente o inmovilizado no se considera enzarzado "a no ser que esté siendo atacado". La cláusula "siendo atacado" es estado-de-turno difuso; **simplificación aceptada V1**: un objetivo cuyo estado de vida no es activo (inconsciente/moribundo/muerto vía `lifeStatus`) o con trait `HELPLESS` no se considera enzarzado. La variante "salvo que esté siendo atacado en este momento" queda explícitamente fuera de alcance y anotada como deuda RAW menor.

### 1.2. Excepción de 10 pies

El penalizador se ignora si el objetivo está **al menos a 10 ft del personaje amistoso más cercano al atacante** — el amistoso más cercano *en general*, no "el aliado involucrado en la melé":

- Conjunto evaluado: todos los combatientes de la misma facción que el atacante, excluyendo al propio atacante y a los muertos.
- Medición: `distanceBetweenFootprintsFeet(room, target, friendly)` (`rules.ts:1341`, Sprint 027) — distancia mínima entre footprints, correcta para criaturas Large/Huge y multicelda por construcción. No se usa distancia entre centros ni entre posiciones-ancla.
- Nota RAW sobre objetivos grandes ("la parte a la que apuntas"): la distancia entre footprints ya es el mínimo entre celdas ocupadas; apuntar a "la parte lejana" de una criatura Grande queda fuera de alcance V1 (se usa el mínimo, la interpretación conservadora — el penalizador se aplica más a menudo, nunca menos que RAW).

Obsérvese la estructura: la condición de "enzarzado" y la excepción de distancia son **independientes** — un objetivo puede estar enzarzado con mi aliado de alcance 10 ft y aun así quedar exento si ese aliado (y todos los demás amistosos) están a ≥10 ft.

## 2. Punto de integración (análisis, no decisión unilateral)

Opciones evaluadas:

| Opción | Descripción | Veredicto |
|---|---|---|
| A. Lógica inline en `Rules.totalAttackBonus` | Todo el cálculo geométrico dentro de la función | Descartada: `totalAttackBonus` no conoce hoy al objetivo; incrustar iteración de aliados ahí engorda una función ya extensa y no es reutilizable por previews. |
| B. `ConditionalModifier` del sistema de efectos | Modelarlo como modificador condicional de un `EffectDefinition` | Descartada: no hay efecto activo que lo porte — es una regla situacional geométrica permanente, no un estado aplicado; forzarla en la capa de efectos sería complejidad accidental. |
| C. Solo en el resolver del servidor | Calcular el -4 en `attackResolver.ts` | Descartada: rompe el isomorfismo UI/servidor (la UI no podría predecir el penalizador). |
| **D. Helper puro + extensión de `AttackContext` (elegida)** | Ver diseño abajo | Cumple los cinco requisitos de la revisión. |

**Diseño D**:
1. Helper puro exportado en `rules.ts`:
   `getRangedIntoMeleeAssessment(room, attacker, target): { applies: boolean; penalty: 0 | -4; exemption?: "distance" | "feat"; nearestFriendlyDistanceFeet: number | null }`
   Conoce atacante, objetivo y geometría; reutiliza `threatensTarget` y `distanceBetweenFootprintsFeet`; sin estado persistente; determinista (independiente del orden de inserción de combatientes: el "más cercano" se resuelve por mínimo numérico con desempate irrelevante porque solo importa el umbral ≥10).
2. Extensión **aditiva y opcional** de `AttackContext` (`rules.ts:167`): nuevo campo `readonly targetId?: string`. Cuando `attackType === "ranged"` y `targetId` está presente, `totalAttackBonus` resuelve el objetivo del snapshot, invoca el helper y pliega el resultado en el total y en `parts` (entrada trazable: `"disparo a melé -4"` o `"disparo a melé evitado (dote)"` / `"(distancia)"` a decidir en implementación — la entrada existe siempre que la evaluación ocurra, para depurabilidad).
3. Sin condicionales por dote en resolvers: la exención de Disparo Preciso se resuelve dentro del helper vía el fold declarativo de `FeatCatalog` (§3), nunca en `attackResolver.ts`.

## 3. Infraestructura de dotes pasivas (frontera mínima)

Patrón oficial existente verificado: `FeatDefinition` expone contribuciones declarativas opcionales (`avoidsOpportunityOn`, `lifeRules`, `tacticalActionRules`, `attackRoutineRules`) consumidas por folds de `FeatCatalog` (`featCatalog.ts:84-126`). **No existe aún** un campo para excepciones de combate a distancia; la frontera mínima necesaria — sin construir un sistema general de feats — es:

- Nuevo campo opcional: `rangedAttackRules?: { readonly ignoresFiringIntoMeleePenalty?: boolean }` en `FeatDefinition`.
- Nuevo fold: `FeatCatalog.rangedAttackContribution(featIds)` (mismo patrón OR-fold que `lifeRules`).
- Registro de `srd_precise_shot` ("Disparo Preciso") con `rangedAttackRules: { ignoresFiringIntoMeleePenalty: true }`.

**Distinción de dotes (corrección respecto al plan anterior)**: *Precise Shot* **elimina** este -4; *Point Blank Shot* es un bono distinto (+1 ataque/daño a ≤30 ft), **no** elimina este penalizador, y es solo prerrequisito de Precise Shot. Esta slice **no** implementa Point Blank Shot ni lo "desbloquea" mecánicamente; lo que habilita es la implementación *correcta* de Precise Shot (que sin el -4 no tendría nada que anular). `srd_point_blank_shot` NO se registra en el catálogo en este sprint.

## 4. Respuestas al Design Review Checklist

- **Decisión difícil de revertir en 20 sprints**: la forma del campo `AttackContext.targetId`. Mitigación: es opcional y aditivo — los 5 call sites existentes de `totalAttackBonus` compilan sin cambios; retirarlo solo rompería a sus consumidores explícitos. El helper es una función pura exportada, borrable sin arrastre.
- **Infraestructura reutilizada**: `threatensTarget`/`threatensTargetWithGeometry` (relación de amenaza con footprints y alcance), `distanceBetweenFootprintsFeet` (Sprint 027), patrón de folds de `FeatCatalog`, desglose `parts` para isomorfismo UI/servidor, `CombatantType` como facción.
- **Complejidad accidental**: cero entidades nuevas, cero estado persistente, cero aleatoriedad, un campo opcional y un helper puro. Se rechazaron las 3 alternativas que añadían capas (§2).
- **Impacto por subsistema**: Rule Engine (helper + integración en `totalAttackBonus` + `AttackContext`), FeatCatalog (campo + fold + 1 registro), Servidor (los call sites que resuelven ataques a distancia pasan `targetId` — inventario en §6), UI (preview hereda por `parts`; pasar `targetId` donde ya se conoce el objetivo), Tests. Sin impacto en: efectos activos, movimiento, comandos Zod (el `targetId` ya viaja en el payload de `resolve-attack`), esquemas de red.
- **Alternativas descartadas**: tabla de §2.
- **Regla de Tres (futuras reglas que reutilizan esta infraestructura)**: (1) *Precise Shot* — primer consumidor real del fold `rangedAttackRules`; (2) **ataques de toque a distancia** (rayos de conjuro): mismo penalizador RAW al disparar a melé — el helper se reutiliza pasando `attackType: "ranged"` + `targetId` desde el pipeline de conjuros con `attack-roll`; (3) **armas con alcance y criaturas Large/Huge**: cubiertas sin código adicional porque la condición vive en `threatensTarget` y la distancia en footprints — los tests lo fijan explícitamente. Extensión posterior natural: *Improved Precise Shot* (segundo bit en el mismo `rangedAttackRules`).
- **Fuera de alcance**: bono de Point Blank Shot; interacción con cobertura blanda; ocultación; matiz RAW "salvo que esté siendo atacado" para indefensos; apuntar a partes de objetivos grandes; fuego amigo (RAW no hace que el fallo golpee al aliado y este diseño tampoco).

## 5. Estrategia de pruebas (casos de la revisión, mapeados)

Archivo nuevo `tests/ranged-into-melee.test.mjs` (vía `node --test` contra `dist/`, técnica de Sprints 036/037):

| # | Caso | Aserción |
|---|---|---|
| T1 | Ataque melee contra objetivo trabado | Sin -4 (helper no aplica cuando `attackType !== "ranged"`). |
| T2 | Ranged contra objetivo sin amistosos cerca ni amenazas | Sin -4, `applies: false`. |
| T3 | Amenaza no recíproca (aliado espadachín amenaza al arquero objetivo; el objetivo no amenaza de vuelta) | **Con** -4 — fija la formulación "al menos uno amenaza". |
| T4 | Excepción de 10 ft: único amistoso a exactamente 10 ft del objetivo | Sin -4, `exemption: "distance"`; a 5 ft → con -4 (borde del umbral). |
| T5 | Aliado con arma de alcance (longspear, amenaza a 10 ft sin adyacencia) | Con -4 si el amistoso más cercano está a <10 ft; verifica que la amenaza no exige adyacencia. |
| T6 | Objetivo Large 2×2 y/o aliado Large | Distancia por footprints (mínimo entre celdas), no por anclas; con/sin -4 según el borde correcto. |
| T7 | Varios amistosos: uno trabado lejos (≥10 ft) y otro no-trabado cerca (<10 ft) | Con -4 — el "más cercano" es el amistoso más cercano en general, no el involucrado. |
| T8 | Atacante con `srd_precise_shot` | Sin -4, `exemption: "feat"`; `parts` lo refleja. |
| T9 | Atacante con `featIds: ["srd_point_blank_shot"]` (sin registro de exención) | **Con** -4 — PBS por sí solo no lo elimina. |
| T10 | Desglose | La entrada de `parts` explica el penalizador/exención textualmente. |
| T11 | Determinismo | Permutar el orden de inserción de combatientes en el snapshot no cambia el resultado del helper. |

Adicional (blindaje adjunto aprobado en el plan de saneamiento): `tests/aoo-limit-regression.test.mjs` fijando el invariante de AOO-03 (1/ronda, `1+mod(Des)` con Reflejos de Combate, reinicio por ronda) — cerrando su deuda residual en el mismo sprint.

## 6. Inventario exacto de archivos y consumidores afectados

**Archivos a modificar** (cuando llegue `Proceed`):

| Archivo | Cambio |
|---|---|
| `packages/shared/src/rules.ts` | Helper `getRangedIntoMeleeAssessment`; campo opcional `AttackContext.targetId`; integración en `totalAttackBonus` (rama `ranged` + `targetId`). |
| `packages/shared/src/featCatalog.ts` | Campo `rangedAttackRules` en `FeatDefinition`; fold `rangedAttackContribution`; registro `srd_precise_shot`. |
| `apps/server/src/combat/attackResolver.ts` (línea 90) | Añadir `targetId` al contexto que ya construye (el objetivo ya está resuelto en ese punto). |
| `apps/web/src/components/ActionsPanel/ActionsPanel.tsx` | Pasar `targetId` en el contexto del preview cuando hay objetivo declarado (hereda el desglose por `parts`). |
| `tests/ranged-into-melee.test.mjs` (nuevo), `tests/aoo-limit-regression.test.mjs` (nuevo) | Estrategia de §5. |

**Call sites de `totalAttackBonus` verificados y su afectación**:

| Call site | Afectación |
|---|---|
| `apps/server/src/combat/attackResolver.ts:90` | SÍ — punto autoritativo; añade `targetId`. |
| `packages/shared/src/rules.ts:2271` (`getEffectiveAttackRoutine`) | Opcional — su `attackContext` es `Pick<...>`; ampliar el Pick para propagar `targetId` al preview de rutina (decisión de implementación, sin romper firma). |
| `packages/shared/src/rules.ts:1660` (maniobra, contexto melee) | NO — melee, sin `targetId`, comportamiento idéntico. |
| `apps/server/src/commands/tacticalCommands.ts:186` | NO — sin contexto; idéntico. |
| `apps/web/src/components/SelectedInfo/SelectedInfo.tsx:41` | NO — stat general sin objetivo; idéntico. |

**Sin cambios en**: `types.ts`, esquemas Zod (`resolve-attack` ya transporta `targetId`), `effects/contracts.ts`, `effects/catalog.ts`, `spells/catalog.ts`, movimiento.

## 7. Plan de implementación (orden estricto, post-`Proceed`)

1. Tests de caracterización primero (`ranged-into-melee.test.mjs` T1-T11 + `aoo-limit-regression.test.mjs`), en rojo contra `dist/` actual.
2. `featCatalog.ts`: campo + fold + `srd_precise_shot`.
3. `rules.ts`: helper puro (sin integrar).
4. `rules.ts`: `AttackContext.targetId` + integración en `totalAttackBonus` con entrada en `parts`.
5. `attackResolver.ts:90`: pasar `targetId`.
6. UI: `ActionsPanel.tsx` (y decisión sobre el `Pick` de `getEffectiveAttackRoutine`).
7. DoD oficial: `npm run typecheck` · `npm test` · `npm run build` · `node scripts/e2e-websocket.mjs` · `npm run test:ui` (suite completa en la máquina Windows; en sandbox, subconjunto `node --test` contra `dist/` + typecheck/build:shared/build:server, limitación documentada).

**Nota de gobernanza**: `implementation_plan.md` (raíz) sigue ocupado por el plan del Sprint 038 (pendiente de su propio `Proceed`); este plan vive dentro del NDD hasta que la dirección decida qué sprint entra primero, evitando clobber documental.

## 8. Actualizaciones documentales previstas al cierre

1. `RULES_PHB_CHECKLIST.md`: fila "Disparar/lanzar a combate cuerpo a cuerpo (-4)" → `[x]`; dashboard regenerado.
2. `FEATS_PHB_CHECKLIST.md` / `FEATS_CHECKLIST.md`: `srd_precise_shot` → `[x]`.
3. `docs/audits/combat-rules-deviations.md`: nueva discrepancia **D-11** ("amenazándose mutuamente" vs RAW *either threatens*, `combat/06:58` y copia en `combat/10:12`) + enmienda **E-10** propuesta para el Sprint de Saneamiento documental; cierre definitivo de la fila `AOO-03` (test de regresión entregado).
4. `PROJECT_STATUS.md` / `TODO.md` / `walkthrough.md` / `.ai/PROJECT_MEMORY.md`: cierre estándar del sprint (incluyendo las sincronizaciones pendientes listadas en `core-rules-consolidation.md` §6 si la dirección las aprueba en el mismo `Proceed`).

---

**Detención**: diseño completo. A la espera de ✅ `Proceed` para ejecutar el plan de §7. Ningún archivo TypeScript ha sido modificado.
