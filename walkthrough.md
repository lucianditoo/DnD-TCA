# Walkthrough — Sprint D-1A-R1 (Remediación Normativa de Área)

## Objetivo
Remediar el NDD `docs/designs/normative-area-shape-projection.md` que falló el Normative SRD Compliance Gate debido a la mezcla de formas geométricas con modos de propagación y la invención de reglas no respaldadas por el SRD 3.5 (ej. Half-Square Rule, origen genérico en el centro de la celda).

## Entregables
- **`docs/designs/normative-area-shape-projection.md`**: Reescritura completa del NDD D-1A, con separación total de Geometric Shape vs Propagation Mode y una estricta fidelidad a los textos del PHB para Point of Origin e Inclusion Contract.
- **`docs/designs/normative-spatial-geometry.md`**: Modificación de la sección de AoE para armonizar la delegación del trazado a D-1A-R1 e incorporar la ODR bloqueante respecto a la métrica XYZ de `Spatial Distance`.
- **`docs/designs/spell-aoe-geometry-design.md`**: Adición de una cláusula de supersesión (Migration First), conservando su utilidad para el pipeline funcional transaccional del backend V1 pero delegando su autoridad geométrica y de propagación al nuevo NDD D-1A-R1.
- **`docs/rules/registry.md`**: Actualizado para señalar que la autoridad de `SPELL-AOE` ahora recae sobre ambos documentos de forma híbrida (SSOT geométrica en D-1A-R1, Legacy Pipeline en Sprint 033).
- **`PROJECT_STATUS.md`**: Refleja el cierre de D-1A-R1.

## Correcciones Normativas (SRD)
1. **Forma vs Propagación:** Cone, Line, Sphere y Cylinder son geometrías. Burst, Emanation y Spread son modos de propagación. No son sinónimos (ej. *Cone-shaped Burst* existe).
2. **Point of Origin:** El origen de un Burst, Emanation, Spread y Cylinder es una *grid intersection* (generalizado 3D a un vértice de 8 cubos). Conos y Líneas se originan desde una de las esquinas de ocupación del lanzador.
3. **Inclusión Far Edge / Near Edge:** Eliminada la *Half-Square Rule*. Si el límite del área cruza el *far edge* del cubo, se incluye. Si solo toca el *near edge*, se excluye. La traducción a Z-axis queda registrada explícitamente como una ODR.
4. **Spread y Cylinder:** Spread dobla esquinas, medido por *route cost* y no *Spatial Distance* recta. Cylinder origina su trazado físico desde el círculo superior e ignora obstrucciones internas para la propagación del área.
5. **No Cover forzado:** El cálculo del área geométrica produce casillas candidatas. Cover (cobertura) y otras resoluciones son derivadas por el efecto, no un filtro universal geométrico, conservando la independencia de la resolución mecánica.

## Cierre Formal
- Todas las frases dudosas del D-1A original se han descartado.
- Todas las generalizaciones tridimensionales están formalmente rotuladas en la matriz de trazabilidad como `Extensión del Proyecto`.
- Zero Orphan Policy y comprobación de whitespace aplicadas.
