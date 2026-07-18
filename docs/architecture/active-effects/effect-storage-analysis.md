# Análisis Arquitectónico: Almacenamiento de Efectos (Ownership)

## 1. Planteamiento del Problema
Tras decidir que el motor utilizará un Sistema Genérico de Efectos (ActiveEffects), es fundamental determinar quién es el "dueño" (owner) de las instancias de los efectos. 
Específicamente, ¿dónde viven los datos en el árbol del estado del combate?

### Modelo A: Propiedad del Combatiente
```typescript
CombatState
  ├── Combatants
      ├── Combatant A
          └── activeEffects[]
      ├── Combatant B
          └── activeEffects[]
```

### Modelo B: Propiedad Global (Top-Level)
```typescript
CombatState
  ├── Combatants
  ├── EffectInstances[] // Contiene targetId, targetIds o areaOfEffect
```

---

## 2. Análisis Comparativo

### 2.1 Auras y Efectos de Área (AoE)
- **Modelo A**: Si un Mago lanza *Grasa* (Grease) en el piso, o un Paladín emite un *Aura de Valor*, el efecto no tiene un combatiente objetivo. Guardarlo dentro de un combatiente rompe la semántica.
- **Modelo B**: Un efecto puede no tener `targetId` y en su lugar tener un `targetArea`. Es natural y semánticamente correcto que pertenezca al estado global del cuarto.

### 2.2 Sincronización, Disipación y Efectos Multi-objetivo
- **Modelo A**: Si un Clérigo lanza *Bendición* (Bless) a 4 aliados, se crearían 4 instancias independientes de `ActiveEffect` dentro de 4 combatientes. Si el Clérigo decide finalizar el hechizo (o es disipado), el motor debe iterar todos los combatientes buscando y eliminando los 4 efectos individuales.
- **Modelo B**: Un solo `EffectInstance` a nivel global con `targetIds: ["A", "B", "C", "D"]`. Disiparlo o actualizarlo es una operación atómica única.

### 2.3 Consultas y Rendimiento
- **Modelo A**: `combatant.activeEffects` es lectura directa O(1).
- **Modelo B**: Requiere un filtro `effectInstances.filter(e => e.targetId === id)`. Al existir usualmente menos de ~100 efectos activos en un combate, el costo de filtrado es de microsegundos, trivial para Node.js, y sumamente fácil de memoizar al generar el `CombatSnapshot`.

### 2.4 Limpieza (Garbage Collection) y Ownership
- **Modelo A**: Si el origen del efecto (Source) muere o es eliminado de la sala, buscar qué efectos dejó huérfanos requiere barrer todos los combatientes. Si un objetivo muere, sus efectos se borran de RAM automáticamente al borrar el combatiente, lo cual es útil, pero impide que su cuerpo mantenga efectos (ej. animar a los muertos).
- **Modelo B**: Desacopla la vida del combatiente de la vida del efecto. Permite conservar efectos persistentes en el campo de batalla incluso si todos los actores originales han muerto o se han ido.

### 2.5 Serialización y Networking
- **Modelo A**: Estructura de árbol anidada profunda.
- **Modelo B**: Estructura plana (Flat State), lo cual es ideal para Redux/Zustand en el cliente y facilita mandar diffs parciales por WebSocket.

### 2.6 Facilidad de Debugging
- **Modelo B** permite al GM inspeccionar la tabla global `CombatState.EffectInstances` y ver exactamente "qué está pasando en el mapa" en una sola vista plana.

---

## 3. Recomendación Arquitectónica Fundamentada

La decisión debe ser la adopción innegociable del **Modelo B: Propiedad Global de Efectos**.

**Fundamentación:**
El Modelo A asume incorrectamente que todo efecto en D&D 3.5 está anclado biológicamente a un combatiente. Esto es falso. Gran parte de la táctica de D&D reside en controlar el campo de batalla (Muros, Niebla, Terreno Difícil, Auras). 
Al elevar `EffectInstances` al nivel del `CombatState` (Modelo B), abstraemos el concepto de "objetivo": un efecto puede afectar a un ID específico, a un array de IDs, a una zona poligonal, o a todo el mapa. 

La ligera sobrecarga de rendimiento al filtrar efectos para un combatiente (O(N)) es mitigada al 100% por la generación del `CombatSnapshot`, el cual se encarga de este filtrado una única vez por evento y distribuye el estado consolidado a los clientes. El Modelo B garantiza que el motor podrá soportar zonas y auras en el futuro sin requerir una reescritura arquitectónica.
