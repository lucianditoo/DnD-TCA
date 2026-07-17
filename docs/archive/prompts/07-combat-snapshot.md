# CombatSnapshot Prompt

Use this prompt when introducing or evolving CombatSnapshot.

```text
Necesito trabajar sobre CombatSnapshot.

Lee primero CODEX_GUIDE.md, ARCHITECTURE.md, RULES_ENGINE.md y COMBAT_FLOW.md.

Objetivo:
Crear una vista estable y testeable del estado de combate para que reglas, validaciones y UI no dependan de estructuras mutables dispersas.

Principios:
- No cambiar comportamiento visible en la primera fase.
- El snapshot debe facilitar tests.
- El servidor sigue siendo autoridad.
- El snapshot no debe duplicar catalogos completos.
- El snapshot puede exponer datos derivados, pero estos deben calcularse desde fuentes confiables.

Implementacion sugerida:
1. Definir el tipo de snapshot en shared o server segun convenga.
2. Crear una funcion pura que lo construya desde CombatRoom.
3. Migrar una regla pequenia para usarlo.
4. Agregar tests.
5. Repetir incrementalmente.

Validar con:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs
```

