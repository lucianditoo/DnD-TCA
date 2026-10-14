# Walkthrough — D-1B-I5R2: Movement Resolution Provenance & Stale-Rules Remediation

Responsabilidad: Registrar la última entrega, sus validaciones y límites.
Autoridad: Registro
Lifecycle: Rotativo
Reemplaza: Walkthrough de D-5R3, conservado en Git (D-5 no se reabre).
Complementa: [Estado](PROJECT_STATUS.md), [plan I5R1/I5R2](implementation_plan.md), [NDD D-1B](docs/designs/normative-movement-design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

## Resultado

**READY FOR ARCHITECTURE REVIEW**. I5 no se declara cerrado; I6 permanece
**BLOQUEADO**. Baseline de entrada: `a10919ebcdad7875550f34eae72283beef10ba46`.

- `MovementResolutionResult` conserva `readonly combatantId` en `ready` e
  `insufficient-budget`, derivado exclusivamente del actor recibido. Copia el
  contexto diagonal inicial para no compartir la referencia del caller.
- Commit busca ese ID en `room.combatants` y exige la misma referencia viva,
  el actor esperado y el turno activo antes de mutar. Actor ajeno, clon detached
  o actor eliminado se rechazan como `invalid-actor` sin mutación.
- Un único fingerprint verifica las dependencias espaciales existentes y las
  fuentes de movilidad/presupuesto. Consume las huellas canónicas y
  `Rules.getMovementSpeedProjection` (total, base ajustada y razón), el trait
  declarativo `CANNOT_MOVE` y el presupuesto gastado. No duplica Speed ni coste.
- Se elimina la lista de efectos espaciales por ID del fingerprint: cambios de
  efecto se representan por su semántica efectiva. Arrays no ordenados se
  normalizan; nombres, iconos, logs y trazas cosméticas no invalidan la resolución.

El presupuesto disponible sigue siendo un input del consumidor; se verifica la
vigencia de sus fuentes actuales sin introducir fórmulas por acción. La
integración/autorización productiva de acciones pertenece a I6, no a este sprint.

## Archivos y trazabilidad

- `packages/shared/src/movementResolution.ts`: procedencia y fingerprint canónico.
- `packages/shared/src/movementCommit.ts`: identidad canónica y guardas anti-stale.
- `tests/movement-commit.test.mjs`: 20 regresiones nuevas; actualización de fixtures
  existentes al contrato con actor.
- `implementation_plan.md`: recuperación del mismo plan I5R1 desde `9a6b87d`
  (retirado en `551a333`), con §8 de dependencias reales e implementación I5R2.
  Las secciones anteriores quedan identificadas como trazabilidad I5R1; no se
  crea otro NDD ni otra autoridad de reglas.
- `INDEX.md`, `PROJECT_STATUS.md`, `TODO.md`,
  `docs/testing/master-coverage.md` y este walkthrough: estado/evidencia sincronizados.

## Validaciones ejecutadas

| Gate | Resultado |
|---|---|
| `npm test` | 701/701; 28 suites, 0 fallos, 0 omitidos |
| Focalizados Commit / Resolution / Cost | 72/72 |
| `npm run typecheck` | PASS en shared, web y server |
| `npm run build` | PASS en shared, web y server |
| `node scripts/e2e-websocket.mjs` | 110/110 |
| `npm run test:ui` | 16/16 |
| `git diff --check` | PASS |

El primer build dentro del sandbox falló por `EPERM` en `realpath` de Vite;
la repetición autorizada fuera del sandbox terminó correctamente. Se conserva
el aviso existente de tamaño de bundle, sin modificar D-4/D-5.
La primera ejecución WebSocket no pasó y coincidió con reinicios del servidor
`tsx watch` al guardar el código; se repitió sobre el servidor estable y pasó
110/110. El servidor local usado se detuvo antes de Playwright, que levantó su
propio entorno de prueba. No se modificaron las suites WebSocket/UI.

## Límites y gate documental

- Sin consumidores productivos nuevos, Publication ni cambios en Run/Withdraw/Charge.
- Sin cambios de semántica diagonal, costes de Squeezing, ni métrica base de ruta.
- **ODR-D1B-C3-01** y **ODR-D1B-I5-1** siguen abiertas; no se persiste `squeezingAxis`.
- NDD, Research, Registry, D-5 y archivos locales ajenos no se modifican.
- No se crean Rule IDs ni deuda técnica nueva. Los dos hallazgos I5R2 quedan
  remediados en código, pendientes del veredicto arquitectónico externo.
- Enlaces internos de documentos tocados verificados; plan recuperado indexado,
  sin duplicar responsabilidad normativa. Estados oficiales del Registry intactos.
- El commit único se publica y su Windows CI se verifica según Governance v2;
  el resultado remoto se informa en la entrega del SHA, sin declarar aprobación.
