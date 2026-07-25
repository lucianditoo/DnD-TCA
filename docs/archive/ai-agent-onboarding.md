# Diseño: Carpeta `.ai/` — Onboarding compacto para agentes de IA

*Creado: 2026-07-07*

---

## Objetivo

Crear una carpeta `.ai/` en la raíz del repositorio que sirva como capa de onboarding rápido para agentes de IA (Cline, Antigravity, Gemini CLI, ChatGPT, etc.) sin reemplazar ni duplicar la documentación oficial existente.

El propósito es reducir el tiempo de "calentamiento" de un agente nuevo: en lugar de leer `CODEX_GUIDE.md` completo + `AGENTS.md` + `ARCHITECTURE.md` + `RULES_ENGINE.md` + ADRs desde cero, el agente puede leer `.ai/` primero y luego profundizar donde sea necesario.

---

## Problema que resuelve

Los modelos locales pequeños (Qwen2.5-Coder-14B) tienen contexto limitado y tienden a omitir reglas críticas cuando el onboarding está disperso en múltiples documentos largos. Un modelo que no entiende "el servidor es autoritativo" antes de tocar código puede generar cambios en el cliente que rompen el modelo de seguridad.

---

## Principios de diseño

1. **Compacto**: cada archivo debe poder leerse en menos de 5 minutos.
2. **Orientado a acción**: responde "¿qué hago primero?" y "¿qué no debo tocar?".
3. **Enlaza, no copia**: referencia documentos existentes en vez de duplicarlos.
4. **Jerarquía clara**: si hay conflicto, prevalecen `AGENTS.md`, ADRs y documentación oficial.
5. **Sin código**: esta carpeta es 100% documentación markdown.

---

## Arquitectura propuesta

```
.ai/
  README.md             — Qué es esta carpeta y cómo usarla
  PROJECT_MEMORY.md     — Resumen ultracompacto del proyecto
  WORKFLOW.md           — Flujo obligatorio de trabajo (resumen de AGENTS.md)
  FILE_INDEX.md         — Mapa rápido de archivos clave
  COMMON_COMMANDS.md    — Comandos frecuentes con notas de uso
  DO_NOT_BREAK.md       — Reglas no negociables
  LOCAL_LLM_GUIDE.md    — Guía para Cline + LM Studio + Qwen
  PROMPT_TEMPLATES.md   — Prompts reutilizables listos para copiar
```

---

## Relación con documentación existente

| Documento existente | Relación con `.ai/` |
|---|---|
| `AGENTS.md` | `.ai/WORKFLOW.md` lo resume; `AGENTS.md` tiene prioridad en conflictos |
| `CODEX_GUIDE.md` | `.ai/PROJECT_MEMORY.md` y `.ai/FILE_INDEX.md` lo resumen |
| `ARCHITECTURE.md` | `.ai/FILE_INDEX.md` apunta a él para detalles |
| `docs/technical-debt.md` | Enlazado desde `.ai/PROJECT_MEMORY.md` |
| `docs/designs/rule-coverage-matrix.md` | Enlazado desde `.ai/PROJECT_MEMORY.md` |
| `docs/testing-checklist.md` | Enlazado desde `.ai/COMMON_COMMANDS.md` |

---

## Componentes afectados

- **Ningún archivo de código** es afectado.
- **Ningún test** es afectado.
- **Ningún contrato WebSocket** es afectado.
- Opcional: agregar una línea en `README.md` o `CODEX_GUIDE.md` con un enlace a `.ai/README.md`.

---

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `.ai/` queda desactualizado tras cambios grandes | Media | Agregar a AGENTS.md la regla de actualizar `.ai/PROJECT_MEMORY.md` en cada walkthrough |
| Agente lee solo `.ai/` y omite `AGENTS.md` | Media | `.ai/README.md` lo advierte explícitamente |
| Duplicación con `CODEX_GUIDE.md` | Baja | Los archivos `.ai/` enlazan en vez de copiar; no repiten el texto |

---

## Plan de verificación

- `npm test` → sin cambios, 46/46 pasan.
- `npm run typecheck` → sin cambios.
- `npm run build` → sin cambios.
- `node scripts/e2e-websocket.mjs` → sin cambios, 47/47 pasan.

No hay cambios funcionales. Los tests validan que la tarea no rompió nada.

---

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Agregar sección en `CODEX_GUIDE.md` | Ya es largo; agregar más no ayuda a modelos con contexto limitado |
| Un único `AI_GUIDE.md` en raíz | Monolítico; difícil de mantener y de cargar selectivamente |
| Carpeta `.context/` | Nombre menos estándar; `.ai/` es más descriptivo de la intención |
