# Project Status

Este documento es una foto del estado actual. La guia principal del proyecto es `CODEX_GUIDE.md`.

Proyecto: D&D 3.5 Tactical Combat Assistant

Ruta local:

`C:\Users\lucia\OneDrive\Documentos\dnd-tactical-combat-assistant`

## Proceso de Trabajo (Sprints)

El desarrollo del proyecto está organizado en **Sprints**.
Existen dos tipos:
- **Sprints Arquitectónicos**: Enfocados en infraestructura, deuda técnica y reorganización documental (Ej. Sprint 001).
- **Sprints Funcionales**: Enfocados en implementar reglas del motor (Ej. Conditions, Critical Hits).

Todo cambio requiere:
- Aprobación explícita del diseño.
- Plan de implementación.
- Validación final de DoD (Build, Typecheck, Unit Tests, E2E).

## Hecho

- Monorepo con `npm workspaces`.
- Frontend React + Vite en `apps/web`.
- Servidor Express + WebSocket en `apps/server`.
- Paquete compartido TypeScript en `packages/shared`.
- Roles de GM y jugador.
- Ownership/control de combatientes validado en servidor.
- Conexion desde celular usando el hostname de la pagina cuando no existe `VITE_WS_URL`.
- Salas locales en memoria.
- Fases de encuentro (`EncounterPhase`):
  - `preparation`
  - `active`
  - `opportunity-resolution`
  - `critical-confirmation`
  - `finished`
- Función centralizada `syncEncounterPhase(room)` para evitar estados inválidos.
- Tablero tactico, tokens con posicion unica y bloqueo de casillas ocupadas.
- Preparacion con carga de heroes/enemigos, posicionamiento e iniciativas.
- Seleccion automatica del combatiente activo.
- Acciones por menu: Ver, Mover, Atacar, Habilidad, Tacticas.
- Movimiento por ruta paso a paso.
- Coste diagonal 5/10/5/10 ft.
- Overlays:
  - verde para movimiento.
  - rojo para amenaza melee.
  - naranja para alcance a distancia/arrojadizo.
  - dorado para rutas previstas.
- Ataque simple, ataque completo y luchar a la defensiva.
- Ataques a distancia con incrementos de alcance.
- D20 y danio manual o automatico.
- Defensa total.
- Carga con ruta prevista.
- Prestar ayuda con buff pendiente de eleccion.
- **Fase Actual:** Sprint 052B.1, corrección geométrica de Line of Effect — `getLineOfEffect` modelaba cada celda bloqueadora como un punto (ancla entera) y probaba colinealidad exacta; corregido a un recorrido "supercover" por área de celda (aritmética entera, sin coma flotante), con política explícita para cruces por borde y por vértice.
- **Estado:** ✅ Aplicar/remover condiciones desde la UI real · ✅ onStack delegado íntegramente a `EffectManager` · ✅ Legalidad de objetivo (Line of Effect) antes de tirada/mutación en `resolve-attack`, con geometría corregida · ✅ 510/510 unitarias · ✅ 99/99 WebSocket · ✅ Playwright 7/7.
- **Hitos Completados Recientes:**
  - `Sprint 052B.1`: corrección geométrica de `getLineOfEffect` (recorrido "supercover" por área de celda en vez de colinealidad exacta de punto), 29 casos nuevos en `tests/line-of-effect.test.mjs` (matriz de 4 pendientes, política de bordes/vértices, footprints 1×1/Large/ambos Large), todos verificados empíricamente contra la implementación real.
  - `Sprint 052B`: `LineOfEffectAssessment`/`getLineOfEffect` independientes de Cover, `DEFENSE-LINE-OF-EFFECT` (Parcial, solo ataques físicos ordinarios), corrección de `getAttackLineInterception`/`buildCoverAssessment` (Cover ahora es solo por interposición de criaturas, no por `impassableCells`).
  - `Sprint 052A`: auditoría de semántica de terreno — confirmó que la extensión de `impassableCells` a Cover (Sprint 042) nunca tuvo NDD dedicado; recomendó separar movimiento de Line of Effect (Opción A).
  - `Sprint 046`: contrato especializado `ConcealmentContribution`, reducción determinista con stacking/trazas, `ConcealmentAssessment` compartido, resolución porcentual autoritativa y preview UI sin RNG de cliente.
  - `Sprint 045`: `srd_entangled` declarativo (-2 ataque, -4 DEX, velocidad ×1/2, `FORBID_RUN`, `FORBID_CHARGE`), contrato especializado `MovementRateContribution`, deduplicación/trazas y preview isomorfo.
  - `Sprint 042`: Cover canónico en `getAttackContextModifiers`, criaturas y obstáculos de casilla, footprints deterministas y consumo uniforme por armas, touch, AdO, maniobras y UI.
  - `Sprint 030`: Escape de Presa autoritativo, rangos de habilidades V6, restricciones de armas en agarre, penalizador melee etiquetado y preview UI compartido.
  - `Sprint 029`: primitivas genéricas de toque/oposición, vínculo contextual `srd_grappling`, Presa transaccional y preview UI de modificadores.
  - `Sprint 028`: compresión Large 2×1/1×2 derivada, penalizadores contextuales, movimiento forzado puro, Embestida transaccional y preview UI de trayectoria/footprint.
  - `Sprint 027`: geometría rectangular efímera, distancia O(1), flanqueo por footprints completos, índice local de ocupación y trazas de AdO consolidadas.
  - `Sprint 026`: inventario por instancias, ranuras V5, persistencia/migración V5, munición autoritativa transaccional, equip/unequip, AUTO servidor y UI de stock.
  - `Sprint 025-R`: proyección vital canónica, Diehard, Stand Up seguro y preview isomorfo.
  - `Sprint 025-A`: huellas derivadas multicelda, flanqueo por caras, movimiento/colocación autoritativos y tokens Large 2×2 interactivos; preservado tras la repriorización.
  - `Sprint 024`: salvaciones automáticas autoritativas, mitigación `half`/`negates`, commit transaccional de lanzamiento y preview compartido.
  - `Sprint 022`: Mecánica de Stand Up con AdO incondicional (sin piruetas) y Percentile Roller puro.
  - por abandonar amenaza.
  - por ataque a distancia amenazado.
  - multiples AdO contra el mismo objetivo.
  - bloqueo de flujo hasta resolver/limpiar.
  - resolucion contra snapshot de la casilla abandonada.
- Estados de vida:
  - active.
  - disabled.
  - dying.
  - stable.
  - dead.
- HP hasta -10 y muerte a -10.
- Estabilizacion con limite de un intento por turno.
- Cure Light Wounds, Haste y Magic Missile demo.
- Resultado de Victoria/TPK y pantalla de estadisticas.
- Panel GM:
  - curar.
  - ajustar HP.
  - cambiar estado.
  - limpiar AdO.
  - forzar resultado.
  - nota al log.
  - reposicionar tokens respetando casillas ocupadas.
- Editor de perfiles en `/profiles`, separado del combate.
- Persistencia de perfiles en localStorage.
- Agregar perfiles guardados al combate.
- Catalogo oficial de equipamiento en `packages/shared/src/data/equipment`.
- `EquipmentCatalog` como API para armas, armaduras y escudos.
- Perfiles guardan IDs de equipo, no objetos completos.
- Estadisticas base separadas de estadisticas derivadas:
  - `baseSpeedFeet`, características, tamaño, equipo y defensa intrínseca son fuentes.
  - CA, ataque, velocidad efectiva y daño medio se consultan mediante reglas/selectores y no se cachean en el snapshot.
- Primera version de `CombatantSnapshot`/`CombatSnapshot`:
  - perfiles permanentes se convierten en estado temporal de combate.
  - HP actual, iniciativa, buffs, posicion y stats viven en el snapshot.
  - ownership se asigna en servidor.
  - derivados se recalculan desde IDs de catalogo.
- Tests automatizados con `npm test`.
- E2E WebSocket en `scripts/e2e-websocket.mjs`.
- Sistema de críticos completo:
  - amenaza configurable por arma.
  - confirmación con modificador de ataque (no total).
  - multiplicador de daño.
  - cancelación aplica daño normal.
- Catálogo unificado y sistema de efectos activos (`ActiveEffects` / `CombatRulesSnapshot`):
  - Catálogo productivo único y verificable en runtime (`effects/catalog.ts`).
  - Evaluador de reglas desacoplado (`RulesEngine`).
  - Traits inyectables (Ej: `CANNOT_ACT`, `NO_DEX_TO_AC`, `CANNOT_MAKE_AOO`).
  - Penalizadores y bonos apilables (Stacking).
  - Soporte de duración y expiración (`durationPreset` y Tick Layer).
  - Inyección y eliminación GM (`gm-apply-effect`).
  - Condición implementada: `srd_stunned` (Sprint 006).
  - Condición implementada: `srd_flat_footed` con ciclo de vida automático vía `sort-initiative` (Sprint 007).
  - bloqueo de flujo durante confirmación.
  - críticos en ataques de oportunidad.
