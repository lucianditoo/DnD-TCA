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

## 3. Decisiones Arquitectónicas (ADRs)
Ubicación: `docs/adr/`
Registros inmutables de las decisiones fundamentales que han consolidado la arquitectura actual.

## 4. Diseños Funcionales
Ubicación: `docs/designs/`
Propuestas técnicas y documentación de sistemas específicos en desarrollo (ej. Condiciones, Validación de Movimiento, Ataque Completo). Las reglas descritas aquí se indexan en el Rule Registry.

## 5. Registro de Reglas (Rule Registry)
Ubicación: `docs/rules/registry.md`
El índice maestro y única fuente de verdad sobre el estado de implementación de cada regla en el código. Enumera cada Rule ID y enlaza a los diseños correspondientes.

## 6. Sprints y Auditorías
- `docs/sprints/`: Contiene plantillas y registros de Sprints Arquitectónicos.
- `docs/audits/`: Contiene plantillas y registros de auditorías de higiene y cobertura.

## 7. Testing
Ubicación: `docs/testing/`
Estrategia de testeo (Unit, E2E), checklists unificadas y directrices de cobertura. 
Documento principal: `docs/testing/master-coverage.md`.

## 8. Agentes de IA
- `.agents/AGENTS.md`: Reglas del sistema para asistentes IA (ChatGPT, Gemini, Cursor).
- `.ai/PROJECT_MEMORY.md`: Memoria conversacional de la IA para decisiones y contexto de largo plazo.

## 9. Archivo Histórico
Ubicación: `docs/archive/`
Contiene documentos obsoletos de fases previas o recursos históricos preservados únicamente por trazabilidad.
