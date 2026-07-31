# Walkthrough — Sprint D-1 (Geometría Normativa Espacial)

## Objetivo
Producir el NDD arquitectónico oficial **D-1 — Geometría Normativa Espacial**, el primer diseño hijo derivado del Spatial Engine 2.5D. Establece los contratos inmutables de las entidades tridimensionales, la semántica del espacio, las intersecciones, y los invariantes topológicos que regirán a todos los consumidores funcionales (Movement, Threat, LoE, Cover).

## Entregables
- **`docs/designs/normative-spatial-geometry.md`**: El NDD canónico. Formaliza el modelo espacial `(Celda, Columna, Surface, Prisma Corporal, Empty Space)`. Establece los límites matemáticos del Reach, Distancia, y LoE. Crea la librería de Invariantes y Casos Límite.
- **`INDEX.md`**: Actualizado para incluir la referencia al nuevo documento D-1.
- **`PROJECT_STATUS.md`**: Refleja el cierre exitoso del Sprint D-1 en la gobernanza.

## Decisiones Arquitectónicas Registradas (NDD D-1)

1. **Cuantización Rígida:** Se consolida la Spatial Cell de 5x5x5 pies, prohibiendo subdivisión y elevaciones con decimales o floating points (`z=12.5`).
2. **Consolidación Volumétrica (Body Prism):** La ocupación queda matemáticamente definida como el prisma resultante de extruir el Footprint X/Y mediante el Perfil Vertical intrínseco en Z, partiendo desde el soporte transitable.
3. **Múltiples anclajes legales (Surface):** Se establece la capacidad de tener Surfaces superpuestas con elevación distinta en la misma Columna `(x, y)`. Se declaran los invariantes de que ninguna Surface se superpondrá a la cota idéntica de otra transitable.
4. **Desacople Presentacional Absoluto:** Todo cálculo de Cover, LoE o Flanking es un trazado puramente matemático en el servidor; se prohíbe explícitamente usar motores de físicas o UI client-side (como raycasters WebGL) para dictaminar validez.
5. **Composición por Delegación:** D-1 delega formalmente (No Objetivos) aspectos como FoW a D-2, protocolos/almacenamiento a D-3, presentación a D-4, editores a D-5, absteniéndose de mezclar niveles de preocupación.

## Cierre Formal
- Al ser un sprint arquitectónico (Nivel D), no se redactó ni ejecutó código funcional.
- No se crearon ni alteraron Unit Tests.
- Se ha respetado escrupulosamente la separación entre *contratos geométricos* y algoritmos o pseudocódigo implementacional.
- Validaciones documentales (Zero Orphan, `git diff --check`) completadas.