- Validación runtime de comandos WebSocket con Zod:
  - schemas por dominio en `packages/shared/src/schemas/commands/`.
  - `validateClientCommand` en `apps/server/src/validation/`.
  - errores seguros sin stack trace.
- Flanqueo:
  - bonus táctico dinámico calculado puros (+2 ataque).
  - validación estricta de alcance, estado y posición.
- Paso de 5 pies (5-foot step):
  - acción táctica explícita que consume 5 ft de movimiento pero no la acción de movimiento.
  - reposicionamiento libre sin ataques de oportunidad.
  - compatible con ataque completo.
- Ataque Completo Formal e Iterativos:
  - Rutinas iterativas calculadas puramente basadas en BAB.
  - El límite de ataques por turno se incrementa automáticamente (hasta 4 ataques).
- Sprint 048 (Helpless Combat & Coup de Grace):
  - Integración completa del ataque "Coup de Grace" a través del servidor.
  - Interrupción asíncrona de ataques de oportunidad.
  - Resolución automática de golpes críticos.
  - Validaciones robustas de E2E WebSockets pasadas.
  - Bloqueo dinámico si se usó la acción de movimiento normal (el 5-foot step sigue permitido).
  - UI interactiva mostrando el progreso y penalizadores iterativos.
  - Modo Explícito de Ataque Completo: el jugador declara la intención (Estándar o Completo, más Lucha a la Defensiva opcional) antes de consumir la acción.
  - El consumo real de la acción (Estándar o Asalto Completo) ocurre sólo al resolver el primer ataque.
- Esfuerzo de Incapacitado (Disabled Effort) centralizado:
  - Helper pura de validación para economía de acciones (una acción estándar o de movimiento).
  - Muta HP de manera segura sin logs, interceptado correctamente en tácticas, ataques y movimientos.
- Sistema Base de Efectos Activos (ActiveEffects):
  - Catálogo puramente declarativo y sin lógica acoplada (EFFECTS-SYS-CATALOG).
  - Gestor inmutable de mutaciones y copias defensivas (EFFECTS-SYS-CORE).
  - Tick Layer funcional sin registro global, basado en Event Bus (EFFECTS-SYS-TICK).
  - Identidad temporal monotónica vía eventSequence.
  - Expiración inmutable delegada (until_turn y rounds).
- Sprint 009 — Clase de Armadura Desglosada:
  - `armorClassBreakdown` tipado y persistido en snapshots nuevos.
  - proyecciones Normal AC, Touch AC, Flat-Footed AC y Touch + Flat-Footed mediante `Rules.totalArmorClass`.
  - Touch filtra armor, shield y natural armor; Flat-Footed filtra Destreza positiva y dodge.
  - penalizadores de Destreza se conservan.
  - los fallbacks legacy de este sprint fueron retirados por Sprint 010.
  - servidor autoritativo: `targetAcType` se deriva de la fuente catalogada y no existe en el comando WebSocket.
  - UI muestra las tres variantes defensivas en el panel del combatiente seleccionado.
- Sprint 010 — Migración total y ataques de toque reales:
  - perfiles V2 persisten únicamente fuentes: características, tamaño, BAB, velocidad base, equipo, dotes, defensa intrínseca y aptitudes.
  - migrador Zod V0/V1→V2 con backup, idempotencia, validación de catálogos y cuarentena explícita.
  - todas las criaturas integradas producen snapshots con `armorClassBreakdown` obligatorio; Canocrock usa defensa y ataque natural explícitos.
  - `SizeRulesCatalog` separa modificadores de ataque/CA, Presa, espacio y alcance.
  - Shocking Grasp y Ray of Frost usan el resolver común contra Touch AC; Magic Missile continúa como impacto automático.
  - `resolve-ability-attack` no acepta `targetAcType`, característica ni bonus de ataque enviados por el cliente.
- Sprint 011 — Flanqueo y Amenaza:
  - `ThreatProfile.meleeSources` se deriva al crear el snapshot desde equipo y ataques naturales catalogados; el snapshot valida y congela la capacidad.
  - `threatensTarget` unifica facción, estado vital, `NO_THREAT`, fuentes melee y alcance para flanqueo y detección de AdO.
  - `isFlanking` aplica oposición exacta por caras sobre la huella derivada del defensor, conservando los casos 1×1 y habilitando Large 2×2.
  - `getAttackContextModifiers` separa melee (+2 circunstancial) de ranged (+0); servidor y React consumen el mismo helper sin flags de red.
  - ataques normales, iterativos, AdO, carga y aptitudes con tirada reciben el contexto antes de `resolveAttack`; el resolver permanece ajeno al espacio.
  - la daga amenaza a 5 ft aunque pueda lanzarse; Flat-Footed conserva amenaza, mientras `NO_THREAT` la elimina.
- Sprint 012 — Ataque Furtivo y purga legacy:
  - eliminados de `CombatantSnapshot`, producción, fixtures y E2E los cuatro caches escalares prohibidos; un guard de tipos impide reintroducirlos.
  - snapshots fuente-first conservan equipo, defensa intrínseca, anatomía, tipo y features; la creación falla de forma descriptiva si faltan fuentes V3.
  - persistencia elevada a StoredProfile V3 con schema Zod estricto, backup, migración idempotente de casos inequívocos y cuarentena para perfiles opacos.
  - `CreatureTypeCatalog` inyecta traits inmutables; undead y construct son inmunes a críticos y daño de precisión.
  - Bane deriva `sneakAttackDice: 1` desde `srd_sneak_attack_1d6`; la UI de perfiles permite seleccionar tipo racial y progresión de Ataque Furtivo.
  - `canApplySneakAttack` centraliza flanqueo/DEX negada, inmunidades y límite ranged de 30 ft.
  - `DamageBundle` separa base y precisión; el servidor tira Nd6, aplica HP y loguea el desglose. `neverMultiply` mantiene la precisión lineal en críticos.
- Sprint 013 — Cobertura y Alcance Dinámico (Dynamic Reach):
  - Cobertura (+4 AC) implementada vía intercepción geométrica efímera calculada en `getAttackLineInterception`.
  - El modificador se aplica en `AttackContext` sin polucionar `CombatRoom` ni la CA estática de la criatura.
  - Alcance dinámico (Dynamic Reach) modelado en `MeleeThreatSource` usando `minReachFeet` y `maxReachFeet`. Armas como *Longspear* ahora amenazan a 10 pies, pero no a 5 pies.
  - Frontend despliega advertencias visuales de "Cobertura (+4 AC)" si hay un aliado en la línea de visión al declarar el ataque.
- Sprint 014 — Condiciones V3 Formales:
  - Implementación de `Fatigued`, `Prone`, `Dazed` y `Paralyzed` con lógica de sobrescritura de características.
  - Integración de `getEffectiveAbilityScore` y nuevas pruebas de regresión.

### FASE ACTUAL: Sprint 050.1 — Panel de Estados del GM

  **Sprint 050 (diseño/auditoría) + Sprint 050.1 (implementación) — panel administrativo de ActiveEffects**
  - Diseño y auditoría (`docs/designs/gm-condition-panel.md`, Sprint 050): confirmó que `gm-apply-effect` ya era genérico y ya delegaba el 100% del stacking a `EffectManager`/`severityChain` (Sprint 049) — no requería cambios. Única pieza de infraestructura faltante identificada: un comando simétrico de remoción por `instanceId`.
  - **Comando nuevo**: `gm-remove-effect { roomCode, actorId, instanceId }` (`types.ts`, `schemas/commands/gmCommands.ts`, `dispatcher.ts`, `handleGmRemoveEffect` en `gmCommands.ts`). Remoción exclusivamente por `instanceId` — nunca por `effectId` (ambiguo ante múltiples instancias) ni por `sourceId` (no siempre poblado).
  - **`gm-apply-effect` reutilizado sin ningún cambio de semántica.**
  - UI: nueva sección "Condiciones de {combatiente}" dentro de `GmPanel.tsx` (ya gateado por `participantRole === "gm"` en `ActionsPanel.tsx`, igual que el resto del panel). Lista vía `EffectQueries.getByTarget` + `effectsCatalog` (sin reimplementar filtros), selector de aplicación filtrado únicamente por ausencia de bloque `hazard` (sin blacklist manual por ID — incluye 13 de los 15 efectos del catálogo), duraciones limitadas a los presets reales (`Permanente`/`until_target_turn_end`).
  - La UI nunca decide stacking: envía el `effectId` solicitado y refleja el `room-update` resultante — auditado que ningún archivo nuevo contiene `effectId ===`, `onStack`, `upgradeTo` ni `severityChain`.
  - Fuera de alcance (sin cambios): descanso/1h, Lesser Restoration/Restoration, clima, viajes, conjuros, condiciones nuevas, edición manual de `duration`/`source`/`stacks`, remoción masiva o por `effectId`.
  - **Validación real ejecutada (2026-07-24)**: `npm test` **478/478**, `npm run typecheck` 0 errores (3 workspaces), `npm run build` los 3 en verde, `node scripts/e2e-websocket.mjs` **98/98** aserciones exit 0, `npm run test:ui` **7/7** escenarios Playwright (nuevo: aplicar/remover una condición desde el Panel GM real).
  - Sin Rule ID nueva (tooling administrativo, no regla de D&D) y sin cambios en `docs/rules/registry.md`.

