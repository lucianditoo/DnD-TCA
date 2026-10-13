# D-4 — Renderer táctico 2.5D y cámara

Responsabilidad: Definir la arquitectura de presentación del tablero táctico, la cámara y los assets visuales sin introducir autoridad mecánica en el cliente.
Autoridad: Canónica (Nivel D)
Lifecycle: Implementado — pendiente de aceptación visual y Architecture Review
Reemplaza: La implementación CSS/SVG 2.5D actual como destino de presentación; no elimina el renderer 2D de respaldo.
Complementa: [`../spatial-engine-2.5d.md`](../spatial-engine-2.5d.md), [`../normative-spatial-geometry.md`](../normative-spatial-geometry.md), [`../scripted-combat-demo.md`](../scripted-combat-demo.md)
Consumidores: UI React, Board, previews tácticos, demo guionada, D-2 Participant Projection, D-3 protocolo y D-5 editor.

---

## 1. Problema y objetivo observable

El renderer vigente inclina y rota nodos DOM mediante CSS y dibuja combatientes con SVG parametrizados. Aunque preserva la simulación, no satisface el objetivo visual: la profundidad es una ilusión plana, la cámara solo ofrece cuatro presets y los combatientes no son sprites pixel-art.

D-4 establece un renderer de escena acelerado por GPU que debe permitir:

- terreno visible como un escenario con profundidad y volumen;
- cámara ortográfica que orbita e inclina el escenario mediante arrastre, sin trasladar el tablero;
- sprites pixel-art erguidos como billboards;
- obstáculos, criaturas Large y efectos con oclusión y orden de profundidad reales;
- overlays tácticos proyectados sobre el suelo;
- selección precisa de celdas y combatientes;
- conservación de la vista 2D actual como fallback funcional.

El criterio de aceptación no es que exista un botón denominado `2.5D`, sino que una persona pueda reconocer visualmente un escenario táctico volumétrico, cambiar su punto de observación de forma continua y distinguir personajes mediante arte, no mediante nombres o IDs dentro de círculos.

## 2. Límites de autoridad

El servidor y los helpers compartidos continúan siendo la única autoridad sobre posiciones, ocupación, movimiento, Cover, LoE, Vision, selección de objetivos y consecuencias. El renderer:

1. recibe un snapshot o proyección autorizada;
2. construye un modelo de escena efímero;
3. transforma coordenadas normativas a coordenadas visuales;
4. traduce el picking visual a una identidad de celda, superficie o entidad;
5. envía una intención por los contratos existentes.

La escena visual nunca persiste posiciones normativas, nunca calcula legalidad y nunca envía matrices, rayos, profundidad, cámara o colisiones como veredictos al servidor.

La altura visual provisional del Board V1 es cosmética. Cuando el modelo espacial V2 provea `Surface`, `Body Prism` y volúmenes ambientales, el mismo adaptador los consumirá; la geometría visual no se convertirá en una segunda fuente de verdad.

## 3. Auditoría de la implementación vigente

| Pieza | Valor reutilizable | Límite comprobado |
|---|---|---|
| `Board.tsx` | Props, eventos de selección, toolbar y composición con React | Mantiene celdas, obstáculos y fichas como DOM transformado; no tiene escena ni cámara 3D. |
| `presentationModel.ts` | Frontera pura entre snapshot y presentación; resolución de poses, footprints y overlays | Proyecta a filas/columnas de CSS y cuatro ángulos discretos; mezcla decisiones propias del renderer CSS. |
| `sprites.tsx` | Mapeo de arquetipos y fallbacks | Produce ilustraciones SVG vectoriales, no frames pixel-art ni texturas. |
| `styles.css` | Layout general, paneles, fallback 2D y accesibilidad | La profundidad depende de `rotateX/rotateZ`, z-index y contra-rotaciones manuales. |
| `useBoardSelection.ts` y `viewModel.ts` | Intenciones y previews compartidos | Deben seguir fuera del renderer y recibir identidades obtenidas por picking. |
| `tests-ui/demo.spec.ts` | Guion de aceptación funcional | Sus aserciones CSS/SVG deben migrar a resultados observables, no a detalles internos del renderer. |

No se debe extender el árbol CSS 3D. El prototipo actual se conserva solo hasta que la nueva ruta cubra interacción, overlays y fallback.

## 4. Decisión tecnológica

