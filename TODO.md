# TODO

> **Responsabilidad canónica:** acciones pendientes. El historial de cierres
> vive en Git y en `walkthrough.md`; el estado oficial de Rule IDs vive en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Spatial Engine 2.5D (Nuevos NDD Hijos Requeridos)

- **D-1 — Geometría Normativa Espacial:** Identidad, ocupación volumétrica, alcance 3D, distancia.
- **D-1B — Diseño Normativo de Movimiento:** NDD completo (Capítulos 1–7) aprobado y congelado. Sprint D-1B-I1 implementa el Movement Context estructural y queda pendiente de Architecture Review; Movement Cost, Route Validation, Budget, Resolution, acciones, preview y UI continúan pendientes de sus fases propias.
- **D-2 — Fog of War y Participant Projection:** Filtro de visibilidad server-side.
- **D-3 — Protocolo, Identidad, Reconexión y Persistencia Durable:** Sesiones, versionado de wire, y guardado en servidor.
- **D-4 — Renderer, Presentación 2.5D y Cámara.**
- **D-5 — Editor Táctico V2.**
- **D-6 — Objetos Ambientales.**
- **D-7 — TurnState e Integración de Movimiento Fragmentado:** Formalizar Ataque Elástico y persistencia intra-turno.

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

- Mejorar indicadores de buffs, estados y trazas en tokens y logs.
- Persistir salas fuera de memoria.
- Completar editores de encuentros/mapas y persistencia poscombate.
- Diseñar autenticación y autorización persistentes.
- Extender footprints a formas no cuadradas y completar Squeezing.

## Deuda técnica

- Priorizar y cerrar únicamente las entradas abiertas documentadas en
  [`docs/technical-debt.md`](docs/technical-debt.md), sin duplicar aquí su
  estado.