### HISTÓRICO: Sprint 049 — EFFECT-EXHAUSTED + corrección de `onStack` (DT-022)

  **Sprint 049 — implementación funcional de Exhausted y consumo real de `onStack`**
  - Nueva condición `srd_exhausted` (`effects/catalog.ts`): -6 STR/-6 DEX, velocidad ×1/2, `FORBID_RUN`/`FORBID_CHARGE` — mismo patrón declarativo que Fatigued/Entangled/Blinded.
  - `srd_fatigued` ahora declara `onStack:"upgrade_to"` hacia `srd_exhausted`, modelando la regla SRD "un personaje Fatigado que vuelve a sufrir fatiga queda Exhausto en su lugar".
  - **Hallazgo y corrección de infraestructura (DT-022)**: `EffectDefinition.onStack` estaba declarado desde Sprint 003 pero ningún consumidor lo leía — `EffectManager.add` era puramente aditivo. `tests/conditions-v3.test.mjs` ya documentaba el síntoma para Prone (dos instancias duplicaban el penalizador de CA) sin corregirlo. `EffectManager.add` ahora resuelve `onStack` mediante `severityChain` (cadena de severidad vía `upgradeTo`): reaplicar el mismo efecto respeta su política declarada, un efecto más débil se reemplaza por uno más severo de la misma cadena, y un efecto ya-superado por algo más severo se descarta como redundante — sin lógica en fuentes/handlers/hazards individuales.
  - Corrige un bug real y alcanzable: `srd_poison_gas_hazard` reaplicaba `srd_fatigued` cada ronda que el objetivo fallaba su salvación; sin este fix, tres fallos consecutivos sumaban -6 STR/-6 DEX en vez de escalar correctamente a Exhausted.
  - `EffectDefinition.onStack` angostado de 4 a 2 valores (`"ignore" | "upgrade_to"`) tras auditoría normativa confirmando que `"replace"`/`"accumulate"` no tienen respaldo oficial en este dominio.
  - Fuera de alcance, documentado explícitamente: recuperación Exhausted→Fatigued tras 1h de descanso (depende del paso del tiempo, no de aplicación de efectos).
  - **Validación real ejecutada (2026-07-23)**: `npm test` **467/467**, `npm run typecheck` 0 errores (3 workspaces), `npm run build` los 3 en verde, `node scripts/e2e-websocket.mjs` **93/93** aserciones exit 0 (sin regresión), `npm run test:ui` **6/6** escenarios Playwright.
  - Registry: nueva Rule ID `EFFECT-EXHAUSTED` (Completo); `EFFECT-FATIGUED` anotado con la transición.

### HISTÓRICO: Sprint 048 — Helpless Combat & Coup de Grace (cerrado formalmente)

  **Sprint 048 — implementación funcional de Helpless & Coup de Grace**
  - Implementación completa de la acción "Coup de Grace" a través de comandos tácticos en el servidor (`handleCoupDeGrace`, `handleResumeCoupDeGrace`), con validador `isValidCoupDeGraceTarget` y ejecución (`resolveAutomaticCritical` + salvación de Fortaleza CD 10+daño o muerte instantánea).
  - Provocación y manejo asíncrono de Ataques de Oportunidad mediante `pendingCoupDeGrace` (mismo patrón interrumpir/reanudar que Withdraw/Charge).
  - `getDefensiveAbilityProjection` (`rules.ts`) reemplaza el parche ad-hoc de "diferencial de Destreza" en `totalArmorClass` por un cálculo declarativo único que cubre `HELPLESS` (Destreza 0/-5), `NO_DEX_TO_AC` y Flat-Footed sin `if (effectId === ...)`.
  - Reutiliza el trait `HELPLESS` ya existente (otorgado por `srd_paralyzed`, Sprint 014) — cero efectos de catálogo nuevos.
  - **Validación real ejecutada en el cierre de este trabajo (Sprint 044.1→048, 2026-07-18)**: `npm test` **457/457**, `npm run typecheck` 0 errores (3 workspaces), `npm run build` los 3 en verde, `node scripts/e2e-websocket.mjs` **93/93** aserciones exit 0, `npm run test:ui` **6/6** escenarios Playwright.
  - Registry: nueva Rule ID `MANEUVER-COUP-DE-GRACE` (Completo) en `docs/rules/registry.md`; de paso se corrigió una fila `EFFECT-BLINDED` duplicada y mal formada que había quedado fuera de la tabla.

### HISTÓRICO: Sprint 047.1 — EFFECT-BLINDED (Core cerrado)
  - `srd_blinded` implementado: -2 AC, pérdida de bono de Destreza a la CA, -4 en interacciones físicas.
  - Velocidad reducida a 1/2 y prohibición de correr y cargar (FORBID_RUN, FORBID_CHARGE).
  - Los ataques propios fallan un 50% de las veces por Concealment automático (Total Concealment del blanco).
  - La ceguera otorga Ocultamiento Total (Concealment 50%) a los enemigos.
  - Validación local: typecheck 3/3 workspaces, build 3/3, unitarias verdes, E2E verdes.
  - Sprint 047.1 ejecutó la auditoría y cierre formal garantizando la sincronización arquitectónica de `ConcealmentAssessment`.
  - Registry: `EFFECT-BLINDED` queda **Parcial — falta Vision/Targeting**.

### HISTÓRICO: Sprint 046 — DEFENSE-CONCEALMENT (infraestructura validada)

  **Sprint 045 — implementación funcional acotada**
  - `srd_entangled` aporta únicamente -2 a ataque, -4 a Destreza, velocidad ×1/2, `FORBID_RUN` y `FORBID_CHARGE`.
  - `MovementRateContribution` modela razones multiplicativas con enteros positivos, `stackingKey`, deduplicación determinista, conflicto explícito y trazas applied/suppressed.
  - `Rules.getMovementSpeedProjection` es la proyección compartida por servidor y React; `totalSpeedFeet` no persiste ni duplica la matemática.
  - El paso de 5 pies usa el gate general velocidad efectiva > tamaño de casilla; terreno difícil continúa en `validateMovePath`.
  - No existe branching productivo por `srd_entangled`; el ID solo aparece en catálogo y pruebas/integraciones.
  - Validación: 440/440 unitarias, typecheck 3/3 workspaces, build 3/3, WebSocket 91/91 y Playwright 6/6.
  - Registry: `EFFECT-ENTANGLED` queda **Parcial — falta Concentration**.

### HISTÓRICO: Sprint 044.2 — Arquitectura del Pipeline de Modificadores

  **Sprint 044.2 — Análisis y diseño exclusivamente documental**
  - Auditoría completa de las rutas reales por las que una regla altera otra: derivación source-first, ActiveEffects estáticos/contextuales, folds de dotes, contexto táctico, handlers, resolvers, `Buff`, restricciones, daño y consecuencias.
  - Pipeline oficial: Intención → Preflight → Operación base → Contribuciones estructurales → Contexto → Proyección efectiva → Resolver → Consecuencias → Commit.
  - Decisión central: una regla base conserva una identidad única; feats, spells, conditions, equipment y size aportan contribuciones especializadas y nunca crean una variante de la regla.
  - Se reutilizan snapshot, reducer, traits/overrides, catálogos, folds, assessments, `DamageBundle`, resolvers y transacciones existentes.
  - Contrato nuevo estrictamente justificado para trabajo futuro: proyección especializada del intento de ataque; el resto son extensiones acotadas de contratos existentes o assessments por dominio.
  - `Buff` queda identificado como ruta general legacy a retirar incrementalmente, no mediante migración masiva.
  - Documento: `docs/designs/modifier-pipeline-architecture.md`. Sin `implementation_plan.md`, código, tests o cambios al Registry.