### 4.1 Alternativas evaluadas

| Alternativa | Ventajas | Incompatibilidad con el objetivo |
|---|---|---|
| DOM/CSS/SVG actual | Sin dependencia nueva, accesibilidad DOM directa | No ofrece cámara espacial, depth buffer, picking volumétrico ni oclusión robusta. La complejidad crece por cada pose, volumen y ángulo. |
| Canvas 2D nativo | Control de píxeles y buen rendimiento en escenas simples | Exige implementar proyección, orden de profundidad, cámara, picking y volúmenes manualmente. |
| PixiJS 8 | Excelente pipeline 2D de sprites, batching, interacción y WebGL/WebGPU | Su scene graph y sus transformaciones principales son 2D; una cámara con pitch/orbit y volúmenes reales exigiría meshes y proyección personalizada. Es adecuado para isométrico fijo, no es la mejor base para la cámara solicitada. |
| Three.js | Cámara ortográfica, escena 3D, depth buffer, meshes, billboards, raycasting y controles orbitales | Mayor disciplina de lifecycle y assets; WebGL2 debe tratarse como capacidad requerida para esta vista. |

### 4.2 Elección

Se adopta **Three.js mediante integración directa y encapsulada en React**, sin introducir un reconciliador de escena adicional en esta fase.

Motivos:

- `OrthographicCamera` mantiene escala táctica estable sin deformación por distancia.
- `OrbitControls` ya expresa orbitado, inclinación, zoom y límites; se configurará sin pan.
- `Raycaster` resuelve picking de celdas, unidades y objetos contra la cámara vigente.
- `WebGLRenderer` aporta depth buffer y oclusión real.
- planos texturados, `Sprite`/billboards y meshes sencillos cubren sprites pixel-art, suelo y volúmenes sin convertir la app en un motor 3D generalista.

