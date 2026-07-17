# Feats Prompt

Use this prompt when starting feat support.

```text
Necesito diseniar o implementar soporte para dotes de D&D 3.5.

Lee primero CODEX_GUIDE.md y RULES_ENGINE.md.

Objetivo:
Integrar dotes sin hardcodearlas en la UI ni dispersarlas por el servidor.

Lineamientos:
- Crear datos de dotes en packages/shared/src/data/feats cuando corresponda.
- Separar definicion de la dote de su efecto mecanico.
- Los efectos que alteran reglas deben integrarse al Rule Engine.
- El servidor debe validar efectos relevantes.
- Agregar tests para cada dote implementada.
- No implementar muchas dotes a la vez; empezar con una o dos de alto valor.

Validar con:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs
```