### ANTECEDENTE: Sprint 045 — Clasificación y recorte arquitectónico

  **Sprint 045 — Reglas Base, Modificadores y Condiciones Restantes**
  - Clasificación formal: regla base, modificador de regla, infraestructura, fuente normativa y estado runtime.
  - `ATTACK-FULL` queda como regla base; Rapid Shot, Haste, Two-Weapon Fighting, ataques naturales y Cleave/Great Cleave se recomiendan como Rule IDs independientes que reutilizan o reaccionan a esa base.
  - El lote “Condiciones Restantes” se descompone por dependencias reales: Concealment/visión, velocidad multiplicativa, skills/Concentration, movimiento obligatorio, caída de objetos y Coup de Grace.
  - Recorte recomendado para implementación: `DEFENSE-CONCEALMENT` como vertical única. Documento: `docs/designs/rule-and-modifier-classification.md`.
  - No se creó `implementation_plan.md`: la vertical recomendada requiere primero una NDD específica y aprobación `Proceed`.

### HISTÓRICO: Sprint 042.5 — Recuperación de Baseline completada; Sprint 042 (Cover) cerrado formalmente

  **Sprint 042.5 — Recuperación del Baseline y Cierre Formal de Sprint 042**
  - Origen: auditoría de baseline Sprint 042-R (2026-07-18) detectó que `npm test` fallaba con 9 casos (7 reales) y que Sprint 042 no podía cerrarse formalmente por ese motivo, además de un gate de CI (`.github/workflows/windows-ci.yml`, agregado fuera del alcance literal de Sprint 042) con conclusión Failure en su primera ejecución real.
  - **Bug real corregido (causa raíz, no parche)**: `packages/shared/src/combatSnapshot.ts::cloneEffectInstances` no propagaba `targetCells` (agregado a `EffectInstance` en Sprint 034) — los hazards ambientales (Muro de Fuego, gas venenoso) estaban inoperantes en cualquier partida real, no solo en tests, desde su introducción. Causa raíz: existe una segunda lista blanca independiente del mismo clonado en `effects/manager.ts::EffectManager.add`, que sí incluía `targetCells`; las dos divergieron. Corregido en paridad exacta con `manager.ts`. Ver DT-021 (`docs/technical-debt.md`).
  - **Auditoría de clones equivalentes**: revisados todos los helpers de clonado del monorepo. `cloneCombatRoom`/`structuredClone` (inmunes por construcción) y la mayoría de `createCombatRulesSnapshot` (spread-based, seguros ante campos nuevos de nivel superior) no tienen el problema. Dos bloques (`board: {...}` y `activeAttackThreat.normalDamageBundle`) usan el mismo patrón de lista blanca sin spread — coinciden con sus tipos hoy, sin bug activo, pero quedan documentados como riesgo latente en DT-021.
  - **Snapshot Integrity robustecido**: `tests/dt-006-snapshot-integrity.test.mjs` gana un caso que arma un `EffectInstance` completo y compara por `assert.deepStrictEqual` contra el clonado del snapshot — verifica comportamiento (¿se preservó todo?), no la lista de campos de la implementación, por lo que cualquier campo futuro no propagado por un clon pondrá este test en rojo automáticamente. Confirmado que detecta el bug original (revertido temporalmente, el test falló con el diff exacto).
  - **Ray of Frost (Sprint 011) — test desactualizado, no bug**: trazabilidad completa confirmada (`combat/06_ataques.txt:58` → Rule ID `ATK-RANGED-INTO-MELEE` → `docs/rules/registry.md` → `getRangedIntoMeleeAssessment`/`getAttackContextModifiers` → `docs/audits/combat-rules-deviations.md` D-11). El motor es correcto: el escenario del test coloca al objetivo enzarzado con un aliado del lanzador, lo que hace que el ataque de toque a distancia herede el -4 "disparo a melé" (extensión deliberada y documentada en `docs/designs/ranged-into-melee-penalty.md`, sección "Regla de Tres"). El test de Sprint 011, anterior a esa regla, esperaba los números viejos. Corregido `tests/sprint011.test.mjs` únicamente; el motor no se tocó.
  - **Withdraw W22 — test mal escrito, no bug**: `assert.throws(..., /a traves de/)` nunca pudo coincidir con el mensaje real (`"...no puede atravesar..."`, sin espacio en esa posición) — probable copy-paste de la rama vecina de esquinas diagonales. `tests/rules.test.mjs:298` ya verificaba correctamente ese mismo mensaje, confirmando que la redacción de producción es estable. Corregido el regex a `/atravesar/`. Revisados todos los demás `assert.throws(...,/regex/)` y `assert.match`/`doesNotMatch` de la suite: no se encontró otro caso con el mismo defecto.
  - **Validación real y completa (2026-07-18, todos ejecutados de punta a punta en esta máquina)**: `npm test` **430/430** (0 fallos — antes 429/420/9), `npm run typecheck` 0 errores (3 workspaces), `npm run build` los 3 workspaces en verde (Vite compila 1660 módulos), `node scripts/e2e-websocket.mjs` **87/87 aserciones, exit 0**, `npm run test:ui` (Playwright, Chromium ya instalado en esta máquina) **5/5 escenarios, 20.3s**. **Los 5 gates del DoD en verde real simultáneamente por primera vez.**
  - **Sprint 042 (Cover) queda cerrado formalmente.**

  **Sprint 042 — Cover**
  - `getAttackContextModifiers` es la sede canónica única: calcula una sola vez la intercepción y devuelve `CoverAssessment` para melee/ranged.
  - Cobertura por criatura de Sprint 013 preservada en +4 CA; obstáculos completos de `impassableCells` conceden el mismo +4 cuando ocupan una celda interior real de la línea discreta. **Corregido en Sprint 052B**: esta extensión nunca tuvo NDD dedicado (Sprint 013 la excluyó explícitamente) y contradecía la existencia real de Cobertura Total en SRD 3.5; `impassableCells` ahora es exclusivamente de movimiento y ya no concede Cover — ver `docs/designs/terrain-cover-line-of-effect-decision.md` y `DEFENSE-LINE-OF-EFFECT` en el Rule Registry.
  - Geometría determinista por footprints: selecciona el par de celdas ocupadas más cercano, inspecciona todas las celdas de bloqueadores Large y ordena resultados independientemente del orden del snapshot.
  - Criatura + terreno no apilan: se conservan ambas evidencias pero se aplica una sola parte `cobertura +4`.
  - Consumidores migrados: armas, conjuros/aptitudes con ataque, touch ranged, AdO, Carga, toque de maniobras y preview React. `resolveAttack` ya no recalcula geometría.
  - Cover permanece efímero: no se persiste en `CombatRoom`, combatientes ni efectos.
  - Validación 2026-07-18 (Sprint 042 original): focalizadas **58/58**, typecheck completo verde, build completo verde, WebSocket **87/87**. Suite global entonces: 429 tests, 420 pass, 9 fail — **ver Sprint 042.5 arriba, ya recuperado a 430/430**.
  - Gate de infraestructura preparado en `.github/workflows/windows-ci.yml`: Windows/Node 22, `npm ci`, validaciones secuenciales completas, espera activa del puerto `3333`, cierre garantizado del servidor y artefactos de fallo. GitHub Actions pasa a ser el gate canónico para validaciones no ejecutables en sandboxes locales.

