# Walkthrough — Sprint D-1A (Proyección Normativa de Áreas)

## Objetivo
El proyecto ya cuenta con el diseño base normativo del espacio 3D (D-1R1), sin embargo carecía de la formalización geométrica que rige a las plantillas de Áreas de Efecto. Este sprint crea el NDD de "Normative Area Shape Projection", detallando la inclusión estricta de celdas para todas las áreas del SRD, independizando el concepto de Area Projection de `Spatial Trace` y formalizando el pipeline de ejecución espacial en el servidor.

## Entregables
- **`docs/designs/normative-area-shape-projection.md`**: NDD canónico. Formaliza el comportamiento de Cone, Line, Burst, Spread, Emanation, Cylinder y Cube de acuerdo al SRD pero instanciado bajo las limitaciones del grid 3D discreto establecido en D-1R1.
- **`INDEX.md`**: Actualizado para incluir `docs/designs/normative-area-shape-projection.md`.
- **`PROJECT_STATUS.md`**: Refleja el cierre exitoso del Sprint D-1A.

## Decisiones Arquitectónicas (NDD D-1A)

1. **Origen Cuantizado:** El área de las formas jamás se proyecta desde un espacio continuo, se proyecta desde una intersección de la grilla volumétrica o una arista/vértice, salvo en el caso del "Targeted Cell" donde irradia desde la ocupación.
2. **Orientación XYZ:** Formas direccionales (conos, líneas) no están limitadas a vectores bidimensionales. El servidor acepta cualquier vector central 3D para evaluar la inclusión de los volúmenes, permitiendo bañar balcones y abismos.
3. **Inclusión por Borde SRD:** Se establece normativamente el "Half-Square Rule" y "Far-Edge Rule" adaptados al espacio volumétrico: toda celda cubierta en más de un 50% por la matemática de un Cono pertenece a él; todo cubo intersectado por la arista final de un Burst pertenece al Burst completo. Nunca existe afectación parcial geométrica.
4. **Desacople Projection vs Trace:** D-1A formaliza que generar el volumen de inclusión (`Area Projection`) es un paso previo e independiente del trazado de bloqueo físico (`Spatial Trace`/LoE). Un área atraviesa paredes en su generación teórica, pero las celdas resultan censuradas después al evaluar si poseen `Line of Effect` al centro (clipping).
5. **Diferenciación Spatial Distance vs Route Cost en Spread:** El Burst y la Emanation crecen puramente utilizando métricas de `Spatial Distance`. El Spread es la excepción sistémica que dobla esquinas, obligando a utilizar `Route Cost` radicado desde el origen para evitar paredes sin ser censurado por el clipping final.

## Cierre Formal
- Al ser un sprint puramente arquitectónico (Nivel D), no se redactó ni ejecutó código funcional ni algoritmos concretos.
- No se definieron rules concretos sobre salvaciones o daño, únicamente la inclusión volumétrica de la plantilla.
- Validaciones documentales (Zero Orphan, `git diff --check`) completadas.
