# Diseño Técnico: Sistema de Críticos del MVP (Actualizado)

Este documento define la especificación detallada para la implementación de amenazas, confirmaciones e impactos de críticos en el motor táctico de combate de D&D 3.5.

---

## 1. Objetivo
Implementar las reglas de críticos oficiales de D&D 3.5 mediante un flujo interactivo de dos pasos (Intención de Ataque -> Amenaza -> Confirmación manual de Crítico), garantizando que las tiradas de dados sean ingresadas manualmente por los jugadores o el GM, y previniendo vulnerabilidades y recalculaciones en el cliente.

---

## 2. Reglas de Críticos a Implementar

### Aciertos y Fallos Automáticos
* **20 Natural**: Acierto automático. Siempre impacta al objetivo (incluso si la CA del objetivo es superior al total de ataque). Siempre amenaza crítico (rango mínimo 20).
* **1 Natural**: Fallo automático. Siempre erra el ataque, independientemente de los modificadores.

### Rango de Amenaza (Threat Range)
* Cada arma tiene un rango de amenaza definido en el catálogo (ej: espada larga `19-20`, guadaña `20`, cimitarra `18-20`). Si no se especifica, es `20`.
* Se produce una **Amenaza de Crítico** si:
  1. El resultado natural del d20 está dentro del rango de amenaza del arma equipada.
  2. **Y** el total del ataque (d20 + modificadores) es suficiente para impactar la CA del objetivo (o es un 20 natural). Un tiro en el rango de amenaza que no iguala o supera la CA del objetivo es un fallo normal.

### Tirada de Confirmación (Confirmation Roll)
* Si hay amenaza, el atacante realiza una segunda tirada d20.
* La confirmación se calcula comparando la tirada d20 de confirmación más los modificadores del ataque inicial contra la CA del objetivo en el momento del impacto:
  $$\text{confirmD20Roll} + \text{attackModifier} \ge \text{targetArmorClass}$$
* **Importante**: No se utiliza `attackTotal` de la primera tirada (el cual incluye la tirada d20 inicial), sino el `attackModifier` base puro.
* **1 natural de confirmación**: Siempre falla.
* **20 natural de confirmación**: Siempre confirma.

---

## 3. Flujo en WebSocket y Estado de la Sala (Dos Pasos)

### Modelo de Datos: `AttackThreatState`
Para resolver la confirmación en el servidor de manera segura y autoritativa, se guardará el contexto completo de la agresión en el estado de la sala:

```typescript
export interface AttackThreatState {
  readonly attackerId: string;
  readonly targetId: string;
  readonly initialD20Roll: number;
  readonly attackModifier: number;      // Suma total de bonos del ataque inicial (BAB + Fuerza/Destreza + buffs - penalizaciones de rango)
  readonly targetArmorClass: number;     // CA final calculada del objetivo al momento del ataque inicial
  readonly normalDamage: number;         // Daño normal ingresado o calculado en la primera tirada
  readonly criticalThreatFrom: number;   // Rango de amenaza del arma
  readonly criticalMultiplier: number;   // Multiplicador de crítico del arma
  readonly weaponName: string;           // Nombre del arma para la narración
  readonly isFullAttack: boolean;
  readonly fightingDefensively?: boolean;
  readonly label: string;
}
```

### Modificación de Estructuras y Comandos
* **`CombatRoom` y `CombatRulesSnapshot`** contendrán:
  `activeAttackThreat: AttackThreatState | null;`
* **Nuevos Comandos en `ClientCommand`**:
  * `{ type: "resolve-attack-confirmation"; roomCode: string; actorId: string; d20Roll: number; damage: number | null }`
  * `{ type: "cancel-attack-threat"; roomCode: string; actorId: string }`

---

## 4. Lógica de Negocio y Seguridad

### Regla de Validación de Críticos (`rules.ts`)
* `isCriticalThreat(d20Roll: number, attackTotal: number, targetAC: number, threatFrom: number): boolean`
  * Retorna `true` si `(d20Roll >= threatFrom && attackTotal >= targetAC) || d20Roll === 20`.
* `isCriticalConfirmed(confirmD20Roll: number, attackModifier: number, targetAC: number): boolean`
  * Retorna:
    * `false` si `confirmD20Roll === 1`
    * `true` si `confirmD20Roll === 20`
    * `true` si `confirmD20Roll + attackModifier >= targetAC`

### Seguridad y Control de Acceso (Ownership)
Al recibir `resolve-attack-confirmation` o `cancel-attack-threat`, el servidor validará que el `actorId` del cliente:
1. Sea el controlador del combatiente atacante (dueño de su ficha).
2. O sea el GM.
* Cualquier petición de otros jugadores será rechazada con un error de permisos.

### Bloqueo de Flujo del Combate
Mientras `activeAttackThreat` no sea `null`:
* Se bloquea cualquier movimiento o inicio de otra acción en el servidor (tanto en `rules.ts` como en validadores de comandos).
* La interfaz de usuario ocultará las opciones ordinarias y renderizará únicamente el modal de resolución para el atacante o el GM.

---

## 5. Estrategia de Testing

### Pruebas Unitarias (`tests/rules.test.mjs`)
Implementaremos tests para validar cada regla de borde:
1. **Amenazas**:
   * Natural 20 siempre amenaza e impacta automáticamente.
   * Natural 1 siempre falla automáticamente.
   * Natural 19 con arma de rango 19-20 amenaza solo si el ataque total iguala o supera la CA del objetivo.
2. **Confirmación**:
   * La confirmación utiliza `attackModifier`, no `attackTotal`.
   * Confirmación con 1 natural falla automáticamente.
   * Confirmación con 20 natural confirma automáticamente.
3. **Resolución de Daño**:
   * Si la confirmación falla, se aplica únicamente el `normalDamage`.
   * Si la confirmación tiene éxito, se aplica el `criticalDamage` ingresado por el usuario.
