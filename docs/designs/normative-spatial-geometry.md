# Geometría Normativa Espacial (D-1R1)

Responsabilidad: Definir la matemática autoritativa y el modelo formal del espacio táctico tridimensional.
Autoridad: Canónica (Nivel D)
Lifecycle: Diseño Aprobado (Remediation)
Reemplaza: -
Complementa: `docs/designs/spatial-engine-2.5d.md` (SSOT Espacial)
Consumidores: Rules Engine, Movement, Cover, Vision, LoE, AoE, Threat, Flanking, Opportunity Attacks, Editor, FoW, Persistencia, Protocolo.

---

## 1. Modelo Espacial Formal

El motor opera sobre un espacio tridimensional cuantizado regido por primitivas estrictas. El tamaño de la celda táctica queda normativamente fijado en **5 pies** para V1.

- **Spatial Cell (Celda):** La unidad volumétrica matemática de 5x5x5 pies. No se admiten subdivisiones topológicas.
- **Column (Columna):** Colección de celdas que comparten `(x, y)`. Estructura la verticalidad.
- **Surface (Superficie):** Estructura topológica primaria que agrupa celdas horizontales. Provee anclaje y transitabilidad.
- **Anchored Spatial Position:** Identidad inmutable de una entidad apoyada sobre una Surface.
- **Volumetric Spatial Coordinate:** Identidad de una celda volumétrica (anclada o en el aire).
- **Vertical Profile (Perfil Vertical):** Extensión vertical efectiva de una entidad.
- **Footprint (Huella):** Proyección horizontal de la entidad. Soporta ocupación sub-celular para criaturas diminutas y co-ocupación legal.
- **Body Prism (Prisma Corporal):** Volumen táctico exacto (Footprint X/Y extruido en Z por el Vertical Profile).
- **Environmental Volume:** Celdas ocupadas por objetos del entorno.
- **Hazard Volume:** Regiones volumétricas que el motor de reglas interseca pero que carecen de solidez puramente geométrica.
- **Empty Space:** Celdas vacías sin Surface, Prismas ni Objetos.

---

## 2. Identidades Espaciales

Para evitar duplicidad de fuentes de verdad, existen dos identidades formales, mutamente exclusivas por estado:

### Anchored Spatial Position
Usada por entidades con soporte estable (apoyadas en una Surface).
```typescript
{
  x: number;
  y: number;
  surfaceId: string;
}
```
*Invariante:* La elevación se deriva unívocamente de la `Surface`. No existe `zFeet`.

### Volumetric Spatial Coordinate
Usada para identificar celdas puras, targeting volumétrico, celdas aéreas, caída, salto, o criaturas volando sin soporte.
```typescript
{
  x: number;
  y: number;
  zLevel: number; // Múltiplo entero de 5 pies (ej: 0, 5, 10)
}
```

Una criatura anclada conserva `Anchored Spatial Position`. Al perder soporte, transiciona temporal o definitivamente a un estado aéreo/en caída regido por `Volumetric Spatial Coordinate` hasta validar un nuevo soporte.

---

## 3. Surface (Superficie)

- **Identidad:** `surfaceId` inmutable.
- **Extensión y Elevación:** Colección de celdas `(x, y)` a una cota basal única múltiplo de 5 pies.
- **Solidez y Continuidad:** Puede tener agujeros, islas desconectadas, y superponerse en la misma `(x,y)` con otras Surfaces siempre que no ocupen el mismo `zLevel`.
- **Soporte:** Abandonar una Surface (sin vuelo/salto explícito o connection) equivale a abandonar el anclaje y desencadena la transición espacial de caída.

---

## 4. Footprint y Ocupación Natural/Efectiva

El Footprint define la ocupación en X/Y derivándose de la autoridad de estado (ej. `SizeRulesCatalog.spaceFeet`), no de una tabla manual hardcodeada duplicada.
- **Criaturas < Small (Tiny, Diminutive, Fine):** Ocupan matemáticamente un espacio inferior a 5 pies (`spaceFeet < 5`). La celda de 5 pies sigue siendo la unidad topológica, pero el contrato permite la co-ocupación de celdas para entidades que sumen menos de 5 pies, y el targeting debe soportar resoluciones que distingan ocupantes de la misma celda. Si esto exige una ODR técnica para targeting UI, queda registrada como bloqueante antes de la implementación de UI.
- **Squeezing:** Se distingue el *Footprint natural* del *Footprint efectivo* (orientado y reducido) y del *Body Prism efectivo* resultante durante condiciones de Squeezing legal.

