# D&D 3.5 Tactical Combat Assistant

Aplicacion web local para dirigir combates tacticos de Dungeons & Dragons 3.5.

El proyecto esta evolucionando hacia un motor de combate tactico mantenible, con documentacion AI-first para que humanos y asistentes de IA puedan continuar el desarrollo sin depender del historial del chat.

Empieza por leer (orden unico oficial — Sprint 054C):

1. El **Reader Pipeline** obligatorio: [.agents/AGENTS.md](.agents/AGENTS.md)
   (Fase 0) — define exactamente que leer antes de cualquier tarea.
2. [INDEX.md](INDEX.md): localizador de toda responsabilidad documental.
3. [.ai/README.md](.ai/README.md): contexto compacto complementario para
   agentes de IA.

Vistas de orientacion (derivadas, no autoridad): [CODEX_GUIDE.md](CODEX_GUIDE.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [RULES_ENGINE.md](RULES_ENGINE.md),
[COMBAT_FLOW.md](COMBAT_FLOW.md).

## Correr el proyecto

```powershell
npm install
npm run dev
```

URLs por defecto:

- Web: `http://localhost:5173`
- Server health: `http://localhost:3333/health`

## Validar

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
```

Para `scripts/e2e-websocket.mjs`, el servidor debe estar levantado.

