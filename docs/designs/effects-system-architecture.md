# Diseño Arquitectónico Definitivo: Sistema Universal de Efectos Activos (ActiveEffects)

*Nota: Tras el análisis arquitectónico, este diseño reemplaza el concepto estricto de "Sistema de Condiciones" por un "Sistema Genérico de Efectos", del cual las Condiciones son un subconjunto.*

Este documento establece la arquitectura a largo plazo para el manejo de alteraciones temporales o permanentes en el motor táctico D&D 3.5. Responde a la necesidad de escalar a cientos de reglas (Condiciones, Hechizos, Auras, Dotes, Entorno).

## 1. Niveles Estructurales (La Triada de Efectos)
El sistema separa estrictamente la definición de un efecto de su existencia en el tiempo y espacio.

### Nivel 1: EffectDefinition (El Catálogo)
Es la plantilla estática que describe qué es y qué hace el efecto (ej. "Bless", "Stunned").
**Reglas Inquebrantables del Catálogo:**
- Es exclusivamente un repositorio de datos declarativos (metadatos, traits, modifiers).
- **No contiene comportamiento, funciones ni callbacks.**
- **Nunca puede consultar el estado del combate.** Es 100% determinista, serializable y testeable en aislamiento.

### Nivel 2: EffectInstance (El Estado)
Es la aplicación concreta y temporal de una plantilla sobre el campo de batalla.
Aquí vive el estado vivo de la regla: `instanceId`, `source`, objetivos (`targetIds`, `targetArea`), cuándo se aplicó, su duración restante y `stacks`.

### Nivel 3: ActiveEffects (El Subconjunto)
Es la colección de `EffectInstance` que afectan directamente a un objetivo específico en un instante dado. El Rule Engine usa esta colección (derivada del estado global) para calcular modificadores finales.

## 2. Almacenamiento y Ownership (Propiedad Global)
Tras el análisis en `docs/designs/effect-storage-analysis.md`, se abandona el modelo donde el `Combatant` es dueño de sus efectos.

**Modelo Definitivo:**
El `CombatState` (la sala entera) es el único dueño del array plano de `EffectInstances`.
- Permite modelar Auras, Muros o terrenos mágicos que no tienen un `targetId` biológico específico, sino un área poligonal.
- Permite que efectos de área (ej. *Bendición* sobre 4 aliados) sean una única instancia con múltiples `targetIds`, actualizable atómicamente.
- El ciclo de vida del efecto se independiza del ciclo de vida del combatiente.

## 3. Modelo de Datos

```typescript
// Nivel 1: Definition
type EffectId = keyof typeof effectsCatalog;

// Nivel 2: Instance
interface EffectInstance {
  instanceId: string;       // Identificador único de esta aplicación concreta
  effectId: EffectId;       // Referencia a EffectDefinition
  source: EffectSource;     // Causante polimórfico (criatura, objeto, hechizo, aura, terreno)
  targets?: string[];       // Combatant IDs afectados (opcional si es área)
  targetArea?: Polygon;     // Opcional para zonas espaciales
  appliedAtEvent: { type: "TurnStarted" | "ActionResolved", combatantId?: string, round: number };
  duration?: DurationPolicy;
  stacks?: number;
}
```

### 3.1 Duraciones Polimórficas (DurationPolicy)
> **Nota de Enmienda (ADR-0008):** La versión original de este contrato utilizaba inferencias relativas al turno como `until_source_turn_start`. Fue modificada para exigir anclas temporales explícitas e identidades monotónicas, garantizando un Tick Layer determinista. Ver `ADR-0008`.

```typescript
type DurationPolicy = 
  | { type: "rounds", count: number, anchorCombatantId: string, phase: "start" | "end", appliedAtSequence: number }
  | { type: "until_turn", anchorCombatantId: string, phase: "start" | "end", appliedAtSequence: number }
  | { type: "until_rest" }
  | { type: "permanent" }
  | { type: "until_dispelled" }
  | { type: "until_save_success", saveType: "fort" | "ref" | "will", dc: number };
```

