# Walkthrough — D-1B-I6: Design Remediation R3 (RAW Diagonal Semantics + Squeezing Axis)

Responsabilidad: Registrar la resolución de los bloqueantes de diseño de I6: semántica diagonal RAW, matriz canónica de costes y sede autoritativa de `squeezingAxis` (ODR-D1B-I5-1).
Autoridad: Registro
Lifecycle: Rotativo
Reemplaza: Walkthrough de D-1B RAW Movement Cost Remediation, conservado en Git.
Complementa: [Estado](PROJECT_STATUS.md), [TODO](TODO.md), [Plan de Implementación I6](implementation_plan.md), [NDD D-1B](docs/designs/normative-movement-design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

## Resultado

- **D-1B-I6 Design Remediation R3**: Cerradas las contradicciones de diseño de I6 y resuelto el prerrequisito bloqueante ODR-D1B-I5-1 antes del Proceed de implementación.
- **ODR-D1B-I5-1 (`squeezingAxis`)**: **RESUELTA Y CERRADA** situando la autoridad única en `EffectInstance<ProductionEffectId>` para `srd_squeezing`.
- **ODR D-1B-C3-01 (composición de costes)**: **RESUELTA Y CERRADA** conforme a la regla RAW de Double Movement Cost.
- **Estado de I6**: DISEÑO ARQUITECTÓNICO Y PLAN DE IMPLEMENTACIÓN LISTOS PARA REVISIÓN FINAL. Sin código productivo ni tests modificados; bloqueado hasta Proceed explícito.

### Logros Consolidados

1. **Semántica RAW de Tumble Aislado (Major 1):**
   - RAW formula Tumble como restricción de velocidad (*one-half normal speed*).
   - Su representación equivalente en el motor duplica el coste normal que habría consumido el paso:
     - Ortogonal: 5 ft -> 10 ft.
     - Diagonal normal: 5 / 10 ft -> 10 / 20 ft.
     - Paridad normal: **SÍ** (continúa participando e incrementando `normalDiagonalStepsThisTurn`).
   - Tumble aislado **NO** es una diagonal obstaculizada fija de 15 ft.
2. **Fuentes Reales de Movimiento Obstaculizado (True Hampering Sources):**
   - Terreno Difícil (DT): ortogonal 10 ft; diagonal 15 ft fijos; paridad normal: **NO** (`normalDiagonalStepsThisTurn` intacto).
   - Compresión (Squeezing): ortogonal 10 ft; diagonal 15 ft fijos; paridad normal: **NO** (`normalDiagonalStepsThisTurn` intacto).
3. **Composición de Tumble con Fuentes de Movimiento Obstaculizado:**
   - La restricción de mitad de velocidad duplica el coste impedido subyacente:
     - Tumble + DT: ortogonal 20 ft; diagonal 30 ft fijos; paridad: **NO**.
     - Tumble + Squeezing: ortogonal 20 ft; diagonal 30 ft fijos; paridad: **NO**.
     - DT + Squeezing: ortogonal 20 ft; diagonal 30 ft fijos; paridad: **NO**.
     - Tumble + DT + Squeezing: ortogonal 40 ft; diagonal 60 ft fijos; paridad: **NO**.
4. **Eliminación de Contradicciones Legacy de Squeezing (Major 2):**
   - Se removió la mención desactualizada donde Squeezing aislado consumía paridad 10/20 ft en §3.10 y §8.3.
   - Squeezing aislado queda estrictamente como movimiento obstaculizado RAW: 10 ft ortogonal / 15 ft diagonal fija sin mutar paridad normal.
5. **Matriz Canónica de Costes Congelada (§8.3.2):**
   - Queda documentada y congelada la tabla canónica con sus 8 estados y sus reglas de paridad.
6. **Resolución Normativa de ODR-D1B-I5-1 (Major 3):**
   - Diagnóstico: `getCombatantOccupiedCellsAt` sin `preferredAxis` seleccionaba arbitrariamente `legal[0]` (horizontal), provocando *footprint drift* respecto al eje confirmado por Resolution.
   - Auditoría de alternativas:
     - Alternativa A (campo en `CombatantSnapshot`): rechazada por crear dualidad de fuentes de verdad con `srd_squeezing` y violar guardas de estado escalar en el combatiente.
     - Alternativa B (`squeezingAxis?: SqueezingAxis` en `EffectInstance`): **SELECCIONADA COMO AUTORIDAD ÚNICA**. Vincula el eje de compresión al ciclo de vida atómico del efecto `srd_squeezing`.
     - Alternativa C (registro independiente en la sala): rechazada por introducir colecciones superfluas y requerir sincronización bidireccional.
   - Evaluación multidimensional (10 áreas): evaluada en R3, completada por R4 en snapshot, serialización, room state, EffectManager, proyección de cliente, persistencia futura, fingerprinting, protección anti-stale, preparación y edición de tablero D-5.
   - Invariante obligatoria garantizada:
     `occupiedCellsImmediatelyAfterCommit == occupiedCellsDerivedFromNextAuthoritativeSnapshot`
7. **Autoridad Canónica de `wasSqueezing`:**
   - Se eliminó del diseño la referencia a un inexistente `combatant.spatialMode`.
   - Se consulta a través de `room.effectInstances.some(i => i.effectId === "srd_squeezing" && i.targets?.includes(combatant.id))`.

## Archivos y trazabilidad

- `docs/designs/normative-movement-design.md`:
  - §3.8.2: Distinción entre True Hampering Sources y Tumble-only; composición multiplicativa con paridad intacta.
  - §3.10: Corrección de coste diagonal de Squeezing a 15 ft fijos sin mutación de paridad.
  - §8.1: Actualización de alcance y registro del cierre de ODR-D1B-I5-1.
  - §8.3: Reformulación de Tumble aislado (10/20 ft con paridad) y congelación de la Matriz Canónica de 8 filas.
  - §8.5: Corrección de autoridad de consulta de `wasSqueezing` en `room.effectInstances`.
  - §8.7: Nueva sección exhaustiva con la resolución de ODR-D1B-I5-1, auditoría de alternativas, evaluación en 10 dimensiones y contrato normativo de `squeezingAxis`.
- `implementation_plan.md`:
  - Sección 1: Ampliación de alcance para incorporar `squeezingAxis` en `EffectInstance` y en `movementCommit` / `movementGeometry`.
  - Sección 3: Consulta canónica de `wasSqueezing` y ciclo de vida de `squeezingAxis`.
  - Sección 5: Matriz de pruebas canónica (8 casos) y pruebas de contrato de `squeezingAxis` (horizontal, vertical, ambigüedad sin drift, continuidad, salida, stale rejection, fingerprint y fase preparación).
- `TODO.md` y `PROJECT_STATUS.md`: Sincronización formal marcando ODR-D1B-I5-1 y ODR D-1B-C3-01 como resueltas y cerradas.
- `walkthrough.md`: Actualizado para este cierre.

## Validaciones

- Modo: Exclusivamente diseño y arquitectura documental.
- Código productivo y tests: 0 líneas modificadas.
- `git diff --check`: Verificado limpio.

## Límites y gate documental

- Sin implementación de código hasta recibir Proceed explícito.
- Sin House Rules; pleno alineamiento con D&D 3.5 RAW / SRD / PHB.
- Todas las ODRs de la vertical D-1B activas para I6 quedan formalmente cerradas.

## D-1B-I6 Design Remediation R4

[Contrato R4](docs/designs/movement/i6r4-squeezing-axis-integration.md): corrige la pérdida de eje en safeInstance y descubre el mismo defecto en cloneEffectInstances. Audita las 13 invocaciones de commitSpatialTransition: 4 reciben modo variable con eje disponible en pasos validados y 9 confirman natural. Withdraw/Run/Five-Foot Step propagan evidencia existente sin migración táctica. Ambos commits reemplazan instancia al cambiar eje para evitar onStack ignore. GM manual no puede aportar evidencia: rechazo explícito. Fixtures map-builder requieren migración; salas en memoria antiguas se drenan/recrean sin fallback de eje. La matriz RAW aprobada R3 permanece intacta.

Estado: solo documentación; implementación y tests futuros descritos en implementation_plan y contrato R4. Awaiting Architecture Review and Proceed.
