# WORKFLOW — Flujo obligatorio de trabajo

> Este archivo es un **resumen navegable**, no una autoridad por sí mismo. Reparto de autoridades (Sprint 040):
> - [`GOVERNANCE.md`](../GOVERNANCE.md) — principios y políticas documentales/técnicas (SSOT, Zero Orphan, Minimal Documentation, Migration First, Nivel de cambio A/B/C/D y Architectural Audit Sprint desde Governance v2 / Sprint 052).
> - [`.agents/AGENTS.md`](../.agents/AGENTS.md) — flujo operativo y Definition of Done.
> - Este archivo enlaza a ambas sin duplicar su contenido. En caso de conflicto, prevalece la autoridad específica (`GOVERNANCE.md` para principios, `AGENTS.md` para flujo/DoD).

---

## Regla general

**Nunca tocar código antes de tener un diseño aprobado.** El rigor exacto de
las Fases 2-3 depende del **Nivel de cambio** (`GOVERNANCE.md` §5.2): Nivel
A/B puede resumirlas sin archivos dedicados; Nivel C/D las exige completas.

---

## Fases obligatorias

### FASE 1 — Análisis

- Leer el código relevante y la documentación afectada.
- Entender el impacto arquitectónico del cambio.
- **No escribir código.**

### FASE 2 — Documento de diseño

- Nivel C/D: crear `docs/designs/<nombre-de-la-feature>.md` incluyendo objetivo, arquitectura propuesta, alternativas consideradas, componentes afectados, riesgos, impacto en Rule Engine / CombatSnapshot / Ownership / WebSocket / UI / Tests.
- Nivel A/B: puede resumirse sin archivo dedicado si no hay decisiones arquitectónicas nuevas.
- **No escribir código.**

### FASE 3 — Plan de implementación

- Nivel C/D: crear `implementation_plan.md` en la raíz del repo. **Se versiona en Git** (corrección de Sprint 040 — nunca fue una política aprobada que fuera efímero/ignorado). Si la feature tiene 2+ documentos persistentes, su ubicación final es `docs/designs/<feature-slug>/implementation-plan.md`. Si tiene un único documento, el plan se resume como sección `## Plan de implementación` dentro de su `design.md`. Detallar: archivos afectados, cambios por archivo, orden de implementación, plan de verificación.
- Nivel A/B: puede omitirse como archivo separado.
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

#### Gate canónico en Windows

El workflow `.github/workflows/windows-ci.yml` es el gate canónico para las validaciones que los sandboxes locales no pueden ejecutar de forma fiable. Corre en `windows-latest` sobre `push`/`pull_request` de `master` y por despacho manual; valida typecheck, build, suite global, pruebas focalizadas, WebSocket E2E y Playwright.

- La suite global conserva su resultado real: los fallos conocidos permanecen visibles y no usan `continue-on-error`.
- Los gates posteriores usan ejecución incondicional para separar la salud de cada subsistema sin ocultar el fallo global del job.
- Los E2E esperan activamente el puerto `3333` y detienen siempre el proceso del servidor.
- Ningún sprint se declara cerrado por la mera existencia del workflow: debe observarse una ejecución real del gate aplicable.

### FASE 7 — Walkthrough, Commit, Push y Architecture Review

- Generar `walkthrough.md` con el detalle completo (qué cambió, por qué, qué se testeó, estado final, deuda técnica pendiente) — el detalle vive aquí, no se repite en el chat.
- Commit único del sprint, `push` inmediato tras el DoD (Governance v2, `GOVERNANCE.md` §5.3 — ya no se espera aprobación explícita antes de pushear salvo que el usuario pida ese gate más estricto para un sprint puntual).
- Esperar CI y reportar con el formato mínimo de `GOVERNANCE.md` §5.5. Nada de diffs ni archivos completos pegados en el chat.
- El Architecture Gate revisa el repositorio directamente sobre el commit reportado y aprueba, solicita cambios o rechaza.

---

## Documentación a actualizar tras cambios importantes

- `CODEX_GUIDE.md` — features soportadas y roadmap.
- `PROJECT_STATUS.md` — estado actual.
- `TODO.md` — tareas completadas y pendientes.
- `docs/technical-debt.md` — deuda resuelta o nueva.
- `docs/rules/registry.md` — índice maestro de Rule IDs (reemplaza la ruta obsoleta `docs/rules-coverage-checklist.md`, ya archivada).
- `.ai/coverage/*_PHB_CHECKLIST.md` — si se implementó una regla, dote, conjuro o pieza de equipo cubierta por el Master Plan de Cobertura Total.
- ADR correspondiente en `docs/adr/` si se tomó una decisión arquitectónica.
- `.ai/PROJECT_MEMORY.md` — si cambió algo fundamental del sistema.

---

## Cultura de testing

- Toda nueva funcionalidad debe tener tests unitarios.
- Todo bug importante se convierte en test de regresión antes de corregir.
- No se borran tests para hacer pasar el build.
- Los tests E2E cubren flujos reales de WebSocket.
