// Cell-center supercover. Vertex crossings include both adjacent cells.
export function traversedCellKeysBetween(ax: number, ay: number, bx: number, by: number): Set<string> {
  const dx = bx - ax;
  const dy = by - ay;
  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;
  let x = ax;
  let y = ay;
  let ix = 0;
  let iy = 0;
  const visited = new Set<string>([`${x},${y}`]);
  while (ix < nx || iy < ny) {
    const lhs = (2 * ix + 1) * ny;
    const rhs = (2 * iy + 1) * nx;
    if (ny === 0 || (nx > 0 && lhs < rhs)) {
      x += signX;
      ix += 1;
    } else if (nx === 0 || lhs > rhs) {
      y += signY;
      iy += 1;
    } else {
      visited.add(`${x + signX},${y}`);
      visited.add(`${x},${y + signY}`);
      x += signX;
      y += signY;
      ix += 1;
      iy += 1;
    }
    visited.add(`${x},${y}`);
  }
  return visited;
}