---

## 5. Vertical Profile

La altura corporal no se infiere mecánicamente de la categoría de tamaño de forma rígida.
**Precedencia Conceptual del Perfil Vertical Efectivo:**
1. Valor base declarado por el template/catálogo de la criatura.
2. Sustitución estructural (transformación, forma alternativa, montura).
3. Modificadores temporales de estado.
4. Perfil efectivo congelado en el snapshot.

---

## 6. Body Prism (Prisma Corporal)

El Body Prism es el poliedro resultante de la extrusión del *Footprint efectivo* por el *Vertical Profile efectivo*, anclado a la elevación. Es consumido por LoE, Reach, AoE, Cover.
El renderer visual y el modelo 3D son estéticos y no participan de las colisiones.

---

## 7. Distancia y Rutas (Separación Contractual)

### Spatial Distance (Métrica)
Distancia puramente matemática, simétrica (A→B == B→A) y volumétrica, evaluada como la distancia mínima entre dos prismas. Produce múltiplos de 5 pies, sin floating point.
**ODR Bloqueante:** El PHB gobierna 5-10-5 en 2D. La extrapolación oficial 3D (extender la regla de "el eje mayor domina, los otros ejes añaden diagonales") debe ser ratificada formalmente como algoritmo único, o sustituida por una fórmula canónica exacta del servidor. Queda registrada esta ODR como bloqueante antes de escribir `Math.distance3D`.

### Route Cost (Coste de Ruta)
Coste acumulado de una secuencia de transiciones (caminar, connection, trepar). Considera terreno difícil, Hazards y superficies. No es intercambiable por `Spatial Distance`.

---

## 8. Reach

El volumen alcanzable se deriva de las fuentes formales del atacante:
- Posee **Mínimo y Máximo** (ej. armas de alcance con "zona muerta").
- Soporta múltiples fuentes simultáneas (armas naturales + alcance).
- No es una burbuja acumulativa arbitraria, es un conjunto matemático de celdas delimitadas por las fuentes del atacante.

---

## 9. Spatial Trace (Primitiva de Trazado)

Se instaura una abstracción única para cualquier vector volumétrico: `Spatial Trace`.
- Define orígenes, destinos, endpoints, caras y aristas.
- Retorna evidencia pura del recorrido (celdas intersecadas, bloqueos encontrados).
- Es una primitiva matemática. **LoE, Visual Path, Iluminación y Cover pueden consumir `Spatial Trace`**, pero cada uno inyecta sus propias capacidades bloqueadoras (un vidrio detiene el trace de LoE pero no el trace de Vision).

---

## 10. LoE, Cover, Vision, Iluminación y Opacidad

- **Independencia de Veredictos:** Comparten `Spatial Trace` pero evalúan diferentes blockers.
- **LoE:** Bloqueado por solidez (`blocksLoE`).
- **Vision:** Bloqueada por opacidad. No rige el LoE (humo bloquea Vision, no LoE).
- **Cover Parcial:** Ocurre cuando el `Spatial Trace` acusa interposición de un objeto con `providesCover` o de un Body Prism que cruza la trayectoria. Nunca es otorgado por el mero suelo (`Surface`).
- **Total Cover:** Resulta de la invalidación legal del trazado por ausencia de LoE.

---

## 11. Threat, Flanking y AoO (Separación de Concerns)

- **Threat (Amenaza):** Assessment puramente geométrico de ocupación y Reach. **Threat no consume LoE**, Cover, ni Vision. Si una víctima está en el volumen alcanzable, está amenazada (incluso detrás de muros, aunque el ataque luego falle).
- **Flanking:** Consume Threat y alineación. No hereda restricciones de LoE salvo que las reglas PHB lo dictaminen (las reglas actuales no asumen bloqueo implícito).
- **Opportunity Attack (AoO):** Es el orquestador final. Para detonar un ataque, compone la provocación con Threat, y *luego* evalúa de forma independiente el LoE, Cover, y Concealment, decidiendo la legalidad.

---

## 12. Movimiento, Transiciones y Caída

