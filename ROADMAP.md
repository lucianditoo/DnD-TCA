# Roadmap

Responsabilidad: Orden tentativo de hitos y dependencias, no calendario de implementaciones aprobadas.
Autoridad: Canónica
Lifecycle: Snapshot vivo
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [pendientes](TODO.md)
Consumidores: Propietario y agentes durante la planificación.

## Cómo interpretar este roadmap

Un hito identificado no equivale a un NDD terminado, un NDD no equivale a
un plan de código aprobado y un commit con CI verde no sustituye Architecture
Review. El estado integrado vive en PROJECT_STATUS; las tareas concretas,
en TODO; las Rule IDs y su cobertura oficial, en el [Registry](docs/rules/registry.md).

## 1. Transición al Spatial Engine 2.5D

Marco existente: [Spatial Engine & 2.5D](docs/designs/spatial-engine-2.5d.md).
Su desarrollo normativo incluye [D-1R1](docs/designs/normative-spatial-geometry.md),
[D-1A](docs/designs/normative-area-shape-projection.md) y
[D-1B, capítulos 1–7](docs/designs/normative-movement-design.md).
Son contratos de destino; no certifican una migración completa del motor.
Los siete capítulos de D-1B permanecen aprobados y congelados; este
saneamiento no los reabre ni convierte los pendientes en decisiones nuevas.

La continuidad inmediata es el gate pendiente de la implementación D-1B y,
según su resultado, la planificación de su integración productiva. Publication,
comandos, preview y UI siguen siendo entregas diferenciadas por delimitar.
No se asigna aquí una numeración nueva a esas fases ni un Proceed implícito.

Los siguientes hitos conservan el orden de diseño propuesto en el NDD padre.
No se ha establecido un orden total de implementación ni planes detallados
para todos ellos:

| Hito | Responsabilidad | Preparación documental |
|---|---|---|
| D-2 | Fog of War y Participant Projection | Requerido por el NDD padre; diseño específico pendiente. |
| D-3 | Protocolo, identidad, reconexión y persistencia durable | Requerido; debe coordinarse con las proyecciones de D-2. |
| D-4 | Renderer, presentación 2.5D y cámara | Requerido; consume el modelo espacial y la proyección autorizada. |
| D-5 | Editor táctico V2 | Requerido; consume superficies, formato de mapa y prefabs. |
| D-6 | Objetos ambientales | Requerido; sus capacidades y entidades deben coordinarse con mapa/editor. |
| D-7 | TurnState y movimiento fragmentado | Candidato registrado en TODO; sin NDD propio ni implementación aprobada de Ataque Elástico. |

La enumeración D-2–D-7 no elimina las dependencias cruzadas. Cada diseño
debe resolver su alcance antes de programar su implementación.

## 2. Vision, Line of Effect y Concealment

- Extender Line of Effect a conjuros y áreas de efecto; AdO ya fue integrado
  en Sprint 055B.
- Incorporar sentidos alternativos, fuentes dinámicas de luz y fenómenos visuales.
- Completar consecuencias de oscuridad y Concealment, coordinadas con el modelo espacial.

## 3. Conditions pendientes

- Concentration para Entangled.
- Dazzled/Shaken después de skills/checks.
- Stunned con caída de objetos.
- Frightened/Panicked con movimiento obligatorio y escalado de miedo.

## 4. Composición de rutinas de ataque

Rapid Shot, Haste, Two-Weapon Fighting, ataques naturales y Cleave/Great Cleave
deben contribuir a las reglas existentes mediante el pipeline oficial.
Existen un [diseño](docs/designs/full-attack-v2-haste-rapid-shot-design.md) y un
[plan](docs/designs/full-attack-v2-implementation-plan.md) de Sprint 038:
son antecedentes para revalidar, no autorización de ejecución actual.

## 5. Feats, Spells y Equipment

Entregar lotes pequeños después de sus dependencias. Los cuatro inventarios
PHB se localizan desde el [manifiesto V1](.ai/coverage/V1_LAUNCH_MANIFESTO.md).
Power Attack permanece congelado hasta decisión explícita de producto.

## 6. Plataforma y deuda

Ownership transversal, buffs de equipo, stacking y mejoras de UI se priorizan
por riesgo según [technical-debt.md](docs/technical-debt.md).
Persistencia, autenticación y editores se coordinan con D-3/D-5; no constituyen
un segundo backlog espacial independiente.

Cada vertical requiere el gate de diseño y ejecución que determine
[.agents/AGENTS.md](.agents/AGENTS.md). Este saneamiento no abre sprints funcionales.
