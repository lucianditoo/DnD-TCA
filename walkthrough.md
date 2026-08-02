# Walkthrough — Sprint D-1B Capítulo 6

## Objetivo

Definir cómo Run, Withdraw, Charge, Five-Foot Step, Minimum Movement y Forced Movement consumen el sistema normativo común sin redefinir ninguna de esas operaciones ni crear rutas paralelas de movimiento.

## Capítulo redactado

- Se fijó el principio de consumidor: cada operación conserva elegibilidad, restricciones, presupuesto autorizado y consecuencias propias.
- Se definió una única frontera común: la operación produce Intent; Movement resuelve mediante los contratos de los Capítulos 1–5; la operación puede consumir después el resultado confirmado.
- Las seis operaciones quedaron documentadas exclusivamente como consumidoras de Route, Route Validation, Movement Cost, Movement Budget y el ciclo Resolution–Publication cuando corresponda.
- Se separaron las consecuencias externas —ataque, Opportunity, efectos defensivos, daño y checks— del núcleo de Movement.
- Se reafirmaron servidor autoritativo, Preview predictivo y prohibición de fórmulas particulares en UI o consumidores.

## ODR y alcance

No se abrió ninguna ODR nueva. `D-1B-C3-01` conserva exactamente su alcance sobre composición simultánea de fuentes de coste.

No se modificaron las reglas de Run, Withdraw, Charge, Five-Foot Step, Minimum Movement o Forced Movement. Tampoco se diseñaron TurnState, ataques, AoO, hazards, interrupciones, rollback, networking, TypeScript ni implementación.

## Validación documental

- Capítulos 1–5 preservados sin cambios semánticos.
- Sin código ni tests modificados.
- Responsabilidad canónica conservada dentro del NDD existente.
- Alcance limitado a `docs/designs/normative-movement-design.md`, `PROJECT_STATUS.md`, `TODO.md` y este walkthrough rotativo.

READY FOR ARCHITECTURE REVIEW
