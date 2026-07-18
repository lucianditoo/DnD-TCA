# Documento de Diseño Funcional: Sprint 041 — Correr (Run)

**Tipo de documento**: NDD (Documento de Diseño). Fase de análisis y diseño únicamente — no autoriza implementación. Sigue el flujo de `.agents/AGENTS.md` (Fases 1-4) y el reparto de autoridades fijado en Sprint 040 (`GOVERNANCE.md` = principios, `AGENTS.md` = flujo/DoD).

**Rule ID propuesto**: `MOVE-RUN`.

---

## 1. Regla RAW (literal del corpus normativo, sin interpretar ambigüedades)

Fuente primaria: `combat/05_acciones.txt:143` (Tabla 8-2) y `combat/05_acciones.txt:197`; duplicado casi idéntico en `combat/07_movimiento.txt:33,41` y `combat/08_ataques_de_oportunidad.txt:88`.

Cita literal (`combat/07_movimiento.txt:33`):

> "Correr Puedes correr como acción de asalto completo (al hacer esto, no tendrás derecho a un paso de 5'). Cuando corres puedes moverte en línea recta hasta 4 veces tu velocidad normal (o 3 veces tu velocidad normal, si llevas puesta una armadura pesada). Al no poder evitar los ataques, perderás tu bonificador de Destreza a la CA salvo que tengas la dote de Correr (pág. 94), que te permite conservarlo. Puedes correr durante tantos asaltos como puntuación tengas en Constitución; transcurrido ese tiempo, deberás tener éxito en una prueba de Constitución (CD 10) para poder seguir corriendo. Llegado este punto, deberás realizar una nueva prueba cada asalto que mantengas la carrera, y la CD irá aumentando en 1 punto con cada nueva tirada. En cuanto falles una de estas pruebas, tendrás que parar. Un personaje que haya corrido hasta el límite debe descansar durante 1 minuto (10 asaltos) antes de poder correr de nuevo. Durante un periodo de descanso, el personaje no podrá desplazarse más deprisa que con una acción de movimiento normal. No puedes correr a través de terreno difícil (consulta la pág. 148), ni tampoco puedes correr si no ves hacia dónde vas. Correr representa una velocidad de unas 12 millas por hora para un humano sin impedimenta."

Desglose punto por punto pedido por el mandato:

1. **Acción de asalto completo**: confirmado. Consume el turno completo, mutuamente excluyente con Ataque Completo, Carga, Retirada — la misma familia de acciones de asalto completo ya modelada (`usedFullAttack` como marcador genérico de "acción de asalto completo consumida", precedente fijado en Retirada/Carga).
2. **Movimiento ×4 (×3 con armadura pesada)**: en línea recta únicamente ("línea recta hasta 4 veces tu velocidad"). No se especifica ×3.5 ni categorías intermedias; solo Ligera/Media (×4) vs Pesada (×3).
3. **Restricciones explícitas**:
   - No hay paso de 5' en el mismo asalto (idéntico a Retirada).
   - No se puede correr a través de terreno difícil — **prohibición absoluta**, no un simple recargo de coste (a diferencia del movimiento normal, donde el terreno difícil solo duplica el coste).
   - No se puede correr si no puedes ver hacia dónde vas.
   - Pierdes el bonificador de Destreza a la CA salvo que tengas la dote de Correr.
   - Resistencia: rondas gratuitas = puntuación de Constitución; luego prueba de Constitución CD 10, +1 por ronda adicional; fallo = detenerse; tras llegar al límite, descanso obligatorio de 10 asaltos (1 minuto) sin poder moverse más rápido que una acción de movimiento normal durante ese descanso.
