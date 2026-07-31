# Normative Area Shape Projection (D-1A)

Responsabilidad: Definir la representación autoritativa y el contrato de inclusión de las formas de área sobre la grilla tridimensional.
Autoridad: Canónica (Nivel D)
Lifecycle: Diseño Aprobado
Reemplaza: -
Complementa: `docs/designs/normative-spatial-geometry.md` (D-1R1), `docs/designs/spatial-engine-2.5d.md` (A-001R1)
Consumidores: Rules Engine, Spells, AoE, Targeting, UI Previews.

---

## 1. Filosofía y Alcance

Este documento es la única autoridad para dictaminar qué celdas espaciales (`Volumetric Spatial Coordinate` o `Anchored Spatial Position`) pertenecen al área teórica de un efecto antes de la validación de obstrucciones físicas.

Las formas soportadas normativamente son las dictadas por el SRD/PHB 3.5: **Cone, Line, Burst, Spread, Emanation, Cylinder, Cube**. Formas como "Wall" (muro) y "Ray" (rayo) tienen comportamientos híbridos pero se incorporan a la geometría como formas específicas (Wall como ocupación explícita, Ray como trazado directo sin área colateral). Formas exclusivas de suplementos fuera del SRD quedan excluidas de este contrato base.

---

## 2. Origen del Área

El punto de origen matemático de un área nunca es el centro de una celda flotante abstracta; siempre es una intersección de la grilla topológica.

- **Grid Intersection (Vértice/Arista):** Para **Burst, Spread, Emanation, Cylinder y Cube**, el origen es estrictamente una intersección de la grilla volumétrica (el vértice compartido por 8 celdas en 3D, o la arista/cara compartida entre celdas).
- **Caster's Square Corner:** Para **Cone y Line**, el origen es obligatoriamente una de las esquinas (vértices) del `Body Prism` de la criatura que origina el efecto.
- **Centro de Celda (Targeted Cell):** En casos excepcionales donde el objetivo es una criatura o un objeto singular que derrama un efecto, el origen se asienta en la celda o el `Body Prism` del objetivo, emitiendo hacia las intersecciones colindantes.

---

## 3. Orientación de la Forma

Las formas volumétricas pueden ser dirigidas en el espacio 3D.
- **Restricción Direccional:** Las formas direccionales (Cone, Line) se orientan definiendo un vector desde el origen hacia cualquier otra intersección de la grilla volumétrica en el espacio 3D.
- **Libertad de Trazado:** No se restringe a las 8 direcciones planas. Cualquier vector tridimensional es válido para definir el eje central de un cono o una línea.
- **Formas Omnidireccionales:** Burst, Spread, Emanation y Cylinder no tienen "orientación" en el sentido de un vector de ataque (salvo la verticalidad inherente del Cylinder, que crece paralelo al eje Z hacia arriba o hacia abajo).

---

## 4. Determinación de la Longitud y Anchura

El crecimiento del área obedece a las reglas puras del SRD:
- **Cone (Cono):** La longitud está dada por el efecto. Su anchura en el extremo más alejado es exactamente igual a su longitud.
- **Line (Línea):** La longitud está dada por el efecto. Su anchura normativa SRD es siempre de 5 pies (una celda de ancho/alto a lo largo del vector).
- **Cylinder (Cilindro):** Posee un radio definido y una altura definida. Crece radialmente en el plano X/Y y linealmente en el eje Z.
- **Cube (Cubo):** Posee un tamaño de arista. Su volumen es un cubo estricto que se alinea a los ejes de la grilla desde su origen.
- **Burst / Emanation / Spread:** Poseen un radio. Crecen esféricamente en todas las direcciones tridimensionales desde el vértice de origen.

---

## 5. Contrato de Inclusión (Qué celdas pertenecen)

La inclusión teórica (antes de LoE) sigue la regla canónica SRD adaptada a la cuantización de 5 pies (D-1R1):
- **Criterio del Borde Mayoritario (Half-Square Rule):** Una `Spatial Cell` (5x5x5 pies) pertenece al volumen de la forma de área si el volumen matemático de la forma cubre al menos la mitad (50%) de la celda.
- **Burst/Emanation/Spread (Regla de Arista Lejana):** De acuerdo al PHB, si la arista más alejada de la celda está dentro del radio del área, la celda entera queda incluida.
- **Intersección Mínima (Líneas):** Una `Line` incluye toda celda cuyo centro geométrico sea atravesado o rozado por el vector de 5 pies de espesor.
- Ninguna celda puede estar "parcialmente afectada" mecánicamente. O la celda entera pertenece al área teórica, o está excluida.

