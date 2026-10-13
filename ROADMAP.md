# Roadmap — Mesa Digital Táctica D&D 3.5

Responsabilidad: Orden estratégico de hitos, arquitectura de producto y dependencias hacia la V1.0.
Autoridad: Canónica
Lifecycle: Snapshot vivo
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [pendientes](TODO.md), [Manifiesto V1](.ai/coverage/V1_LAUNCH_MANIFESTO.md)
Consumidores: Propietario y agentes durante la planificación y ejecución.

---

## Visión del Producto: Mesa Táctica Híbrida

El objetivo central del proyecto es dar soporte a una **Mesa Digital de Combate Táctico D&D 3.5**, compuesta por tres roles/vistas diferenciadas conectadas en tiempo real:

1. **Pantalla Central de Mesa (TV / Battlemap)**:
   - Tablero 2.5D tridimensional orbital en Three.js proyectado a pantalla completa, sin menús molestos que obstruyan el combate.
   - Muestra la **visión compartida del grupo (Party Vision)**: lo que al menos un héroe consciente y vidente puede ver se revela en el escenario; lo que nadie ve permanece en penumbra o niebla.
   - En caso de Ceguera momentánea en el turno del personaje activo, la escena simula la reducción visual a 10 pies.
2. **Mandos Satélite de Jugador (Companion Móvil / Navegador)**:
   - Interfaz vertical limpia y ligera para el celular/laptop de cada jugador.
   - Tablero 2D complementario para interactuar y tocar casillas de movimiento o selección de objetivos.
   - Panel de acciones (*Mover*, *Paso de 5 ft*, *Atacar*, *Conjurar*), estadísticas en vivo y log de eventos.
   - Ocultación estricta de todo elemento o enemigo que el personaje individual no perciba.
3. **Mando de Dirección (Panel del GM)**:
   - Control omnisciente del encuentro (sin Fog of War).
   - Editor rápido de salas y encuentros, gestión de monstruos, orden de iniciativa y administración de estados.

---

## Fases de Desarrollo

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ROADMAP: MESA DIGITAL TÁCTICA D&D 3.5                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ FASE 1: NÚCLEO DE COMBATE Y ENTORNO INMEDIATO                                          │
│ • Zoom ampliado al 200% y presets de cámara en el tablero 2.5D                         │
│ • Corrección de oclusión 3D (muros ocluyen a personajes según perspectiva)             │
│ • Creador de Mapas Básico: definir tamaño de sala y pintar muros, columnas, escombros  │
│ • Flujo libre de combate en sala: selección, movimiento 2.5D, ataques y conjuros       │
│                                                                                        │
│ FASE 2: CHARACTER BUILDER GUIADO                                                       │
│ • Creación por pasos: Selección de Raza, Clase y Nivel objetivo                        │
│ • Cálculo automático de BAB, Salvaciones, HP y bonos de característica                 │
│ • Asignación de competencias de equipo, dotes iniciales y conjuros preparados          │
│                                                                                        │
│ FASE 3: MESA DIGITAL HÍBRIDA (TV + COMPANION MÓVIL)                                    │
│ • Modo Pantalla TV (Battlemap Espectador): render 2.5D maximizado a pantalla completa   │
│ • Modo Jugador / Móvil: interfaz táctica 2D rápida con botones de acción y log         │
│ • Modo GM: control omnisciente, gestión de iniciativa y estado global                  │
│                                                                                        │
│ FASE 4: FOG OF WAR DINÁMICA Y CEGUERA REAL                                             │
│ • Revelado en tiempo real por Unión de Visión Grupal (Party Vision) en la TV           │
│ • Ocultación estricta en el móvil de lo que el personaje individual no perciba         │
│ • Mecánica de Ceguera/Oscuridad: reducción visual a 10 ft en el turno del afectado      │
│                                                                                        │
│ FASE 5: CATÁLOGOS COMPLETOS Y REGLAS AVANZADAS DEL PHB (V1.0)                          │
│ • Ataque completo iterativo (BAB múltiple, combate con dos armas, disparo rápido)      │
│ • Cobertura integral de dotes y conjuros del Manual del Jugador                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Fase 1: Núcleo de Combate y Entorno Inmediato

