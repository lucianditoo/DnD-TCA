# NDD D-5 — Editor Táctico de Mapas MVP (Map Builder)

> **Responsabilidad canónica:** Documento de diseño arquitectónico para el Editor Táctico de Mapas MVP (Hito 1.2 de la Fase 1 del Roadmap de Mesa Digital).
> **Autoridad:** Especificación de diseño y contratos.
> **Lifecycle:** Permanente.
> **Consumidores:** Desarrolladores, Architecture Reviewers y agentes de IA.

---

## 1. Contexto y Objetivos

El sistema cuenta con un motor autoritativo de reglas D&D 3.5 en el servidor y una capa de presentación WebGL 2.5D (Three.js) con cámara orbital, zoom continuo al 300%, paneo libre con click derecho y fallback 2D.

Hasta el momento, la configuración del tablero (`room.board`) era estática: todas las salas regulares se inicializaban con un tablero vacío de 16×8 casillas (`demoBoard`), y los obstáculos solo existían preconfigurados dentro de la demo automática (`scripted_tactical_demo_v1`).

### Objetivo
Permitir al Director de Juego (GM) diseñar, ajustar y redimensionar el mapa táctico interactivo directamente desde la aplicación web, persistiendo el resultado en la sala autoritativa y actualizando en tiempo real la geometría volumétrica 3D y el motor de reglas (movimiento, Line of Effect y terreno difícil).

---

## 2. Arquitectura y Contratos

### 2.1 Modelo de Datos Canónico (`Board`)

