# Diseño: Validación en Runtime de Comandos WebSocket con Zod

## 1. Problema actual y riesgos
El servidor de combate asume implícitamente que los datos recibidos mediante WebSockets coinciden con el tipo `ClientCommand` de TypeScript. No existe validación estructural en tiempo de ejecución (runtime check).

### Riesgos de payloads malformados:
* **Crashes del Servidor**: Acceder a propiedades anidadas inexistentes (ej. `command.roomCode.toUpperCase()`) arroja `TypeError` que, de no manejarse en el try-catch de primer nivel, puede comprometer la estabilidad del hilo.
* **Corrupción del Estado**: Campos con valores del tipo incorrecto (ej. un string enviado en un campo que espera un número como `d20Roll`) pueden sortear TypeScript en tiempo de compilación y contaminar los cálculos aritméticos en los resolvidores, resultando en estados corruptos persistentes en la sala.
* **Manipulación de Datos**: Clientes modificados podrían inyectar campos adicionales o ignorar checks de control de acciones enviando datos malformados.

---

## 2. Solución Propuesta: Validación con Zod
Proponemos incorporar la biblioteca **Zod** como dependencia en `@dnd-tactical/shared`. 
* **Por qué Zod**: Proporciona validación declarativa, tipado estático inferido y es altamente reutilizable tanto en el servidor como en el cliente.
* **Impacto de Complejidad**: Mínimo. Zod se acopla de manera natural a monorrepositorios TypeScript y permite mantener las definiciones y validadores de esquemas en un único punto.

---

## 3. Arquitectura y Ubicación

### Ubicación de los Schemas
Los esquemas se ubicarán en un nuevo archivo dentro de la carpeta compartida:
`packages/shared/src/schemas/commands.ts`

Los exportaremos en el punto de entrada principal del paquete (`packages/shared/src/index.ts`).

### Estructura de Schemas
Definiremos esquemas individuales para cada comando y los combinaremos usando la unión discriminada de Zod:
```typescript
import { z } from "zod";

export const positionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  zFeet: z.number().int().default(0)
});

export const createRoomSchema = z.object({
  type: z.literal("create-room"),
  name: z.string().min(1)
});

// ... esquemas para cada comando ...

export const clientCommandSchema = z.discriminatedUnion("type", [
  createRoomSchema,
  // ... resto de comandos ...
]);
```

---

## 4. Conexión en el Servidor (`index.ts` y `dispatcher.ts`)

En `apps/server/src/index.ts`, en el receptor del mensaje WebSocket, implementaremos la validación utilizando `safeParse` antes de despachar el comando:

```typescript
socket.on("message", (raw) => {
  try {
    const rawData = JSON.parse(raw.toString());
    const parseResult = clientCommandSchema.safeParse(rawData);
    
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      send(socket, { type: "error", message: "Validación de comando fallida: " + errorMsg });
      return;
    }

    dispatchCommand(socket, parseResult.data);
  } catch (error) {
    send(socket, { type: "error", message: error instanceof Error ? error.message : "Mensaje inválido." });
  }
});
```

De este modo, `dispatcher.ts` recibirá garantizadamente un comando 100% tipado y limpio de datos basura.

---

## 5. Compatibilidad y Errores

### Compatibilidad con comandos existentes
El esquema Zod replicará exactamente el contrato actual del tipo `ClientCommand`. No se modificará ningún campo ni comportamiento semántico.

### Reporte de Errores al Cliente
Los errores de validación se mapearán en una cadena amigable que especifica qué propiedad falló y cuál es la expectativa (ej: `d20Roll: Expected number, received string`). Se enviará un evento WebSocket estándar de tipo `"error"`.

---

## 6. Estrategia de Testing

Crearemos una nueva suite de pruebas `tests/websocket-validation.test.mjs`:
1. **Validación de Comando Correcto**: Asegurar que comandos bien formados son parseados exitosamente.
2. **Rechazo de Payloads Corruptos**: Enviar payloads con tipos de datos inválidos (ej: `d20Roll: "veinte"`) y validar que el esquema los rechace produciendo un mensaje detallado de error.
3. **Rechazo de Comandos Desconocidos**: Enviar comandos con un campo `type` inexistente o no contemplado y verificar el rechazo controlado.

---

## 7. Plan Incremental de Implementación

1. **Fase 1: Configurar Dependencias**
   * Añadir `zod` a `packages/shared/package.json` como dependencia de producción.
2. **Fase 2: Definir Esquemas**
   * Escribir todos los esquemas individuales de comandos WebSocket en `packages/shared/src/schemas/commands.ts`.
   * Exportar el esquema principal y exportar Zod en `packages/shared/src/index.ts`.
3. **Fase 3: Integrar en el Receptor del Servidor**
   * Modificar `apps/server/src/index.ts` para interceptar y validar con `clientCommandSchema.safeParse`.
4. **Fase 4: Ejecutar Pruebas y QA**
   * Crear la suite de tests unitarios de validación de payloads.
   * Ejecutar la suite completa (`npm test`, `npm run build`, `npm run typecheck` y tests E2E).
