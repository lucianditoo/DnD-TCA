# Testing Prompt

Use this prompt to expand automated tests.

```text
Necesito fortalecer la cultura de testing del proyecto.

Lee primero CODEX_GUIDE.md, PROJECT_STATUS.md y RULES_ENGINE.md.

Objetivo:
Agregar tests automatizados para una regla, flujo o bug sin agregar funcionalidad nueva.

Reglas:
- Cada bug corregido debe quedar cubierto por un test de regresion.
- Preferir funciones puras testeables en packages/shared cuando sea posible.
- Para flujos de combate o multiplayer, agregar cobertura en scripts/e2e-websocket.mjs.
- No cambiar reglas de juego salvo que el test demuestre una discrepancia con el comportamiento esperado.

Ejecutar:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs

Reportar:
1. bug o comportamiento cubierto,
2. tests agregados,
3. archivos modificados,
4. comandos y resultados,
5. riesgos restantes.
```

