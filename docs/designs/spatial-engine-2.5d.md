# Spatial Engine & 2.5D Tactical Presentation

Responsabilidad: Definir la arquitectura autoritativa del espacio 3D discreto, entidades espaciales y su presentación visual 2.5D.
Autoridad: Canónica
Lifecycle: Diseño
Reemplaza: docs/designs/combat-engine-mvp.md (totalmente supersedido por exclusiones espaciales obsoletas)
Complementa: docs/architecture/combat-engine.md, docs/designs/terrain-cover-line-of-effect-decision.md, docs/designs/cover-and-dynamic-reach-design.md, docs/designs/vision-and-line-of-effect-architecture.md, docs/designs/large-footprints-core-integration-design.md
Consumidores: Todo agente (P0) que toque reglas de movimiento, geometría, LoE, Cover, proyecciones visuales, objetos del entorno o persistencia de mapas.

## 1. Filosofía del Spatial Engine
El motor táctico es el árbitro exclusivo de las reglas espaciales. El espacio es discreto (cuantizado) también en el eje vertical Z, con incrementos canónicos obligatorios de 5 pies (unidades espaciales enteras, prohibido el floating point). DnD-TCA no incorporará físicas continuas ni colisiones rígidas; la topología está estructurada por conectividad declarativa y volúmenes discretos alineados al grid espacial tridimensional para garantizar determinismo estricto.

## 2. Separación entre capas
- **Simulación (Servidor):** Autoridad sobre ocupación, estado, transacciones y matemática del combate.
- **Espacio (Servidor):** Estructura topológica y volumétrica (Surfaces, Volúmenes). Fuente canónica para cálculos de alcance, visión y obstrucciones.
- **Presentación (UI):** Proyección visual 2.5D del estado espacial. Realiza hit-testing presentacional traduciéndolo a identidades espaciales para el servidor, pero **no** decide legalidad ni reconstruye geometría normativa.
- **Renderer y Audiovisual:** Cosmética, cámara y tecnología de dibujado; independientes del motor de reglas.

## 3. Modelo Espacial: Columnas y Superficies
Se adopta formalmente el modelo de **columnas x/y con múltiples superficies transitables (o sólidas) superpuestas, conexiones explícitas y volúmenes corporales/ambientales discretos.**

## 4. Identidad Espacial Canónica y SpatialPosition
`Position` legacy (que acarrea el valor no autoritativo `zFeet`) queda restringida a formatos V1 y fronteras de importación/adaptación.
El dominio V2 adopta la identidad espacial canónica para celdas ocupables:
```typescript
SpatialPosition {
  x: number,
  y: number,
  surfaceId: string
}
```
`zFeet` no se persiste como fuente de verdad en `SpatialPosition`. Es un valor derivado (u obtenido por caché) resolviendo `surfaceId -> Surface -> elevación basal`.

**Migración conceptual pendiente:** Los consumidores actuales (`AttackTarget.kind === "square"`, `OpportunityAttack.origin/.destination`, `provokingCells`, `MovementStepProjection`, `EffectInstance.targetCells`, viewModels) migrarán para referenciar identidades espaciales canónicas que soporten superposiciones puente/túnel en la misma x/y.

## 5. Surface
Contrato conceptual mínimo de `Surface`:
- Identidad estable unívoca.
- Extensión horizontal discreta (colección de casillas x/y a las que pertenece).
- Elevación canónica base (discretizada en enteros de 5 pies).
- Separación entre cara transitable y volumen sólido.
- Propiedades estructurales: bloqueos de LoE, visión, iluminación, movimiento y separación de volúmenes.
**Importante:** Una Surface no concede Cover parcial por el mero hecho de cruzarse; Cover parcial requiere una evaluación específica de interposición. Total Cover resulta de la pérdida total de LoE.

## 6. Ocupación, Perfil Vertical y Footprints
La ocupación evoluciona de rectángulos horizontales (footprints) a prismas corporales discretos.
- **Perfil Vertical:** Dato táctico explícito (no derivado puramente de `sizeCategory`). Su autoridad puede provenir del catálogo, templates, monturas o transformaciones.
- **Volumen Corporal:** Prismas resultantes del footprint horizontal + perfil vertical.
- **Ocupación:** `getCombatantOccupiedCells` se reemplazará (o envolverá) en una abstracción volumétrica canónica que integre apoyo (sobre `Surface`) y extensión superior.

## 7. Objetos Ambientales
Existen como identidades tácticas independientes con capacidades particionadas explícitas y declarativas. No existe un atributo genérico `blocking`. Sus capacidades modulares son:
- Bloqueo de Movimiento / Terreno Difícil / Squeezing.
- Bloqueo de Line of Effect.
- Bloqueo/Reducción de Vision / Opacidad / Emisión de luz.
- Participación explícita en Cover parcial.
- Ocultación (Concealment).
- Interactividad (targetability, hazards).
Las implementaciones específicas requieren diseño (D-6).

