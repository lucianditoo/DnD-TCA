# D&D 3.5 Tactical Combat Assistant - Agent Rules

Este archivo contiene las reglas y el flujo de desarrollo no negociables para cualquier agente de IA o desarrollador que trabaje en este monorrepósito.

> Reparto de autoridades (Sprint 040): [`GOVERNANCE.md`](../GOVERNANCE.md) define los principios y políticas documentales/técnicas (Single Source of Truth, Zero Orphan Policy, Minimal Documentation, Migration First). Este archivo (`AGENTS.md`) es la autoridad del **flujo operativo y la Definition of Done**. `.ai/WORKFLOW.md` es un resumen navegable de ambos, sin duplicar su contenido.

## 1. Filosofía de Trabajo
* **Diseño Primero**: Nunca implementar funcionalidades de inmediato. Primero se deben diseñar y evaluar arquitectónicamente.
* **Prioridades Técnicas**: Priorizar la claridad, mantenibilidad, escalabilidad, separación de responsabilidades, funciones puras, servidor autoritativo, catálogo único de datos, Rule Engine desacoplado y CombatSnapshot por encima de soluciones o hacks rápidos.

## 2. Flujo de Desarrollo (Obligatorio)

Cualquier cambio o funcionalidad nueva solicitada por el usuario debe realizarse siguiendo estrictamente estas fases:

### FASE 1: Análisis
* Analizar el problema e impacto arquitectónico.
* Leer la documentación necesaria.
* NO escribir código.

### FASE 2: Documento de Diseño
* Generar un documento de diseño bajo `docs/designs/<nombre-de-funcionalidad>.md`.
* Debe incluir:
  * Objetivo y problema que resuelve.
  * Arquitectura propuesta y alternativas consideradas (justificando la elección).
  * Componentes afectados y riesgos.
  * Compatibilidad e impacto sobre: Rule Engine, CombatSnapshot, EquipmentCatalog, Ownership, WebSocket, UI y Tests.
  * Estrategia de implementación y testing.
* NO escribir código.

### FASE 3: Plan de Implementación
* Generar un `implementation_plan.md` en la raíz del repositorio. **Se versiona en Git** (Sprint 040: nunca fue política aprobada que fuera efímero o ignorado por `.gitignore`).
* Debe detallar archivos afectados, cambios propuestos, orden de implementación, riesgos y plan de verificación.
* Ubicación final tras el cierre del sprint: `docs/designs/<feature-slug>/implementation-plan.md` si la feature tiene 2+ documentos persistentes; si tiene uno solo, se resume como sección `## Plan de implementación` dentro de su `design.md` en vez de un archivo aparte.

### FASE 4: Espera de Aprobación
* DETENER la ejecución y esperar la aprobación explícita del usuario.
* NO modificar ningún archivo de código ni implementar nada antes de la aprobación.

### FASE 5: Ejecución
* Solo proceder tras recibir un mensaje explícito como "Proceed" o "Implementar".

### FASE 6: Validación
* Tras la implementación, ejecutar siempre:
  ```powershell
  npm test
  npm run typecheck
  npm run build
  node scripts/e2e-websocket.mjs
  ```

### FASE 7: Walkthrough
* Generar un `walkthrough.md` resumiendo cambios, motivos, estado final y deuda técnica pendiente.

## 3. Documentación y Tests
* Cada funcionalidad importante debe actualizar:
  * `CODEX_GUIDE.md`
  * `PROJECT_STATUS.md`
  * `ARCHITECTURE.md`
  * `RULES_ENGINE.md`
  * `TODO.md`
  * `docs/technical-debt.md`
  * `docs/rules/registry.md`
  * `.ai/coverage/*_PHB_CHECKLIST.md` (si la funcionalidad cubre una regla del Master Plan de Cobertura Total)
  * ADRs correspondientes.
* Mantener la cultura de testing: todas las nuevas funcionalidades deben contar con pruebas unitarias y E2E (si corresponde).
* Cualquier bug encontrado durante el desarrollo se convierte en un caso de test de regresión.

## 4. Definition of Done (DoD)

Una tarea solamente puede marcarse como COMPLETADA cuando cumple TODOS los siguientes puntos. **Esta es la regla fundamental del proyecto.**

### 4.1 Arquitectura
* Diseño aprobado previo a la implementación.
* Arquitectura respetada.
* No se introduce deuda técnica innecesaria ni se rompen decisiones existentes.

### 4.2 Implementación
* Código terminado sin TODOs injustificados.
* Sin código muerto ni duplicación innecesaria.

### 4.3 Validaciones
Todos los siguientes comandos deben finalizar correctamente:
```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
npm run test:ui # (cuando corresponda)
```

### 4.4 Documentación
Toda la documentación afectada debe quedar sincronizada. Revisar automáticamente:
* `PROJECT_STATUS.md`
* `TODO.md`
* `docs/technical-debt.md`
* `docs/rules/registry.md` (reemplaza la ruta obsoleta `docs/rules-coverage-checklist.md`, ya archivada en `docs/archive/`)
* `.ai/coverage/*_PHB_CHECKLIST.md` (si aplica)
* Carpeta `.ai/` (si el modelo mental cambió).
* Documentos de diseño afectados y `walkthrough.md`.

### 4.5 Auditoría
Antes de cerrar una tarea se debe verificar que el código y la documentación describan exactamente el mismo sistema. No deben existir documentos contradictorios y el backlog debe estar actualizado.

### 4.6 Entrega Final Obligatoria
Al finalizar cada tarea deberá informarse siempre:
* Archivos modificados y documentos actualizados.
* Tests agregados/modificados.
* Deuda técnica resuelta/nueva.
* Funcionalidades futuras habilitadas.
* Resultado exacto de todas las validaciones ejecutadas.

**Regla Fundamental**: Una tarea NO se considera terminada hasta que: **Código + Tests + Documentación representen exactamente el mismo estado del sistema.** Si alguno no está sincronizado, la tarea permanece "En progreso".
