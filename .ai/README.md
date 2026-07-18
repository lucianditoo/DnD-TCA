# .ai/ — Memoria compacta para agentes de IA

Esta carpeta es una **capa de onboarding rápido** para cualquier agente de IA que trabaje en este repositorio: Cline, Antigravity, Gemini CLI, ChatGPT, o cualquier modelo local vía LM Studio.

## Qué es esta carpeta

- **Memoria compacta**, no documentación exhaustiva.
- Pensada para que un agente entienda el proyecto en una primera lectura corta antes de tocar código.
- Útil especialmente para modelos locales con contexto limitado (Qwen2.5-Coder-14B).

## Qué NO es

- **No reemplaza `CODEX_GUIDE.md`** — ese sigue siendo la guía principal del proyecto.
- **No reemplaza `AGENTS.md`** — ese define las reglas obligatorias de comportamiento del agente.
- **No reemplaza los ADRs** en `docs/adr/`.
- **No es documentación de reglas** — para eso está `RULES_ENGINE.md`.

## Jerarquía en caso de conflicto

```
AGENTS.md  >  ADRs  >  CODEX_GUIDE.md  >  .ai/
```

Si algo en `.ai/` contradice `AGENTS.md` o un ADR, **prevalece la documentación oficial**.

## Orden de lectura recomendado para un agente nuevo

1. **Este archivo** — entender qué es la carpeta.
2. [PROJECT_MEMORY.md](PROJECT_MEMORY.md) — resumen del proyecto en una pantalla.
3. [DO_NOT_BREAK.md](DO_NOT_BREAK.md) — reglas no negociables antes de escribir código.
4. [WORKFLOW.md](WORKFLOW.md) — flujo obligatorio de trabajo.
5. [FILE_INDEX.md](FILE_INDEX.md) — dónde vive cada responsabilidad.
6. [COMMON_COMMANDS.md](COMMON_COMMANDS.md) — comandos de validación.

Opcionales según tarea:

- [LOCAL_LLM_GUIDE.md](LOCAL_LLM_GUIDE.md) — si usás Cline + LM Studio + Qwen.
- [PROMPT_TEMPLATES.md](PROMPT_TEMPLATES.md) — prompts listos para copiar.
- [coverage/](coverage/) — checklists de cobertura total PHB 3.5 (reglas, dotes, conjuros, equipo) y el manifiesto de gobernanza `coverage/V1_LAUNCH_MANIFESTO.md`.
- [patterns/](patterns/) — patrones arquitectónicos reutilizables documentados a partir de una vertical slice ya implementada (ej. `patterns/conditions-pattern.md`).

## Mantenimiento

Cuando se complete un walkthrough importante, actualizar [PROJECT_MEMORY.md](PROJECT_MEMORY.md) con el estado nuevo. Los demás archivos cambian raramente (solo si cambia la arquitectura o el flujo de trabajo).
