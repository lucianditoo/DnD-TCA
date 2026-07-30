# Spatial Engine & 2.5D Tactical Presentation

Responsabilidad: Definir la arquitectura autoritativa del espacio 3D discreto, entidades espaciales y su presentación visual 2.5D.
Autoridad: Canónica
Lifecycle: Diseño
Reemplaza: -
Complementa: docs/architecture/combat-engine.md
Consumidores: Todo agente o desarrollador que modifique movimiento, geometría, LoE, Cover, proyecciones visuales, objetos del entorno o la persistencia de los mapas.

## 1. Filosofía del Spatial Engine

DnD-TCA es un motor táctico autoritativo para encuentros de combate D&D 3.5. El combate es el núcleo del producto. El **Spatial Engine** evoluciona para soportar plenamente la verticalidad que las reglas mecánicas del juego exigen (diferencia de altura, túneles, puentes, caída, obstáculos volumétricos), sin convertirse en un motor de física genérico ni de simulación de mundos. Todo el espacio es discreto y sirve como tablero de arbitraje de las reglas SRD.

## 2. Separación entre Simulación, Espacio, Presentación, Renderer y Audiovisual

- **Simulación (Servidor):** Autoridad absoluta de estados, reglas, transacciones, y mecánicas D&D 3.5.
- **Espacio (Servidor):** Estructura topológica y volumétrica (superficies, conexiones, niveles, elevación). Dicta distancias, alcance, LoE y Cover de forma determinista y autoritativa.
- **Presentación (UI):** Traducción pura del estado espacial (el Snapshot) a una perspectiva visual 2.5D, cámara interactiva (isométrica, rotación, pan, zoom).
- **Renderer (UI):** La tecnología de dibujado elegida (ej. Three.js o Babylon.js, reemplazando el CSS grid plano). No tiene autoridad de reglas.
- **Audiovisual (UI):** Efectos visuales, sprites, animaciones, sonidos. Pura cosmética que acompaña la presentación 2.5D sin dictar mecánica.

## 3. Modelo Espacial

Se adopta la recomendación del Codex: **Columnas con múltiples superficies transitables y conexiones explícitas, complementadas mediante volúmenes discretos para criaturas, obstáculos y efectos.**
El espacio es discreto (casillas x/y), pero una columna (x, y) puede tener múltiples pisos (Superficies). Cada superficie proporciona anclaje y altura de soporte canónica, y los volúmenes existen en el espacio continuo discretizado.

## 4. Formato de Mapa Versionado

El mapa debe versionarse semánticamente. Un mapa V2 (espacial) definirá:
- `surfaces`: Colección indexada de superficies que otorgan piso/techo.
- `connections`: Vínculos explícitos de transición entre superficies (rampas, escaleras, aberturas).
- `hazards / volumes`: Regiones o celdas espaciales con propiedades persistentes.
- `environmentalObjects`: Catálogo de objetos con identidad y presencia volumétrica.

## 5. Position

El concepto original de `Position {x, y, zFeet}` deja de ser simplemente "casilla + un número ignorado" para representar una coordenada de anclaje abstracta, asumiendo su `zFeet` como la cota inferior estricta en el espacio.

## 6. Surface

Nueva primitiva: `Surface`. 
Define una región transitable (o no transitable pero sólida). Otorga soporte gravitatorio y elevación basal canónica (`zFeet`). Las superficies resuelven la ambigüedad estructural de dos puentes en la misma (x, y). Un combatiente apoya sus pies sobre una `Surface` explícita o cae.

## 7. SpatialPosition

Nueva primitiva canónica de estado de ocupación: `SpatialPosition { x: number, y: number, surfaceId: string, zFeet: number }`.
Combina la coordenada horizontal con la identidad concreta del soporte (`surfaceId`), dejando `zFeet` como el valor derivado pero persistido de elevación real.

## 8. Objetos Ambientales

Existen como entidades tácticas de primera clase. Poseen:
- Identidad (`id`).
- Posición / Volumen ocupado.
- Capacidades de bloqueo participativas (Cover, LoE, Ocupación de Movimiento).
No todos tienen HP ni son destructibles en V1, pero pueden ser objetivos de selecciones tácticas si el sistema lo requiere.

## 9. Movimiento

