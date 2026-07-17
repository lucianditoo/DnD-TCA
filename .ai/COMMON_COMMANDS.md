# COMMON_COMMANDS — Comandos frecuentes

> Shell: **PowerShell** (Windows). Usar `;` en lugar de `&&` para encadenar comandos.

---

## Instalación

```powershell
npm install
```

**Cuándo**: Al clonar el repositorio o después de cambios en cualquier `package.json`.

---

## Tests unitarios

```powershell
npm test
```

**Cuándo**: Siempre después de cualquier cambio de código. Es el comando de verificación más rápido.

**Qué cubre**: Reglas de combate, snapshots, equipo, críticos, natural 1/20, AdO, validación Zod de comandos WebSocket.

**Nota**: Construye `packages/shared` automáticamente antes de correr los tests.

---

## Typecheck

```powershell
npm run typecheck
```

**Cuándo**: Antes de commitear. Verifica `shared`, `web` y `server` de forma secuencial.

**Qué detecta**: Errores de tipos que no impiden que el servidor arranque pero que indican contratos rotos.

---

## Build de producción

```powershell
npm run build
```

**Cuándo**: Para validar que el código compila completo (shared → web → server). Obligatorio antes de considerar una tarea terminada.

**Qué incluye**: Compilación TypeScript de los tres paquetes + bundling Vite del frontend.

---

## E2E WebSocket

```powershell
# Terminal 1 — levantar el servidor:
npx tsx apps/server/src/index.ts

# Terminal 2 — correr el E2E:
node scripts/e2e-websocket.mjs
```

**Cuándo**: Después de cambios que afecten el protocolo WebSocket, handlers de comandos, movimiento, ataques, o cualquier flujo de combate visible desde el cliente.

**Qué cubre**: Flujos reales de sala: ownership, movimiento diagonal, AdO, carga, defensa total, luchar a la defensiva, prestar ayuda, críticos (vía dispatcher completo).

---

## Desarrollo local

```powershell
npm run dev
```

**Cuándo**: Para desarrollo interactivo con hot reload. Levanta el servidor y el frontend en paralelo.

**URLs por defecto**:
- Web: `http://localhost:5173`
- Server health: `http://localhost:3333/health`

---

## Build solo de shared

```powershell
npm --workspace @dnd-tactical/shared run build
```

**Cuándo**: Cuando cambiás algo en `packages/shared` y querés que `apps/server` o `apps/web` vean el cambio antes de correr los tests completos.

---

## Orden recomendado de validación completa

```powershell
npm test
npm run typecheck
npm run build
# (en otra terminal: npx tsx apps/server/src/index.ts)
node scripts/e2e-websocket.mjs
```

Ejecutar en este orden: los tests unitarios son los más rápidos y detectan la mayoría de los problemas primero.
