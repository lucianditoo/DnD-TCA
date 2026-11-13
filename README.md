# D&D 3.5 Tactical Combat Assistant

Aplicacion web local para dirigir combates tacticos de Dungeons & Dragons 3.5.

El proyecto esta evolucionando hacia un motor de combate tactico mantenible, con documentacion AI-first para que humanos y asistentes de IA puedan continuar el desarrollo sin depender del historial del chat.

Para contribuir, seguí [AGENTS.md](AGENTS.md) y consultá [INDEX.md](INDEX.md)
para ubicar las fuentes del área. La [guía de Codex y ECC](CODEX_GUIDE.md)
explica la selección de habilidades y los verificadores del proyecto.
## Correr el proyecto

```powershell
npm install
npm run dev
```

URLs por defecto:

- Web: `http://localhost:5173`
- Server health: `http://localhost:3333/health`

## Reconexión del GM

Si se corta el WebSocket, mantené abierta la pestaña de la partida. El GM se
reconecta automáticamente, incluso al recargarla, mientras el servidor conserve
la sala en memoria. La credencial queda en `sessionStorage` de esa pestaña.

La recuperación está disponible por HTTP/WebSocket en loopback y por HTTPS/WSS
en red. Para TLS directo, configurá `WS_TLS_CERT` y `WS_TLS_KEY` con las rutas del
certificado y la clave del servidor, y `VITE_WS_URL` con la URL WSS correspondiente.

## Validar

Consultá los [verificadores](CODEX_GUIDE.md#verificadores) y la [matriz de evidencia](GOVERNANCE.md#52-nivel-de-cambio-y-evidencia).
