# Documento de Diseño: Spell Areas of Effect & Polygonal Templates (Sprint 033)

## Objetivo
Establecer la infraestructura geométrica isomórfica en el paquete `shared` para calcular plantillas poligonales de áreas de efecto (AoE) de conjuros bajo las reglas de D&D 3.5. Integrar este cálculo en el backend transaccional para resolver salvaciones y daño simultáneo a múltiples objetivos, y en el frontend para dibujar proyecciones predictivas.

## Arquitectura de Tipos (shared/src/types)

Se define un nuevo catálogo de formas de áreas mágicas:
```typescript
export type AoEShapeType = "cone" | "line" | "burst";

export type AoEShape = 
  | { type: "cone"; lengthFeet: number }
  | { type: "line"; lengthFeet: number; widthFeet: 5 }
  | { type: "burst"; radiusFeet: number };

export type CardinalDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
```

## Helper Puro Isomórfico (shared/src/geometry/aoe.ts)

Se expondrá una función determinista y pura que calculará la matriz de celdas bajo el efecto de una plantilla:

```typescript
export function getCellsIntersectedByAoE(
  origin: Position, 
  direction: CardinalDirection, 
  shape: AoEShape, 
  cellSizeFeet: number = 5
): Position[] {
  // Implementación geométrica para aproximaciones en grilla (Raycasting o discretización)
}
```

## Backend: Ejecución en `abilityCommands.ts`

Al resolver `cast-spell` con un objetivo de área, se ejecutará el pipeline simultáneo:

1. Llamar a `getCellsIntersectedByAoE` para obtener `aoeCells`.
2. Crear un `Set` o usar un mapeo de coordenadas rápidas con `footprintCellKey`.
3. Iterar todos los combatientes; por cada combatiente, comprobar si `getCombatantOccupiedCells(combatant, snapshot)` se solapa (intersecta) en al menos 1 celda con `aoeCells`.
4. Los combatientes interceptados entran a un bucle que resuelve, uno por uno, la tirada de salvación utilizando el mismo resolver del Sprint 024.
5. Se mitiga el daño (`half` / `negates`) y se aplican las condiciones en el `draft` del estado. Al final, se hace un único `commit`.

## Frontend: Overlay Predictivo en React

En `ActionsPanel.tsx` o `Board.tsx`, se utilizará un `useMemo` local:
```tsx
const aoePreviewCells = useMemo(() => {
  if (!spell.aoe || !targetDirection) return [];
  return getCellsIntersectedByAoE(caster.position, targetDirection, spell.aoe);
}, [caster.position, targetDirection, spell.aoe]);
```
Se renderizarán polígonos o celdas de overlay de color naranja. Los tokens que interseccionen mostrarán un indicador de peligro.

---

## Design Review Checklist (.ai/DESIGN_REVIEW_CHECKLIST.md)

### 1. Filtro de Irreversibilidad a 20 Sprints
**Pregunta:** Al estructurar la intercepción multiposición mediante el solapamiento de arrays de celdas, ¿cómo diseñamos el resolver de AoE para que en el futuro mecánicas de fuego amigo (Friendly Fire), dotes como "Esculpir Conjuro" (Sculpt Spell) o la Cobertura del terreno obstruyendo el cono se integren de forma natural sin modificar el Command Handler?

**Respuesta:** La lógica de intercepción de celdas recae enteramente en la función pura y aislada `getCellsIntersectedByAoE` y su filtro asociado. 
Para integrar Line of Effect (LoS/Cobertura), la función aceptará opcionalmente la topología del tablero (`isImpassable` o los muros de `Board`), eliminando determinísticamente las celdas ocluidas antes de devolver el array. 
Para mecánicas como Sculpt Spell, se modificará el `AoEShape` en el catálogo de modificadores (p.ej. vaciando ciertas casillas) o se alterará el filtro posterior sin necesidad de inyectar reglas complejas en `abilityCommands.ts`. El handler seguirá consumiendo un array genérico de `Position[]`.

### 2. Complejidad Accidental
**Pregunta:** ¿Cómo evitamos la duplicación de código en el cálculo de colisiones geométricas y aseguramos que el frontend dibuje las plantillas de forma 100% simétrica a la resolución final del servidor?

**Respuesta:** Aprovechando la arquitectura isomórfica del monorrepósito. La función `getCellsIntersectedByAoE` pertenecerá a `@dnd-tactical/shared`. El Frontend utilizará la misma idéntica función que el servidor para pintar los overlays superpuestos en la UI y comprobar qué combatientes están amenazados visualmente, garantizando que el usuario observe exactamente lo que el servidor resolverá con autoridad de milisegundos. 

### 3. La Regla de Tres
**Pregunta:** Nombra tres conjuros del catálogo que se beneficiarán directamente de este pipeline de áreas de efecto.

**Respuesta:** 
1. **Burning Hands (Manos Ardientes):** Geometría `"cone"` con longitud de 15 ft.
2. **Lightning Bolt (Relámpago):** Geometría `"line"` con longitud de 120 ft.
3. **Fireball (Bola de Fuego):** Geometría `"burst"` con radio de 20 ft.
