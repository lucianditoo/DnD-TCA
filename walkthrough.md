# Walkthrough — Sprint D-1B Capítulo 2R1

## Objetivo
Aplicar únicamente las observaciones de la remediación arquitectónica sobre el Capítulo 2 de `normative-movement-design.md`, solucionando los hallazgos de MAJOR y MINOR.

## Cambios realizados
- **Identidad Espacial (MINOR):** En la sección 2.2, se sustituyó la mención abstracta al modelo espacial por la declaración explícita de dependencia normativa de las primitivas: `Anchored Spatial Position`, `Volumetric Spatial Coordinate`, `Surface` y `Connection`. No se redefinieron.
- **Autoridad de Validación (MAJOR):** Se añadió la sección `2.12 Autoridad y previews` donde se indica que el servidor (RULES_ENGINE) tiene la autoridad final exclusiva, mientras que el cliente puede emplear helpers para predecir, sin que esto sustituya la validación sobre el snapshot inmutable.
- La antigua sección de límites y ODR se desplazó a `2.13`.
- No se modificó el alcance del documento ni se abrieron ODRs nuevas.

READY FOR ARCHITECTURE REVIEW
