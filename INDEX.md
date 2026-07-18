# Índice Maestro del Proyecto

Este documento es el mapa oficial de la documentación del proyecto `dnd-tactical-combat-assistant`. Su propósito es enlazar a cada sección de forma centralizada sin duplicar contenido.

## 1. Gobernanza y Estado (Raíz)
Documentos de alto nivel que dictan el progreso y la organización del motor:
- `README.md`: Entry point y overview técnico.
- `GOVERNANCE.md`: Visión del proyecto, principios de ingeniería, política Zero Orphan, Migration First y Minimal Documentation.
- `ROADMAP.md`: Ruta de desarrollo y planificación a largo plazo.
- `PROJECT_STATUS.md`: Fotografía actual de hitos logrados y proceso de trabajo.
- `TODO.md`: Registro vivo de tareas próximas y deuda inmediata.

## 2. Arquitectura Base
Documentos que definen cómo está estructurado el código y cómo se relacionan los dominios:
- `ARCHITECTURE.md`: Modelo principal de arquitectura cliente-servidor (Raíz).
- `RULES_ENGINE.md`: Directrices sobre funciones puras vs mutaciones (Raíz).
- `COMBAT_FLOW.md`: Explicación del ciclo de vida del combate y sincronización de estado (Raíz).
- `docs/architecture/combat-engine.md`: Detalles técnicos profundos sobre el funcionamiento del motor de turnos y validaciones.
- `docs/architecture/combat-documentation-integration.md`, `docs/architecture/rule-engine-integration.md`: documentos transversales de integración, no atados a una única feature (reclasificados desde `docs/designs/` en Sprint 040, Lote B).
- `docs/architecture/active-effects/`: familia de documentos de la arquitectura ActiveEffects (`effects-system-architecture.md`, `effects-tick-layer.md`, `effect-storage-analysis.md`, `effects-vs-conditions-analysis.md`) — una sola narrativa arquitectónica en capas (reclasificados desde `docs/designs/` en Sprint 040, Lote B).

## 3. Decisiones Arquitectónicas (ADRs)
Ubicación: `docs/adr/`
Registros inmutables de las decisiones fundamentales que han consolidado la arquitectura actual (incluye `ADR-0008-temporal-anchor-semantics.md`, reclasificado desde `docs/designs/` en Sprint 040, Lote B).

## 4. Diseños Funcionales
Ubicación: `docs/designs/`
Propuestas técnicas y documentación de sistemas específicos en desarrollo (ej. Condiciones, Validación de Movimiento, Ataque Completo). Las reglas descritas aquí se indexan en el Rule Registry.

Convención (Sprint 040): una feature con un único documento persistente vive plana (`docs/designs/<feature-slug>.md`); una feature con 2+ documentos persistentes (diseño + plan de implementación y/o análisis histórico) vive en su propia carpeta (ej. `docs/designs/withdraw/` con `design.md`, `analysis.md`, `implementation-plan.md`). Ver `docs/designs/document-architecture-cleanup.md` para el criterio completo y el estado de la migración por lotes.

## 5. Registro de Reglas (Rule Registry)
Ubicación: `docs/rules/registry.md`
El índice maestro y única fuente de verdad sobre el estado de implementación de cada regla en el código. Enumera cada Rule ID y enlaza a los diseños correspondientes.

## 6. Sprints y Auditorías
- `docs/sprints/`: Contiene plantillas y registros de Sprints Arquitectónicos.
- `docs/audits/`: Contiene plantillas y registros de auditorías de higiene y cobertura, incluida `combat-rules-deviations.md` (auditoría cruzada del motor contra el corpus normativo PHB Cap. 8, reclasificada desde `docs/designs/` en Sprint 040, Lote B).

## 7. Testing
Ubicación: `docs/testing/`
Estrategia de testeo (Unit, E2E), checklists unificadas y directrices de cobertura. 
Documento principal: `docs/testing/master-coverage.md`.

## 8. Agentes de IA
- `.agents/AGENTS.md`: Reglas del sistema para asistentes IA — flujo operativo y Definition of Done.
- `.ai/README.md`: Onboarding compacto de la carpeta `.ai/` y orden de lectura recomendado.
- `.ai/WORKFLOW.md`: Resumen navegable del flujo, con enlaces a `GOVERNANCE.md` y `AGENTS.md`.
- `.ai/PROJECT_MEMORY.md`: Memoria conversacional de la IA para decisiones y contexto de largo plazo.
- `.ai/DESIGN_REVIEW_CHECKLIST.md`: Filtro analítico previo a cualquier documento de diseño.
- `.ai/DO_NOT_BREAK.md`: Reglas no negociables de arquitectura.
- `.ai/FILE_INDEX.md`: Mapa rápido de archivos de código (responsabilidad · qué modificar · qué no hacer) — complementa a este índice, que mapea documentación.
- `.ai/COMMON_COMMANDS.md`: Comandos frecuentes de validación.
- `.ai/PROMPT_TEMPLATES.md`: Prompts reutilizables para iniciar sesión con un agente.
- `.ai/LOCAL_LLM_GUIDE.md`: Guía para agentes locales (Cline + LM Studio).
- `.ai/coverage/`: Checklists de Cobertura Total PHB 3.5 (reglas, dotes, conjuros, equipo) y `V1_LAUNCH_MANIFESTO.md` (manifiesto de gobernanza de esa cobertura).
- `.ai/patterns/`: Patrones arquitectónicos reutilizables extraídos de vertical slices ya implementadas.

## 9. Archivo Histórico
Ubicación: `docs/archive/`
Contiene documentos obsoletos de fases previas o recursos históricos preservados únicamente por trazabilidad.
