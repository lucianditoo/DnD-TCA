# Plan de Saneamiento: Consolidación de Combat Rules (PHB Capítulo 8) — Revisión 2

## Estado

Fase 2 — análisis pre-NDD, en respuesta a la revisión "CHANGES REQUIRED". **Se detiene tras la recomendación de vertical slice** (Sección 7). No hay NDD detallada, no hay secuencia de implementación conjunta, y ningún cambio de código está autorizado hasta ✅ `Proceed`. Sprint 039 (Power Attack) permanece congelado.

---

## 1. Auditoría de cobertura con cifras inequívocas

Conteo exacto por fila de tabla (`grep '^| \[x\] |'` / `'^| \[ \] |'`), tras la 2ª pasada de auditoría que corrigió un falso negativo (ver 3.1):

| Categoría | Completas | Parciales | No implementadas | Total filas | % dashboard (cuenta `[x]`) |
|---|---|---|---|---|---|
| Combat Rules (`RULES_PHB_CHECKLIST.md`) | 59 | 5 (1 marcada `[x]` con nota explícita, 4 marcadas `[ ]`) | 32 | 96 | **60/96 = 63%** |
| Feats (`FEATS_PHB_CHECKLIST.md`) | 6 | 0 | 81 | 87 | 6/87 = 7% |
| Spells (`SPELLS_PHB_CHECKLIST.md`) | 11 | 0 | 119 | 130 | 11/130 = 8% |
| Equipment (`EQUIPMENT_PHB_CHECKLIST.md`) | 93 | 0 | 14 | 107 | 93/107 = 87% |

**Política de conteo declarada** (ahora documentada en el propio checklist): una regla parcial solo se cuenta como implementada si su fila lo indica explícitamente; existe exactamente una en ese caso ("Acciones en combate", economía sustancial sin contador formal estándar+movimiento). Las otras 4 parciales cuentan como no implementadas.

**Cobertura global V1** — dos cifras, ambas correctas según su definición:
- **Promedio no ponderado de categorías** (lo que imprime el dashboard): (63+7+8+87)/4 = **41%**.
- **Ponderado por filas**: (60+6+11+93)/(96+87+130+107) = 170/420 = **40,5%**.

Resolución de la incompatibilidad señalada: el "59/96 = 61%" del borrador anterior mezclaba el conteo estricto del resumen (58) con el del dashboard (59) **y además contenía un falso negativo** (Tabla 8-1, ver 3.1). Tras corregir el checklist, la cifra canónica es 60/96 = 63%. No se alteró ninguna cifra para forzar coincidencia: se corrigió el dato de origen erróneo y se documentó la política de conteo.

## 2. Confirmación documental del cierre de AOO-03

Verificado en código y asentado en el Apéndice A de `docs/audits/combat-rules-deviations.md` (fila `AOO-03`, ahora "CERRADA" con evidencia): `rules.ts:515-521` (límite `1 + max(0, mod(Des))` solo con `srd_combat_reflexes`, rechazo al alcanzar `maxAooAllowed`), incrementos del contador en `attackCommands.ts:204,223,377`, reinicio por ronda (Sprint 032) y DT-007. **No se reimplementa nada.** Deuda residual única: test de regresión dedicado que fije (a) 1 AdO/ronda sin dote, (b) `1+mod(Des)` con dote, (c) reinicio por ronda — tarea menor adjuntable a cualquier sprint futuro.

## 3. Análisis separado de las tres capacidades

### 3.1. Tamaño (Tabla 8-1) — RESULTADO: NO ES BRECHA

Inventario transversal de consumidores de `sizeCategory`, verificado en código:

| Consumidor | Estado | Evidencia |
|---|---|---|
| Modificador de tamaño a Ataque | **Implementado** | `rules.ts:342`: `getSizeRule(combatant.sizeCategory).attackAndAcModifier` sumado al modificador de característica dentro de `totalAttackBonus`. |
| Modificador de tamaño a CA | **Implementado** | Componente `size` de `deriveArmorClassBreakdown` (`equipmentStats.ts:206`), consumido por `projectStructuredArmorClass` → `totalArmorClass`. |
| Modificador de tamaño a CA de toque | **Implementado** | La proyección de toque suprime armadura/escudo/natural pero conserva el componente `size` (conforme RAW). |
| Modificador especial de presa (±4/categoría, tabla especial ±16) | **Implementado** | `grappleModifier` en `SizeRulesCatalog` + `getSpecialManeuverSizeModifier` (`rules.ts:647-648`), usado en presa/derribo/embestida (`rules.ts:1789-1792,1943-1945,2008-2010`). |
| Espacio (space) | **Implementado** | `spaceFeet` + footprints multicelda (Sprints 025-A/027/028). |
| Alcance (reach) | **Implementado** | `defaultReachFeet` (`rules.ts:1933,1981,2056`). |
| Modificador de tamaño a Esconderse | No implementado | Sin sistema de habilidades — pertenece a la brecha "Habilidades", no a esta. |