- **Transiciones:** El pathfinding y validación de movimiento ya no se basan en un grid adyacente x/y liso. Se valida transitabilidad mediante adyacencia de casillas sobre la misma superficie, y transiciones explicitadas mediante `connections` entre superficies distintas.
- Coste vertical: Todo cambio de elevación que no fluya por una conexión mitigadora (rampa) asume modo especial (trepar, saltar, volar).
- Caen (literalmente y lógicamente) las entidades que abandonan una superficie sin tener vuelo.

## 10. Ocupación

Las entidades ya no ocupan sólo un rectángulo horizontal en (x,y). Ocupan un prisma discreto definido por su Footprint horizontal (size) y su Perfil Vertical (altura corporal base, ej. 5 pies para Mediano, 10 para Grande (alto)). 
La ocupación de casilla x/y en z constante permite que dos criaturas estén en la misma (x,y) en diferentes superficies, respetando las leyes de solapamiento solo donde los prismas corporales colisionen.

## 11. Geometría

Las primitivas puramente planas (como distancia Euclidiana y Chebyshev horizontal) se elevan. La matemática volumétrica usa cajas delimitadoras (Bounding Boxes de tamaño `width x length x height` en pies).

## 12. Distancia

La regla canónica 5-10-5 de 3.5e debe calcularse en tres dimensiones: el mayor desplazamiento (x, y, z) establece la distancia base, y el segundo mayor aporta diagonales.

## 13. Alcance

El volumen amenazado ya no es un cuadrado plano, sino una burbuja volumétrica truncada (ej. un cubo expandido, según 3.5) alrededor del volumen corporal. Las elevaciones importan para atacar criaturas volando o sobre balcones.

## 14. Threat

Amenaza (Threat) requiere LoE y Alcance Volumétrico (Reach). No se amenaza a través de pisos sólidos ni coberturas totales que bloqueen LoE en Z.

## 15. Flanking

Sigue trazándose línea entre centros corporales (ajustados volumétricamente). Si la línea interseca bordes o caras opuestas horizontales sin obstrucciones de Cover Totales/Sólidas, otorga Flanking.

## 16. AoO

Ataques de oportunidad requieren Threat legal (convergencia de LoE, Alcance y Cover verificados en 3D). La trayectoria de salida de un prisma amenazado detona el AdO, midiendo sobre la superficie real que abandona o atraviesa el provocador.

## 17. Cover

La intercepción volumétrica. El rayo entre volúmenes o caras del agresor y objetivo busca colisión en Z con otros prismas corporales (criaturas) y objetos ambientales. Una plataforma concede Cover si el rayo de ataque cruza el suelo.

## 18. Vision

Iluminación y visión operan sobre volumen. Fuentes de luz esféricas radiantes que se limitan (clipping) por suelos/techos (superficies).

## 19. LoE

Misma lógica de trazado de rayos volumétricos. LoE se corta irrevocablemente si intersecta suelos sin aberturas o volúmenes opacos marcados como bloqueadores.

## 20. AoE

Expansiones de formas cilíndricas (explosiones), cónicas volumétricas y de línea 3D. 
Celdas afectadas son la intersección volumétrica de la forma con la topología, clipada por LoE (paredes, pisos).

## 21. Snapshots

El `CombatRulesSnapshot` incluirá colecciones `surfaces`, `connections`, y `environmentalObjects`, junto con `positions` enriquecidas a `SpatialPosition` (o garantizando el transporte explícito de elevación y superficie).

## 22. CombatRoom

Envía la topología persistente del nivel en forma inmutable como parte del estado inicial y snapshotings incrementales.

## 23. Versionado

El protocolo WebSocket, el esquema de Room y Storage de base de datos asumen explícitamente formato/versiones: 
- `format: "v1"` (plano clásico).
- `format: "v2-spatial"` (superficies y objetos explícitos).

## 24. Compatibilidad

Los perfiles (personajes) se asumen agnósticos, al entrar al combate su `Position` asume la `Surface` inicial asignada. 
Servidor v2 adaptará mapas antiguos (V1) autogenerando una única `Surface` basal que cubre todo el width x height, a zFeet 0.

## 25. Migración Conceptual

El motor espacial (servidor) expone un adaptador bidimensional temporal o resuelve que cualquier consulta carente de Z apunte al `surface` base por defecto, para no romper primitivas funcionales que todavía no hayan adoptado volumen.