El tipo canónico [`Board`](file:///c:/Users/lucia/OneDrive/Documentos/AGCLI-dnd-tactical-combat-assistant/packages/shared/src/types.ts#L24-L34) en `@dnd-tactical/shared` define:

```typescript
export interface Board {
  width: number;
  height: number;
  cellSizeFeet: number;
  difficultTerrainCells?: string[];       // Claves "x,y" O(1): coste doble de movimiento (Sprint 052)
  impassableCells?: string[];             // Claves "x,y" O(1): bloqueo de MOVIMIENTO (muros de piedra 3D)
  narrowCells?: string[];                 // Claves "x,y" O(1): Squeezing
  lineOfEffectBlockingCells?: string[];   // Claves "x,y" O(1): obstrucción completa de Line of Effect (pilares/columnas 3D)
  dimLightCells?: string[];              // Claves "x,y" O(1): iluminación tenue
  darknessCells?: string[];              // Claves "x,y" O(1): oscuridad total
}
```

El MVP se enfoca en las 3 capas fundamentales de obstáculos tácticos:
1. **Muro (`impassableCells`)**: Bloque volumétrico de piedra (1.55 de altura) que bloquea el paso físico de criaturas.
2. **Columna / Pilar (`lineOfEffectBlockingCells`)**: Cilindro volumétrico (2.4 de altura) que bloquea la Line of Effect (visión y efecto directo).
3. **Escombros (`difficultTerrainCells`)**: Rocas volumétricas bajas (0.38 de altura) que cuestan el doble de movimiento (10 ft por casilla).
4. **Suelo Libre**: Elimina cualquier obstáculo de la casilla.

### 2.2 Protocolo de Red (`ClientCommand`)

Se añade el comando autoritativo `update-board` a la unión cerrada [`ClientCommand`](file:///c:/Users/lucia/OneDrive/Documentos/AGCLI-dnd-tactical-combat-assistant/packages/shared/src/commands.ts):

```typescript
export interface UpdateBoardCommand {
  readonly type: "update-board";
  readonly roomCode: string;
  readonly actorId: string;
  readonly board: {
    readonly width: number;
    readonly height: number;
    readonly cellSizeFeet?: number;
    readonly impassableCells?: readonly string[];
    readonly lineOfEffectBlockingCells?: readonly string[];
    readonly difficultTerrainCells?: readonly string[];
    readonly narrowCells?: readonly string[];
    readonly dimLightCells?: readonly string[];
    readonly darknessCells?: readonly string[];
  };
}
```

### 2.3 Autoridad y Validación en el Servidor (`apps/server`)

El handler `handleUpdateBoard` en `apps/server/src/commands/roomCommands.ts` (o `tacticalCommands.ts`) valida:
1. **Ownership / Permisos**: Únicamente el participante con rol `"gm"` puede alterar el tablero de la sala. Si un jugador envía `update-board`, se rechaza con error: *"Solo el GM puede modificar el mapa de la sala"*.
2. **Dimensiones Válidas**:
   - `width` y `height` deben ser enteros entre 6 y 40 (mínimo 6 para albergar criaturas Large 2×2, máximo 40 para evitar consumos desproporcionados de memoria).
   - `cellSizeFeet` se normaliza a 5.
3. **Integridad de Coordenadas**:
   - Todas las claves `"x,y"` deben corresponder a enteros dentro de los límites: `0 <= x < width` y `0 <= y < height`.
   - Se limpian celdas que queden fuera si el mapa fue achicado.
4. **Validación de Ocupación por Combatientes**:
   - Si se intenta colocar un `impassableCells` sobre la casilla ocupada por un combatiente, el comando se rechaza con mensaje: *"No se puede colocar un muro en la casilla (x,y) ocupada por [Nombre]"*.
   - Los combatientes no pueden quedar fuera de los límites del tablero.
5. **Transaccionalidad y Broadcast**:
   - Se asigna el nuevo `room.board`.
   - Se registra en `room.log`: *"El GM actualizó el mapa táctico (ancho x alto)"*.
   - Se emite `broadcast(room)` a todos los clientes conectados.

---

## 3. Diseño de la Experiencia de Usuario (UI/UX)

### 3.1 Integración en la Interfaz Web
- En la barra superior (`topbar`) o en `ActionsPanel` (sección del GM), se agrega un botón accesible exclusivamente para el GM: **"Editor de Mapa"**.
- Al activarse, se entra en modo edición (`isMapEditing: true`):
  - Se despliega una barra de herramientas del editor:
    - **Dimensiones**: Selector de Ancho y Alto con botón de redimensionar.
    - **Pinceles Tácticos**:
      - 🧱 Muro
      - 🏛️ Columna LoE
      - 🪨 Escombros
      - 🧹 Borrar
    - **Herramientas Rápidas**:
      - "Limpiar Todo" (despeja todos los obstáculos conservando dimensiones).
    - **Acciones**:
      - "Aplicar / Guardar" (emite `update-board` al servidor).
      - "Cancelar" (restaura el tablero original y sale del modo edición).
- **Interacción en el Tablero**:
  - Mientras `isMapEditing` esté activo, hacer click izquierdo en cualquier casilla del tablero 2.5D (o 2D) aplica instantáneamente el pincel seleccionado en el borrador local.
  - La escena Three.js refleja los cambios volumétricos en tiempo real (muros de piedra, pilares y escombros aparecen de inmediato).
  - Al hacer click en "Aplicar", se sincroniza con el servidor WebSocket.

---

## 4. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Redimensionar el mapa deja combatientes en el vacío | Inconsistencia de estado | El servidor valida que ninguna criatura quede fuera de los nuevos límites `[0..width-1, 0..height-1]`. Si ocurre, el comando se rechaza indicando qué combatiente requiere reubicación previa. |
| Inyección de celdas inválidas desde clientes maliciosos | Desincronización o errores de raycasting | El validador del servidor filtra rigurosamente que cada string `"x,y"` represente coordenadas enteras positivas acotadas. |
| Muros colocados sobre combatientes | Criatura atrapada en terreno impasable | Regla explícita de rechazo en el servidor si la huella de una criatura viva se solapa con una celda impasable. |

---

## 5. Estrategia de Testing

1. **Unit Tests (Shared & Server)**:
   - Validación de esquema de `update-board`.
   - Rechazo de participantes no-GM.
   - Rechazo de dimensiones fuera de rango (<6 o >40).
   - Rechazo de muros colocados sobre criaturas existentes.
   - Aceptación y persistencia de tablero válido con emisión de `room-update`.
2. **WebSocket E2E Integration**:
   - GM crea sala, emite `update-board` con muros, columnas y escombros.
   - Comprobación de que el snapshot del cliente refleja las nuevas dimensiones y celdas.
3. **UI / Playwright**:
   - Activar "Editor de Mapa", pintar muros y verificar que se reflejan en el modelo de presentación y canvas 2.5D.
