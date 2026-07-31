# Walkthrough — Sprint A-001R1 (Architecture Review Remediation)

## Objetivo
Resolver las deficiencias, contradicciones y ambigüedades arquitectónicas detectadas en el Sprint A-001 original por el Architecture Gate. El foco es asentar firmemente el NDD de motor espacial discreto tridimensional (2.5D), de manera consistente y determinista, alineado con las directivas ineludibles del Propietario.

## Entregables
- **`docs/designs/spatial-engine-2.5d.md`**: Reesquematizado y reescrito. Establece reglas concretas de discretización, perfiles verticales, identidad canónica (`SpatialPosition`), independencias funcionales (Cover, LoE, Threat), y delega explícitamente a 6 NDDs hijos mandatorios.
- **`docs/designs/combat-engine-mvp.md`**: Header actualizado declarando su estado documental como parcialmente supersedido.
- **`RULES_ENGINE.md`**: Corregida contradicción sobre "una criatura/token por casilla" para alinearlo con el soporte actual de footprint y la futura ocupación volumétrica.
- **`PROJECT_STATUS.md`**: Actualizado reflejando el progreso de la remediación.

## Matriz de Resolución de Hallazgos (Architecture Gate)

| Hallazgo / Observación | Reviewer | Estado | Evidencia de Resolución (NDD) |
|---|---|---|---|
| Tolerancia a "12.5 pies" en Z. | Propietario (OD-1) | **Accepted** | Sec. 1 prohíbe floating point; Sec. 5 manda 5 pies enteros. |
| Múltiples fuentes de verdad para `zFeet`. | Propietario (OD-2) | **Accepted** | Sec. 4 consolida `SpatialPosition` (x, y, surfaceId) y extirpa `zFeet` canónico. |
| Cover automático por `Surface`. | Propietario (OD-3) | **Accepted** | Sec. 5 y 11 separan Cover (evaluación de interposición) de Surface. |
| LoE/Cover acoplado dentro de `Threat`. | Propietario (OD-4) | **Accepted** | Sec. 10 aísla Threat (evalúa LoE en Z, pero no Cover/Concealment ni legalidad total). |
| FoW via censura visual del cliente. | Propietario (OD-5) | **Accepted** | Sec. 12 obliga a censura autoritativa en `Participant Projection` (NDD D-2). |
| `localStorage` como persistencia durable. | Propietario (OD-6) | **Accepted** | Sec. 13 restringe `localStorage`; exige BDD server-side (NDD D-3). |
| Resolución V2 silenciosa de fallbacks V1. | Propietario (OD-7) | **Accepted** | Sec. 13 obliga a fallo explícito en fronteras si no existe adaptador estricto. |
| Reafirmación falaz sobre la Reconexión. | Propietario (OD-8) | **Accepted** | Sec. 14 asume el problema y delega a D-3. |
| Foco Libre 3D en el Editor V1. | Propietario (OD-9) | **Accepted** | Sec. 15 restringe V1 a catálogo de prefabs sin manipulación volumétrica libre. |
| Tecnologías concretas en Render/Cámara. | Propietario (OD-10) | **Accepted** | Se eliminó toda mención (ej. CSS, ortográfica), delegando diseño UI a D-4. |
| Contradicciones en `RULES_ENGINE.md`. | Codex | **Accepted** | `RULES_ENGINE.md` modificado in-situ (huellas/prismas superseden 1 criatura/casilla). |
| MVP histórico confuso y sin superseding. | Codex | **Accepted** | Header de `combat-engine-mvp.md` actualizado y referenciado explícitamente en el NDD. |
| Algoritmo 5-10-5 simplificado 3D irreal. | Codex | **Accepted** | Sec. 9 retira la fórmula irreal; difiere el algoritmo exacto determinista a D-1. |
| Altura derivada únicamente de `Size`. | Codex | **Accepted** | Sec. 6 desvincula la obligatoriedad, permitiendo catálogos o templates de montura. |

Todos los _blockers_ dictaminados fueron **Aceptados**, sin ningún rechazo, incorporándose al texto final y marcando la arquitectura preparada y limpia para iteraciones venideras.

## Documentos Supersedidos / Parcialmente Supersedidos
- `docs/designs/combat-engine-mvp.md`
- `RULES_ENGINE.md` (fragmentos históricos)

## Estado del Gate
ARCHITECTURE APPROVED AFTER A-001R1 REMEDIATION
