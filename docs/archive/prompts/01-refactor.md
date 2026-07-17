# Refactor Prompt

Use this prompt when asking any AI assistant to refactor the project safely.

```text
Necesito una fase de refactor arquitectonico segura para dnd-tactical-combat-assistant.

Lee primero CODEX_GUIDE.md, ARCHITECTURE.md, RULES_ENGINE.md y COMBAT_FLOW.md.

Objetivo:
Reducir complejidad y duplicacion sin cambiar comportamiento.

Restricciones:
- No agregar funcionalidades nuevas.
- No cambiar reglas de juego.
- No cambiar mensajes del contrato WebSocket salvo que sea estrictamente necesario.
- Mantener al servidor como autoridad.
- Mantener la UI igual salvo que se pida explicitamente lo contrario.
- No duplicar datos de catalogos.

Criterios:
- Separar responsabilidades por dominio.
- Evitar archivos gigantes.
- Mantener funciones puras cuando sea posible.
- Agregar o ajustar tests solo para proteger comportamiento existente.

Al terminar ejecutar:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs

Reportar:
1. archivos modificados,
2. responsabilidades movidas,
3. comandos ejecutados,
4. resultado de cada comando,
5. riesgos o deuda restante.
```

