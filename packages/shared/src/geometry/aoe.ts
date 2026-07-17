import type { Position, AoEShape, CardinalDirection } from "../types.js";

/**
 * Función geométrica pura que determina las celdas interceptadas por una plantilla (AoE).
 * 
 * @param origin Posición origen (normalmente el caster).
 * @param direction Dirección cardinal hacia la cual se proyecta (si aplica).
 * @param shape La forma geométrica del AoE (cone, line, burst).
 * @param cellSizeFeet Tamaño de cada celda (por defecto 5 pies).
 * @returns Array de coordenadas (Position) interceptadas.
 */
export function getCellsIntersectedByAoE(
  origin: Position,
  direction: CardinalDirection,
  shape: AoEShape,
  cellSizeFeet: number = 5
): Position[] {
  switch (shape.type) {
    case "burst":
      return getBurstCells(origin, shape.radiusFeet, cellSizeFeet);
    case "line":
      return getLineCells(origin, direction, shape.lengthFeet, cellSizeFeet);
    case "cone":
      return getConeCells(origin, direction, shape.lengthFeet, cellSizeFeet);
    default:
      return [];
  }
}

// Para burst de D&D 3.5, se mide la distancia desde una intersección o el centro de la celda.
// Asumimos centro de la celda origen y usamos la regla 5-10-5 para distancia radial.
function getBurstCells(origin: Position, radiusFeet: number, cellSizeFeet: number): Position[] {
  const cells: Position[] = [];
  const radiusCells = Math.floor(radiusFeet / cellSizeFeet);
  
  for (let dx = -radiusCells; dx <= radiusCells; dx++) {
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      const distance = getDistance5105(Math.abs(dx), Math.abs(dy)) * cellSizeFeet;
      if (distance <= radiusFeet) {
        cells.push({ x: origin.x + dx, y: origin.y + dy, zFeet: origin.zFeet });
      }
    }
  }
  return cells;
}

// Línea en D&D 3.5: Avanza en la dirección dada por la longitud (lengthFeet).
function getLineCells(origin: Position, direction: CardinalDirection, lengthFeet: number, cellSizeFeet: number): Position[] {
  const cells: Position[] = [];
  const lengthCells = Math.floor(lengthFeet / cellSizeFeet);
  
  const d = getDirectionDelta(direction);
  let currentX = origin.x;
  let currentY = origin.y;
  
  // Excluimos la celda de origen según las reglas (el rayo sale del caster)
  for (let i = 1; i <= lengthCells; i++) {
    currentX += d.dx;
    currentY += d.dy;
    cells.push({ x: currentX, y: currentY, zFeet: origin.zFeet });
  }
  
  return cells;
}

// Cono en D&D 3.5: Expande a 45 grados o un cuarto de círculo (aprox).
function getConeCells(origin: Position, direction: CardinalDirection, lengthFeet: number, cellSizeFeet: number): Position[] {
  const cells: Position[] = [];
  const lengthCells = Math.floor(lengthFeet / cellSizeFeet);
  
  const d = getDirectionDelta(direction);
  
  for (let dist = 1; dist <= lengthCells; dist++) {
    const centerX = origin.x + d.dx * dist;
    const centerY = origin.y + d.dy * dist;
    
    if (d.dx === 0 || d.dy === 0) { // Ortogonal
      const halfWidth = Math.floor(dist / 2);
      for (let w = -halfWidth; w <= halfWidth; w++) {
        const perpX = d.dx === 0 ? w : 0;
        const perpY = d.dy === 0 ? w : 0;
        const totalDx = Math.abs(centerX + perpX - origin.x);
        const totalDy = Math.abs(centerY + perpY - origin.y);
        const distance = getDistance5105(totalDx, totalDy) * cellSizeFeet;
        
        if (distance <= lengthFeet) {
           cells.push({ x: centerX + perpX, y: centerY + perpY, zFeet: origin.zFeet });
        }
      }
    } else { // Diagonal
      const halfWidth = Math.floor(dist / 2);
      for (let w = -halfWidth; w <= halfWidth; w++) {
        // En diagonal, la perpendicular al vector (1, 1) es (1, -1) o (-1, 1).
        // Usamos perpX = w, perpY = -w
        const perpX = d.dx * w;
        const perpY = -d.dy * w;
        
        const totalDx = Math.abs(centerX + perpX - origin.x);
        const totalDy = Math.abs(centerY + perpY - origin.y);
        const distance = getDistance5105(totalDx, totalDy) * cellSizeFeet;
        
        if (distance <= lengthFeet) {
           cells.push({ x: centerX + perpX, y: centerY + perpY, zFeet: origin.zFeet });
        }
      }
    }
  }
  
  return cells;
}

function getDistance5105(dx: number, dy: number): number {
  const max = Math.max(dx, dy);
  const min = Math.min(dx, dy);
  return max + Math.floor(min / 2);
}

function getDirectionDelta(dir: CardinalDirection): { dx: number, dy: number } {
  switch (dir) {
    case "N": return { dx: 0, dy: -1 };
    case "S": return { dx: 0, dy: 1 };
    case "E": return { dx: 1, dy: 0 };
    case "W": return { dx: -1, dy: 0 };
    case "NE": return { dx: 1, dy: -1 };
    case "NW": return { dx: -1, dy: -1 };
    case "SE": return { dx: 1, dy: 1 };
    case "SW": return { dx: -1, dy: 1 };
  }
}
