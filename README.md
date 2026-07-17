# D&D 3.5 Tactical Combat Assistant

Aplicacion web local para dirigir combates tacticos de Dungeons & Dragons 3.5.

El proyecto esta evolucionando hacia un motor de combate tactico mantenible, con documentacion AI-first para que humanos y asistentes de IA puedan continuar el desarrollo sin depender del historial del chat.

Empieza por leer:

- [.ai/README.md](.ai/README.md): **Memoria compacta para agentes de IA** (Onboarding de 5 mins).
- [CODEX_GUIDE.md](CODEX_GUIDE.md): guia principal del proyecto.
- [PROJECT_STATUS.md](PROJECT_STATUS.md): estado actual.
- [ARCHITECTURE.md](ARCHITECTURE.md): organizacion tecnica.
- [RULES_ENGINE.md](RULES_ENGINE.md): reglas implementadas y pendientes.
- [COMBAT_FLOW.md](COMBAT_FLOW.md): flujo de combate.
- [TODO.md](TODO.md): roadmap.

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