4. **Interacción con terreno difícil**: prohibición absoluta (ver arriba), no solo recargo.
5. **Interacción con Retirada**: ninguna regla especial cruzada en el corpus; ambas son acciones de asalto completo, por lo que son mutuamente excluyentes por turno a través de la misma economía de acciones ya existente (no hay una regla RAW específica "Correr vs Retirada", es simple exclusión de acción de asalto completo única por turno).
6. **Interacción con Paso de 5 pies**: prohibición explícita en el propio texto ("no tendrás derecho a un paso de 5'"), igual que Retirada.
7. **Interacción con Carga**: sin regla cruzada específica; misma exclusión genérica de acción de asalto completo única por turno. Ninguna combina con la otra en el mismo asalto.
8. **Interacción con Disabled (0 PG)**: el corpus no describe ninguna variante "Correr limitado" a diferencia de Retirada, que sí tiene un párrafo explícito de "Retirada limitada" como acción estándar (`combat/07_movimiento.txt:33`, párrafo anterior). Bajo el modelo ya implementado (`canDisabledCombatantTakeAction(..., "full-round")` rechaza cualquier acción de asalto completo para un combatiente Disabled), **un combatiente Disabled no tiene ninguna vía legal para Correr** en este sprint — no existe un "Correr limitado" documentado que replicar.
9. **Interacción con Fatiga**: **ya existe infraestructura declarativa para esto.** `packages/shared/src/effects/catalog.ts:49-58` (`srd_fatigued`) ya declara `ruleOverrides: ["FORBID_RUN", "FORBID_CHARGE"]` con la descripción literal *"El personaje no puede correr ni cargar"* — el override `FORBID_RUN` existe en el tipo `RuleOverride` (`effects/contracts.ts:130`) desde antes de este sprint, pero **no tiene ningún consumidor todavía** (confirmado: cero referencias a `FORBID_RUN` fuera de su declaración). La regla real, entonces, no es "correr causa fatiga" sino **"estar Fatigado impide correr"** — exactamente el mismo patrón que `FORBID_CHARGE`, que sí es consumido hoy en `chargeResolver.ts` (`reduced.ruleOverrides.includes("FORBID_CHARGE")`).

### Decisiones cerradas (PROCEED, fase de implementación — corrigen las dudas registradas en el diseño original)

- **D-1 (AdO por la acción en sí) — CERRADA**: Correr no crea un AdO adicional artificial al comenzar la acción. La tabla indica que la acción provoca porque el desplazamiento abandona casillas amenazadas. Se reutiliza la generación normal de AdO por camino (`findTriggeredOpportunityAttacksForPath`), sin exenciones y sin evento adicional artificial — a diferencia de Retirada, que sí exime su huella inicial. Implementado en `handleRun` (`apps/server/src/commands/tacticalCommands.ts`): la llamada no recibe ningún conjunto de exención.
- **D-2 (resistencia multi-asalto) — CERRADA, fuera de alcance**: límite de asaltos por Constitución, pruebas de Constitución, CD creciente y descanso obligatorio de 10 asaltos quedan fuera de alcance de este sprint. La cobertura de Correr entregada aquí es **parcial** respecto de esta regla diferida: cubre el movimiento de un único asalto, no la resistencia multi-asalto. No se inventa ningún estado persistente entre turnos para simularla. Registrado como deuda técnica explícita (`docs/technical-debt.md`).
- **D-3 (pérdida de Destreza, no de Esquiva) — CERRADA**: se reutiliza la infraestructura existente `NO_DEX_TO_AC` (mismo trait que Desprevenido), que suprime Destreza y Esquiva juntos. En D&D 3.5, una situación que niega el bonificador de Destreza a la CA también niega los bonos de Esquiva (regla general de esquiva condicionada a Destreza) — no se crea una supresión separada solo para Esquiva. Implementado como nuevo efecto de catálogo `srd_running_exposed` (`packages/shared/src/effects/catalog.ts`), aplicado por `handleRun` con duración `until_turn` (inicio del propio próximo turno).
- **D-4 ("no ver hacia dónde vas") — CERRADA, diferida**: diferido hasta que exista un modelo real de visión y Cegado en el motor. No se introducen heurísticas parciales. Registrado como deuda técnica explícita (`docs/technical-debt.md`), compartiendo el mismo punto de extensión futuro que usará Retirada.
- **D-5 (dote de Correr) — CERRADA, incluida en esta slice**: la dote de Correr se modela declarativamente en `FeatCatalog` (`RunRuleContribution.keepsDexBonusWhileRunning`, feat `srd_run`) y permite conservar Destreza/Esquiva mientras se corre (el efecto `srd_running_exposed` no se aplica si `FeatCatalog.runContribution(featIds).keepsDexBonusWhileRunning` es verdadero). No se implementó ningún otro beneficio de dote.