### Historial inmediato y gates paralelos

  **Sprint 041.5 — Test Infrastructure Cleanup (origen: Auditoría Arquitectónica 2026-07-18)**
  - Alcance exclusivo: cerrar DT-020 (`tests/withdraw-server.test.mjs` no ejecutaba ni un solo test por un import roto). Cero cambios de motor, cero refactors.
  - Corregido el import (`../apps/server/src/validation/index.ts` → `.../validation/validateClientCommand.ts`, línea 4). Al inspeccionar el archivo se encontró un segundo defecto del mismo origen: el caso W24 comparaba `bad.ok`/`good.ok` contra un campo que nunca existió en el contrato real de `validateClientCommand` (`{ success, data|error }`) — corregido a `.success`, sin tocar ninguna otra aserción.
  - Ejecución real (`npx tsx --test tests/withdraw-server.test.mjs`) sigue bloqueada en este sandbox Windows por una causa **no relacionada** con el test: `node_modules/@dnd-tactical/shared` es un symlink de workspace creado en un sandbox Linux distinto (evidenciado por `@esbuild/linux-x64` en `node_modules`) que el Node nativo de Windows no puede resolver (`EACCES` al hacer `realpathSync`) — el mismo `ERR_MODULE_NOT_FOUND` se reproduce idéntico en `tests/rules.test.mjs` y `tests/run-server.test.mjs`, ambos ajenos a este cambio. Verificación sustituta por inspección: el import corregido apunta al único archivo real de `validation/`, con la misma forma de uso que `run-server.test.mjs`/`sprint010.test.mjs`/`websocket-validation.test.mjs`.
  - DT-020 queda **parcialmente resuelta** (defecto original corregido) y abierta solo en su parte de "confirmación de ejecución real" — ver detalle en `docs/technical-debt.md`.

  **Sprint 041 — Correr (Run)**
  - Diseño: `docs/designs/run-design.md` (decisiones D-1 a D-5 cerradas por PROCEED, ver §1 y §8 del documento).
  - Sub-acción `run` de `use-tactical-action` (`apps/server/src/commands/tacticalCommands.ts`, `handleRun`) — `movementCommands.ts` intocado, mismo patrón que Carga/Retirada. El servidor deriva el camino canónico en línea recta desde la posición actual hasta `to`; el comando no acepta `path` del cliente.
  - Movimiento: asalto completo, presupuesto ×4 (×3 con armadura pesada) sobre la velocidad efectiva ya resuelta (`Rules.totalSpeedFeet`, hereda Prisa/penalizador de armadura sin cálculo adicional). Sin paso de 5' en el mismo asalto. Terreno difícil: rechazo absoluto (no solo recargo de coste, a diferencia del movimiento normal). Disabled: sin variante limitada — ninguna vía legal para correr (a diferencia de Retirada).
  - AdO (D-1): sin exención de huella inicial — se reutiliza la generación normal por camino, sin evento adicional artificial (a diferencia de Retirada, que sí exime su huella inicial).
  - Destreza/Esquiva (D-3): se reutiliza `NO_DEX_TO_AC` (nuevo efecto de catálogo `srd_running_exposed`), aplicado con duración `until_turn`/inicio del propio próximo turno, salvo que el combatiente tenga la dote de Correr.
  - Dote de Correr (D-5): `FeatCatalog` (`runRules.keepsDexBonusWhileRunning`, feat `srd_run`), consumida por `handleRun` para omitir la supresión de Destreza/Esquiva.
  - Fuera de alcance (D-2, D-4): resistencia multi-asalto (Constitución/CD creciente/descanso) y bloqueo por visión/Cegado — diferidas explícitamente, registradas como deuda técnica (`docs/technical-debt.md` DT-018, DT-019).
  - Consolidación arquitectónica: `buildStraightPath` (geometría de línea recta, antes privada y duplicada en `chargeResolver.ts`) se movió a `packages/shared/src/rules.ts` como función pura exportada — única fuente de verdad, reutilizada por Carga y Correr sin cambio de comportamiento (verificado con test de regresión).
  - UI: botón "Correr (×4/×3 velocidad)" en el panel de movimiento (mutuamente excluyente con "Retirarse"), preview con presupuesto ×4/×3 según categoría de armadura; cero lógica de reglas en cliente.
  - Tests: `run.test.mjs` + `run-server.test.mjs` — **37/37 en verde real** (`npx tsx --test`, ambos archivos, capa pura y capa servidor). Typecheck estricto (shared+web+server) en verde. `build:shared`/`build:web`/`build:server` los tres en verde (Vite/Rollup compilan 1660 módulos). `node scripts/e2e-websocket.mjs` contra servidor real (`npx tsx apps/server/src/index.ts`): **87/87 aserciones, exit 0**. Suite completa (52 archivos, 405 tests): 394 pass, 11 fail — los 11 verificados vía `git worktree` sobre el commit previo a este sprint como **pre-existentes, ninguno de MOVE-RUN** (detalle en `walkthrough.md`). Único punto aún bloqueado: `npm run test:ui` (Playwright), por falta de librerías nativas de Chromium instalables solo con `apt`/root (no por Rollup, ya resuelto). **DoD prácticamente completo** — ver "Cierre del gate ambiental" en `walkthrough.md` (2026-07-18). Hallazgo colateral: `tests/withdraw-server.test.mjs` (Sprint MOVE-WITHDRAW) tiene un import roto que le impide ejecutar ni un solo test desde su creación — registrado como DT-020, no es una regresión de Correr.

  **Sprint 040 — Document Architecture Cleanup (gobernanza documental, sin cambios de motor)**
  - Diseño: `docs/designs/document-architecture-cleanup.md` (Rev. 2, con auditoría, convención híbrida de designs, 5 diffs semánticos resueltos, plan de migración por lotes).
  - **Lote A ✅**: `.gitignore` corregido (`implementation_plan.md` deja de ignorarse — nunca fue política aprobada); Withdraw migrado a `docs/designs/withdraw/` (`design.md`, `analysis.md`, `implementation-plan.md`); autoridades documentales actualizadas (`GOVERNANCE.md` = principios, `AGENTS.md` = flujo/DoD, `.ai/WORKFLOW.md` = resumen navegable); índices completados (`INDEX.md`, `.ai/README.md`); 7 huérfanos eliminados (`output.txt`, 5 scripts `fix*.js`, `rewrite-rules.js`). Commit `5837d7c`.
  - **Lote B ✅**: reclasificaciones inequívocas — `ADR-0008-Temporal-Anchor-Semantics.md` → `docs/adr/ADR-0008-temporal-anchor-semantics.md`; `combat-rules-deviations.md` → `docs/audits/`; `combat-documentation-integration.md`, `rule-engine-integration.md` → `docs/architecture/`; familia ActiveEffects (`effects-system-architecture.md`, `effects-tick-layer.md`, `effect-storage-analysis.md`, `effects-vs-conditions-analysis.md`) → `docs/architecture/active-effects/`. Todas las referencias entrantes corregidas (`registry.md`, `RULES_PHB_CHECKLIST.md`, `ranged-into-melee-penalty.md`, `core-rules-consolidation.md`, `PROJECT_STATUS.md`, `INDEX.md`, y las auto-referencias de los propios archivos movidos).
  - **Lote C (carpetas para 3 features multi-documento: `full-attack-v2`, `large-footprints-v1`, `prone-eschewal-diehard`) y Lote D (erratas in-situ) siguen pendientes.** Sprint 040 no cerrado formalmente hasta ejecutarlos o decidir explícitamente diferirlos.

  **Sprint completado: MOVE-WITHDRAW (Retirada)**
  - Sub-acción `withdraw` de `use-tactical-action` (NDD Rev. 3, `docs/designs/withdraw/design.md`) — `movementCommands.ts` intocado, patrón Charge.
  - Normal: asalto completo, presupuesto 2× vía `validateMovePath` paramétrico, mutaciones mínimas `movementUsedFeet`+`usedFullAttack` (contrato real verificado). Disabled: retirada limitada RAW a 1× como acción estándar (`usedStandardAction` + esfuerzo existente).
  - AdO: parámetro puro `exemptDepartureCellKeys` en `findTriggeredOpportunityAttacksForPath` (default neutro, cero impacto en call sites) — solo el disparo por abandonar la huella inicial completa (Large+ incluido) queda exento; resto de la ruta provoca con AOO-03/Reflejos intactos. Secuencia real: AdO calculadas sobre snapshot previo, transición confirmada completa, pendientes después.
  - V1: sin Acrobacias, sin atravesar enemigos, invisibles también exentos (deuda pro-defensor), Cegado sin validar.
  - UI: botón "Retirarse (×2)" en el panel de movimiento, preview con presupuesto ×2 (1× Disabled), confirmación reutiliza la ruta dibujada; cero lógica de reglas en cliente.
  - Tests: `withdraw.test.mjs` 8/8 puros en verde real (`node --test` contra `dist/`) + `withdraw-server.test.mjs` (13 casos servidor, vía `tsx` en Windows) + regresión previa 40/40. Typecheck y `build:shared`/`build:server` en verde. `npm test` completo/`build:web`/E2E/Playwright: limitación pre-existente del sandbox, **pendientes de Windows — DoD NO declarado completo**.
  - Cobertura oficial: Combat Rules 62/96 = 65%; overall 42%.


  **Sprint completado: ATK-RANGED-INTO-MELEE (Penalizador -4 por disparar a combate cuerpo a cuerpo)**
  - Vertical slice aprobada por el pivot de saneamiento (`docs/designs/core-rules-consolidation.md` Rev. 2; NDD: `docs/designs/ranged-into-melee-penalty.md`).
  - **Helper puro** `getRangedIntoMeleeAssessment` (`rules.ts`): contrato RAW "either threatens" (una dirección de amenaza basta — corrige la imprecisión de traducción del corpus, hallazgo D-11), excepción de 10 ft medida entre footprints (`distanceBetweenFootprintsFeet`, correcta para Large/Huge) respecto del amistoso más cercano en general, exclusión de objetivos fuera de combate/indefensos, exención declarativa de Disparo Preciso.
  - **Sede de integración**: `getAttackContextModifiers.byAttackType.ranged` — la misma costura isomorfa del flanqueo, ya consumida por el servidor (armas en `attackCommands`, **conjuros con tirada de ataque en `abilityCommands`** — los rayos de toque a distancia heredan la regla sin código extra) y por la UI predictiva. **Decisión clave**: se descartó integrar en `totalAttackBonus` + `AttackContext.targetId` (habría exigido un campo nuevo, un cast en el evaluador genérico y habría dejado fuera a los conjuros); cero cambios en servidor y UI.
  - **FeatCatalog**: nuevo campo declarativo `rangedAttackRules` + fold `rangedAttackContribution` (patrón `lifeRules`) + registro de `srd_precise_shot`. Point Blank Shot NO registrado (es prerrequisito, no exención — distinción fijada por test).
  - **Tests**: `tests/ranged-into-melee.test.mjs` (13 casos: unilateralidad, alcance, 10 ft, footprints Large, amistoso más cercano general, Precise/Point Blank, parts, determinismo, moribundo) + `tests/aoo-limit-regression.test.mjs` (4 casos que cierran la deuda residual de AOO-03). **32/32 en verde** vía `node --test` contra `dist/` (incluye regresión de Sprints 036/037); `typecheck` y `build:shared`/`build:server` en verde; `npm test` completo/`build:web`/E2E pendientes de la máquina Windows (limitación pre-existente de binarios nativos).
  - Cobertura: Combat Rules 61/96 (64%), Feats 7/87.

  **Sprint 038 en gate:**

  **Sprint activo:** Full Attack V2 — Disparo Rápido (Rapid Shot) y Aceleración (Haste) *(nota de Sprint 044.1: "Full Attack V2" es el nombre histórico de esta etapa de diseño/sprint, no una Rule ID separada — en `docs/rules/registry.md` esto es "completar `ATTACK-FULL`", la misma regla oficial única de Ataque Completo)*
  - **Hallazgos clave de Fase 1:** (1) el NDD recibido redeclaraba `IterativeAttack`/`AttackRoutineContribution` como si no existieran — ya existen desde Sprint 036, con forma ligeramente distinta a la propuesta. (2) **Gap crítico**: `attackCommands.ts` sigue gateando `attacksMade` contra `getAttackRoutine` (rutina cruda por BAB), no contra `getEffectiveAttackRoutine` — de no corregirse, cualquier ataque extra sería visible en la UI pero rechazado por el servidor al intentar resolverlo. (3) *Haste* no vive en `EffectDefinition`/`effectsCatalog`: es un caso especial hardcodeado que empuja un `Buff` plano en `abilityResolver.ts` (`effectId === "haste" || "srd_haste"`) — anexar `attackRoutineRules` a `EffectDefinition`, como proponía el NDD, no habría tenido ningún efecto sobre Haste.
  - **Delta re-acotado:** poblar por primera vez el punto de extensión inerte de `FeatCatalog` con `srd_rapid_shot` (`extraAttack` + `flatAttackBonusToRoutine: -2`, condicionado a `appliesToAttackType: "ranged"`); extender `Buff` con `grantsExtraAttack` para Haste (en vez de migrarlo a `EffectInstance`); reescribir `getEffectiveAttackRoutine` para plegar ambas fuentes; **corregir `attackCommands.ts` para que use `getEffectiveAttackRoutine`** en el gating autoritativo. Cero cambios de UI adicionales (`ActionsPanel.tsx` ya consume la función correcta desde Sprint 036).
  - **Explícitamente fuera de alcance:** migrar Haste al sistema `ActiveEffects`; apilar múltiples fuentes de ataque extra simultáneas; Ataque con Dos Armas/Ráfaga de Golpes/ataques naturales concatenados (validados solo como extensibilidad futura, no implementados).
  - **Gate:** NDD (`docs/designs/full-attack-v2-haste-rapid-shot-design.md`) y plan creados; a la espera de aprobación `Proceed` **específica para Sprint 038**.

