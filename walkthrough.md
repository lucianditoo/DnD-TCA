# Walkthrough — D-1B: RAW Movement Cost Remediation (Owner Decision)

Responsabilidad: Registrar la alineación normativa de Movement Cost con D&D 3.5 RAW y la resolución formal de ODR D-1B-C3-01.
Autoridad: Registro
Lifecycle: Rotativo
Reemplaza: Walkthrough de D-1B-I5R2, conservado en Git.
Complementa: [Estado](PROJECT_STATUS.md), [TODO](TODO.md), [Plan de Implementación I6](implementation_plan.md), [NDD D-1B](docs/designs/normative-movement-design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

## Resultado

- **D-1B RAW Movement Cost Remediation**: Alineación de diseño y plan con la decisión normativa del Propietario (D&D 3.5 RAW / SRD / PHB como autoridad primaria).
- **ODR D-1B-C3-01**: **RESUELTA Y CERRADA** para todas las combinaciones multiplicativas de duplicaciones de coste de movimiento (Terreno Difícil, Squeezing, Tumble-equivalent).
- **D-1B-I6**: DISEÑO ARQUITECTÓNICO Y PLAN REMEDIADOS. Sin código productivo ni tests modificados; pendiente de Architecture Review y Proceed explícito.

Logros consolidados:
1. **Regla RAW de Excepción a Duplicaciones (PHB p. 148 / SRD "Hampered Movement")**:
   - Cada duplicación sucesiva multiplica el coste de paso: 1 duplicación = x2 (10 ft ortogonal); 2 duplicaciones = x4 (20 ft ortogonal); 3 duplicaciones = x8 (40 ft ortogonal); 4 duplicaciones = x16 (80 ft ortogonal).
   - No aplica la regla general aditiva de D&D de (x2 + x2 = x3).
2. **Movimiento Diagonal Impedido (RAW Hampered Movement)**:
   - 1 duplicación: 3 casillas = 15 ft.
   - 2 duplicaciones: 6 casillas = 30 ft.
   - 3 duplicaciones: 12 casillas = 60 ft.
   - El coste diagonal impedido es fijo, no alterna paridad 5/10 ft, y preserva intacto `normalDiagonalStepsThisTurn`.
3. **Formulación Isomórfica de Acrobacias / Tumble**:
   - RAW formula Tumble como restricción de velocidad ("one-half normal speed").
   - El motor traduce esta restricción de forma pura e isomorfa como duplicación x2 del coste de paso en `assessMovementCost`.
   - Se documenta la equivalencia técnica y se registra la brecha de Accelerated Tumbling (-10 check para velocidad completa).
4. **Publicación y Máquina de Estados de Squeezing**:
   - Captura pre-commit de `wasSqueezing = combatant.spatialMode === "squeezing"`.
   - Comparación post-commit contra `commitResult.finalSpatialMode === "squeezing"` para emitir logs de entrada/salida únicamente ante transiciones efectivas.
   - Si el commit es rechazado, cero mutaciones y cero logs emitidos.

## Archivos y trazabilidad

- `docs/designs/normative-movement-design.md`:
  - §3.8: Adición de §3.8.1 (RAW Double Movement Cost Exception), §3.8.2 (Hampered Diagonal Movement), §3.8.3 (Resolución formal de ODR D-1B-C3-01).
  - §3.10: Actualización de matemáticas de Squeezing con factores RAW y combinaciones.
  - §3.16, §4.15, §5.15, §6.16: Registro de ODR D-1B-C3-01 como resuelta y cerrada.
  - §8.1, §8.3: Formulación isomórfica de Tumble, tabla exhaustiva de combinaciones multiplicativas y autoridad exclusiva de `assessMovementCost`.
  - §8.5: Máquina de estados de publicación para transiciones de Squeezing.
- `implementation_plan.md`:
  - Sección 1: Actualizada con factores multiplicativos RAW y combinaciones soportadas.
  - Sección 3: Búfer de publicación con captura pre-commit de `wasSqueezing` y guardas de commit.
  - Sección 5: Matriz exhaustiva de pruebas para 1, 2 y 3 duplicaciones (ortogonal y diagonal impedida), invariante de paridad normal, y transiciones de compresión.
- `TODO.md` y `PROJECT_STATUS.md`: Sincronización del estado de ODR D-1B-C3-01 e I6.
- `walkthrough.md`: Actualizado con el resumen del sprint.

## Validaciones

- Modo: Exclusivamente documentación y diseño arquitectónico.
- Código productivo y tests: 0 modificaciones.
- `git diff --check`: Verificado limpio.

## Límites y gate documental

- No se autoriza implementación de I6.
- No se introducen House Rules.
- ODR-D1B-I5-1 (`squeezingAxis`) permanece abierta y fuera de alcance.
- Enlaces internos y consistencia documental verificados.
