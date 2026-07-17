# Sprint 020: Saving Throws Core & Resolution

## Objetivo
Implementar el motor central de Salvaciones (Saving Throws) respetando la arquitectura de D&D 3.5, con una capa puramente predictiva (Rule Engine) y una capa autoritativa atómica (Server Command Handler), siguiendo el flujo transaccional exitoso del Sprint 019.

## 1. Diseño de Arquitectura

### A. Capa de Datos (Snapshot V3)
El `CombatantSnapshot` se extenderá para incluir las bases de salvación:
```typescript
interface Combatant {
  // ...
  baseFortitude: number;
  baseReflex: number;
  baseWill: number;
}
```
Además, en `packages/shared/src/effects/contracts.ts`, `EffectStat` incluirá las nuevas stats para recibir bonificadores o penalizadores de manera declarativa:
```typescript
export type EffectStat = "ATTACK" | "ARMOR_CLASS" | "SPEED" | "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA" | "FORTITUDE" | "REFLEX" | "WILL";
```

### B. Capa de Reglas (Proyección Pura)
Añadiremos en `packages/shared/src/rules.ts` la función `totalSavingThrow` en el `RuleEvaluator`:
```typescript
totalSavingThrow(
  context: CombatRulesSnapshot<TEffectId>,
  combatant: Combatant,
  saveType: "fortitude" | "reflex" | "will"
): { total: number; parts: string[] }
```
La fórmula:
1. Extrae la base (ej. `combatant.baseFortitude`).
2. Determina el atributo asociado: Fort (CON), Ref (DEX), Will (WIS).
3. Obtiene el score efectivo usando `_getEffectiveAbilityScoreFromReduced`.
4. Obtiene modificadores directos de la stat (ej. `"FORTITUDE"`) desde `ReducedEffects`.
5. Suma todo devolviendo el `total` y las `parts`.

### C. Capa de Comandos (Pipeline Transaccional del Servidor)
Nuevo endpoint WebSocket estricto:
```typescript
{
  type: "resolve-saving-throw",
  roomCode: string,
  targetId: string,
  saveType: "fortitude" | "reflex" | "will",
  dc: number,
  d20Roll: number
}
```
- El `savingThrowResolver` en el servidor validará el estado del target (no muerto).
- Calculará el total: `Rules.totalSavingThrow(...)`.
- Evaluará éxito: `d20Roll === 20 ? true : (d20Roll === 1 ? false : (d20Roll + total >= dc))`.
- Emitirá un log narrativo (CombatLog) atómico indicando Éxito/Fallo y aplicará posibles daños o condiciones.

## 2. Design Review Checklist (.ai/DESIGN_REVIEW_CHECKLIST.md)

### 1. Filtro de Irreversibilidad a 20 Sprints
**Pregunta:** ¿Cómo diseñamos el resolver para que soporte "1 Natural/20 Natural" o "Evasion" sin alterar el Command Handler?
**Respuesta:** El Command Handler `resolve-saving-throw` delega en una función pura de resolución (ej. `resolveSavingThrow(snapshot, target, d20Roll, dc, options)`). Dentro de ese resolvedor, podemos comprobar fácilmente `if (d20Roll === 1) return { success: false }` o `if (d20Roll === 20) return { success: true }`. Para "Evasión", al resolver el daño asociado a la salvación (enviar una intención de daño acoplada a la salvación o interceptarla en el reducer de HP), consultaremos `hasEffectTrait(reduced, "EVASION")` y si `success` es `true`, multiplicaremos el daño por 0, manteniendo el handler original intacto sin fragmentar la red (solo el motor interno reacciona).

### 2. Complejidad Accidental
**Pregunta:** ¿De qué manera garantizamos que el preview interactivo consuma el mismo método para que el jugador vea el desglose?
**Respuesta:** Empaquetando la lógica estrictamente en `Rules.totalSavingThrow(...)` dentro de `packages/shared/src/rules.ts`, que es agnóstico del entorno. Así, el componente de UI llamará directamente a `Rules.totalSavingThrow(snapshot, combatant, "reflex")`, renderizando el mismo arreglo `parts` y `total` que el servidor usará para resolver. No existirá lógica paralela en el cliente.

### 3. La Regla de Tres
**Pregunta:** Nombra tres hechizos o condiciones futuras que se beneficiarán directamente.
**Respuesta:** 
1. **Hold Person**: Requiere que el objetivo haga tiradas de Will repetidas; el motor transaccional permite automatizar estas tiradas de forma robusta al final de cada turno.
2. **Cure Light Wounds contra Muertos Vivientes**: Al curar a un no-muerto, actúa como daño pero requiere salvación de Voluntad. El flujo reutilizará este endpoint unificado.
3. **Veneno (Poison)**: Daño por habilidad (ej. CON damage) al fallar salvaciones de Fortaleza periódicas, calculadas y resueltas por el mismo núcleo.
