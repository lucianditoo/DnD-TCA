# Rule Engine Prompt

Use this prompt when consolidating or adding rules.

```text
Necesito trabajar sobre el Rule Engine de D&D 3.5.

Lee primero CODEX_GUIDE.md, RULES_ENGINE.md y COMBAT_FLOW.md.

Principios:
- Datos en catalogos.
- Reglas en shared/server, no en UI.
- El servidor valida toda regla importante.
- La UI solo guia, muestra overlays y envia comandos.
- Las reglas reutilizables deben ser funciones puras cuando sea posible.
- No duplicar logica entre cliente y servidor.

Antes de implementar:
1. Identificar datos necesarios.
2. Definir inputs/outputs de la regla.
3. Ubicar la logica compartida o autoritativa.
4. Definir tests unitarios o E2E.

Al terminar ejecutar:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs

Actualizar RULES_ENGINE.md y TODO.md si cambia cobertura de reglas.
```