### Master Plan de Cobertura Total PHB 3.5 (V1.0)

  El proyecto opera bajo un mandato de gobernanza que decreta cobertura fiel y completa de dotes, conjuros y equipamiento del Manual del Jugador 3.5 como criterio de cierre de la Versión de Lanzamiento 1.0. El marco de principios (contenido declarativo sobre `rules.ts`/`FeatCatalog`/`ActiveEffects`/`EquipmentCatalog`, prohibición de condicionales ad-hoc por regla) y el inventario taxativo de brechas viven en `.ai/coverage/`: `V1_LAUNCH_MANIFESTO.md`, `FEATS_CHECKLIST.md` + `FEATS_PHB_CHECKLIST.md`, `SPELLS_CHECKLIST.md` + `SPELLS_PHB_CHECKLIST.md`, `EQUIPMENT_CHECKLIST.md` + `EQUIPMENT_PHB_CHECKLIST.md`. Estos documentos son puramente analíticos — cada fila `[ ]` que se quiera cerrar requiere su propia NDD, Design Review Checklist y `Proceed` explícito antes de tocar código. Cobertura medida en Sprint 043: Equipment ~86%, Rules (núcleo PHB) ~64%, Feats ~11%, Spells ~10% — los dos últimos son el hueco más grande antes de considerar cerrada la V1.0.

  **Sprint 043 (Planning & Roadmap) — completado**: auditoría real cruzando documentación/código/tests/CI (sin asumir nada). `ROADMAP.md` (obsoleto, describía fases pre-Sprint-005) reescrito desde cero. `walkthrough.md` deja de estar en `.gitignore` — aprobación explícita a la propuesta pendiente de Sprint 040 §3, pasa a versionarse en git. Hallazgos: DT-011 y DT-014 (`docs/technical-debt.md`) están desactualizadas (ambas ya resueltas por Sprints 036 y 021 respectivamente, no corregido en este sprint por estar fuera de su alcance de documentos a sincronizar); "Modificadores de tamaño" de la sección "Falta" (abajo) ya está implementado (`SizeRulesCatalog.attackAndAcModifier`, consumido en `rules.ts`/`equipmentStats.ts`) — corregido. Recomendación de próximo sprint: Condiciones Restantes, ver `ROADMAP.md`.

  **Sprints Recientes (Completados):**
  * **Sprint 037 (Restricción de Esquinas y Obstáculos Diagonales — MOVE-05):** `isFootprintHardBlocked` simplificada y renombrada a `isCornerAnchorBlockedByTerrain`, corrigiendo una divergencia deliberada de Sprint 015 que bloqueaba el corte de esquina diagonal por criaturas además de por muros. Cero cambios de UI (heredado vía `validateMovePath`). `tests/difficult-terrain.test.mjs` actualizado + nuevo `tests/corners-geometry.test.mjs`, 12/12 ejecutados realmente en verde vía `node --test`; `typecheck`/`build:shared`/`build:server` en verde; `npm test`/`build:web`/E2E pendientes de confirmación en la máquina Windows local.
  * **Sprint 036 (Consolidación de la Rutina de Ataques Iterativos):** `getEffectiveAttackRoutine` (read-model puro que compone `getAttackRoutine` + `Rules.totalAttackBonus`), punto de extensión declarativo inerte en `FeatCatalog` (`attackRoutineRules`) para Disparo Rápido/Dos Armas/Haste real, UI de `ActionsPanel` mostrando bonus absoluto. `tests/iterative-attacks-effective-routine.test.mjs` ejecutado realmente en verde (5/5) vía `node --test` contra `dist/index.js`; `typecheck`/`build:shared`/`build:server` verificados en verde; `npm test` completo/`build:web`/E2E pendientes de confirmación en la máquina Windows local.
  * **Sprint 035 (Defensas Contextuales — Dodge & Mobility):** Esquiva (+1 CA redeclarable contra un `dodgeTargetId` designado) y Movilidad (+4 CA solo en AdO con `isOpportunityAttack && isMovementProvoked`) modeladas como reglas puras derivadas de `combatant.featIds` dentro de `Rules.totalArmorClass`, reutilizando `suppressDexAndDodge` como única fuente de anulación. Nuevo comando `declare-dodge-target`, UI en `SelectedInfo` ("CA vs. objetivo actual" + control "Declarar Esquiva"). `tests/dodge-mobility.test.mjs` escrito; `typecheck`/`build:shared`/`build:server` verificados en verde; `npm test`/`build:web`/E2E pendientes de confirmación en la máquina Windows local (mismo bloqueo de binarios nativos que Sprint 034).
  * **Sprint 034 (Salvaciones Pasivas Ambientales & Trampas):** `targetCells` en `EffectInstance`, bloque `hazard` declarativo, `getEnvironmentalHazardHits` puro, `resolveEnvironmentalHazards` orquestado fuera del Event Bus puro, comando GM `gm-apply-environmental-hazard`, overlay `hazard-cell`. `typecheck`/`build` verificados en verde en todo el monorepo tras alinear el toolchain local. `npm test`/E2E WebSocket/Playwright pendientes de confirmación final (ver `walkthrough.md`).
  * **Sprint 033 (Spell Areas of Effect & Polygonal Templates):** geometría isomórfica `cone`/`line`/`burst` (`getCellsIntersectedByAoE`), intercepción con huellas multiposición disparando salvaciones y mitigaciones simultáneas, y overlays predictivos en React.
  * **Sprint 032 (Advanced AoO Limits & Reaction Triggers):** oráculo puro de provocación (`Rules.actionProvokesOpportunityAttack`), límites dinámicos de AdO con reinicio en `roundTickListener`, e interrupción transaccional en el backend para conjuros y armas a distancia. Alerta preventiva predictiva en React si la acción provocará AdO. Total 309 pruebas unitarias aprobadas.
  * **Sprint 031 (Consolidación de Infraestructura Espacial):** consolidación del efecto de squeezing, transiciones espaciales idempotentes (commitSpatialTransition), y footprint efectivo en movimiento forzado. Verificadas las 305 pruebas unitarias, compilación y pruebas de red (E2E) con éxito completo.