---

## 2. Design Review Checklist

### Filtro de Irreversibilidad a 20 Sprints
La pieza más difícl de revertir sería introducir una segunda ruta de validación de movimiento paralela a `validateMovePath`, o un segundo mecanismo de "acción de asalto completo" distinto de `usedFullAttack`. Este diseño no lo hace: reutiliza exactamente el mismo parámetro de presupuesto explícito que ya introdujo Retirada (precedente ya validado en producción) y el mismo marcador de economía que ya comparten Carga, Ataque Completo y Retirada. El único elemento genuinamente nuevo — el override `FORBID_RUN` — no es nuevo en absoluto: ya existe declarado, solo le falta un consumidor, exactamente como ya ocurrió con `FORBID_CHARGE`. Acotar el alcance a un único asalto (sin D-2) evita comprometerse hoy a una forma de estado persistente entre turnos que podría no encajar con futuras mecánicas de resistencia/fatiga.

### Complejidad Accidental
Riesgo identificado: la tentación de resolver D-2 (resistencia multi-asalto) en la misma slice infla el estado nuevo (contador de rondas corriendo, CD creciente, temporizador de descanso) sin necesidad, cuando el mandato pide explícitamente una "slice pequeña, de bajo riesgo". Mitigación: acotar expresamente esta slice al movimiento de un único asalto (ver §6), dejando D-2 como una mejora futura aislada y opcional que no obliga a rediseñar nada de lo entregado aquí.

### Matriz de Reutilización de Infraestructura
- **ActiveEffects**: reutiliza `FORBID_RUN` (ya declarado en `srd_fatigued`, sin consumidor) exactamente como `FORBID_CHARGE` ya es consumido por Carga.
- **Pure Helpers (`rules.ts`)**: reutiliza `canDisabledCombatantTakeAction(..., "full-round")` (ya usado por Ataque Completo y Carga), `validateMovePath` con su parámetro de presupuesto explícito (patrón fijado por Retirada), `totalSpeedFeet` (ya incorpora Prisa/Haste, penalizador de armadura, etc. — el ×4/×3 debe aplicarse sobre su resultado, no sobre la velocidad base cruda).
- **Resolvers**: reutiliza el trazado de línea recta ya existente para Carga (mismo requisito geométrico: "línea recta").
- **EquipmentCatalog**: reutiliza la categoría de armadura ya expuesta (ligera/media/pesada) para decidir ×4 vs ×3 — sin nueva data.
- **FeatCatalog**: reutiliza el patrón declarativo de contribución de dote ya usado por Disparo Preciso (`rangedAttackRules`), extendido con un nuevo campo declarativo para la dote de Correr.
- **Patrón de postura hasta el próximo turno**: reutiliza el mismo mecanismo ya usado por Carga (-2 CA) y Defensa Total (+4 CA) para aplicar la pérdida de Destreza durante el resto del asalto.

