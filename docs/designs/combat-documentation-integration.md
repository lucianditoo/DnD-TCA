# Política de Uso e Integración Normativa del Motor de Combate

## 1. Jerarquía de Fuentes
`combat/` es la referencia normativa funcional para las reglas del Capítulo 8 de D&D 3.5. Toda simplificación, divergencia, extensión homebrew o dependencia externa debe quedar registrada explícitamente.

En caso de conflictos o dudas de diseño, el orden de consulta es el siguiente:

1. **Documentación Normativa (`combat/`)**: Contiene la reorganización literal y temática del Capítulo 8.
2. **Decisiones Arquitectónicas (`docs/architecture/combat-engine.md`)**: Determinan *cómo* se estructura una regla en el código (separación de responsabilidades, pureza de los resolvers, ownership en servidor).
3. **Simplificaciones Registradas (`docs/designs/combat-rules-coverage.md`)**: Si una regla normativa se reduce de manera deliberada por el alcance del proyecto.
4. **Reglas Homebrew**: Alteraciones hechas al sistema D&D (no pertenecen al manual) que deben estar documentadas y marcadas explícitamente.
5. **Código Fuente**: El comportamiento implementado en `packages/shared/src/rules.ts` y demás módulos.
6. **Tests**: Son las garantías, pero **no** son normativos. Si un test protege un comportamiento contrario a la regla normativa de `combat/`, el test está equivocado y debe ser alterado una vez aprobado el cambio.

## 2. Cómo Consultar `combat/` al Diseñar Nuevas Reglas
Ningún desarrollador ni agente (IA) debe implementar reglas basándose puramente en su memoria de D&D 3.5 o asunciones previas.
- **Antes de la Fase de Diseño:** Se debe ubicar el archivo correspondiente en `combat/` (por ej., `07_movimiento.txt` o `08_ataques_de_oportunidad.txt`).
- **Durante el Diseño:** Citar textualmente el fragmento de la regla en el plan de implementación, usando los identificadores formales (`Rule ID`).
- **Prevención:** Evitar inferencias; la regla se aplica tal como está escrita en la documentación normativa, a menos que el Arquitecto apruebe una simplificación.

## 3. Normas de Documentación
Cada funcionalidad agregada o modificada debe clasificarse y documentarse:
- **Regla oficial implementada fielmente**: El código responde en un 100% al manual.
- **Regla oficial simplificada**: Se omitieron detalles deliberadamente (ej. no contemplar armas de alcance natural dinámico por ahora). Debe constar en `combat-rules-coverage.md`.
- **Regla oficial no implementada**: Reservada para características fuera de scope temporalmente.
- **Divergencia conocida (Bug/Error)**: Funciona distinto a las reglas oficiales sin haber sido aprobado como simplificación (registrado en `combat-rules-deviations.md`).
- **Extensión Homebrew**: Mecánica creada exclusivamente para este videojuego que diverge del TTRPG.

## 4. Archivos a Actualizar post-Implementación
Tras la aprobación e implementación de una Fase o regla (Definition of Done de cualquier tarea de combate), se deben actualizar sincrónicamente:
- `PROJECT_STATUS.md`
- `TODO.md`
- `docs/rules-coverage-checklist.md` (y `combat-rules-coverage.md`)
- `walkthrough.md`
- Documentos de diseño afectados.

## 5. Mapeo de Documentación (`combat/`) al Motor de Combate

Este es el mapa de impacto de cada archivo normativo dentro de nuestra arquitectura actual y futura.

| Archivo Normativo | Capas Afectadas | Módulos / Resolvers | Command Handlers |
|-------------------|-----------------|---------------------|------------------|
| `01_tablero_de_combate.txt` | Context, Board | `calculatePathStepCostsFeet`, `distanceFeet`, Board Generator | N/A |
| `02_como_funciona_el_combate.txt` | Room Flow | `turnManager.ts`, `EncounterPhase` | N/A |
| `03_estadisticas_de_combate.txt` | Stats, Context | `totalAttackBonus`, `totalArmorClass`, `CombatSnapshot` | N/A |
| `04_iniciativa.txt` | Room Flow | `turnManager.ts` | `handleRollInitiative` |
| `05_acciones.txt` | Validation, TurnState | `canUseMoveAction`, `canTakeTurn`, `canFullAttack` | `handleDeclareAttackMode`, UI `ActionsPanel` |
| `06_ataques.txt` | Resolver, Routine | `attackResolver.ts`, `getAttackRoutine` | `handleResolveAttack` |
| `07_movimiento.txt` | Validation | `validateMovePath` | `handleMove` |
| `08_ataques_de_oportunidad.txt` | Context, Opportunity Flow | `findTriggeredOpportunityAttacks`, `threatensTarget` | `resolveOpportunityAttack` |
| `09_posicionamiento.txt` | Context | `threatensTarget`, `isFlanking` | N/A |
| `10_modificadores_de_combate.txt`| Context, Resolver | `getAttackContextModifiers`, Cover/Concealment | N/A |
| `11_ataques_especiales.txt` | Validation, Handlers | `isHelpless` (Coup de Grace), `handleCharge`, `resolveAttack` (Crit) | `handleCharge`, `handleSpecialAttack` |
| `12_acciones_especiales_iniciativa.txt`| Room Flow | (Por implementar: Preparar acción, Retrasar) | (Nuevos comandos requeridos) |
| `13_heridas_y_muerte.txt` | Health, Conditions | `lifeStatus`, `applyDamage`, `applyHealing` | GM Panel, Heal Commands |

Cualquier cambio normativo en estos archivos impacta directamente las dependencias cruzadas de WebSockets, UI (bloqueo de botones), `Playwright` y `E2E WebSocket` tests.