## 26. Presentación 2.5D

La UI React abandona el Grid CSS (por insuficiencia de Z order y clipping real). Adopta una escena renderizada, con los tokens y tiles renderizables pero presentados desde perspectiva táctica.

## 27. Cámara

Obligatorio en V1:
- Rotación horizontal continua de 360°.
- Control por brújula o atajos de teclado.
- Paneo y Zoom fluido.
- Inclinación vertical fija u horquillada (ej. 30° a 60°) para asegurar legibilidad táctica.
- Compartir cámara del GM temporalmente sin exponer Fog of War (posiciones ignoradas siguen invisibles).

## 28. Fog of War

Debe operar diferenciado por jugador, sobre el modelo 2.5D:
- Regiones Vistas (visibles ahora, con tokens y acciones).
- Regiones Exploradas (memoria arquitectónica, grisadas, sin tokens actuales).
- No Exploradas (ocultas total).

## 29. Editor

Debe ser estricto y generar sólo el formato de mapa autoritativo V2. Crear superficies, alturas, y ubicar objetos tácticos. No un modelador libre 3D, sino un constructor de topología por bloques/superficies (tileset tridimensional o elevador de grillas).

## 30. Persistencia

Preparación para persistencia de Room: Los mapas no pueden existir sólo en memoria. El NDD deja el contrato preparado para que una base de datos documental (o localStorage expandido) guarde el plano topológico.

## 31. Reconexión

El estado del cliente reasume su cámara o posición default, descarga el Snapshot V2 y su Fog of War personal, y re-rutea el ownership en la `CombatRoom` tal y como funciona ahora, sumando identidad espacial (superficies, volúmenes, luces).

## 32. Cierre del Encuentro

Mantiene separación mecánica entre resultado (victory, defeat, etc.) y causa. No se involucra con el espacio directamente, pero el encuentro preserva el snapshot del terreno en la persistencia del cierre (loot sobre terreno).

## 33. Riesgos

- **Sobre-ingeniería de Rendering:** Intentar implementar físicas u oclusión visual fotorrealista.
- **Rendimiento UI:** Motor WebGL costoso que impida acceso por tablets.
- **Divergencias Servidor-UI:** Que el cliente intente "adivinar" colisiones de AoE usando el engine 3D visual en vez del árbitro del servidor.

## 34. Alternativas Descartadas

- **Física Continua y Motores Colisión:** Rechazado por desalineación con las reglas SRD por casillas discretas y determinismo estricto de testing (Floating Point errors).
- **Grid Plano con Z como atributo transportado ignorado:** La recomendación y decisión del owner determinan que esto impide soporte funcional a túneles, puentes superpuestos y bloqueo de LoE real.

## 35. Deuda Documental

El MVP Histórico de `combat-engine-mvp.md` ya excluye vuelo y 3D, requiere marcaje de Superseded (superado) para no contradecir el `spatial-engine-2.5d.md`. Además, deberá actualizarse la mención a footprints en el documento de `RULES_ENGINE.md`.

## 36. Criterios de Aceptación

- Arquitectura de estado separada, puramente inyectable en `rules.ts`.
- Primitiva `Surface` unifica resolución ambigua en el Eje Z.
- UI con cámara aislada de la resolución autoritativa (no evalúa, solo pinta la proyección provista).
- El `INDEX.md` refleja la introducción de este NDD de forma canónica.

## 37. ODR Pendientes (Owner Decision Required)

- **ODR-1: Cuantización de Eje Z (Discretización Base):** ¿Debe la altura de `Surface` anclarse obligatoriamente a incrementos discretos (ej. 5 pies), o es continua (`zFeet: 12.5`) siempre que las reglas consuman pies redondeables? 
- **ODR-2: Foco del Editor V1:** ¿El editor táctico de V1 requiere soporte incorporado de edición de objetos volumétricos (modificar ancho y alto del objeto en la UI) o solo colocación de "prefabs" tácticos con volumen inmutable provenientes de catálogo?
- **ODR-3: Naturaleza del Render Visual:** ¿La perspectiva obligatoria isométrica clásica será forzada (cámara ortográfica) o se admitirá cámara perspectiva con limitación de grados de libertad (tilt)?
