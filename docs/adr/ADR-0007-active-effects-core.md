# ADR 0007: Infraestructura Base para ActiveEffects

## Contexto
D&D 3.5 requiere un sistema para aplicar alteraciones persistentes (Condiciones, Hechizos, Auras, etc.) sobre los combatientes. Inicialmente se contemplaba construir un motor específico para "Condiciones", pero se identificó que el sistema de apilamiento (Stacking) y duraciones es compartido universalmente por todos los efectos del juego.

## Decisión
Se decide implementar un **Sistema Genérico de Efectos (ActiveEffects)** como infraestructura fundamental del motor, con las siguientes reglas arquitectónicas:

1. **Propiedad Global (Global Ownership)**: Las instancias de los efectos (`EffectInstance`) viven en un arreglo plano en el nivel superior del estado de la sala (`CombatRoom`), no dentro de cada combatiente. Esto permite modelar Auras y efectos de área sin acoplarlos biológicamente.
2. **Separación Definition / Instance**: Se establecen 3 niveles lógicos:
   - *Catálogo (`EffectDefinition`)*: Totalmente estático, sin comportamiento, inmutable y determinista.
   - *Instancia (`EffectInstance`)*: Registro con `instanceId` único de una aplicación en curso.
   - *Subconjunto (`ActiveEffects`)*: Agrupación derivada mediante una capa de consultas (`Query Layer`).
3. **Data Driven First**: Todo nuevo efecto se implementará mediante datos en el catálogo estático siempre que sea posible.
4. **Manejo Exclusivo**: El `Rule Engine` lee pasivamente los efectos; no tiene permisos de mutación. Las alteraciones ocurren estrictamente a través del `EffectManager`.

## Consecuencias
- **Positivas**: Evita reescribir un sistema de apilamiento y expiración por cada nueva mecánica (hechizos, enfermedades, venenos). Habilita el soporte futuro para terrenos y auras.
- **Negativas**: Aumenta marginalmente el tamaño del payload de red (serialización plana global) y requiere una capa adicional de reducción (memoizada) para extraer las estadísticas de cada combatiente.