- **Caminar:** Dentro de la misma Surface.
- **Connections:** (Ej. escaleras) Modifican la posición anclada transfiriendo el Body Prism a otra Surface.
- **Salto / Vuelo:** Transiciones aéreas que adoptan `Volumetric Spatial Coordinate` temporal o permanentemente.
- **Caída:** Ante la pérdida de soporte, la geometría detecta la ausencia de Surface. El NDD difiere la resolución algorítmica de la "caída parcial" de criaturas enormes a una ODR de diseño, garantizando mientras tanto que el invariante de "un Prisma debe tener soporte válido" se mantenga para posiciones estables.

---

## 13. Area of Effect (AoE)

Contrato conceptual:
- Definido por origen, volumen teórico base (esfera, cono, línea) y orientación (ahora obligatoria en 3D).
- Produce una intersección de inclusión volumétrica clipada (`Spatial Trace` de LoE desde el origen).

---

## 14. Hazards y Objetos Ambientales

- **Hazards:** La geometría solo devuelve puras intersecciones de celdas. **Los Hazards no mutan por sí mismos ni "escuchan" la geometría.** El Rules Engine pide las intersecciones, resuelve los efectos y despacha transacciones.
- **Objetos:** Modifican el mundo declarando ocupación y capacidades puras (`blocksLoE`, `providesCover`, `blocksVision`).

---

## 15. Previews y Cliente UI (Invariante Desacoplado)

El cliente UI carece de toda autoridad normativa.
- **Previews Locales:** Permitidos mediante helpers puros y deterministas, compartidos con el servidor.
- **Limitación de FoW:** Bajo Participant Projection (D-2), el cliente solo puede ejecutar sus previews sobre la topología visible/explorada recibida.
- El servidor siempre revalida y ejerce la última palabra.

---

## 16. Inmutabilidad y Snapshots

El `CombatRulesSnapshot` debe clonar y congelar los estados tridimensionales:
- Surfaces, Connections, Environmental Volumes, Hazard Volumes.
- `Anchored Spatial Position` y `Volumetric Spatial Coordinate`.
- Body Prisms efectivos y Vertical Profiles.
- Colecciones derivadas (`provokingCells`).

**Fuente única V2:** En el dominio V2, todo proviene de estas primitivas. El Board legacy (`difficultTerrainCells`, `lineOfEffectBlockingCells`, etc.) solo sobrevive detrás del Adaptador V1. No coexisten como segunda fuente de verdad.

---

## 17. Contratos Consumidores (Matriz Semántica)

| Consumidor | Identidad / Primitiva Consumida | Comentarios |
|---|---|---|
| `CreatureTemplate.position` | Anchored / Volumetric | Depende de estado inicial de vuelo. |
| `CombatantSnapshot.position` | Anchored / Volumetric | Mantiene el estado inmutable por ronda. |
| `AttackTarget` (Square/Volumetric) | Volumetric Coordinate | Para apuntar a celdas aéreas o vacías. |
| `MovementStepProjection` | Anchored / Volumetric | Traza la secuencia de transiciones. |
| `OpportunityAttack` (origin/dest) | Anchored / Volumetric | Basado en el punto exacto de abandono. |
| Comandos GM / Movimiento | Anchored | Típicamente snap a Surfaces. |
| Ataques / Conjuros / AoE | Body Prism / Spatial Trace | Evalúan intersección y clip de volúmenes. |
| `EffectInstance.targetCells` | Volumetric Coordinate | Lista de celdas afectadas independientemente de Surfaces. |
| Hazards / Charge / Run | Body Prism / Route Cost | Validación matemática de la secuencia de celdas ocupadas. |

---

## 18. Invariantes Arquitectónicos

1. **Unicidad:** Una celda se define por `(x, y, zLevel)`.
2. **Dualidad de Estado Espacial:** Toda entidad en un frame de snapshot detenta EXACTAMENTE UNA identidad (Anchored o Volumetric). Nunca ambas.
3. **Cota Derivada:** Si la identidad es Anchored, `zFeet` se obtiene de la Surface.
4. **Threat no requiere LoE:** Threat mide ocupación y alcance, no obstrucciones.
5. **No Concesión Automática de Cover:** Una Surface nunca provee Cover hacia los Prismas que sostiene.
6. **Desacople Visual:** Opacidad interrumpe Vision, no LoE. Solidez interrumpe LoE, no Vision.
7. **Pureza Geométrica:** El motor espacial responde consultas puras. El Rules Engine inyecta consecuencias.
8. **Revalidación Autoritaria:** El cliente UI puede anticipar un trazado (Preview), pero no somete el veredicto de Cover o LoE al servidor.
