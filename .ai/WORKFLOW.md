# WORKFLOW — Flujo obligatorio de trabajo

> Fuente completa y autoritativa: [`.agents/AGENTS.md`](../.agents/AGENTS.md)
> Este archivo es un resumen operativo. En caso de conflicto, `AGENTS.md` prevalece.

---

## Regla general

**Nunca tocar código antes de tener un diseño aprobado.**

---

## Fases obligatorias

### FASE 1 — Análisis

- Leer el código relevante y la documentación afectada.
- Entender el impacto arquitectónico del cambio.
- **No escribir código.**

### FASE 2 — Documento de diseño

- Crear `docs/designs/<nombre-de-la-feature>.md`.
- El documento debe incluir: objetivo, arquitectura propuesta, alternativas consideradas, componentes afectados, riesgos, impacto en Rule Engine / CombatSnapshot / Ownership / WebSocket / UI / Tests.
- **No escribir código.**

### FASE 3 — Plan de implementación

- Crear `implementation_plan.md` en el directorio de artifacts de la conversación.
- Detallar: archivos afectados, cambios por archivo, orden de implementación, plan de verificación.
- **No escribir código todavía.**

### FASE 4 — Espera de aprobación

- Detener la ejecución.
- Esperar un mensaje explícito del usuario como **"Proceed"**, **"Aprobado"** o **"Implementar"**.
- **No modificar ningún archivo de código sin esta aprobación.**

### FASE 5 — Ejecución

- Implementar siguiendo el plan aprobado.
- Si durante la implementación aparece un problema que requiere cambios significativos al plan, detener y pedir revisión.

### FASE 6 — Validación

Ejecutar siempre en este orden:

```powershell
npm test
npm run typecheck
npm run build
```

Y si el cambio afecta flujos WebSocket:

```powershell
# Primero levantar el servidor en otra terminal:
npx tsx apps/server/src/index.ts

# Luego en la terminal principal:
node scripts/e2e-websocket.mjs
```

> **Nota PowerShell**: usar `;` en lugar de `&&` para encadenar comandos, o ejecutarlos de a uno.

### FASE 7 — Walkthrough

- Generar `walkthrough.md` en el directorio de artifacts.
- Incluir: qué cambió, por qué, qué se testeó, estado final, deuda técnica pendiente.

---

## Documentación a actualizar tras cambios importantes

- `CODEX_GUIDE.md` — features soportadas y roadmap.
- `PROJECT_STATUS.md` — estado actual.
- `TODO.md` — tareas completadas y pendientes.
- `docs/technical-debt.md` — deuda resuelta o nueva.
- `docs/rules-coverage-checklist.md` — si se implementó una regla de D&D.
- ADR correspondiente en `docs/adr/` si se tomó una decisión arquitectónica.
- `.ai/PROJECT_MEMORY.md` — si cambió algo fundamental del sistema.

---

## Cultura de testing

- Toda nueva funcionalidad debe tener tests unitarios.
- Todo bug importante se convierte en test de regresión antes de corregir.
- No se borran tests para hacer pasar el build.
- Los tests E2E cubren flujos reales de WebSocket.
