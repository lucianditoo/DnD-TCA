# Sprint 023: Acrobatic Movement & Squeezing Design

## 1. Objetivo y Problema
D&D 3.5 introduce dos mecánicas fundamentales para el control de masas y posicionamiento táctico que el motor actual no soporta:
1. **Piruetas (Tumble)**: La capacidad de moverse de forma acrobática (a mitad de velocidad) para evitar Ataques de Oportunidad (CD 15) al abandonar casillas amenazadas, y atravesar espacios ocupados por enemigos (CD 25).
2. **Apretujarse (Squeezing)**: La penalización mecánica cuando un personaje avanza por una ruta o termina su movimiento en un espacio más pequeño que su categoría de tamaño (ej: un personaje Mediano en un pasillo de 2.5 pies). Cuesta el doble de movimiento y aplica -4 CA y -4 al ataque.

El objetivo de este diseño es integrar de forma pura estas reglas en el motor estocástico (servidor autoritativo), asegurando que el cliente de React reciba feedback de predicción de riesgo y que las criaturas gigantes en futuros Sprints se mapeen correctamente.

## 2. Arquitectura Propuesta

### A. Tumble (Piruetas)
Se agregará una nueva intención al comando `move-combatant`: `isAcrobatic: boolean`.
En el servidor:
- **Costo de Movimiento**: Si `isAcrobatic` es true, cada casilla cuenta como el doble de distancia (simulando que moverse acrobáticamente reduce la velocidad a la mitad).
- **Evitar AdO (CD 15)**: `findTriggeredOpportunityAttacksForPath` será interceptado por la intención. Si el movimiento es acrobático, el servidor generará una tirada de `1d20 + DexMod`. Si la tirada `>= 15`, el AdO no se encola. Si falla, el AdO se encola normalmente.
- **Atravesar Enemigos (CD 25)**: `validateMovePath` relajará la restricción de "ruta ocupada por enemigo" si `isAcrobatic` es true. Al intentar entrar a la casilla enemiga, el servidor tira `1d20 + DexMod` contra CD 25. Si falla, el movimiento se aborta en la casilla adyacente anterior y provoca AdO automático, terminando la acción. No se puede terminar el turno en la misma casilla que un enemigo (a menos que aplique Squeezing/Grapple, fuera de alcance actual).

### B. Apretujarse (Squeezing)
Se habilitará un modificador de terreno en la matriz del tablero: `narrowCells: string[]` (por ejemplo `"x,y"`), o se permitirá que el cliente envíe una acción de estado "toggle-squeezing". Para ser más autoritativo, usaremos una inyección condicional desde `validateMovePath`.
- Al pisar una casilla "angosta" (o al estar bajo el efecto Squeezing):
  - El costo de entrar a la casilla se multiplica x2.
  - Se inyecta temporalmente un efecto `srd_squeezing` (que aplica -4 a CA y -4 a Melee Attacks). Este efecto persiste mientras el combatiente permanezca en la casilla estrecha.

## 3. DESIGN REVIEW CHECKLIST

### 1. Filtro de Irreversibilidad a 20 Sprints (Criaturas Large y footprint)
*¿Cómo estructuramos el payload y el retorno del validador para que cuando implementemos criaturas Grandes (Large, 10x10 ft) el sistema sepa qué casillas del footprint están provocando el chequeo?*
**Respuesta:** En lugar de tratar al combatiente como un punto singular (`origin`), `findTriggeredOpportunityAttacksForPath` debe transicionar a evaluar un `Footprint` (conjunto de coordenadas `[x, y]`). El retorno del validador por paso no debe ser un simple booleano de "provoca o no", sino un objeto `{ provokingCells: Position[], enemyId: string, baseCd: number }`. Cuando una criatura Large (2x2) mueve su masa, si *cualquier parte* de su footprint de 4 casillas abandona un área de amenaza, el payload detallará exactamente qué coordenada del footprint desencadenó la amenaza de qué enemigo, escalando limpiamente para criaturas Enormes (3x3) y colosales.

### 2. Complejidad Accidental (Feedback Predictivo en React)
*¿De qué manera aseguramos que la UI de React consuma este nuevo validador para pintar las casillas en amarillo o naranja predictivo indicando el riesgo de la CD 15/25 antes de que el jugador envíe el comando?*
**Respuesta:** Aprovecharemos la arquitectura de Monorepo. `packages/shared/src/rules.ts` será el *Single Source of Truth*. La UI de React, al hacer "hover" sobre las casillas para trazar la ruta de movimiento, ejecutará `validateMovePath` de forma *dry-run* (pasando `isAcrobatic: false/true` según un toggle en la UI). El validador en `shared` expondrá un array estructurado por cada paso de la ruta con la forma `MetadataStep = { position, cost, threats: { enemyId, requiredCd }[] }`. Así, el componente de React iterará el `path` retornado: si `requiredCd === 15`, pinta el borde amarillo; si `requiredCd === 25`, pinta la casilla naranja, evitando lógica duplicada o reglas hardcodeadas en el frontend.

### 3. La Regla de Tres
*Nombra tres dotes o modificadores futuros que se beneficiarán directamente de este pipeline de movimiento acrobático.*
**Respuesta:**
1. **Movilidad (Mobility)**: Otorga un bono de esquiva de +4 a la CA contra Ataques de Oportunidad provocados por salir de una casilla amenazada. El nuevo payload detallado identificará exactamente qué AdO es por movimiento vs. otras acciones (como lanzar un hechizo), permitiendo aplicar el +4 selectivamente.
2. **Ataque Elástico (Spring Attack)**: Permite moverse, atacar, y continuar el movimiento. El refactor del validador de rutas por tramos y el soporte de Acrobacias permitirán fraccionar el movimiento en dos comandos segmentados sin perder el contexto del límite de `baseSpeedFeet`.
3. **Carga Acrobática (Acrobatic Charge)**: Permite cargar sobre terreno difícil o atravesando aliados/enemigos. Al abstraer CD 25 para pasar por enemigos y multiplicar por dos el costo en lugar de bloquear `validateMovePath`, esta dote futura simplemente reducirá la CD o ignorará el multiplicador x2 de la ruta.

## 4. Riesgos y Aislamiento
- **Regresiones en AdO**: Reestructurar `findTriggeredOpportunityAttacksForPath` para contemplar Tumble y Footprints puede romper la lógica estricta de AdO base. Se asegurará con tests de regresión puros de movimiento básico.
- **Desincronización de Costos**: Si React predice un costo X (Tumble) y el servidor otro, el movimiento fallará. Mantener la lógica de terreno difícil y Acrobatics confinada en `packages/shared` previene esto.
