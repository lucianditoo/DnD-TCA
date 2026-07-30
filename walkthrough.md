# Walkthrough — Sprint A-001 (Spatial Engine & 2.5D Tactical Presentation)

## Objetivo

Producir el NDD (Documento de Diseño de Nodo/Arquitectónico) oficial que define la evolución del motor táctico hacia un espacio discreto tridimensional con presentación 2.5D, conforme a la decisión del propietario de no utilizar motores de física continua. Este sprint es puramente arquitectónico (Nivel D) y no incluye implementaciones en código.

## Artefactos Entregados

- **`docs/designs/spatial-engine-2.5d.md`**: El NDD canónico.
- **`INDEX.md`**: Actualizado para incluir la referencia al nuevo documento de diseño.
- **`PROJECT_STATUS.md`**: Actualizado reflejando el cierre del Sprint A-001.

## Decisiones Arquitectónicas Registradas (NDD)

1. **Modelo de Espacio Discreto:** Se utilizarán columnas x/y, pero ahora con una o múltiples `Surface`s explícitas (pisos transitables/sólidos), conectados mediante una topología formal.
2. **Volumen Corporal (Prisma):** La ocupación y line-of-effect operan ahora sobre volúmenes (prismas rectangulares) y ya no sobre proyecciones planas de la celda origen.
3. **Representación 2.5D:** La interfaz de React se moverá de la grilla ortogonal CSS actual a un canvas/escena con cámara interactiva isométrica libre en 360°, manteniéndose como un renderizador "dumb" que sólo dibuja el estado autoritativo dictado por el servidor.
4. **Posición de Soporte:** Introducida la `SpatialPosition`, que identifica unívocamente sobre qué superficie se está anclado y cuál es la elevación z real.

## Cierre Formal

Al ser un sprint documental, no se ejecutaron pipelines de compilación de CI. Las revisiones de índice, cero políticas huérfanas y Source of Truth se han mantenido intactas. El sistema de documentación (GOVERNANCE.md) ratifica que este documento (`docs/designs/spatial-engine-2.5d.md`) actúa como la fuente unificada para cualquier agente futuro al tocar la geometría, el engine de movimiento, o el mapa del proyecto.
