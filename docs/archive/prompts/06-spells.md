# Spells Prompt

Use this prompt when adding spells.

```text
Necesito diseniar o implementar conjuros de D&D 3.5.

Lee primero CODEX_GUIDE.md, RULES_ENGINE.md y COMBAT_FLOW.md.

Principios:
- Los conjuros deben tener datos separados de su resolucion.
- La UI no debe contener reglas complejas de conjuros.
- El servidor valida objetivos, alcance, acciones, componentes si existen, salvaciones y efectos.
- Los efectos reutilizables deben vivir en helpers testeables.
- Evitar hardcodear un conjuro completo dentro de un componente.

Al implementar un conjuro:
1. Agregar/ajustar datos.
2. Definir tipo de objetivo.
3. Definir accion requerida.
4. Definir alcance.
5. Definir efecto.
6. Agregar tests.

Validar con:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs
```