### La Regla de Tres
1. **Prisa (Haste)**: ya implementada (+10' velocidad); al calcular el presupuesto de Correr sobre `totalSpeedFeet` en vez de la velocidad base, el bono de Prisa se hereda automáticamente sin ningún cambio adicional.
2. **Futuras dotes/condiciones de resistencia** (Vigor, Cansancio extendido, etc.): al consumir `FORBID_RUN` de la misma forma que `FORBID_CHARGE`, cualquier futura condición que quiera impedir correr solo necesita declarar el mismo `ruleOverride` — cero cambios en el handler de Correr.
3. **Futuro modelo de visión/Cegado**: cuando exista, el gate de "no puedes correr si no ves hacia dónde vas" (D-4) se conecta al mismo punto de extensión que ya usará Retirada para su propia deuda de visión pendiente — un único modelo de visión sirve a ambas mecánicas sin acoplarlas entre sí.

### Matriz de Impacto de Subsistemas
- [x] **Rule Engine**: nueva función de gate análoga a `canCharge` (consume `FORBID_RUN`, `canDisabledCombatantTakeAction`, economía de turno); nuevo cálculo de presupuesto ×4/×3 sobre `totalSpeedFeet`.
- [ ] **CombatRoom / State Schema**: sin cambios, bajo el alcance acotado de §6 (sin D-2, no hace falta estado nuevo persistente entre turnos).
- [x] **WebSocket Contract**: nueva variante de `use-tactical-action` (mismo patrón que `withdraw`/`charge`), sin presupuestos ni exenciones enviados por el cliente.
- [x] **UI**: botón + preview ×4/×3 (mismo patrón que el preview de Carga/Retirada), sin lógica de reglas en React.
- [x] **Tests**: unitarios, integración de servidor, E2E (patrón Retirada).

### Qué NO resuelve este sprint
- D-2: resistencia multi-asalto (Constitución, CD creciente, descanso de 10 asaltos) — explícitamente diferida.
- D-4: bloqueo por no poder ver hacia dónde se corre — diferida hasta que exista un modelo de visión/Cegado.
- D-3: no se compromete a una supresión granular de solo-Destreza en esta fase de diseño; se decide recién en la revisión.
- La dote de Correr en sí (conservar Destreza) puede entregarse en la misma slice (es una adición de catálogo pequeña) o diferirse — a decidir en la revisión, no se asume.
- Cualquier variante "Correr limitado" para Disabled — no existe en el corpus, no se inventa.
- Acrobacias durante Correr, o correr atravesando enemigos — fuera de alcance, igual que en Retirada V1.

---

## 3. Arquitectura (infraestructura, contratos — sin nombres de función)

**Qué infraestructura existente reutiliza**:
- El patrón de sub-acción de `use-tactical-action` (mismo lugar que Carga y Retirada — no es un modo de `move-combatant`, no es un comando de nivel superior).
- El marcador genérico de "acción de asalto completo consumida" ya compartido por Ataque Completo, Carga y Retirada.
- El gate de Disabled para acciones de asalto completo, ya existente y ya usado por dos acciones distintas.
- El override declarativo `FORBID_RUN`, ya presente en el catálogo de efectos desde antes de este sprint, sin consumidor hasta ahora.
- El parámetro de presupuesto explícito de la validación de movimiento, mismo patrón fijado por Retirada (presupuesto ×2/×1 según Disabled) — aquí sería ×4/×3 según categoría de armadura.
- El trazado de línea recta ya existente para Carga.
- La categoría de armadura ya expuesta por el catálogo de equipo.
- El patrón declarativo de contribuciones de dote del catálogo de dotes.
- El mecanismo de modificador de postura "hasta el próximo turno" ya usado por Carga y Defensa Total.

**Qué contratos consume**:
- Economía de turno existente (movimiento usado, acción de asalto completo usada, paso de 5 pies usado).
- Velocidad efectiva ya resuelta (con Prisa, armadura, etc. ya incorporados).
- Snapshot de reglas de combate existente, sin cambios de forma.

**Qué contratos extiende**:
- El override `FORBID_RUN` pasa de "declarado sin consumidor" a "consumido" — extensión de comportamiento, no de forma de datos.
- El catálogo de dotes necesita un nuevo campo declarativo para la dote de Correr (conservar Destreza al correr) — mismo patrón que el campo ya usado para Disparo Preciso, aplicado a un nuevo caso.
- La validación de movimiento necesita, para esta acción específica, una prohibición absoluta de terreno difícil (a diferencia del recargo de coste que ya aplica al movimiento normal) — a resolver como una comprobación adicional específica de esta acción, no como un cambio de comportamiento del movimiento normal ya existente (Retirada estableció el precedente de comprobaciones adicionales específicas de una acción, resueltas en el handler en vez de alterar la validación genérica compartida).

**Qué estado adicional necesita** (bajo el alcance acotado de §2/§6): ninguno más allá de los campos de economía de turno ya existentes. Si se aprobara ampliar el alcance a D-2, sí se necesitaría estado nuevo persistente entre turnos (contador de asaltos corriendo consecutivos, última CD intentada) — explícitamente fuera de esta slice.

---

## 4. Riesgos

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Presupuesto de movimiento inconsistente | Calcular ×4/×3 sobre la velocidad base en vez de la velocidad efectiva ya resuelta perdería Prisa, penalizadores de armadura ya aplicados, etc. | Multiplicar siempre el resultado ya resuelto de la velocidad efectiva, nunca un valor crudo. |
| Interacción con Retirada | Si Correr usara un marcador de economía distinto al ya compartido por Carga/Ataque Completo/Retirada, ambas acciones podrían combinarse ilegalmente en el mismo turno. | Reutilizar exactamente el mismo marcador genérico ya existente — no crear uno paralelo. |
| Economía de acciones (paso de 5 pies) | Omitir el bloqueo explícito del paso de 5' permitiría una combinación no-RAW. | Reutilizar el mismo bloqueo ya aplicado por Retirada para esta misma restricción. |
| Efectos que modifican velocidad | Fatigado ya debería impedir correr (D existente), pero si el gate no consulta `FORBID_RUN` la restricción quedaría muda pese a estar declarada en el catálogo. | Consumir `FORBID_RUN` explícitamente, con un test de regresión dedicado (Fatigado no puede correr). |
| Sobre-alcance (D-2) | Intentar resolver la resistencia multi-asalto en esta slice introduce estado nuevo persistente entre turnos sin necesidad inmediata, contradiciendo el pedido explícito de una slice pequeña. | Acotar expresamente el alcance (§6) y obtener aprobación explícita de esa acotación antes de codificar. |
| Terreno difícil | Aplicar solo el recargo de coste (como el movimiento normal) en vez de la prohibición absoluta que exige el RAW para Correr sería una desviación silenciosa. | Comprobación adicional específica de esta acción que rechace la ruta si cualquier casilla atravesada es terreno difícil, no solo que la encarezca. |

---

## 5. Estrategia de tests

**Unit (puros, contra `rules.ts`)**:
- Rechaza si ya se usó movimiento, acción estándar, acción de asalto completo o paso de 5' este turno (mismo patrón de pre-checks que Retirada/Carga).
- Rechaza si el combatiente está Disabled (ninguna variante limitada existe — full-round completo bloqueado).
- Rechaza si el combatiente tiene el trait/override `FORBID_RUN` (Fatigado).
- Presupuesto correcto: ×4 con armadura ligera/media o sin armadura, ×3 con armadura pesada — calculado sobre la velocidad efectiva (con Prisa aplicada en el caso de prueba).
- Rechaza rutas que no sean estrictamente en línea recta.
- Rechaza absolutamente cualquier ruta que atraviese una casilla de terreno difícil (no solo la encarece).
- No permite paso de 5' en el mismo asalto.
- Con la dote de Correr: conserva el bonificador de Destreza a la CA durante el resto del asalto; sin la dote: lo pierde (con la simplificación de D-3 documentada explícitamente en el test, para que quede trazable si más adelante se decide una supresión más granular).

**Integration (servidor)**:
- Comando completo válido: mutación exacta de economía (movimiento + marcador de asalto completo, sin campos nuevos fuera de alcance).
- Ownership: rechaza si el actor no controla al combatiente.
- Payload inválido (Zod) rechazado en runtime.
- Regresión: Carga, Ataque Completo, Retirada y movimiento normal siguen intactos (mismo patrón de suite de no-regresión usado en Retirada).

**E2E (WebSocket)**:
- Flujo completo cliente-servidor de Correr, mismo patrón que el E2E de Retirada — diferido a validación en Windows por la limitación ambiental ya documentada en sprints anteriores (esbuild/tsx).

**Casos RAW límite**:
- Línea recta obligatoria (zigzag rechazado aunque respete el presupuesto de distancia).
- Armadura pesada → ×3, no ×4.
- Fatigado → bloqueado por completo.
- Disabled → bloqueado por completo (sin variante limitada).
- Terreno difícil en cualquier punto de la ruta → bloqueado por completo, no solo encarecido.
- Combinado con Prisa → el presupuesto ya incorpora el bono sin cálculo adicional.
- Intento de paso de 5' en el mismo asalto → rechazado.
- Intento tras ya haber usado movimiento/acción estándar/asalto completo este turno → rechazado.

---

## 6. Plan de implementación

*(Embebido en este documento por política de Sprint 040 — no se crea un `implementation_plan.md` temporal separado; esta es una feature de un único documento persistente, por lo que no se crea una carpeta `docs/designs/run/`.)*

**Alcance acotado de esta slice** (pendiente de ratificación en la revisión): un único asalto de Correr — presupuesto ×4/×3, línea recta, sin paso de 5', prohibición absoluta de terreno difícil, gate de Disabled y `FORBID_RUN`, pérdida de Destreza (con la simplificación de D-3) salvo dote de Correr. **Fuera de esta slice**: D-2 (resistencia multi-asalto) y D-4 (visión/Cegado).

Pasos, pequeños y verificables:

1. **Tests primero (rojo)**: escribir los casos unitarios de §5 contra el estado actual del paquete compartido, confirmando que fallan por ausencia de la funcionalidad (no por errores de fixture).
2. **Catálogo de dotes**: agregar la dote de Correr al catálogo declarativo, con su contribución (conservar Destreza al correr), siguiendo el mismo patrón ya usado por Disparo Preciso. Verificar que el catálogo sigue compilando y que las dotes existentes no cambian de comportamiento.
3. **Contratos compartidos**: agregar la variante de Correr a la unión discriminada de `use-tactical-action` (tipo y esquema Zod), siguiendo exactamente el mismo patrón que la variante de Retirada.
4. **Gate puro**: agregar la función de validación análoga a la de Carga (consume `FORBID_RUN`, el gate de Disabled, la economía de turno) y el cálculo del presupuesto ×4/×3 sobre la velocidad efectiva.
5. **Prohibición de terreno difícil**: agregar la comprobación adicional específica de esta acción (rechazo absoluto, no recargo) reutilizando el mismo predicado de terreno difícil ya usado en otras validaciones, sin alterar el comportamiento del movimiento normal.
6. **Servidor**: agregar el handler de la nueva sub-acción siguiendo el mismo patrón que el handler de Retirada — validar todo antes de mutar, commit atómico de posición + economía + modificador de postura temporal, sin tocar `movementCommands.ts`.
7. **UI**: botón + preview ×4/×3, mismo patrón visual que el de Retirada/Carga, sin lógica de reglas en React.
8. **Tests verdes**: confirmar que los tests del paso 1 pasan, agregar los de integración de servidor.
9. **Validación**: `npm run typecheck`, `npm test` (o el subconjunto ejecutable en el entorno disponible), `npm run build`, E2E cuando el entorno lo permita.
10. **Documentación**: sincronizar `docs/rules/registry.md` (nueva fila `MOVE-RUN`), `.ai/coverage/RULES_PHB_CHECKLIST.md` y `FEATS_PHB_CHECKLIST.md` (marcar Correr/dote de Correr según lo efectivamente entregado), `PROJECT_STATUS.md`, `TODO.md`, `.ai/PROJECT_MEMORY.md`, `walkthrough.md`.

**Criterio de detención**: con este NDD aprobado, detener y esperar `Proceed` explícito antes de escribir cualquier test o código.

---

## 7. Alternativas descartadas

- **Modelar Correr como un modo de `move-combatant`** en vez de sub-acción de `use-tactical-action`: rechazada por inconsistencia con el precedente ya fijado (Carga y Retirada son sub-acciones de `use-tactical-action`, no modos de movimiento).
- **Resolver D-2 en esta misma slice**: rechazada por sobre-alcance — contradice el pedido explícito de una slice pequeña y de bajo riesgo, e introduce estado persistente entre turnos sin necesidad inmediata.
- **Construir ya una supresión granular de solo-Destreza (D-3)** en vez de documentar la simplificación de reutilizar la supresión conjunta existente: pospuesta a la revisión — no se asume la respuesta sin decisión explícita.

---

## 8. Implementación (PROCEED, decisiones D-1 a D-5 cerradas)

**Estado**: implementado y validado dentro de los límites del entorno de este sprint (ver Validación). TDD aplicado: 21 tests puros verdes (`tests/run.test.mjs`) más 18 tests de integración de servidor escritos (`tests/run-server.test.mjs`), cuya ejecución directa está bloqueada en el sandbox Linux por la misma limitación pre-existente de `tsx`/esbuild (binario nativo `win32-x64` en `node_modules`, documentada en sprints anteriores) — typecheck estricto de servidor y shared con el handler ya integrado pasa sin errores, lo cual es la señal de corrección disponible en este entorno; ejecución real de `tests/run-server.test.mjs` queda pendiente en Windows.

**Cambios de arquitectura reales vs. lo previsto en el diseño**:
- El gate puro `canRun` y el cálculo de presupuesto `runSpeedBudgetFeet`/`runSpeedMultiplier` se implementaron en `packages/shared/src/rules.ts` (Rule Engine), no en un resolver de servidor como su análogo `canCharge` (que vive en `apps/server/src/combat/chargeResolver.ts` por razones históricas, no arquitectónicas). Esta es una desviación deliberada respecto del paralelo con Carga, justificada por el principio de gobernanza del proyecto: "toda la lógica de reglas debe permanecer en funciones puras del Rule Engine; la UI y el servidor no contienen reglas". No afecta a Carga (sin cambio de comportamiento).
- La geometría de línea recta (`buildStraightPath`), antes privada y duplicada dentro de `chargeResolver.ts`, se consolidó como función pura exportada en `rules.ts` y ahora es la única fuente de verdad; `chargeResolver.ts` la importa desde `@dnd-tactical/shared` en vez de mantener su propia copia. Sin cambio de comportamiento para Carga (verificado con test de regresión R18).
- El servidor deriva el camino canónico de Correr desde la posición actual del combatiente hasta `to` (`buildStraightPath`); el comando `use-tactical-action`/`run` no acepta ningún campo `path` del cliente (a diferencia de Retirada), eliminando la necesidad de validar que un camino enviado por el cliente sea realmente recto.
- Terreno difícil se rechaza de forma absoluta reutilizando los `occupiedCells` ya calculados por `validateMovePath` en cada paso (mismo dato que ya usa Retirada para su comprobación de bloqueo), sin una función pura nueva dedicada solo a esto.
- Se omite `applyDisabledExertion` en el handler de Correr: un combatiente Disabled nunca alcanza la fase de commit (rechazado siempre por `canRun` vía `canDisabledCombatantTakeAction(..., "full-round")`), a diferencia de Carga/Retirada/Ataque Completo, que sí permiten a un Disabled actuar bajo variantes limitadas.

**Validación**:
- `npm run typecheck` (shared + web + server): verde, sin errores, con todo el código de Correr integrado.
- `node --test tests/run.test.mjs`: 21/21 verde (capa pura: `canRun`, `runSpeedMultiplier`, `runSpeedBudgetFeet`, `buildStraightPath`, `FeatCatalog.runContribution`/`srd_run`).
- `npm test` / `tests/run-server.test.mjs` (integración de servidor, 18 casos escritos): bloqueado en este sandbox por el binario nativo de esbuild (`@esbuild/win32-x64` presente, `@esbuild/linux-x64` ausente) — limitación ambiental ya documentada en sprints previos (ATK-RIM, MOVE-WITHDRAW), no relacionada con la corrección del código. Pendiente de ejecución real en Windows.
- `npm run build:web`: bloqueado por la misma familia de problema (binario nativo de Rollup faltante para Linux en este sandbox) — no relacionado con el código de Correr. `npm run build:server` sí compila limpio (tsc puro, sin dependencia de esbuild).
- `node scripts/e2e-websocket.mjs` y `npm run test:ui` (Playwright): no ejecutados en este sandbox por la misma familia de limitación (requieren el mismo toolchain nativo); quedan pendientes de validación en Windows, como en sprints anteriores.
- Regresión: se ejecutó la suite completa de tests puros (`tests/*.test.mjs` sin dependencia de `tsx`) antes y después de los cambios de este sprint; los mismos 11 fallos preexistentes aparecen en ambos estados (idénticos, incluida su causa), confirmando que son ajenos a MOVE-RUN y no una regresión introducida aquí.

**Dictamen de esta sección**: implementación completa según el alcance acotado (§6), typecheck estricto verde, tests puros verdes, tests de servidor escritos pero no ejecutables en este entorno — consistente con el patrón ya aceptado en sprints anteriores para este mismo sandbox.
