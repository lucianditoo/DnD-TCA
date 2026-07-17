# Diseño: Acciones de Movimiento Especiales y Simulador de Dados Físicos (Sprint 022)

Este documento detalla la arquitectura para introducir la acción especial de Levantarse (Stand Up), la habilidad de Acrobacias/Piruetas (Tumble) para evitar Ataques de Oportunidad, y el refactor del motor de tiradas del servidor para soportar físicas reales de 2d10 en simulaciones porcentuales.

## 1. Refactor del Simulador de Dados (Percentile Roller)

### 1.1 Objetivo
Estandarizar las tiradas aleatorias del servidor en un único módulo físico que soporte correctamente los dados porcentuales de D&D (d100 simulado con 2d10).

### 1.2 Implementación del Módulo `diceRoller.ts`
Se creará un servicio centralizado `apps/server/src/combat/diceRoller.ts` con la función `rollDice(sides: number): number`.
La lógica específica para `sides === 100` será:
```typescript
export function rollDice(sides: number): number {
  if (sides === 100) {
    const tensDie = Math.floor(Math.random() * 10) * 10; // [00, 10, ..., 90]
    const unitsDie = Math.floor(Math.random() * 10);     // [0, 1, ..., 9]
    if (tensDie === 0 && unitsDie === 0) return 100;
    return tensDie + unitsDie;
  }
  return Math.floor(Math.random() * sides) + 1;
}
```

### 1.3 Casilla "AUTO" y Mutación de Contratos
Los esquemas de comandos en `packages/shared/src/schemas/commands/` incluirán la propiedad opcional `isAutoRoll: z.boolean().optional()`.
En la UI (`ActionsPanel.tsx`), se agregará un checkbox "AUTO". Si se marca, el input numérico se deshabilita, se envía `isAutoRoll: true`, y el comando en el servidor tira los dados automáticamente.

## 2. Levantarse (Stand Up) & Piruetas (Tumble)

### 2.1 Acción de Levantarse (MOVE-08)
- **Shared Rule**: Se añadirá `calculateStandUpCostFeet(snapshot, combatant)` en `rules.ts` para devolver `baseSpeedFeet / 2`.
- **Command**: Se expandirá `useTacticalActionSchema` en `tacticalCommands.ts` con la acción `"stand-up"`. Aceptará `tumbleRoll: z.number().int().optional()` y `isAutoRoll: z.boolean().optional()`.
- **Preflight**: Solo válido si el combatiente tiene el trait `PRONE` y le queda movimiento suficiente. Consume una acción de movimiento (`usedMoveAction = true`).
- **Provocación de AdO**: Por defecto genera AdOs de todos los enemigos que lo amenazan (a menos que se evite con Tumble).

### 2.2 Habilidad Tumble (CD 15)
- Si el usuario provee un `tumbleRoll` (o `isAutoRoll: true`), se evalúa una prueba contra CD 15.
- La prueba suma el Modificador de Destreza.
- Si se alcanza 15 o más, no provoca AdO al levantarse. Si falla, provoca AdO normalmente.
- El efecto `srd_prone` es removido de `effectInstances`.

## 3. Respuestas al Checklist de Arquitectura

1. **Filtro de Irreversibilidad a 20 Sprints (Rerolls y Lanzamientos Potenciados):**
   Al centralizar todas las llamadas de dados en `diceRoller.rollDice(sides, context)`, el motor de tiradas adquiere la capacidad de inspeccionar el `context` (estado y buffs del combatiente). Cuando lleguen dotes como "Lanzamiento Potenciado" o conjuros de Reroll, la propia función `rollDice` evaluará estas reglas internas de iteración, efectuando re-tiradas y retornando únicamente el escalar final. Así, los Command Handlers se mantienen 100% ajenos a la mecánica de dados modificados, manteniendo una separación total de responsabilidades.

2. **Complejidad Accidental (Evitar duplicación de fórmulas elásticas):**
   Para evitar que el cliente y el servidor difieran en el cálculo del coste de movimiento (`baseSpeedFeet / 2`), crearemos una función pura exportada en `packages/shared/src/rules.ts` llamada `calculateStandUpCostFeet(snapshot, combatant)`. Tanto la interfaz de usuario (para habilitar o deshabilitar el botón de Levantarse) como el comando del servidor (para descontar los pies del turno) importarán e invocarán esta única fuente de verdad.

3. **La Regla de Tres (Casos de Uso Beneficiados a Futuro):**
   - **Prone Eschewal (Levantarse Rápido)**: Esta dote permitirá interceptar `calculateStandUpCostFeet` para devolver coste 0 o no consumir acción, y esquivará el AdO automáticamente.
   - **Moverse en Casillas Amenazadas (Tumble CD 15 / 25)**: La misma función resolutora de Tumble podrá ser inyectada en `movementCommands.ts` para permitir el movimiento acrobático evitando AdOs estándar.
   - **Probabilidad de Fallo por Ocultación (Concealment)**: Conjuros como *Bruma de Oscurecimiento* requerirán tiradas porcentuales reales de d100. El simulador de dados físicos 2d10 garantizará distribuciones precisas para estas mecánicas.
