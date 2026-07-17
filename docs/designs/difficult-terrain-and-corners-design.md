# Diseño de Terreno Difícil y Esquinas (Sprint 015)

## 1. Objetivo y Problema que Resuelve
El motor geométrico actual calcula el coste de movimiento asumiendo que todas las casillas son de terreno normal (coste 5 ft en recta, 5 y 10 ft alternando en diagonal) y permite el paso diagonal a través de esquinas bloqueadas. El objetivo de este diseño es integrar formalmente:
1. **Terreno Difícil (Difficult Terrain):** Costes de movimiento incrementados (10 ft en recta, 15 ft y 20 ft alternando en diagonal) y bloqueo total del "Paso de 5 pies" (5-foot step) hacia, desde o a través de dichas casillas.
2. **Restricción de Esquinas (Corners):** Bloqueo del movimiento diagonal cuando la esquina compartida está ocupada por un obstáculo infranqueable o una criatura enemiga activa (ya que su control físico bloquea el vértice).

## 2. Arquitectura Propuesta

### A. Modificación del Esquema `Board`
Se extenderá el esquema inmutable del tablero para almacenar la configuración táctica:
```typescript
export interface Board {
  width: number;
  height: number;
  cellSizeFeet: number;
  difficultTerrainCells?: string[]; // Claves "x,y" O(1)
  impassableCells?: string[];       // Claves "x,y" O(1) para muros y obstáculos
}
```

### B. Inyección de Predicados Dinámicos (Filtro de Irreversibilidad a 20 Sprints)
Para evitar que `calculatePathCostFeet` o `validateMovePath` necesiten ser modificados cuando en el futuro añadamos Efectos de Área (como el conjuro *Grasa*), la firma del generador de costes no leerá estáticamente del `board`, sino que el Snapshot inyectará su conocimiento o se proveerán predicados derivados.

**¿Cómo garantizamos que futuras mecánicas se acoplen sin alterar `rules.ts`?**
* **Respuesta (Filtro de Irreversibilidad):** `calculatePathStepCostsFeet` recibirá el `CombatRulesSnapshot`. Dentro del snapshot, o a través de un selector puramente derivado (ej. `selectDifficultTerrain(context)`), se unificarán las `board.difficultTerrainCells` estáticas con las casillas afectadas por `EffectInstances` dinámicas (Area of Effect). De esta forma, el algoritmo geométrico simplemente consultará `isDifficultTerrain(x, y)` ignorando si su origen es el tablero estático o un campo de fuerza mágico dinámico. La pureza de la función matemática en `rules.ts` se mantiene 100% aislada de la lógica de *ActiveEffects*.

### C. Algoritmo de Terreno Difícil y Complejidad Accidental
El coste de la trayectoria se calculará en la función pura `calculatePathStepCostsFeet(origin, path, context)`.
* Paso normal: 5 ft. Terreno Difícil: 10 ft.
* Diagonal normal: 5 ft (primera), 10 ft (segunda). Terreno Difícil: 15 ft (primera), 20 ft (segunda).

**¿De qué manera aseguramos que la UI y el servidor utilicen el mismo algoritmo?**
* **Respuesta (Complejidad Accidental):** La función `calculatePathStepCostsFeet` y `calculatePathCostFeet` exportadas desde el paquete isomorfo `@dnd-tactical/shared` serán consumidas de forma idéntica tanto por el servidor autoritativo durante la validación del comando, como por el validador predictivo del Frontend en React (durante el hover del ratón sobre la cuadrícula). Al no haber estado local imperativo ni dependencias de React en la función de coste, el renderizado de la cuadrícula coloreada coincidirá siempre *byte por byte* con la decisión final del servidor.

### D. Restricción de Diagonales (Rule ID: MOVE-05)
En `validateMovePath`, al detectar que `Math.abs(dx) === 1 && Math.abs(dy) === 1`, se analizarán las casillas adyacentes perpendiculares `(x1, y2)` y `(x2, y1)`.
El paso será marcado como inválido (ilegal) si alguna de estas esquinas contiene:
1. Una casilla presente en `board.impassableCells`.
2. Una criatura enemiga que esté consciente y activa (se usa la misma lógica que determina si provee amenaza).

### E. Beneficiarios Inmediatos (La Regla de Tres)
**Nombra tres mecánicas que se beneficiarán directamente de este nuevo pipeline:**
* **Respuesta:**
  1. **Acróbata (Tumble) / Movilidad:** Al intentar evitar Ataques de Oportunidad a través de casillas enemigas, la presencia de Terreno Difícil incrementa la CD de la prueba de Acrobacias, lo cual ahora podrá consultarse mediante la misma función `isDifficultTerrain(x,y)`.
  2. **Bloqueo de Carga (Charge):** La regla oficial indica que no puedes cargar si hay terreno difícil en la trayectoria o si una línea de visión/efecto por esquinas está bloqueada. El handler de `charge` podrá verificar inmediatamente la ruta generada contra los costes y bloqueos.
  3. **Paso de 5 pies (5-foot step):** Al incorporar el chequeo de `isDifficultTerrain` en `validateMovePath`, se bloqueará de forma nativa la acción de paso de 5 pies sin requerir hacks en el controlador de turnos.

## 3. Riesgos y Mitigaciones
* **Rendimiento:** Verificar que la búsqueda de `(x, y)` en arrays o *Sets* inmutables sea rápida. Se usará tipado `Set<string>` en runtime derivado del `snapshot` para consultas O(1) de obstáculos y terreno difícil.

## 4. Estrategia de Implementación
1. Ampliar el `Board` schema en `@dnd-tactical/shared`.
2. Ajustar `calculatePathStepCostsFeet` para requerir el contexto completo o el mapa de terreno.
3. Actualizar `validateMovePath` para validar el paso de 5 pies en terreno difícil y comprobar los vértices (esquinas bloqueadas) al moverse en diagonal.
4. Desarrollar la suite de pruebas unitarias cubriendo todas las variaciones de costes, prohibición de 5-ft step y bloqueos de esquinas.