## 4. Rule Engine vs Effect Manager
La separación de responsabilidades debe ser estricta:
- **Rule Engine**: **Nunca modifica** los `ActiveEffects`. Su trabajo es exclusivamente *leer* el array global, cruzarlo con el `EffectDefinition`, extraer los Traits/Modifiers aplicables a un combatiente y arrojar un resultado derivado.
- **Effect Manager (Mutation Layer)**: Es la única entidad con permiso para despachar mutaciones de estado (`addEffect`, `removeEffect`, `updateStacks`).

## 5. El Event Bus (Tick Layer Desacoplado)
El motor opera un bus de eventos estricto centrado en el dominio del combate.
**Regla:** Quedan prohibidos los eventos específicos de efectos (ej. `EffectExpired`, `SpellEnded`). 
El sistema despacha eventos puros del motor táctico:
- `TurnStarted` / `TurnEnded`
- `RoundStarted` / `RoundEnded`
- `CombatStarted` / `CombatFinished`
- `AttackResolved` / `SavingThrowResolved`

El *Effect Manager* escucha, por ejemplo, `TurnEnded`, evalúa silenciosamente las duraciones de los `EffectInstances` vigentes, y si una expira, ejecuta una mutación atómica para limpiar el array.

## 6. Integración Funcional (Traits y Modifiers)
El catálogo provee componentes sin lógica.

### 6.1 Traits (Estados Lógicos Descriptivos)
Los Traits describen el *estado pasivo*, no las capacidades operativas (nada de `canMove`).
- `IMMOBILIZED`, `UNCONSCIOUS`, `NO_DEX_TO_AC`, `NO_THREAT`, `LIMITED_ACTIONS`, `PRONE`, `BLIND`.
El *Rule Engine* lee "IMMOBILIZED" y concluye que se prohíbe el movimiento.

### 6.2 Modifiers (Mecánicos y Numéricos)
Un Modifier puede alterar números o anular reglas enteras:
- **Numéricos**: `{ type: "numeric", stat: "AC", bonusType: "morale", value: 2 }`
- **Mecánicos**: `{ type: "rule_override", rule: "FORBID_CHARGE" }` o `{ type: "mechanic", rule: "CONCEALMENT", percentage: 20 }`.

## 7. Pipeline de Resolución Explícito
El flujo de lectura durante la partida es secuencial y unidireccional:
1. **CombatState**: Almacena de forma plana el `EffectInstance`.
2. **Rule Engine**: Toma una petición (ej. "obtener CA") y filtra el State global buscando instancias cuyo target sea el combatiente.
3. **Traits & Modifiers Extractor**: Cruza los IDs instanciados contra el Catálogo (`EffectDefinition`), apila, compara tipos de bonos (ej. el buff Moral más alto) y extrae las reglas finales.
4. **Rule Helpers**: Ejecutan la petición aplicando los bonificadores finales purgados.
5. **CombatSnapshot**: Serializa el estado derivado final y lo envía a la UI. No ejecuta ningún cálculo matemático propio.

## 8. Políticas Fundamentales del Proyecto

### 8.1 Data Driven First
Todo efecto nuevo deberá implementarse, siempre que sea posible, mediante datos declarativos en el catálogo.
La incorporación de una nueva condición, hechizo, veneno o aura **nunca deberá requerir modificar el Rule Engine** salvo que introduzca una regla mecánica fundamental que el motor no comprendía previamente.

### 8.2 Compatibilidad Futura Universal (Future Compatibility)
El diseño garantiza soporte para la totalidad del ecosistema persistente de D&D 3.5:
- **Hechizos**: Un `EffectDefinition` de *Haste* provee Modifiers de velocidad extra y ataques adicionales, gobernados por una `DurationPolicy` de asaltos.
- **Peligros Ambientales (Hazards)**: Un `EffectInstance` que no posee `targetIds`, sino un polígono de área, inyectando un Trait de daño por fuego a cualquiera que cruce la zona.
- **Enfermedades**: Un efecto persistente cuya `DurationPolicy` es `until_save_success`, y cuyo despachador escucha eventos diarios del Event Bus para forzar tiradas.