Referencias oficiales consultadas: [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html) y [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html). PixiJS se descartó para este caso después de contrastar su [scene graph 2D](https://pixijs.com/8.x/guides/components/scene-objects) y sus [renderers](https://pixijs.com/8.x/guides/components/renderers).

La implementación recibió `Proceed`; esta decisión fue aplicada mediante una integración directa y encapsulada de Three.js.

## 5. Fronteras del renderer

### 5.1 Composición React

`Board` se mantiene como fachada estable y selecciona una de dos implementaciones:

- `TacticalScene3D`: vista primaria 2.5D;
- `TacticalBoard2D`: fallback ortogonal existente.

Los paneles React, controles de demo y estado de selección permanecen fuera del canvas. La instancia de Three.js se crea, actualiza y destruye dentro de un adaptador con lifecycle explícito; no se recrea por cada render de React.

### 5.2 Modelo de escena efímero

La frontera de presentación produce nodos tipados y estables:

- terreno/celdas transitables;
- volúmenes ambientales visuales;
- unidades, footprint, pose y asset visual;
- overlays de alcance, ruta, coste, Cover, LoE y estados;
- etiquetas y barras de vida;
- identidades de picking.

Cada nodo porta una identidad de dominio, no callbacks de reglas. Los cambios de snapshot actualizan nodos por identidad. La cámara y sus controles son estado local de UI.

### 5.3 Adaptación V1/V2

Mientras el Board actual siga siendo 2D, un `LegacyBoardSceneAdapter` proyecta:

- `(x, y)` a un plano de suelo;
- `impassableCells`, `narrowCells`, `difficultTerrainCells` y `lineOfEffectBlockingCells` a representaciones visuales distintas, sin cambiar su semántica;
- footprints a áreas de suelo y sprites escalados;
- `zFeet` legacy solo cuando exista como dato visual explícito, nunca inventando superficies.

El renderer V2 reemplazará únicamente ese adaptador para consumir superficies y volúmenes. Cámara, assets, overlays y picking conservarán sus contratos.

## 6. Cámara

La cámara por defecto es ortográfica y apunta al centro visual del mapa.

### 6.1 Interacción

- arrastre primario sobre fondo/tablero: cambia azimut y elevación;
- no existe paneo del target con mouse;
- rueda y controles `+/-`: zoom acotado;
- `Restablecer`: vuelve a encuadre, azimut, elevación y zoom por defecto;
- presets `NO/NE/SE/SO`: accesos rápidos, no únicos ángulos posibles;
- un click sin superar el umbral de arrastre mantiene la selección existente;
- touch utiliza un gesto equivalente sin mezclar selección y órbita.

### 6.2 Límites

La elevación se restringe para evitar atravesar el suelo o alcanzar una vista horizontal inutilizable. El azimut puede girar de forma continua. El target permanece fijado al centro/centroide visible del tablero; D-4 no introduce navegación libre por el mundo.

La cámara es presentacional. No se envía por WebSocket, no integra snapshots y no afecta Vision, LoE ni facing mecánico.

## 7. Escena visual

### 7.1 Terreno y volúmenes

- El suelo es un mesh continuo con textura sobria y cuadrícula superpuesta.
- Muros, pilares, desniveles y otros elementos se representan con meshes y profundidad real.
- El depth buffer reemplaza el orden manual por `paintIndex` para geometría opaca.
- Los materiales priorizan legibilidad táctica sobre realismo físico.
- Los objetos del Board V1 se renderizan según su capacidad declarada; nunca se deduce Cover o LoE del aspecto del mesh.

### 7.2 Sprites pixel-art

Los combatientes usan texturas rasterizadas transparentes, no texto ni SVG procedural en el tablero 2.5D.

Contrato de assets inicial:

- atlas o PNG transparentes originales y versionados en el repositorio;
- escala base coherente por footprint y perfil visual;
- filtrado nearest-neighbor y sin suavizado destructivo;
- ancla en los pies, sombra de contacto separada y billboard vertical;
- variantes direccionales mínimas por arquetipo cuando la cámara rota;
- poses mínimas `standing`, `prone`, `paralyzed` y `fallen`;
- fallback gráfico pixel-art para plantillas sin asset, nunca el valor textual de `icon`.

La dirección visual seleccionada por azimut es cosmética porque el motor todavía no posee facing normativo. No debe sugerirse que mirar hacia un lado tiene consecuencias mecánicas.

Los assets deben ser originales o poseer licencia compatible y registrada. La referencia visual aportada por el propietario define calidad, composición y legibilidad, no autoriza copiar personajes o recursos protegidos de otro juego.

### 7.3 Etiquetas y UI táctica

Los nombres completos no se dibujan dentro de la ficha. Por defecto se muestran al seleccionar, enfocar o pasar el puntero; barras de HP y badges críticos pueden permanecer visibles de forma compacta. La capa de etiquetas puede ser HTML posicionada desde coordenadas proyectadas, siempre que no capture picking del canvas ni sustituya la identidad del nodo.

### 7.4 Overlays

Movimiento, alcance, ruta, coste por Step, Cover, LoE, selección y áreas se dibujan como planos o geometría translúcida ligeramente elevados sobre el suelo para evitar z-fighting. Sus datos provienen de los assessments existentes. La escena solo los representa.

## 8. Picking y accesibilidad

El canvas traduce puntero a un rayo de cámara y devuelve la identidad visual más cercana. La prioridad es unidad/objeto interactivo antes que suelo, con reglas de desempate presentacionales deterministas.

La interacción debe conservar alternativas no gráficas:

- lista de combatientes y paneles React siguen permitiendo inspección/selección;
- el canvas tiene nombre y descripción accesibles;
- foco de teclado y acciones principales no dependen exclusivamente del drag;
- `prefers-reduced-motion` elimina interpolaciones de cámara, no funcionalidad;
- si WebGL2 no está disponible o la inicialización falla, se activa `TacticalBoard2D` con un aviso no bloqueante.

## 9. Rendimiento y lifecycle

- Un único renderer y loop por Board montado.
- Limpieza obligatoria de listeners, controles, geometrías, materiales y texturas al desmontar.
- ResizeObserver ajusta viewport y cámara sin reconstruir la escena.
- Render bajo demanda cuando no hay animación; durante drag o transición se habilitan frames continuos acotados.
- Reutilización de geometrías/materiales y atlas para evitar un draw call por celda o combatiente cuando pueda agruparse.
- Pixel ratio acotado para evitar costes extremos en pantallas de alta densidad.

La meta V1 es mantener interacción fluida en los tamaños de mapa soportados actualmente; D-4 no abre mundos extensos ni streaming.

## 10. Testing y aceptación visual

### 10.1 Tests estructurales

- adaptación determinista de Board V1 a nodos de escena;
- ausencia de mutación del snapshot;
- mapeo estable de identidades para picking;
- selección de assets y fallback sin exponer icon IDs;
- presets, límites y reset de cámara;
- cálculo de variantes direccionales por azimut;
- fallback 2D ante falta/error de WebGL.

### 10.2 Playwright

- arrastrar horizontalmente cambia azimut sin trasladar el target;
- arrastrar verticalmente cambia inclinación dentro de límites;
- click sin drag selecciona la celda/unidad correcta tras rotar;
- zoom y reset funcionan;
- las tres escenas de demo completan su guion en 2.5D;
- overlays, Large, Squeezing, Prone y Paralyzed siguen siendo observables;
- no aparece ningún nombre de icono ni fallback textual en el tablero;
- la vista 2D sigue operativa.

Las pruebas funcionales no deben aprobar calidad estética solo por encontrar un `<canvas>`. El cierre requiere capturas reproducibles desde al menos cuatro ángulos, una secuencia de drag y una **aceptación visual explícita del propietario** sobre sprites, profundidad, legibilidad y encuadre.

## 11. Migración sin big-bang

1. Congelar el contrato observable actual de `Board` y los eventos de selección.
2. Separar del modelo actual las decisiones reutilizables de pose, footprint, estado y overlays.
3. Incorporar el renderer detrás de un selector/feature gate, conservando 2D y CSS 2.5D durante la transición.
4. Habilitar terreno, cámara y picking antes de migrar unidades.
5. Incorporar el primer atlas pixel-art completo para los actores de la demo.
6. Migrar overlays y condiciones.
7. Ejecutar la demo completa y validar accesibilidad/fallback.
8. Retirar la ruta CSS 2.5D y sus proyecciones exclusivas solo cuando exista paridad verificable; la ruta 2D permanece.

## 12. Riesgos

| Riesgo | Control |
|---|---|
| El canvas reimplementa reglas | Modelo de escena recibe assessments e identidades; queda prohibido calcular legalidad. |
| Selección diverge tras rotar | Picking por raycast contra IDs estables y pruebas después de cada movimiento de cámara. |
| Arte inconsistente o ilegible | Guía de assets, atlas inicial cerrado y gate visual humano. |
| Cámara causa mareo o pierde el mapa | Límites de elevación/zoom, target fijo, reset y reduced motion. |
| WebGL no disponible | Fallback 2D funcional. |
| Fuga de recursos al cambiar de sala | Lifecycle y pruebas de montaje/desmontaje repetido. |
| Duplicación con Spatial Engine V2 | Adaptador V1 aislado; renderer consume nodos visuales y luego sustituye solo el adaptador. |
| El prototipo se confunde con D-4 completo | Estado documental explícito y retiro de la etiqueta solo tras aceptación y paridad. |

## 13. Alternativas descartadas

- Seguir profundizando transforms CSS: conserva precisamente las limitaciones reportadas.
- Canvas 2D con proyección isométrica propia: recrea cámara, orden, picking y oclusión sin ventaja para este alcance.
- PixiJS como renderer principal: excelente para sprites e isométrico fijo, pero la órbita/inclinación continua y los volúmenes llevarían a una capa 3D personalizada.
- Cámara perspectiva libre: altera la escala aparente y favorece una experiencia de navegación 3D que no es necesaria para el tablero táctico.
- React Three Fiber en la primera migración: añade otra capa de reconciliación antes de estabilizar la frontera del renderer; podrá reevaluarse si el volumen de escena React lo justifica.

## 14. Decisiones cerradas y abiertas

### Cerradas por este NDD

- Three.js como renderer de la vista 2.5D.
- Cámara ortográfica orbital, con pitch/yaw continuo, zoom y pan deshabilitado.
- Render autoritativamente pasivo: snapshot/proyección entra; identidad de intención sale.
- Sprites pixel-art rasterizados con billboard y nearest-neighbor.
- Fallback 2D preservado.
- Aceptación visual humana obligatoria.

### Pendientes de aprobación del propietario/Architecture Review

- Resolución y cantidad exacta de direcciones/poses del primer atlas.
- Si el primer lote de assets se crea específicamente para la demo o cubre todo el catálogo actual.
- Presupuesto mínimo de rendimiento y tamaño máximo de mapa para el gate V1.
- Persistencia local de preferencias de cámara entre sesiones (nunca autoritativa).

---

**Estado:** READY FOR ARCHITECTURE REVIEW
