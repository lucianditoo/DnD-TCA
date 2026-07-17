# LOCAL_LLM_GUIDE — Guía para Cline + LM Studio

Este proyecto fue diseñado con la premisa de ser asistido por agentes de IA locales o externos, manteniendo siempre a la IA dentro de un corral de testing y reglas estrictas.

## Configuración de Entorno

Si usás Cline y LM Studio para desarrollo local (sin API keys pagas):

1. **Levantar LM Studio**
   - Asegurarse de tener el servidor local activado (ícono de servidor en la barra izquierda).
   - URL base: `http://localhost:1234/v1`

2. **Modelos recomendados**
   - Para tareas diarias, refactors y bugs: **Qwen2.5-Coder-14B-Instruct Q4_K_M** (rápido, cabe en 16GB RAM).
   - Para rediseño arquitectónico complejo: **Qwen2.5-Coder-32B-Instruct Q4_K_M** (más lento, requiere +24GB RAM).
   - Context Window: configurar al menos en 8192 o 16384 en LM Studio.

3. **Configurar Cline**
   - API Provider: `OpenAI Compatible`
   - Base URL: `http://localhost:1234/v1`
   - API Key: `lm-studio` (dummy)
   - Model ID: (El que tengas cargado, no importa para LM Studio pero Cline puede pedirlo).

## Primer Prompt (Onboarding)

Cuando inicies un nuevo chat en Cline, dale contexto sobre esta carpeta para evitar que se pierda:

```text
Por favor, lee primero la carpeta .ai/ para entender el contexto del proyecto y las reglas obligatorias de trabajo. Comienza por .ai/README.md y .ai/PROJECT_MEMORY.md. No propongas código hasta no haber leído esos documentos y entender el flujo de trabajo (WORKFLOW.md).
```

## Advertencia sobre modelos locales

Los modelos locales (incluso de 14B-32B parámetros) pueden sufrir de **degradación de contexto** u olvidar restricciones (ej: "el servidor es autoritativo" o "no usar hooks en `packages/shared`").

Por eso existe el flujo obligatorio en `WORKFLOW.md`:
1. El requerimiento de **crear el plan primero** ayuda al modelo a razonar.
2. La barrera de **esperar aprobación** permite al humano interceptar alucinaciones.
3. La obligación de **correr tests** (`npm test`) captura automáticamente errores groseros.

## Tip pro: Cargar contexto explícito

Si le pedís a Cline que modifique un comando de ataque, decile explícitamente qué leer:

> "Revisá .ai/DO_NOT_BREAK.md, luego apps/server/src/commands/attackCommands.ts y packages/shared/src/rules.ts antes de planificar."
