# Implementation Plan — D-4 Renderer táctico 2.5D y cámara

Responsabilidad: Secuenciar la futura implementación del NDD D-4 sin autorizarla.
Autoridad: Registro del plan ejecutado
Lifecycle: Implementado — pendiente de aceptación visual y Architecture Review
Complementa: [`design.md`](design.md)

> El propietario concedió `Proceed`; las etapas se ejecutaron preservando el renderer 2D y la autoridad mecánica del servidor.

## 1. Gate de precondición

- Confirmar rama, HEAD, sincronización y cambios locales permitidos.
- Revalidar el NDD D-4 contra el código vigente.
- Confirmar que D-1B y cualquier otro sprint concurrente no modificaron las props públicas de `Board`.
- Inventariar todos los tests que inspeccionan selectores CSS/SVG del renderer actual.
- Resolver las decisiones abiertas de assets, rendimiento y preferencias de cámara.

## 2. Etapa 1 — Frontera de renderer y dependencias

Archivos previstos:

- `apps/web/package.json`
- `package-lock.json`
- `apps/web/src/components/Board/Board.tsx`
- nuevos módulos bajo `apps/web/src/components/Board/renderer/`

Trabajo:

- incorporar `three` y tipos requeridos;
- extraer `TacticalBoard2D` sin cambiar comportamiento;
- crear la fachada de renderer y su contrato de lifecycle;
- añadir detección de capacidad WebGL2 y fallback explícito;
- mantener deshabilitada la ruta nueva tras un feature gate durante esta etapa.

Gate: typecheck/build y tests del Board actual sin cambios observables.

## 3. Etapa 2 — Modelo de escena derivado

- separar de `presentationModel.ts` pose, footprint, estado, overlays e identidad de assets;
- crear nodos visuales independientes de Three.js para terreno, unidad, volumen, overlay y etiqueta;
- implementar el adaptador `LegacyBoardSceneAdapter`;
- probar pureza, estabilidad de IDs e inmutabilidad del snapshot;
- evitar cualquier import de Three.js en `@dnd-tactical/shared`.

Gate: tests unitarios del adaptador y equivalencia con las escenas de demo.

## 4. Etapa 3 — Escena, suelo y cámara

- crear renderer, escena y cámara ortográfica;
- dibujar suelo continuo, cuadrícula y volúmenes simples;
- configurar orbitado con pan deshabilitado, límites de elevación y zoom;
- implementar drag, click-vs-drag, presets y reset;
- ajustar resize, pixel ratio y render bajo demanda;
- garantizar dispose completo.

Gate: Playwright verifica orbitado horizontal/vertical, target fijo, zoom/reset y montaje/desmontaje.

## 5. Etapa 4 — Picking e interacción

- raycast de celdas, unidades y objetos;
- traducir intersecciones a las callbacks actuales de `Board`;
- preservar prioridades y selección durante cámara rotada;
- añadir navegación alternativa por panel/teclado;
- bloquear cualquier dato de cámara en comandos de red.

Gate: mismas intenciones de selección desde 2D y 2.5D; servidor sigue revalidando.

## 6. Etapa 5 — Pipeline de pixel art

- aprobar guía visual y matriz de arquetipos/poses/direcciones;
- producir assets originales transparentes para todos los actores de la demo;
- registrar autoría/licencia y manifiesto de atlas;
- configurar nearest-neighbor, ancla de pies, escalas y sombras;
- implementar fallback pixel-art genérico por facción;
- seleccionar variante direccional por azimut sin implicar facing mecánico.

Gate visual intermedio: capturas del mismo actor en cuatro ángulos y comparación humana antes de continuar.

## 7. Etapa 6 — Unidades, condiciones, etiquetas y overlays

- renderizar billboards con depth testing y escala Large/Squeezing;
- representar Prone, Paralyzed y Fallen;
- migrar rutas, celdas alcanzables, costes, Cover/LoE y selección;
- montar etiquetas compactas sin nombres dentro del sprite;
- asegurar que ningún `icon` textual llega al canvas.

Gate: paridad de las tres escenas de demo y pruebas unitarias de assets/poses.

## 8. Etapa 7 — Conmutación y retirada del prototipo CSS

- hacer Three.js la vista `2.5D` primaria;
- conservar `2D` como fallback elegible y automático;
- retirar únicamente CSS, modelos y tests exclusivos del renderer 2.5D anterior;
- conservar helpers que continúen teniendo consumidores legítimos;
- actualizar selectores Playwright hacia comportamiento observable.

Gate: búsqueda de código muerto y cero segunda fuente de proyección normativa.

## 9. Verificación obligatoria

- `npm test`
- `npm run typecheck`
- `npm run build`
- `node scripts/e2e-websocket.mjs`
- `npm run test:ui`
- `git diff --check`
- CI Windows verde

Evidencia visual obligatoria:

- cuatro ángulos cardinales;
- dos inclinaciones distintas obtenidas mediante drag;
- escenario con Large, obstáculos y oclusión;
- overlays de movimiento/coste;
- Prone y Paralyzed;
- fallback 2D;
- una grabación o secuencia de capturas que pruebe que el tablero orbita sin pan.

El sprint no se cierra hasta obtener aceptación visual explícita del propietario.

## 10. Criterios de detención

Detener la implementación si:

- el renderer necesita recalcular legalidad mecánica;
- picking requiere enviar coordenadas visuales como autoridad;
- una dependencia fuerza WebGPU sin fallback compatible;
- no puede mantenerse la vista 2D;
- los assets no tienen procedencia/licencia verificable;
- el lifecycle deja listeners o contextos activos al desmontar;
- D-1B o Spatial V2 cambian una frontera consumida sin adaptación explícita.

---

**Estado:** IMPLEMENTATION PLAN READY FOR ARCHITECTURE REVIEW