## 8. Movimiento
- Fluye horizontalmente sobre la transitabilidad de una misma `Surface`.
- Cambios de elevación ordinarios ocurren por `connections` (escaleras, rampas).
- Abandonar una superficie sin conexión válida ni vuelo implica **caída**.
- Se requiere ancla arquitectónica (diseño futuro) para salto (transición validada a través del vacío) y trepar.

## 9. Geometría Normativa: Distancia y Alcance
La cuantización espacial y el algoritmo exacto 3D para la regla 5-10-5, así como el alcance (burbujas volumétricas truncadas) quedan diferidos al NDD hijo (D-1). Deben respetar estricto determinismo entero tridimensional.

## 10. Threat, Flanking y AoO
Se preserva la separación irrestricta de assessments:
- **Threat (Amenaza):** Deriva de ocupación y alcance espacial. No evalúa legalidad final, Cover, Concealment ni LoE.
- **Flanking:** Consume Threat y la relación geométrica entre centros. No inyecta requisitos de LoE o Cover salvo si el PHB lo indica normativamente.
- **Ataques de Oportunidad (AoO):** Componen provocación, Threat, LoE, Cover, Concealment y otras legalidades, invocando a los módulos individuales. LoE y Cover se verifican en la trayectoria de salida 3D, sobre la superficie real.

## 11. LoE, Cover, Vision e Iluminación
- **Line of Effect:** Rayos volumétricos clipados estrictamente por `Surfaces` sin aberturas y objetos opacos de LoE.
- **Cover:** Interposición de prismas (criaturas) u objetos ambientales declarativos de Cover. Cover Parcial y Total Cover/LoE siguen siendo evaluaciones independientes.
- **Vision / Iluminación:** Capacidades independientes del LoE mecánico (ej. cristal bloquea LoE pero no Vision). Clipping en Z por techos y suelos.

## 12. Fog of War
Abandona el broadcast general de `CombatRoom`.
Se instaura la **Participant Projection** (frontera autoritativa server-side). El cliente recibe una proyección censurada (`Wire Snapshot`) correspondiente a lo que su grupo (o GM) ve legítimamente:
- Combatientes y objetos (y sus estadísticas y efectos) fuera de visión se excluyen del payload o se ofuscan.
- Soporte para terreno No Explorado, Explorador, y Visible.
El diseño recae en D-2.

## 13. Persistencia y Protocolo
La persistencia autoritativa de mapas, FoW, ownership, salas y estados **debe residir en el servidor** (o BDD server-side). `localStorage` queda relegado a preferencias de UI y drafts no autoritativos.
- Versionado por dominio (ej. handshake de red, compatibilidad de protocolo, format de Storage).
- Se prohíben resoluciones silenciosas V2 contra superficies "por defecto". Clientes o mapas no migrados deben encontrarse en fronteras estrictas de adaptación o fallar explícitamente.

## 14. Reconexión e Identidad
No existe hoy una solución robusta. Se requiere un diseño explícito (D-3) de sesiones seguras, binding sesión-socket, tokens de reanudación y recuperación controlada de ownership ante desconexiones, coordinado con la nueva proyección FoW.

## 15. Editor V1
Producirá de manera estricta y directa el formato V2 autoritativo. Basado en colocación de prefabs ambientales (de catálogo) sobre superficies y definición de elevaciones/conexiones. Sin modelado volumétrico libre (el tamaño lo dicta el prefab). Utiliza la validación pura del servidor.

## 16. Cierre de Encuentro
Separación clara entre estado mecánico final (victoria, rendición) y retención del mapa persistido (loot, posiciones finales, objetos mutados).

## 17. Migración de Perfiles
Los perfiles de personajes actuales arrastran `Position` legacy. Queda registrada la deuda migratoria para extirpar la posición del perfil o normalizar las preferencias de despliegue en V2.

## 18. Criterios de Aceptación Observables Futuros (Testing Obligatorio)
- Entidades sobre dos superficies superpuestas en igual x/y.
- Pasos legales por debajo de puentes ocupados.
- Rechazo de superposiciones de prismas.
- Distancia/Alcance volumétrico preservando 5-10-5.
- Rechazo estricto de clientes de protocolo antiguo.
- Proyección visual de FoW incapaz de extraer metadatos censurados.

## 19. NDD Hijos Obligatorios
- **D-1 — Geometría Normativa Espacial (Nivel D):** Algoritmos de identidad, footprint volumétrico, distancia, LoE, Cover, Vision, AoE en 3D discreto.
- **D-2 — Fog of War y Participant Projection (Nivel D):** Frontera de servidor y proyecciones filtradas censuradas.
- **D-3 — Protocolo, Identidad, Reconexión y Persistencia Durable (Nivel D):** Sesiones, versionado de wire y esquemas de persistencia server-side.
- **D-4 — Renderer, Presentación 2.5D y Cámara (Nivel C/D):** Perspectiva UI (tilt, ortográfica/perspectiva), hit-testing, renders.
- **D-5 — Editor Táctico V2 (Nivel C/D):** Creación basada en superficies y prefabs.
- **D-6 — Objetos Ambientales (Nivel C/D):** Capacidades tácticas divisibles y entidades.
