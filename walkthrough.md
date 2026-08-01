# Walkthrough — Sprint D-1B, Capítulo 2

## Objetivo

Definir exclusivamente cuándo una Route es legal mediante validación incremental Step-by-Step, continuidad, legalidad de cada Step y Reachability por transiciones legales.

## Resultado

- Se amplió `docs/designs/normative-movement-design.md` con el Capítulo 2, Normative Route Validation.
- La legalidad se compone sobre una Route ordenada y un único CombatRulesSnapshot inmutable.
- La validación no muta el estado, no ejecuta prefijos y no deduce legalidad únicamente desde origen y destino.
- Movement Cost y economía de acciones permanecen como responsabilidades independientes.
- D-1R1, D-1A y D-1B-Research se consumen sin redefinir sus contratos.
- No se modificaron código, tests ni Rule Registry.
- No se abrió ninguna ODR nueva.

## Validación documental

- Alcance del diff limitado a Markdown.
- Responsabilidad única del NDD preservada.
- Exclusiones del sprint verificadas.
- `git diff --check` completado sin errores.

READY FOR ARCHITECTURE REVIEW.