**Causa del falso negativo original**: la 1ª pasada buscó el identificador `sizeModifier`; el nombre real del campo es `attackAndAcModifier` (`packages/shared/src/sizeRules.ts`, catálogo completo Fine +8 ... Colossal -8). La fila del checklist fue corregida a `[x]` con nota de auditoría, lo que mueve la cobertura de Combat Rules de 59 a 60. **La "Mecánica 01" del borrador anterior queda eliminada del alcance: habría duplicado código existente**, la infracción exacta que la Matriz de Reutilización debe impedir. Deuda residual: test de regresión que fije el invariante RAW de simetría (dos criaturas del mismo tamaño se impactan igual entre sí).

### 3.2. Ocultación (CONCEALMENT) — brecha real, contrato de resolución NO definido

Confirmado: `{ type: "mechanic"; rule: "CONCEALMENT"; percentage }` es una variante de `Modifier` (`effects/contracts.ts:86`), no un `Trait`, y carece de consumidor en `rules.ts` y en `attackResolver.ts`. Antes de cualquier NDD, deben responderse — **y aquí solo se enumeran, sin resolverse**:

1. Combinación de múltiples porcentajes (RAW: no se apilan; sobrevive... ¿el mayor? La NDD debe citarlo del corpus, `combat/10` línea 99).
2. Distinción ocultación (20%) vs ocultación total (50% + prohibición de AdO + ataque a casilla), y si la total entra en este slice o se difiere.
3. Relación con la visión del atacante (visión en la oscuridad/penumbra anulan fuentes concretas — hoy no existe modelo de visión; decidir si el % es incondicional en V1).
4. Orden respecto de amenaza crítica y confirmación (RAW aplica la tirada de fallo al ataque como un todo; decidir el punto exacto del pipeline y documentarlo contra `combat/10`).
5. Trazabilidad del d100 en el log de combate (el proyecto exige logs transaccionales).
6. Frontera Rule Engine puro vs resolver autoritativo: propuesta preliminar — el motor puro *deriva* el porcentaje aplicable (dato), el resolver del servidor *tira* el d100 (efecto); pendiente de validación en la NDD.
7. Inyección del roller (`diceRoller.ts` ya existe en `apps/server/src/combat/`) para tests deterministas — verificar si su firma actual admite inyección o requiere extensión.

### 3.3. Disparar/lanzar a combate cuerpo a cuerpo (-4) — brecha real, primitivas verificadas

**Definición normativa** (corpus `combat/06` línea 58 / `combat/10` línea 12, corrigiendo la sobre-simplificación "aliado adyacente a ≤10 ft" del borrador anterior): el objetivo está *enzarzado en cuerpo a cuerpo* cuando él y un aliado del atacante **son enemigos y se amenazan mutuamente** (un personaje inconsciente o inmovilizado no cuenta como enzarzado salvo que esté siendo atacado). La excepción de los 10 ft es independiente: el penalizador se ignora si el objetivo está al menos a 10 ft del **aliado más cercano** del atacante. Nada de esto depende de adyacencia simple: la relación de amenaza ya absorbe alcance de armas, alcance natural y footprints.

**Primitivas verificadas en código** (sin escribir la fórmula final, conforme a la revisión):
- `threatensTarget(room, attacker, target)` (`rules.ts:1330`) y `threatensTargetWithGeometry` (`rules.ts:1317`) — amenaza entre footprints con alcance min/max; exactamente la relación normativa requerida, en ambas direcciones.
- Facciones: `CombatantType = "player" | "enemy"` (`types.ts:6`) — "aliado del atacante" = mismo `type`; "enemigos entre sí" = `type` distinto. Sin sistema de facciones más rico; suficiente para la regla.
- Precedente directo de reutilización: el cálculo de flanqueo ya itera aliados evaluando `threatensTargetWithGeometry(room, ally, target, ...)` (`rules.ts:1501-1506`) — el patrón de "aliado que amenaza al objetivo" existe y está testeado.
- Distancia entre footprints O(1) (Sprint 027) para la excepción de 10 ft.

**Pendiente para la NDD**: semántica exacta de "amenazándose mutuamente" cuando solo una dirección amenaza (arquero adyacente: el aliado lo amenaza, él no amenaza — RAW exige mutualidad y la NDD debe fijar el caso con ejemplos del corpus), interacción con criaturas que no amenazan (sin arma, ocultación total), y el punto de inyección en `totalAttackBonus` (condicional por `attackType: "ranged"` + contexto geométrico).

## 4. Matriz comparativa

