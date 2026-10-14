# TODO

Responsabilidad: Acciones pendientes verificadas, sin historial de implementaciones.
Autoridad: Canónica
Lifecycle: Snapshot vivo
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [orden futuro](ROADMAP.md)
Consumidores: Agentes al retomar el proyecto y propietario al priorizar tareas.

> **Responsabilidad canónica:** acciones pendientes. El historial de cierres
> vive en Git y en `walkthrough.md`; el estado oficial de Rule IDs vive en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Continuidad inmediata de D-1B

- D-1B-I5R2 ha sido **TÉCNICAMENTE APROBADO** en Architecture Review (`865405a`).
- D-1B-I6 (Integración productiva de Move Action) entra en fase de DISEÑO arquitectónico y plan de implementación; implementación de código bloqueada hasta revisión y Proceed explícito.
- ODR-D1B-I5-1 (sede autoritativa de `squeezingAxis`) queda **RESUELTA Y CERRADA**
  en el diseño de I6 (§8.7 del [NDD](docs/designs/normative-movement-design.md)),
  alojando el eje en `EffectInstance` para `srd_squeezing` sin fuentes duales de verdad.
- ODR-D1B-C3-01 (composición de fuentes de coste) queda **RESUELTA Y CERRADA**
  para combinaciones multiplicativas mediante la regla RAW de Double Movement
  Cost (§3.8 del [NDD](docs/designs/normative-movement-design.md)); su
  implementación se integra en el diseño de I6.
- Delimitar y aprobar las fases de Publication, integración productiva de
  comandos, preview y UI. No crear otra autoridad de legalidad o coste.

## Diseños espaciales pendientes

Los contratos normativos D-1R1, D-1A y D-1B ya existen: no volver a pedir su
creación como si fueran documentos ausentes.

- Elaborar los NDD específicos requeridos para D-2 (FoW), D-3
  (protocolo/identidad/persistencia) y D-6 (objetos ambientales). D-5 (editor MVP)
  completado, remediado y técnicamente aprobado en su [NDD](docs/designs/map-builder-mvp/design.md).
- Validar visualmente con el propietario y obtener Architecture Review de
  [D-4 Renderer táctico 2.5D y cámara](docs/designs/tactical-renderer-2.5d/design.md).
  (D-5 Editor Táctico de Mapas MVP cerrado y aprobado técnicamente en commit `6fd385b42b4dc51b8dcbb195108d7051a600944f`).
  La implementación WebGL está completa; no declararla cerrada antes de esa
  aceptación. Evaluar separación de bundle solo si las métricas reales lo exigen.
- Delimitar D-7, TurnState e integración de movimiento fragmentado, incluido
  Ataque Elástico. Es un candidato, no una funcionalidad aprobada.
- Coordinar las dependencias según [ROADMAP.md](ROADMAP.md).

## Vision, Line of Effect y Concealment

- Integrar Line of Effect en conjuros y áreas de efecto.
- Diseñar Low-Light Vision, Blindsight, Blindsense y Tremorsense.
- Modelar niebla, humo, invisibilidad y fuentes dinámicas de luz.
- Completar las consecuencias defensivas y de movimiento de la oscuridad.

## Conditions

- Completar Entangled con Concentration.
- Diseñar Dazzled y Shaken cuando exista alcance formal para skills/checks.
- Implementar la caída real de objetos para Stunned.
- Diseñar movimiento obligatorio y escalado de miedo para
  Frightened/Panicked.

## Rutinas de ataque

- Incorporar Rapid Shot, Haste, Two-Weapon Fighting, ataques naturales y
  Cleave/Great Cleave como contribuciones a la regla existente, sin crear
  versiones paralelas de `ATTACK-FULL`.

## Feats, Spells y Equipment

- Continuar lotes pequeños de dotes y conjuros después de sus dependencias.
- Mantener Power Attack congelado hasta nueva decisión explícita de producto.

## Plataforma y producto

- Incorporar animaciones opcionales y estados visuales extendidos sobre los sprites estáticos del prototipo 2.5D, y ampliar indicadores de buffs y trazas en logs.
- Persistir salas fuera de memoria.
- Completar editores de encuentros/mapas y persistencia poscombate.
- Diseñar autenticación y autorización persistentes.
- Extender footprints a formas no cuadradas y completar Squeezing.

## Deuda técnica

- Priorizar y cerrar únicamente las entradas abiertas documentadas en
  [`docs/technical-debt.md`](docs/technical-debt.md), sin duplicar aquí su
  estado.
