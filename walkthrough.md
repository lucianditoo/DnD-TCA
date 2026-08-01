# Walkthrough — Sprint D-1B, Capítulo 1

## Objetivo

Definir exclusivamente el modelo abstracto y normativo de movimiento mediante Movement, Step, Route y Movement Cost, sin diseñar acciones, modos, validaciones, geometría de soporte ni implementación.

## Resultado

- Se creó `docs/designs/normative-movement-design.md` como NDD canónico de D-1B.
- El capítulo formaliza Step, la regla diagonal 5/10, Route y la suma de Movement Cost.
- El diseño preserva la separación entre Movement Cost y Spatial Distance establecida por D-1R1.
- No se modificaron código, tests ni Rule Registry.
- No se abrió ninguna ODR nueva; la ODR preexistente de Spatial Distance tridimensional permanece fuera de alcance.
- El documento fue registrado en `INDEX.md` y el estado de revisión se reflejó en los snapshots documentales correspondientes.

## Validación documental

- Alcance del diff limitado a Markdown.
- Enlaces internos del nuevo documento comprobados.
- Responsabilidad única y encabezado permanente verificados.
- `git diff --check` completado sin errores.

READY FOR ARCHITECTURE REVIEW.
