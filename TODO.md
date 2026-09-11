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

- Obtener el veredicto de Architecture Review sobre I5; el estado de
  integración por etapa se mantiene en [PROJECT_STATUS.md](PROJECT_STATUS.md).
- Resolver ODR-D1B-I5-1: sede persistente de `squeezingAxis`, antes de asumir
  una solución en la migración productiva.
- Resolver las combinaciones afectadas por D-1B-C3-01 (composición de fuentes
  de coste) cuando se delimite su implementación; el [NDD](docs/designs/normative-movement-design.md)
  sigue siendo su autoridad.
- Delimitar y aprobar las fases de Publication, integración productiva de
  comandos, preview y UI. No crear otra autoridad de legalidad o coste.

## Diseños espaciales pendientes

Los contratos normativos D-1R1, D-1A y D-1B ya existen: no volver a pedir su
creación como si fueran documentos ausentes.

- Elaborar los NDD específicos requeridos para D-2 (FoW), D-3
  (protocolo/identidad/persistencia), D-4 (renderer/cámara), D-5 (editor)
  y D-6 (objetos ambientales).
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

- Mejorar indicadores de buffs, estados y trazas en tokens y logs.
- Persistir salas fuera de memoria.
- Completar editores de encuentros/mapas y persistencia poscombate.
- Diseñar autenticación y autorización persistentes.
- Extender footprints a formas no cuadradas y completar Squeezing.

## Deuda técnica

- Priorizar y cerrar únicamente las entradas abiertas documentadas en
  [`docs/technical-debt.md`](docs/technical-debt.md), sin duplicar aquí su
  estado.
