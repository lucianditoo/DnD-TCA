# PROMPT_TEMPLATES — Prompts reutilizables

Copiá y pegá estos prompts cuando inicies una sesión con tu agente local o externo.

---

### 1. Leer proyecto (Onboarding)
> Por favor, lee primero la carpeta `.ai/` para entender el contexto del proyecto y las reglas obligatorias de trabajo. Comienza por `.ai/README.md` y `.ai/PROJECT_MEMORY.md`. No propongas código ni modifiques nada hasta no haber leído esos documentos y entender el flujo de trabajo (`.ai/WORKFLOW.md`).

---

### 2. Crear diseño sin implementar
> Quiero planificar la funcionalidad de [nombre de feature].
> 1. Analizá los archivos afectados.
> 2. Creá el documento de diseño en `docs/designs/`.
> 3. Creá el `implementation_plan.md` en la raíz del repo (se versiona en Git; ver `.agents/AGENTS.md` Fase 3 para su ubicación final al cierre).
> 4. Detené la ejecución y esperá mi aprobación. No escribas código fuente todavía.
> Respetá el flujo de `WORKFLOW.md`.

---

### 3. Implementar después de aprobación
> El plan está aprobado. Procedé a implementar los cambios paso a paso.
> Al finalizar, ejecutá la validación completa (`npm test`, `typecheck`, `build`, `e2e`) y generá el `walkthrough.md`.

---

### 4. Auditar feature
> Quiero realizar una auditoría técnica sobre [módulo o feature].
> No implementes nuevas features ni corrijas código. Solo creá un documento en `docs/audits/` evaluando el estado actual, fortalezas, riesgos y recomendaciones según las directivas de `DO_NOT_BREAK.md`.

---

### 5. Corregir bug con test de regresión
> Encontré un bug: [descripción del bug].
> 1. Analizá la causa raíz sin tocar código funcional.
> 2. Escribí un test en `tests/` que reproduzca el bug y falle.
> 3. Solucioná el bug para que el test pase.
> 4. Ejecutá la suite de tests y generá el `walkthrough.md`.

---

### 6. Refactor seguro
> Quiero refactorizar [archivo o módulo] para mejorar [mantenibilidad/claridad].
> No modifiques el comportamiento del sistema ni cambies la UI. El refactor debe pasar los tests existentes sin necesidad de reescribirlos. Mantené las reglas puras. Presentame el plan antes de codear.

---

### 7. Actualizar documentación
> La funcionalidad [feature] fue implementada. Actualizá `PROJECT_STATUS.md`, `TODO.md` y `CODEX_GUIDE.md` para reflejar el estado actual. No toques código fuente ni archivos funcionales. Mantené el estilo conciso de la documentación.

---

### 8. Resolver deuda técnica
> Quiero atacar la deuda técnica [ID de deuda] que figura en `docs/technical-debt.md`.
> Armá el plan de implementación, esperando mi validación antes de tocar código. Recordá actualizar el documento de deuda al terminar.
