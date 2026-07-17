# Documento de Diseño Funcional: Sprint 039 — Power Attack Declarativo

## 1. Objetivo y Frontera de Autorización
Establecer el soporte transaccional e isomorfo para la dote *Ataque Poderoso (Power Attack)* (`srd_power_attack`) alineado con el PHB 3.5 (pág. 134). El diseño se acopla de forma limpia como una extensión opt-in del comando existente sin alterar la estructura base de la red.

## 2. Alineación Específica del Entorno (Corrección de Auditoría)

### 2.1. Extensión del Esquema Zod Real
El campo `powerAttackSacrifice` se inyecta de forma opcional dentro del validador de comandos existente en `packages/shared/src/schemas/commands/attackCommands.ts`:

```typescript
// Extensión declarativa sobre el esquema real de resolve-attack
export const attackPayloadExtension = {
  powerAttackSacrifice: z.number().int().nonnegative().optional()
};
```

### 2.2. Pipeline Unificado de Reglas y Read-Model (`packages/shared/src/rules.ts`)
Para evitar discrepancias predictivas en la UI (`ActionsPanel`), el sacrificio de Ataque Poderoso se pasará en el `attackContext`.

* `Rules.getEffectiveAttackRoutine` interceptará `attackContext.powerAttackSacrifice` y lo aplicará como un penalizador plano a cada elemento de la rutina resultante.
* El cálculo del daño se resolverá de manera pura dentro de las funciones de daño de `packages/shared/src/rules.ts`, consultando la propiedad `weaponHandedness` de la mano activa contra el `EquipmentCatalog`. El daño base de la tirada recibirá un bono inmutable de:
   * Arma a Dos Manos (Two-Handed): `powerAttackSacrifice * 2`
   * Arma de Una Mano (One-Handed): `powerAttackSacrifice * 1`
   * Arma Ligera (Light): `0` (excepto ataques naturales/sin arma).

## 3. Cronograma de Sprints (Backlog Sanado)

* Sprint 038: Full Attack V2 (Disparo Rápido & Aceleración) [PENDIENTE DE PROCEED].
* Sprint 039: Ataques Especiales Declarativos (Power Attack) [EN FASE DE DISEÑO].