* **Sprint 030 (Grapple Core V2):** Escape de Presa transaccional por check de Presa o Escapismo, SkillRanks/StoredProfile V6, elegibilidad de armas compartida y UI predictiva; 303/303 unitarias, 87/87 WebSocket y 5/5 Playwright.
* **Sprint 029 (Grapple Core V1):** primitivas compartidas de toque/oposición, `srd_grappling` contextual, bloqueo de movimiento, resolución atómica y preview React; 295/295 unitarias, 87/87 WebSocket y 4/4 Playwright.
* **Sprint 028 (Bull Rush & Dynamic Squeezing):** compresión Large 2×1/1×2, coste doble, efecto contextual, movimiento forzado, Embestida transaccional y preview de footprint; 288/288 unitarias, 87/87 WebSocket y 3/3 Playwright.
* **Sprint 027 (Large Footprints Core Integration):** proyección rectangular privada, distancia O(1) equivalente al oráculo exhaustivo, oposición por caras completas, ocupación indexada y AdO multiposición sin recomputaciones internas.
* **Sprint 026 (Inventory & Ammunition Core):** inventario V5 por identidad de instancia, ranuras mutables sin caches, migración estricta, munición finita, ataques transaccionales, AUTO servidor y stock predictivo en React.
* **Sprint 025-R (Prone Eschewal & Diehard):** capacidades declarativas en `FeatCatalog`, `LifeStateProjection`, normalización post-HP, Tick Layer semántica, economía Disabled en negativos y Stand Up seguro compartido por servidor/React.
* **Sprint 025-A (Large Footprints V1):** selector canónico de celdas ocupadas, distancia y amenaza entre huellas, flanqueo por caras opuestas, validación integral de movimiento/colocación/carga/AdO y token React multicelda seleccionable desde cualquiera de sus celdas.
* **Sprint 024 (Saving Throws Automation):** El catálogo declara tipo y consecuencia de salvación; el servidor tira el d20, aplica 1/20 natural, calcula el bono efectivo y confirma daño/efecto, slot y logs de forma atómica.
* **Sprint 021 (Global Round Tracker & Bleeding):** Automatización del Event Bus a nivel de asalto, restaurando reacciones globales y desangrando pasivamente a los moribundos. Se cerró definitivamente la DT-007 (enmendada con restricción estricta de objetivo único por ronda para Ataques de Oportunidad).
* **Sprint 018 (Special Tactical Maneuvers — Trip):** Pipeline transaccional autoritativo con AdO interruptivo, Touch AC, oposición de atributos/tamaño, efecto `srd_prone` y preview compartido.
* **Sprint 017 (Total Migration V3):** Guards estáticos de compile-time protegen `CombatantSnapshot`, `CreatureTemplate` y `StoredProfile` contra caches escalares derivados.
* **Sprint 016 (Sneak Attack Integration):** `SNEAK_ATTACK_DICE` y el pipeline de daño de precisión se integraron de forma autoritativa con preview compartido.
* **Sprint 015 (Difficult Terrain & Corners):** Se integró el sistema de terreno difícil (doble coste 10/20ft en diagonales), reglas completas de movimiento diagonal por esquinas, y se abstrajeron los cálculos geométricos basándose estrictamente en el estado inmutable del tablero (snapshot).
* **Sprint 014 (Conditions V3 Formales):** Se incorporaron formalmente `Fatigued`, `Prone`, `Dazed` y `Paralyzed` con matemáticas inmutables, `getEffectiveAbilityScore` y 230/230 tests verdes.
* **Sprint 013 (Cover & Dynamic Reach):** Cálculo de línea de visión para intercepciones (+4 CA por Cover) y validación de alcance (Reach) por armas largas. 100% tests en verde.

## Falta

- Expandir uso de CombatSnapshot en mas resolvers.
- Condiciones: implementar como verticales separadas según `docs/designs/rule-and-modifier-classification.md`; no aprobar un lote único. Entangled Core y la infraestructura de Concealment ya existen; continúan pendientes sus extensiones aprobables por separado, skills/Concentration, huida obligatoria, objetos caídos y Coup de Grace.
- Fuentes productivas de Concealment, targeting por casilla para ocultación total y política efectiva de AdO. La miss chance y su assessment ya están implementados en `DEFENSE-CONCEALMENT`.
- Vision/Línea de Efecto formal (gap G-03 de `docs/audits/combat-rules-deviations.md`).
- Huellas no cuadradas, rotación y reglas completas de `Squeezing` que alteren temporalmente el espacio.
- ~~Alcance natural por tamanio.~~ ✅ Implementado (`SizeRulesCatalog.defaultReachFeet`, Sprint 013).
- ~~Modificadores de tamanio.~~ ✅ Implementado (`SizeRulesCatalog.attackAndAcModifier`, consumido en `rules.ts`/`equipmentStats.ts`) — corregido en Sprint 043, la línea anterior estaba desactualizada.
- Persistencia postcombate de consumos, botín y objetos caídos.
- Feats.
- Spells reales:
  - resistencia a conjuros.
  - componentes.
  - concentracion.
  - áreas y múltiples objetivos.
  - Evasion/Improved Evasion y salvaciones periódicas.
  - cargas retenidas de conjuros de toque y su interacción con AdO/amenaza.
- Skills.
- Editor de criaturas mas completo.
- Editor de mapas.
- Persistencia real de salas/encuentros.
- Guardado multiusuario/autenticacion real.
- UI tests de navegador para `/profiles` y flujos criticos.

## Como Correr

```powershell
npm install
npm run dev
```

URLs:

- Web: `http://localhost:5173`
- Server: `http://localhost:3333`
- Health: `http://localhost:3333/health`

## Validaciones

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
```

Para el E2E, el servidor debe estar levantado.

## Estructura Actual

```text
apps/
  server/
    src/
      auth/
      combat/
      commands/
      gm/
      room/
      index.ts
  web/
    src/
      components/
      hooks/
      pages/
      App.tsx
packages/
  shared/
    src/
      data/
        equipment/
        abilities.json
        creatures.json
      equipmentCatalog.ts
      equipmentStats.ts
      profileStorage.ts
      rules.ts
      types.ts
scripts/
  e2e-websocket.mjs
tests/
  equipment-stats.test.mjs
docs/
  prompts/
  phase-*.md
  *-checklist.md
