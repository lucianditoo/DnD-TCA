# ADR-0005: Separate Data, Rules And UI

## Estado

Aceptado

## Contexto

D&D 3.5 tiene muchas reglas que interactuan: movimiento, alcance, cobertura, flanqueo, condiciones, dotes, conjuros y acciones especiales. Si esas reglas quedan embebidas en componentes UI, el proyecto se vuelve dificil de testear y mantener.

## Decision

Separar Datos, Reglas y UI.

Los datos viven en catalogos. Las reglas viven en helpers compartidos y resolucion autoritativa del servidor. La UI presenta informacion, guia acciones y muestra feedback, pero no contiene reglas complejas como fuente final.

## Alternativas consideradas

- Implementar reglas directamente en React: rapido visualmente, pero dificil de testear.
- Duplicar reglas en cliente y servidor: puede mejorar UX, pero requiere una fuente compartida para no divergir.
- Centralizar todo en servidor sin helpers puros: autoritativo, pero menos testeable.

## Consecuencias

Beneficios:

- Reglas testeables.
- Menos duplicacion.
- Mayor claridad para futuras IA/personas.
- Mejor base para CombatSnapshot, conditions, feats y spells.

Costos:

- Algunas features requieren disenar datos/reglas antes de tocar UI.
- Hay que resistir hacks rapidos dentro de componentes.
- La arquitectura necesita mantenimiento continuo.

