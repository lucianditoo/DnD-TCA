export interface DiceRollerContext {
  // En el futuro podemos pasar buffs o estados que alteren el dado.
}

/**
 * Motor físico estocástico.
 * @param sides - Número de caras del dado
 * @param context - Contexto futuro para Rerolls o alteraciones puras
 */
export function rollDice(sides: number, context?: DiceRollerContext): number {
  if (sides === 100) {
    const tensDie = Math.floor(Math.random() * 10) * 10; // [00, 10, ..., 90]
    const unitsDie = Math.floor(Math.random() * 10);     // [0, 1, ..., 9]
    if (tensDie === 0 && unitsDie === 0) return 100;
    return tensDie + unitsDie;
  }
  return Math.floor(Math.random() * sides) + 1;
}
