# Walkthrough — Sprint D-1B-Research (Auditoría de Reglas de Movimiento)

## Objetivo
Realizar una auditoría exhaustiva de **todas las reglas oficiales de D&D 3.5e** (PHB, SRD, DMG) relativas al movimiento táctico antes de iniciar el diseño arquitectónico D-1B (que migrará el movimiento al `Spatial Engine 2.5D`). No diseñar ni proponer algoritmos; puramente mapear reglas vs documentación existente.

## Entregables
- **`docs/audits/movement-rules-audit.md`**: Nuevo documento de auditoría que recopila:
  1. Inventario pormenorizado de reglas oficiales y su interacción con los sistemas del juego (Movement, AoO, Charge, Reach, etc.).
  2. Matriz de estado mapeando dichas reglas contra los diseños y NDD del proyecto (`movement-validation.md`, `run-design.md`, etc.).
  3. Huecos Normativos (reglas SRD carentes de cobertura arquitectónica en el sistema actual).
  4. Preguntas Abiertas (casos delegados al criterio del DM en el PHB/DMG que requerirán resolución discreta).
  5. Extensiones Necesarias (interacciones del movimiento clásico con los recientes contratos tridimensionales de D-1R1 como `Surfaces` y `Body Prisms`).
- **`INDEX.md`**: Actualizado para incorporar `docs/audits/movement-rules-audit.md`.
- **`PROJECT_STATUS.md`**: Avanzado al término del sprint de Research.

## Metodología
Se completó el *Reader Pipeline Obligatorio* y se extrajeron las siguientes reglas canónicas:
- Movimiento Táctico (5-10-5).
- Terreno Difícil (×2 coste, bloqueo de esquinas).
- Paso de 5 pies (sin consumo de acción, inmune a AoO).
- Squeezing (-4 ATK/AC, mitad de ancho).
- Atravesar espacios ocupados (amigos vs. oponentes de distinto tamaño).
- Modos de acción: Carga, Correr, Retirada.
- Tumble/Acrobacias.
- Interacciones de AoO (provocación al abandonar casilla).
- Vuelo, Maniobrabilidad y Caída (del DMG/SRD).
- Large Footprints y solapamientos.

## Cierre Formal
- Al ser un sprint de "Research", **no se escribió código, algoritmos ni pseudocódigo**.
- Se cumplió estrictamente la directiva de SSOT y Zero Orphan, registrando el documento en `INDEX.md`.
- Todas las menciones normativas se extrajeron sin interpretaciones propias del manual 3.5e, manteniendo el rigor oficial del SRD.