- **Zoom y Cámara**: Zoom continuo de 75% a 200% (`CAMERA_ZOOM_MAX = 2.0`), presets deterministas (`NO`, `NE`, `SE`, `SO`) y órbita libre por arrastre.
- **Oclusión Real 3D**: Ajuste del buffer de profundidad (`depthTest: true`) para que los muros y pilares ocluyan a las criaturas cuando la perspectiva de cámara los sitúa por delante, sin que las líneas del suelo corten los pies de los sprites.
- **Editor Táctico de Mapas (D-5 MVP)**:
  - Definición de dimensiones del tablero (ancho x alto).
  - Herramienta de pintura de celdas para colocar muros (`impassableCells`), columnas LoE (`lineOfEffectBlockingCells`) y escombros (`difficultTerrainCells`).
- **Integración de Movimiento D-1B y Flujo Libre**:
  - Conectar el pipeline puro de movimiento (`resolveMovementPipeline` / `commitMovementResolution`) a partidas libres normales, eliminando la dependencia exclusiva de la demo.

---

## 2. Fase 2: Character Builder Guiado (PHB 3.5)

- **Wizard de Creación**:
  - **Paso 1**: Raza (Humano, Elfo, Enano, Mediano, Gnomo, Semielfo, Semiorco) y Clase (Guerrero, Pícaro, Clérigo, Mago, Explorador, Bárbaro, etc.).
  - **Paso 2**: Nivel del Personaje (1–20):
    - Cálculo automático del BAB según progresión (Bueno `+1/lvl`, Medio `+0.75/lvl`, Bajo `+0.5/lvl`).
    - Cálculo automático de Salvaciones base (Fortaleza, Reflejos, Voluntad).
    - Cálculo de Dados de Golpe y HP sugeridos.
  - **Paso 3**: Puntuaciones de Característica: Arreglo estándar, Point Buy o tirada de dados, aplicando bonos/penalizaciones raciales.
  - **Paso 4**: Equipamiento inicial por paquetes según competencias de clase.
  - **Paso 5**: Selección de dotes según nivel y preparación de conjuros por slots.

---

## 3. Fase 3: Mesa Digital Híbrida (TV + Companion Móvil)

- **Modo Battlemap Espectador (TV)**:
  - Vista limpia sin menús laterales para proyectar en televisión o pantalla de mesa.
  - Controles de cámara orbital y visualización fluida de acciones, rutas y ataques.
- **Modo Companion Móvil / Web**:
  - Vista adaptada a smartphones (pantalla vertical).
  - Mini-mapa táctico 2D para selección táctica precisa por casilla.
  - Botones de acción directa (*Mover*, *Paso de 5 ft*, *Atacar*, *Conjurar*) y log de combate.
- **Modo GM**:
  - Control de visibilidad, iniciativa, monstruos y aplicación de condiciones.

---

## 4. Fase 4: Fog of War Dinámica y Perspectivas de Visión

- **Party Vision en la TV**:
  - Revelado de niebla en tiempo real basado en la unión de campos visuales de los miembros conscientes del grupo.
  - Si el único personaje con visión hacia un área queda cegado o cae inconsciente, dicha área y los enemigos allí ocultos vuelven a cubrirse de niebla en la TV.
- **Visión Individual en Companion**:
  - El jugador solo ve en su teléfono lo que su propio personaje detecta con sus sentidos.
- **Ceguera y Fenómenos Visuales**:
  - En el turno de un combatiente con condición *Cegado* (*Blindness*) u oscuridad mágica, la visión se reduce a 10 ft (2 casillas) de radio auditivo/tanteo.
  - Integración de Visión en la Penumbra (*Low-Light Vision*) y Visión en la Oscuridad (*Darkvision*).

---

## 5. Fase 5: Catálogos Completos y Reglas Avanzadas PHB (V1.0)

- **Rutinas de Ataque Completo**: BAB múltiple (`+6/+1`), combate con dos armas (*Two-Weapon Fighting*), *Rapid Shot*, *Haste*, ataques naturales y *Cleave*.
- **Catálogos Declarativos PHB**: Cobertura sistemática de las dotes y conjuros del Manual del Jugador conforme a [`V1_LAUNCH_MANIFESTO.md`](.ai/coverage/V1_LAUNCH_MANIFESTO.md).
- **Consolidación Final**: Estabilidad de red, reconexión robusta y persistencia durable de campañas.
