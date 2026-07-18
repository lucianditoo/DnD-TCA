# Análisis Arquitectónico: Effects vs Conditions

## 1. Planteamiento del Problema
Actualmente, el motor requiere representar "Condiciones" (ej. Stunned, Prone) para alterar el estado táctico de un combatiente. Sin embargo, D&D 3.5 posee múltiples subsistemas que alteran temporal o permanentemente a un personaje:
- Condiciones (Stunned, Fatigued)
- Buffs y Debuffs mágicos (Bless, Bane)
- Hechizos prolongados (Haste, Slow)
- Venenos y Enfermedades (daño de stat a lo largo del tiempo)
- Efectos ambientales (Fatiga por calor)
- Dotes temporales (Combat Expertise, Luchar a la defensiva)
- Auras (Paladin's Aura of Courage)

El problema arquitectónico es definir si construimos un motor específico para `Conditions`, o si abstraemos el problema hacia un motor universal de `ActiveEffects`.

---

## 2. Opción A: Sistema Específico de Conditions

Un sistema tipado y acotado exclusivamente a las condiciones oficiales descritas en el manual (Stunned, Prone, Helpless, etc.).

### Ventajas
- **Alcance acotado**: Fácil de implementar rápidamente.
- **Tipado estricto explícito**: Un `enum` cerrado con las ~36 condiciones del manual.
- **Menor carga mental inicial**: Resuelve exactamente el problema de la Fase 6 sin pensar en el resto del juego.

### Desventajas
- **Deuda Técnica Garantizada**: Cuando implementemos *Spells* (Fase 8+), tendremos que construir *otro* sistema paralelo para manejar la duración y modificadores de `Bless` o `Haste`.
- **Conflictos de Apilamiento (Stacking)**: Si Conditions y Spells tienen sistemas separados, calcular si el +2 de CA de una condición pisa al +2 de CA de un hechizo requerirá lógica puente compleja.
- **Duplicación de Sistemas**: Habrá un `ConditionTickLayer` y un `SpellTickLayer`.

---

## 3. Opción B: Sistema Genérico de Effects (Recomendado)

Un sistema unificado donde cualquier alteración temporal o persistente se representa como un `ActiveEffect`. Una "Condición" es simplemente un Effect predefinido con el flag `type: "condition"`. Un buff mágico es un Effect con `type: "spell"`.

### Ventajas
- **Única Fuente de Verdad Mecánica**: Todos los modificadores (Ataque, CA, Bloqueos) entran al Rule Engine por un único canal.
- **Stacking Universal**: El Rule Engine puede ordenar y filtrar todos los `ActiveEffects` (ej. comparando un bonus "Morale" de un conjuro contra un penalty de una condición).
- **Tick Layer Único y Desacoplado**: Un sistema de eventos (`TurnStarted`, `RoundEnded`) despacha actualizaciones a todos los efectos vigentes, sin importar su origen.
- **Reutilización Masiva**: Resuelve el 90% del trabajo necesario para implementar Hechizos, Dotes Temporales y Objetos Mágicos.

### Desventajas
- **Mayor Abstracción Inicial**: Requiere un diseño de catálogo y esquema de datos más robusto y genérico desde el día 1.
- **Payload Ligeramente Mayor**: El modelo de datos necesita contemplar más casos de uso.

---

## 4. Análisis de Impacto (Opción B)

### Impacto en el Motor (Core Engine)
- En lugar de `combatant.conditions`, el estado alojará `combatant.activeEffects`.
- El Catálogo deberá ser capaz de definir plantillas genéricas de Efectos (`EffectTemplate`).
- La creación de un efecto en tiempo real generará un `EffectInstance` con su propio UUID (`instanceId`).

### Impacto en el Rule Engine
- **Positivo y Simplificador**: El Rule Engine dejará de preguntar "qué cosas tiene el combatiente". Ejecutará un pipeline puro: recogerá todos los `activeEffects`, extraerá los *Traits* (ej. `IMMOBILIZED`) y *Modifiers* (ej. `AC_BONUS`, `MOVEMENT_HALVED`), resolverá el stacking, y obtendrá un estado derivado.

### Impacto en el Networking y Serialización
- **Serialización**: `ActiveEffect` requiere un tipado estricto pero genérico (JSON serializable sin callbacks).
- **Payload**: El `CombatSnapshot` enviará el array de `activeEffects`. Esto permite que el Frontend dibuje iconos de Buffs, Debuffs y Condiciones usando la misma lógica visual.

### Impacto en el Rendimiento
- Iterar sobre una lista unificada de `Effects` por combatiente al generar el `CombatSnapshot` es matemáticamente idéntico en Big-O a iterar sobre múltiples arrays (`conditions`, `buffs`, `spells`).
- Al estar centralizado, el filtrado es más *cache-friendly* y facilita la memoización.

---

## 5. Recomendación Final Fundamentada

La decisión arquitectónica innegociable debe ser la **Opción B: Sistema Genérico de Effects**.

**Fundamentación:**
D&D 3.5 no distingue matemáticamente entre una penalización proveniente de una "Condición" y una penalización proveniente de un "Hechizo". Ambos son efectos superpuestos que comparten las mismas reglas matemáticas (Stacking de bonificadores tipados) y temporales (Duraciones de eventos, no solo asaltos). 
Crear un sistema aislado llamado "Condiciones" nos obligaría a reescribir la resolución matemática del combate en el futuro para fusionarlo con los hechizos. 

Al migrar el diseño hacia un **Sistema de ActiveEffects**, el Sprint 002 sentará la base definitiva no solo para *Stunned* o *Prone*, sino para toda la magia, dotes y auras de D&D 3.5. En este ecosistema, una "Condición" es simplemente un conjunto de *Traits* y *Modifiers* empaquetados en un `EffectTemplate` inmutable alojado en el Catálogo.