| Criterio | Tamaño (8-1) | Ocultación | Disparar a melee (-4) |
|---|---|---|---|
| ¿Brecha real? | **No** (falso negativo corregido) | Sí | Sí |
| Severidad (fidelidad RAW) | — | Alta (mecánica defensiva ausente por completo) | Media (penalizador situacional ausente) |
| Dependencias previas | — | Contrato de resolución completo (7 preguntas abiertas, 3.2); modelo de visión ausente | Ninguna: primitivas existentes y testeadas (amenaza, facciones, distancia) |
| Riesgo | — | Medio-alto: toca el resolver autoritativo del servidor, orden del pipeline de críticos, aleatoriedad nueva | Bajo: derivación pura en `totalAttackBonus`, cero aleatoriedad nueva, cero cambios de contrato |
| Alcance (archivos) | — | `contracts.ts` (consumo), `attackResolver.ts`, `diceRoller.ts`, catálogo de efectos, UI de log | `rules.ts` (+tests); UI hereda por el desglose `parts` |
| Desbloqueos | — | Sombras/niebla/desplazamiento/invisibilidad parcial (4+ efectos futuros) | Dotes Point Blank Shot y Precise Shot (`FEATS_PHB_CHECKLIST.md`) con punto de anulación declarativo listo |
| Preparación para NDD | — | **No lista** (contrato sin definir) | **Lista** (solo quedan decisiones de semántica documentadas en 3.3) |

## 5. Recomendación: UNA vertical slice

**Slice recomendada para el próximo sprint: Disparar/lanzar a combate cuerpo a cuerpo (-4).** Es la única brecha real cuya NDD puede escribirse ya (primitivas verificadas, cero dependencias, riesgo bajo), produce valor encadenado inmediato (deja listo el punto de anulación declarativo para Precise Shot, primera dote del backlog de cobertura), y no toca el resolver autoritativo. Ocultación queda como candidata al sprint siguiente, condicionada a resolver primero su contrato (3.2). Tamaño sale del backlog de brechas y se convierte en una tarea de test de regresión adjuntable.

**Aquí se detiene este documento.** La NDD detallada de la slice recomendada se redactará solo tras ✅ `Proceed` sobre esta recomendación.

## 6. Documentos desincronizados detectados y correcciones propuestas

| Documento | Desincronización | Corrección propuesta | Estado |
|---|---|---|---|
| `.ai/coverage/RULES_PHB_CHECKLIST.md` | Fila Tabla 8-1 marcada `[ ]` por falso negativo; resumen decía 58 vs 59 del dashboard sin explicar la diferencia | Fila corregida a `[x]` con nota de auditoría; resumen reescrito con cifras completas/parciales/no-implementadas y política de conteo explícita | **Aplicada** (corrección de error factual, autorizada por la revisión §1) |
| `docs/audits/combat-rules-deviations.md` (Apéndice A) | `AOO-03` decía "Resuelta" sin evidencia de cierre | Fila actualizada a "CERRADA" con evidencia de código y deuda residual (test de regresión) | **Aplicada** (entregable 2 de la revisión) |
| `PROJECT_STATUS.md` (líneas 57-59) | Cabecera declara "Fase Actual: diseño técnico del Sprint 031... IMPLEMENTACIÓN BLOQUEADA HASTA Proceed... Sprint Activo: Sprint 031", contradiciendo la sección "FASE ACTUAL: Sprint 038 en diseño" del mismo archivo | Eliminar/reescribir la cabecera obsoleta y reflejar: 038 pendiente de Proceed, 039 congelado, pivot de saneamiento en análisis | Propuesta — pendiente de `Proceed` de sincronización |
| `TODO.md` | No registra el congelamiento del Sprint 039 ni el pivot de saneamiento | Añadir bloque de estado: 039 congelado, saneamiento en Fase 2, slice recomendada | Propuesta — pendiente |
| `ROADMAP.md` | Sin mención de ningún sprint ≥036 (grep sin resultados) — desactualizado varios sprints | Refrescar con la secuencia real 036→037→038 (gate)→039 (congelado)→saneamiento | Propuesta — pendiente |
| Registro de Rule IDs | Fragmentado: `docs/archive/combat-rules-coverage.md` (archivado) + Apéndice A de la auditoría normativa; sin fuente única | Decidir sede canónica del registro (propuesta: el Apéndice A, ya vivo) y marcar el archivo archivado como histórico | Propuesta — pendiente |
| `.ai/PROJECT_MEMORY.md` | Sin entrada del pivot de saneamiento ni del cierre documental de AOO-03 | Añadir entrada al aprobarse esta revisión | Propuesta — pendiente |
| `docs/designs/power-attack-v6-declarative.md` | El congelamiento del 039 solo consta aquí y en este plan | Anotar el estado "CONGELADO" en su cabecera al ejecutar la sincronización | Propuesta — pendiente |

## 7. DoD oficial para el sprint que se apruebe

`npm run typecheck` · `npm test` · `npm run build` · `node scripts/e2e-websocket.mjs` · `npm run test:ui`, más actualización de: checklist de reglas, dashboard, registro de Rule IDs, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`, auditoría del sprint y `.ai/PROJECT_MEMORY.md`.

Nota de entorno (transparencia, no excepción): en este sandbox `npm test` arrastra 44 fallos pre-existentes por el binario nativo de `tsx` ausente y `build:web`/e2e requieren binarios Rollup/red no disponibles; la referencia "17/17" del borrador anterior era el subconjunto ejecutable vía `node --test` contra `dist/`, no la suite completa. El DoD oficial completo se ejecuta en la máquina Windows local, como en los Sprints 034-037.