```

## Decisiones Tecnicas Actuales

**La documentación oficial normativa del motor de reglas (D&D 3.5 Capítulo 8) está en la carpeta: `combat/`**
- **Política de Integración:** [docs/architecture/combat-documentation-integration.md](docs/architecture/combat-documentation-integration.md)
- **Matriz de Cobertura:** [docs/testing/master-coverage.md](docs/testing/master-coverage.md)
- **Divergencias (Bugs/Simplificaciones):** [docs/audits/combat-rules-deviations.md](docs/audits/combat-rules-deviations.md)
- **Roadmap Dependencias:** [ROADMAP.md](ROADMAP.md)
- **Documento Arquitectónico Central:** [docs/architecture/combat-engine.md](docs/architecture/combat-engine.md)

- El servidor es autoritativo.
- El estado de sala vive en memoria.
- WebSocket sincroniza sala en tiempo real.
- El cliente nunca decide ownership.
- El servidor valida ownership y permisos.
- Los datos de equipo se consultan por `EquipmentCatalog`.
- Los perfiles guardan IDs de catalogo.
- Los calculos derivados viven en helpers compartidos y testeables.
- Las reglas importantes no deben vivir solo en UI.
- La UI puede guiar, colorear y deshabilitar.
- Los AdO pendientes bloquean el flujo normal del combate.
- Las reglas se agregan incrementalmente y con tests.

## Testing

- [x] Sprint 010: pruebas de catálogo migrado, tamaño, persistencia V2, fallo cerrado y ataque de toque autoritativo.
- [x] Suite completa: 225/225 tests al cierre del Sprint 012.
- [x] E2E WebSocket completo: 80/80 verificaciones, incluidos flanqueo autoritativo y Ray of Frost contra Touch AC 11 conservando DEX.
- [x] UI Playwright: 2/2 escenarios, incluido preview melee/Shocking Grasp visible y Ray of Frost sin bono.
- [x] Multiplicador de daño crítico como test unitario.
- [x] Expiración de buff por turno como test unitario.
- [x] Tests para cobertura.
- [x] Límite 1 AdO por criatura por ronda.
- [x] CombatRulesSnapshot auto-verificación de campos.
- [x] Tests para condiciones.
- [x] Tests de UI para editor de perfiles.
- [x] Sprint 013: Cobertura viva (+4) e intervalos de alcance dinámico (Longspear test).
- [x] Sprint 024: 279/279 tests, typecheck/build y 82/82 verificaciones WebSocket con salvaciones automáticas.
- [x] Sprint 025-R: 290/290 tests, typecheck/build, 87/87 verificaciones WebSocket y 3/3 escenarios Playwright.
- [x] Sprint 027: 283/283 tests, typecheck/build, 87/87 verificaciones WebSocket y 3/3 escenarios Playwright.
- [x] Sprint 029: 295/295 tests, typecheck/build, 87/87 verificaciones WebSocket y 4/4 escenarios Playwright.
- [x] Sprint 030: 303/303 tests, typecheck/build, 87/87 verificaciones WebSocket y 5/5 escenarios Playwright.
- [x] Sprint 042: 58/58 tests focalizados de Cover, typecheck/build y 87/87 verificaciones WebSocket.
- [x] Sprint 042 — gate global (cerrado en Sprint 042.5): `npm test` **430/430**, 0 fallos. Los 9 fallos previos (7 casos reales) se investigaron y corrigieron por causa raíz — ver DT-021 y la sección Sprint 042.5 arriba. `npm run test:ui` (Playwright) **5/5** en esta máquina (Chromium ya instalado localmente).
- [x] Sprint 042 — gate CI: primera ejecución real de `.github/workflows/windows-ci.yml` (Run #1, commit `b3b7f3d`, `windows-latest`, 2m39s) mostró **conclusión Failure**, causada por el mismo `npm test` rojo (429/420/9) ya corregido en Sprint 042.5. Pendiente observar el próximo run tras este push para confirmar que el gate de CI también queda en verde con la corrección aplicada.
- [ ] Sprint 034: `tests/environmental-hazards.test.mjs` escrito (detección pura, ronda completa con mitigación half/full, hazard sin daño con `onFailEffectId`, idempotencia, sin recursión). `typecheck:shared`/`build:shared` verificados en verde; **suite completa, `typecheck:server`, `build`, E2E WebSocket y Playwright pendientes de correr en la máquina local** (ver `walkthrough.md`).
- [ ] Sprint 035: `tests/dodge-mobility.test.mjs` escrito (foco de Esquiva dinámico/redeclarable, bono de Movilidad exclusivo a AdO por movimiento, anulación total por Flat-Footed, sin dote sin bono, regresiones de `declare-dodge-target`). `typecheck` y `build:shared`/`build:server` verificados en verde en todo el monorepo; **`npm test`, `build:web`, E2E WebSocket y Playwright pendientes de correr en la máquina local** (mismo bloqueo de binarios nativos que Sprint 034).
- [x] Sprint 036: `tests/iterative-attacks-effective-routine.test.mjs` escrito y **ejecutado realmente en verde (5/5)** vía `node --test` puro contra `packages/shared/dist/index.js` (sin `tsx`/esbuild). `typecheck` y `build:shared`/`build:server` verificados en verde en todo el monorepo; **`npm test` completo vía `tsx`, `build:web` y E2E/Playwright pendientes de correr en la máquina local** (mismo bloqueo de binarios nativos que Sprints 034/035).
- [x] Sprint 037: `tests/difficult-terrain.test.mjs` actualizado (esquina dividida en bloqueo-por-muro/permiso-junto-a-enemigo) y nuevo `tests/corners-geometry.test.mjs` (anclas horizontal/vertical, aliado, enemigo, Large 2×2). **12/12 pruebas ejecutadas realmente en verde** vía `node --test` puro contra `packages/shared/dist/rules.js`. `typecheck` y `build:shared`/`build:server` verificados en verde; **`npm test` completo, `build:web` y E2E/Playwright pendientes de correr en la máquina local** (mismo bloqueo de binarios nativos que Sprints 034-036).

Ver [docs/testing/master-coverage.md](docs/testing/master-coverage.md) para análisis completo (enlace corregido en Sprint 042.5 — apuntaba a un archivo movido/renombrado).

## Problemas Pendientes

Ver [docs/technical-debt.md](docs/technical-debt.md) para la lista consolidada y priorizada de deuda técnica.

DT-004 y DT-017 quedaron resueltas en Sprint 010. El registro consolidado conserva las deudas restantes.
Sprint 012 eliminó además los caches escalares residuales y cerró la ruta de reintroducción mediante contrato TypeScript y fixtures V3.
Sprint 019 completó la integración transaccional full-stack de conjuros.

## Proxima Tarea Recomendada

Auditoría final de Sprint 042: el código de Cover está listo, pero el dictamen global permanece condicionado por los siete casos preexistentes de otros subsistemas y por el bloqueo ambiental de Playwright (`spawn EPERM`). No iniciar Concealment desde este estado.

**Actualización (2026-07-18, auditoría post-Sprint 042):** el gate de CI (`.github/workflows/windows-ci.yml`, agregado fuera del alcance literal de Sprint 042 en el commit `b3b7f3d`) ya corrió una vez de verdad en `windows-latest` (Run #1, 2m39s) con **conclusión Failure** y un artefacto de fallo generado. Sin acceso autenticado a GitHub Actions no se pudo confirmar si ese fallo es exactamente el conjunto de 9 casos preexistentes ya documentado arriba o si el runner de GitHub expone algo nuevo (instalación de Playwright, timing del puerto 3333, o resolución de dependencias). **Sprint 042 sigue sin poder declararse cerrado** hasta que alguien con acceso autenticado revise el log del job "Validate on Windows" de ese run y confirme cuál de las dos lecturas es correcta. No iniciar ningún sprint funcional nuevo (ni Concealment ni Conditions) hasta esa confirmación.

**Cierre (Sprint 042.5, 2026-07-18):** la duda quedó resuelta — los 9 fallos (7 reales) fueron investigados uno por uno, clasificados y corregidos por causa raíz (no un parche): 5 Environmental Hazards eran un bug real de producción (`cloneEffectInstances` no propagaba `targetCells`, ver DT-021), 1 Ray of Frost era un test desactualizado frente a una regla posterior correcta (`ATK-RANGED-INTO-MELEE`), y 1 Withdraw W22 era un regex mal escrito en el propio test. `npm test` queda **430/430**; typecheck, build, E2E WebSocket (87/87) y Playwright (5/5) también en verde real en esta máquina. **Sprint 042 (Cover) queda cerrado formalmente.** GitHub Actions confirmado en verde tras el push (Run #4, commit `d3c02ba`, conclusión `success`, verificado por API pública).

**Sprint 043 (Planning & Roadmap, 2026-07-18):** con el baseline verde, se auditó el proyecto completo (documentación, código, tests, CI) y se reescribió `ROADMAP.md` desde cero. Ver detalle completo en el `walkthrough.md` de este sprint. **Recomendación**: el próximo sprint funcional debería ser **Condiciones Restantes** (Blinded, Entangled, Dazzled, Shaken/Frightened, Exhausted, más el cierre de los gaps parciales de Stunned y Helpless Combat) — reutiliza la infraestructura ActiveEffects ya madura (mismo patrón exitoso de Sprints 006/007/014, riesgo bajo) y desbloquea simultáneamente el trabajo futuro de Feats y Spells, que referencian estas condiciones constantemente. Concealment quedó como alternativa fuerte de segundo lugar. Pendiente de aprobación explícita antes de iniciar cualquiera de los dos.

**Actualización Sprint 044.2 (2026-07-21):** la arquitectura transversal previa a esos sprints queda fijada en `docs/designs/modifier-pipeline-architecture.md`. Ninguna vertical funcional debe sumar modificadores por una ruta nueva: debe reutilizar el pipeline oficial y justificar cualquier contrato especializado faltante en su propio NDD. Concealment continúa como candidato funcional recomendado por la auditoría anterior, pero este sprint no lo abre ni lo implementa.