---

## 6. Relación con Spatial Trace

Es mandatorio mantener una estricta separación de responsabilidades:
**Area Projection ≠ Spatial Trace (LoE)**

1. **Area Projection** es el motor generador de celdas candidatas. Crea el volumen ideal y teórico en el vacío (ej. la esfera perfecta del Burst).
2. **Spatial Trace (LoE)** es el filtro físico. Por cada celda generada por la Area Projection, el Rules Engine lanza un `Spatial Trace` desde el origen del área hasta el centro de dicha celda.
3. **Clipping:** Si el `Spatial Trace` informa que una pared sólida corta el trayecto, la celda candidata es eliminada del área real efectiva (clipping).
*La única excepción es el `Spread`, el cual puede "doblar esquinas". Un Spread no requiere un `Spatial Trace` recto; utiliza una métrica de distancia de ruta (Route Cost) limitada por su radio, propagándose fluidamente.*

---

## 7. Relación con Spatial Distance

**Area Projection utiliza `Spatial Distance`.**
- El cálculo del radio teórico de un Burst, Emanation o Spread en el espacio 3D se basa estrictamente en la métrica `Spatial Distance` (la extrapolación de la regla 5-10-5 validada en D-1R1) desde el origen.
- Las plantillas no son "imágenes pre-renderizadas" pegadas sobre la grilla. Son el resultado de consultar qué celdas satisfacen que su distancia al origen sea menor o igual al tamaño del área, utilizando la misma función que mide la proximidad.
- El `Spread` utiliza en cambio `Route Cost` (distancia de ruta) en vez de `Spatial Distance` recta, ya que fluye a través de los espacios disponibles.

---

## 8. Proyección Vertical y Múltiples Surfaces

En presencia de múltiples Surfaces superpuestas (ej. balcones, puentes):
- Las formas se proyectan como volúmenes 3D completos, ignorando a qué Surface están anclados los objetivos.
- **Cylinder:** Su origen puede ser el aire. Su radio afecta las columnas X/Y, y su altura viaja estrictamente hacia arriba o hacia abajo (según dicte el origen o efecto). Penetra Empty Space y Surfaces transitables si estas no bloquean LoE sólido.
- **Emanation/Burst 3D (Esfera):** Corta a través de todas las Surfaces (ej. afecta a las criaturas en el piso inferior y superior si el radio es suficiente, siempre que LoE lo permita).
- **Cono hacia abajo/arriba:** Totalmente válido. Se proyecta de acuerdo a su vector central XYZ. Puede bañar una Surface completa desde el aire.

---

## 9. Invariante del Renderer y UI

La interfaz de usuario (Renderer 2.5D) es un consumidor cosmético:
- La UI **está autorizada** a mostrar *previews* de áreas utilizando algoritmos puros compartidos con el servidor, para permitir al usuario apuntar.
- La UI **jamás** posee la autoridad final de qué celdas fueron incluidas ni qué criaturas fueron golpeadas.
- Al confirmar una acción, el servidor recibe los parámetros puros (origen, vector direccional/forma) y reconstruye normativamente el área exacta.

---

## 10. Pipeline Conceptual del Rule Engine

El ciclo de vida de un ataque de área queda regido por el siguiente pipeline inmutable:

```text
1. Ability / Spell
     ↓ (Define Origen, Forma y Tamaño)
2. Area Projection (Este NDD)
     ↓ (Genera el conjunto de Spatial Cells teóricas)
3. Spatial Trace / LoE Clipping
     ↓ (Elimina celdas obstruidas físicamente, salvo Spreads)
4. Intersección de Body Prisms
     ↓ (Verifica qué Prismas comparten al menos 1 celda con el Área Efectiva Final)
5. Criaturas Afectadas
     ↓ (Produce la lista final de combatientes)
6. Resolución de Reglas
     ↓ (Tiradas de salvación, Cover, daño)
```

Ningún paso puede saltearse y ningún paso realiza la tarea del anterior o siguiente.
