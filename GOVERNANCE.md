# Gobernanza del Proyecto

`dnd-tactical-combat-assistant` es un motor táctico de combate para Dungeons & Dragons 3.5. Este documento define los principios técnicos, estructurales y organizativos innegociables para cualquier agente o desarrollador que contribuya al repositorio.

## 1. Visión y Dirección Técnica
El proyecto persigue modelar el combate táctico de D&D 3.5 construyendo una base mantenible a largo plazo. 

La arquitectura debe favorecer:
- **Servidor Autoritativo**: El servidor valida y decide el estado real. La UI es un cliente sin autoridad que provee feedback y experiencia.
- **Funciones Puras y Datos Desacoplados**: Separación estricta entre Catálogos (datos estáticos), Estado (CombatSnapshot) y Reglas Puras (Cálculos).
- **Testing Exhaustivo**: Todo bug detectado se convierte en un caso de test automatizado. Los cambios exigen ejecución exitosa de unit tests, typecheck, builds y E2E.
- **Sin Hacks Rápidos**: Prohibido implementar lógica compleja en UI, duplicar reglas o acoplar mecánicas para resolver bugs rápidamente sin justificación arquitectónica.

## 2. Gobernanza Documental

### 2.1 Single Source of Truth
Debe existir **una única ubicación para cada concepto**. Queda estrictamente prohibida la duplicación de documentación o el mantenimiento de múltiples archivos con el mismo propósito (ej. matrices de cobertura redundantes).

### 2.2 Minimal Documentation Principle
La mejor documentación es la mínima necesaria. No crear documentos únicamente para "mejorar la organización" si no aportan información nueva. Todo documento debe justificar su existencia. Las redundancias deben ser integradas y consolidadas.

### 2.3 Zero Orphan Policy
Todo documento debe pertenecer exactamente a una de las siguientes categorías:
1. **Activo**: Vigente y en uso.
2. **Histórico**: Hitos pasados preservados por trazabilidad, archivados obligatoriamente en `docs/archive/`.
3. **Plantilla**: Estructuras base reutilizables.
4. **Referencia**: Índices o registros.
Todo documento que no encaje en esta clasificación, o que se encuentre obsoleto sin utilidad histórica, **debe ser eliminado inmediatamente**. Quedan prohibidas las carpetas vacías y los archivos sin propósito.

### 2.4 Migration First Policy
Cuando un documento deba cambiar de ubicación o ser reemplazado, se aplicará el siguiente procedimiento:
1. Migrar el contenido útil al nuevo destino.
2. Actualizar todas las referencias entrantes.
3. Verificar que no queden enlaces internos rotos.
4. Validar la consistencia de la migración.
5. **Eliminar el documento original.**
Ningún documento se eliminará antes de validar la migración.

### 2.5 Política para documentos nuevos

Antes de crear un documento, el agente debe buscar artefactos existentes con
la misma responsabilidad y declarar si el nuevo documento **reemplaza**,
**complementa** o **deriva de** uno anterior. No se crea un archivo nuevo si
una actualización del documento canónico existente resuelve la necesidad.

Todo NDD o documento permanente nuevo debe incluir, cerca de su cabecera, los
campos:

```text
Canonical responsibility:
Supersedes:
Complements:
Derived from:
Lifecycle:
```

Esta exigencia rige hacia adelante; no autoriza una migración masiva de
documentos históricos.

## 3. Decisiones Arquitectónicas (ADR)
Las decisiones estructurales consolidadas deben registrarse en `docs/adr/`. Los ADRs actúan como memoria inmutable del porqué se tomaron decisiones de alto nivel. Las mecánicas en desarrollo permanecerán en `docs/designs/` hasta estabilizarse.

## 4. Ciclo de Trabajo (Sprints)

### 4.1 Definition of Ready (DoR)
Un Sprint o tarea no puede comenzar su implementación sin:
- Diseño documentado y aprobado.
- Plan de implementación claro.
- Reglas afectadas identificadas en el Rule Registry.
- Riesgos y dependencias mapeados.

### 4.2 Definition of Done (DoD)
Una funcionalidad o Sprint se considera finalizada únicamente cuando:
- Compilación y validación de tipos son exitosas (`npm run build`, `npm run typecheck`).
- Tests unitarios y E2E pasan al 100%.
- La documentación, ADRs y Rule Registry están actualizados.
- Se ha generado el informe de auditoría final o walkthrough correspondiente.
- No existen referencias rotas ni deuda técnica injustificada.

El nivel de rigor exacto de diseño/revisión previo a la implementación (¿hace
falta un NDD dedicado? ¿revisión arquitectónica obligatoria antes de tocar
código?) se determina por el **Nivel de cambio** (§5.2), no de manera
uniforme para todo sprint.

## 5. Governance v2 — Metodología de Sprints (Sprint 052)

### 5.1 Motivación

Tras el Sprint 051 (Vision & Line of Effect) el proyecto detectó que el
cuello de botella dejó de ser la calidad del código y pasó a ser el propio
proceso: un sprint pequeño acumulaba verificaciones redundantes (auditoría
del agente → re-auditoría del Architecture Gate → autoauditoría del agente →
revisión del diff por el Gate → validación de CI), cada una repitiendo
esencialmente la misma pregunta. La arquitectura ya es madura — ActiveEffects,
Rule Engine, Snapshot, EffectManager, Modifier Pipeline, Cover, Concealment,
Movement Contributions, Condition System y el Panel de Estados del GM están
todos consolidados y con cobertura real. Gobernanza v2 no relaja el rigor
arquitectónico; lo hace **proporcional al riesgo real de cada cambio** en
vez de aplicarlo de forma uniforme.

### 5.2 Nivel de cambio

Todo sprint se clasifica, antes de empezar, en el nivel más alto que le
corresponda según los archivos que toca (si un sprint mezcla niveles, aplica
el más exigente de los tocados):

| Nivel | Alcance típico (rutas) | Rigor exigido |
|---|---|---|
| **A — Documentación** | `docs/**`, `*.md` de raíz (`GOVERNANCE.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`, `technical-debt.md`) | Sin auditoría arquitectónica profunda. DoD reducido: `git diff --check` + confirmación de alcance. |
| **B — UI** | `apps/web/src/**` sin alterar contratos compartidos ni reglas de negocio (props, estilos, composición, wiring de comandos ya existentes) | Revisión normal: DoD estándar (build/typecheck/tests relevantes) + verificación manual en navegador cuando aplique. |
| **C — Reglas SRD** | `packages/shared/src/effects/catalog.ts`, `packages/shared/src/rules.ts`, resolvers de servidor (`apps/server/src/combat/**`, `apps/server/src/commands/**`), `docs/rules/registry.md` | Diseño (NDD) + `Proceed` explícito antes de implementar. Revisión arquitectónica obligatoria (puede ocurrir sobre el commit ya pusheado, §5.3). |
| **D — Infraestructura** | `EffectManager`, `EffectReducer`, `CombatRulesSnapshot`/`combatSnapshot.ts`, Modifier Pipeline, contratos base compartidos (`types.ts` core), arquitectura de comandos/WebSocket | NDD obligatorio + revisión completa. Candidato natural a disparar un Architectural Audit Sprint anticipado (§5.4) si el cambio es grande. |

### 5.3 Flujo de Sprint Normal (default)

```text
Auditoría inicial
    ↓
Diseño (NDD obligatorio solo en Nivel C/D; Nivel A/B puede resumirlo en el propio commit)
    ↓
Proceed
    ↓
Implementación
    ↓
DoD
    ↓
Commit único
    ↓
Push
    ↓
Esperar CI
    ↓
Architecture Review
    ↓
Cerrar Sprint
```

Esto **reemplaza** el patrón intermedio de "commit local único → detenerse →
esperar aprobación explícita → recién entonces push" adoptado durante el
Sprint 051 como medida transitoria. A partir de Governance v2, el flujo por
defecto empuja (`push`) apenas el commit único pasa su propio DoD, y la
revisión arquitectónica ocurre **sobre el repositorio ya publicado**, no
sobre un candidato pendiente. El patrón transitorio de Sprint 051 queda
disponible como gate opcional más estricto que el usuario puede invocar
explícitamente para un sprint Nivel D puntual, pero deja de ser el
comportamiento por defecto.

Eliminado explícitamente del flujo por defecto: autoauditorías redundantes
después del DoD, reportes gigantes, y diffs/archivos completos pegados en el
chat — el detalle de lo hecho vive en el repositorio (commit, `walkthrough.md`,
documentación afectada), no en la conversación.

### 5.4 Architecture Review

Una vez el commit está en GitHub, el agente informa únicamente con el
formato de §5.5 — nunca vuelve a pegar diffs ni archivos completos. El
Architecture Gate externo inspecciona el repositorio directamente sobre el
SHA reportado. El resultado de esa revisión es uno de: aprobar, solicitar
cambios, o rechazar el sprint.

### 5.5 Reportes mínimos

Formato canónico de cierre de sprint (reemplaza cualquier reporte extenso
previo):

```text
Sprint: <número>

Commit:
<sha>

Push:
OK

CI:
OK / pendiente / falló (detalle breve si falló)

DoD:
OK

Ready for Architecture Review
```

No se pega el diff, ni archivos completos, ni tablas de auditoría en el
chat — esa evidencia, si hace falta preservarla, vive en `walkthrough.md` o
en el propio commit.

### 5.6 Architectural Audit Sprint

Cada tanto, el proyecto necesita un sprint que no agregue funcionalidad:
solo sanea deuda técnica, arquitectura, documentación, coherencia SRD,
`ROADMAP.md`, `docs/rules/registry.md`, duplicaciones y oportunidades de
simplificación.

**Disparador**: no una cadencia fija de sprints. Se dispara **al cerrar una
épica** (ej. Conditions, Vision & Line of Effect, Feats, Spells) — el tamaño
real del trabajo define la frecuencia, no un número arbitrario; una épica de
6 sprints se audita en el sexto, una de 12 en el duodécimo. Disparadores
secundarios válidos, independientes del cierre de una épica: una razón
técnica concreta (ej. se detecta divergencia en el Registry, el backlog de
`docs/technical-debt.md` crece sin resolverse, o un Architecture Review lo
solicita explícitamente). Como salvaguarda no vinculante: si una épica se
extiende más allá de aproximadamente 15 sprints sin cierre natural, se trata
como vencida para una auditoría de todas formas, para evitar que la
arquitectura derive indefinidamente sin revisión.

Un Architectural Audit Sprint es siempre Nivel A o D según lo que toque
(normalmente A si es puramente documental, D si corrige infraestructura
real) — nunca introduce funcionalidad nueva.

## 6. Metodología Documental Permanente (Sprint 054B)

### 6.1 Propósito

Tras ~55 sprints el repositorio acumula **144 archivos Markdown** (23 en
`docs/archive/`, 64 NDD en `docs/designs/`, el resto entre raíz, `docs/` y
`.ai/`). El Sprint 054A saneó contradicciones puntuales; esta sección diseña
la metodología permanente para que la documentación no vuelva a degradarse.
Responde dos preguntas: **qué debe leer un desarrollador nuevo (humano o
agente) y en qué orden**, y **cómo se evita la duplicación y la ambigüedad de
responsabilidades durante los próximos cientos de sprints**. Esta sección es
la autoridad de la *política* documental; el flujo operativo derivado
(pre-tarea y cierre) vive en `.agents/AGENTS.md`, conforme al reparto de
autoridades de Sprint 040.

### 6.2 Mapa de responsabilidades documentales

Cada documento permanente responde **exactamente una pregunta**. Si un
documento no puede enunciar su pregunta en una línea, no debe existir. Si dos
documentos responden la misma pregunta, uno de los dos sobra (§2.1).

| Documento | Pregunta única que responde | Autoridad |
|---|---|---|
| `GOVERNANCE.md` | ¿Bajo qué principios y políticas se trabaja? | Canónica — principios técnicos y documentales |
| `.agents/AGENTS.md` | ¿Qué pasos sigo operativamente y cuándo está "terminado"? | Canónica — flujo y DoD |
| `INDEX.md` | ¿Dónde vive cada responsabilidad documental? | Canónica — localizador; nunca contenido |
| `PROJECT_STATUS.md` | ¿En qué estado está el proyecto hoy? | Snapshot vivo |
| `TODO.md` | ¿Qué está pendiente/completado por sprint? | Snapshot vivo |
| `ROADMAP.md` | ¿Qué sigue y en qué orden tentativo? | Snapshot vivo |
| `docs/rules/registry.md` | ¿Qué reglas de D&D existen y en qué estado real? | Canónica — única fuente de Rule IDs |
| `docs/testing/master-coverage.md` | ¿Qué evidencia de pruebas existe por cierre? | Registro acumulativo |
| `walkthrough.md` | ¿Qué hizo exactamente el último sprint cerrado? | Rotativo — solo el último cierre |
| `docs/adr/` | ¿Por qué se tomó una decisión estructural? | Inmutable — memoria de decisiones |
| `docs/designs/` (NDD) | ¿Cómo se diseñó una vertical y por qué así? | Canónica por vertical |
| `docs/audits/` | ¿Qué encontró una auditoría / dónde divergimos del SRD? | Registro; `combat-rules-deviations.md` es vivo |
| `docs/technical-debt.md` | ¿Qué deuda conocida existe y en qué estado? | Snapshot vivo |
| `.ai/` | ¿Cómo se orienta un agente en 5 minutos? | Derivada — nunca contradice a las canónicas |
| `.ai/coverage/` | ¿Qué fracción del PHB 3.5 está cubierta, ítem por ítem? | Canónica — granularidad PHB (no redefine Rule IDs) |
| `README.md` | ¿Qué es esto y cómo lo corro? | Puerta de entrada humana |
| `CODEX_GUIDE.md`, `ARCHITECTURE.md`, `RULES_ENGINE.md`, `COMBAT_FLOW.md` | Vistas arquitectónicas de orientación | Derivadas — difieren a Registry/NDD/ADR en conflicto |
| `docs/sprints/TEMPLATE.md`, `docs/audits/TEMPLATE.md` | Plantillas reutilizables | Plantilla |
| `docs/archive/` | Historia reemplazada | Histórico — solo lectura |

**Regla de conflicto**: ante contradicción entre una vista derivada y su
fuente canónica, la canónica gana siempre y la derivada se corrige (o se
elimina si ya no aporta). Un agente nunca "promedia" dos documentos en
conflicto: aplica la norma de evidencia primero — se detiene y reporta la
contradicción si afecta la tarea en curso.

#### 6.2.1 Ficha de responsabilidad de los documentos troncales (Sprint 054C)

Para los nueve documentos troncales, la responsabilidad queda cerrada en
cuatro ejes: qué responde, qué **no** responde, cuándo se modifica (este eje
es su ciclo de actualización oficial — no existe otro disparador válido), y
su consumidor principal.

| Documento | Responde | NO responde | Se modifica únicamente cuando | Consumidor principal |
|---|---|---|---|---|
| `GOVERNANCE.md` | Principios, políticas, niveles de cambio, metodología documental | Estado actual, pendientes, pasos operativos concretos | Cambia la gobernanza misma (sprint dedicado) | Todo agente (P0) |
| `.agents/AGENTS.md` | Fases operativas, Reader Pipeline, DoD | Principios (el "porqué"), estado, planificación | Cambia el flujo operativo o el DoD | Todo agente (P0) |
| `PROJECT_STATUS.md` | Estado actual del proyecto (fase, baseline, hitos) | Qué falta (TODO), orden futuro (ROADMAP), detalle de reglas (Registry) | Termina un sprint que cambia el estado | Agentes (P1) y humanos que quieren la foto |
| `ROADMAP.md` | Qué sigue y en qué orden tentativo | Estado actual, detalle de tareas por sprint | Cambia la planificación (épica cerrada, reorden, recomendación nueva) | Usuario/planificación; agentes solo si la tarea planifica |
| `TODO.md` | Qué está pendiente y qué se completó, por sprint | El porqué (NDD) y la narrativa de estado (PROJECT_STATUS) | Cambia el trabajo pendiente (apertura/cierre de sprint) | Agentes (P1) |
| `docs/rules/registry.md` | Qué reglas de D&D existen, en qué estado real, con qué evidencia | Cómo se diseñaron (NDD); cobertura PHB ítem a ítem (`.ai/coverage/`) | Cambia el estado real de una regla, verificado contra código y tests | Sprints Nivel C/D; Architecture Review |
| `docs/testing/master-coverage.md` | Qué evidencia de pruebas existe por cierre | Estado de reglas (Registry); cobertura normativa PHB | Un cierre altera la evidencia (tests nuevos/cambiados/conteos) | Architecture Review; auditorías |
| `walkthrough.md` | Qué hizo exactamente el último sprint cerrado y cómo se validó | Historia de sprints previos (Git) y estado global | Se **reescribe por completo** al cerrar una implementación; nunca se edita incrementalmente | El siguiente agente (P1); Architecture Review |
| `INDEX.md` | Dónde vive cada responsabilidad | Ningún contenido — solo localiza | Se crea, reemplaza o archiva un documento (en el mismo commit) | Cualquier agente (P2) |

Si una necesidad de escritura no coincide con la columna "Se modifica
únicamente cuando" de ningún documento, eso es señal de que el contenido no
pertenece a ninguno de los nueve — aplicar el flujo de creación (§6.6) antes
de forzarlo dentro del documento equivocado.

#### 6.2.2 Clasificación operativa vigente (Sprint 054C)

Con §6.2/§6.4 aplicadas, la clasificación queda cerrada así:

- **SSOT (canónicos)**: `GOVERNANCE.md`, `.agents/AGENTS.md`, `INDEX.md`,
  `docs/rules/registry.md`, cada NDD respecto de su vertical, `docs/adr/`,
  `docs/technical-debt.md`, `docs/testing/master-coverage.md`,
  `.ai/coverage/` (granularidad PHB), y los snapshots vivos
  `PROJECT_STATUS.md`/`TODO.md`/`ROADMAP.md` respecto de su pregunta única.
- **Derivados** (pierden ante su canónico): `README.md`, `.ai/README.md`,
  `.ai/WORKFLOW.md`, `.ai/FILE_INDEX.md`, `CODEX_GUIDE.md`,
  `ARCHITECTURE.md`, `RULES_ENGINE.md`, `COMBAT_FLOW.md` y el resto de `.ai/`.
- **Históricos**: `docs/archive/**` y las auditorías de sprint ya cerradas.
- **Temporales**: `implementation_plan.md` en raíz durante su sprint.

Las ambigüedades detectadas al aplicar esta clasificación están registradas,
sin resolver, como deuda documental **DT-023** en `docs/technical-debt.md`
(§6.7(c)); su resolución pertenece a la próxima auditoría documental, no a
este sprint.

**Riesgo señalado para la próxima auditoría documental** (no se corrige en
este sprint): `RULES_ENGINE.md` y `CODEX_GUIDE.md` solapan parcialmente la
responsabilidad de `docs/rules/registry.md` y `PROJECT_STATUS.md`; `README.md`,
`.ai/README.md` e `INDEX.md` ofrecen tres órdenes de lectura distintos; la
tabla de fuentes canónicas está duplicada en `INDEX.md` y `.ai/README.md`.
La próxima auditoría (§6.6) debe consolidar cada caso aplicando §2.

### 6.3 Pirámide de lectura (Reader Pipeline)

**Nombre oficial**: esta pirámide, ejecutada en orden, es el **Reader
Pipeline** del proyecto. **Regla metodológica permanente (Sprint 054C):
ningún agente puede comenzar una tarea sin completar el Reader Pipeline.**
No es una recomendación: es parte del flujo obligatorio (Fase 0 de
`.agents/AGENTS.md`, donde vive su forma operativa y la Reader Matrix por
tipo de tarea).

Leerlo todo es tan dañino como no leer nada: consume contexto (agentes) o
tiempo (humanos) y diluye lo obligatorio. La lectura se organiza en niveles;
cada nivel existe por una razón distinta y **ningún nivel inferior autoriza a
saltarse uno superior**.

**P0 — Reglas del juego (siempre, toda tarea):**
- `GOVERNANCE.md` — principios y niveles de cambio (§5.2).
- `.agents/AGENTS.md` — fases operativas y DoD.

*Justificación*: sin P0 un agente puede producir trabajo correcto por el
camino incorrecto (implementar sin `Proceed`, cerrar sin DoD, duplicar
documentación). P0 cambia rara vez; su costo de lectura es bajo y su omisión
invalida todo lo demás.

**P1 — Situación (siempre, toda tarea):**
- `PROJECT_STATUS.md` — dónde está el proyecto (fase actual, baseline).
- `TODO.md` — qué sprint está activo/pendiente.
- `walkthrough.md` — qué hizo exactamente el último cierre.

*Justificación*: P0 dice *cómo* trabajar; P1 dice *desde dónde*. El
`walkthrough.md` pertenece a P1 porque el último sprint es el contexto más
probable de la tarea siguiente (continuación, corrección o review).

**P2 — Orientación (solo si hace falta localizar algo):**
- `INDEX.md` — localizador de responsabilidades.
- `.ai/FILE_INDEX.md` — mapa de código.
- `ROADMAP.md` — solo si la tarea reordena o planifica futuro.

*Justificación*: son mapas, no contenido. Se consultan bajo demanda; exigir
su lectura completa sería ritual sin valor.

**P3 — Vertical afectada (condicional, según la tarea):**
- NDD de la vertical en `docs/designs/` — si la tarea toca esa vertical.
- `docs/rules/registry.md` — si la tarea afecta reglas de D&D (Nivel C/D).
- ADR pertinente — si la tarea toca el área decidida por ese ADR.
- `docs/technical-debt.md` — si la tarea toca deuda registrada.
- `docs/testing/master-coverage.md` — si la tarea altera la evidencia de tests.
- `docs/audits/combat-rules-deviations.md` — si hay divergencia normativa en juego.
- `.ai/coverage/*_PHB_CHECKLIST.md` — solo si se cubre un ítem del Master Plan.
- `docs/architecture/**` — solo el subsistema afectado.

*Justificación*: es el nivel más grande del corpus (60+ NDD) y por eso es
condicional por definición: la relevancia la define la vertical, no una
lista fija. Leer NDD ajenos a la tarea es el desperdicio de contexto más
común.

**Nunca en el flujo normal**: `docs/archive/` (histórico; solo para
investigación explícita del pasado) y los NDD de verticales no afectadas.

**Onboarding de un desarrollador totalmente nuevo**: `README.md` (2 min) →
P0 → P1 → P2 según necesidad. El objetivo operativo es que con P0+P1 (5
documentos) cualquier agente pueda empezar a trabajar correctamente en
minutos, y que P3 se resuelva por vertical en el momento de la tarea.

### 6.4 Ciclo de vida documental

Todo documento pertenece a exactamente una clase de ciclo de vida (extiende
la clasificación de §2.3 con reglas de mutación explícitas):

| Clase | Ejemplos | Se actualiza | Se reemplaza | Se archiva | No se toca más |
|---|---|---|---|---|---|
| **Permanente** | `GOVERNANCE.md`, `AGENTS.md`, `INDEX.md`, Registry, plantillas | In situ, con sprint que lo justifique | Nunca (evoluciona) | Nunca mientras viva el proyecto | — |
| **Snapshot vivo** | `PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md`, `technical-debt.md`, master-coverage | Cada sprint que los afecte | Solo su contenido; la historia queda en Git | Nunca (Git es su historia) | — |
| **Rotativo** | `walkthrough.md` | Se **reescribe por completo** en cada cierre | Cada sprint | Git conserva versiones previas | — |
| **Diseño (NDD)** | `docs/designs/**` | Durante el diseño y la implementación de su propia vertical | Solo por un NDD sucesor que declare `Supersedes` | No — son el "porqué" del código vivo | Se congelan al cerrar su vertical; solo un sprint nuevo de esa vertical los reabre |
| **Inmutable** | `docs/adr/**` | Nunca se edita el fondo | Un ADR nuevo que referencia al viejo | Nunca | Sí — append-only |
| **Auditoría** | `docs/audits/Sprint-*.md`, informes | No (foto de un momento) | No | Quedan donde están | Sí, al cerrarse (excepción: `combat-rules-deviations.md`, que es snapshot vivo) |
| **Histórico** | `docs/archive/**` | Nunca | Nunca | Ya lo están | Sí — solo lectura |
| **Temporal** | `implementation_plan.md` en raíz durante un sprint | Durante su sprint | — | Al cierre se reubica/fusiona según la política de Sprint 040 (`AGENTS.md` Fase 3) | Deja de existir en raíz |

Reglas derivadas: (a) un documento que cambia de clase (ej. un NDD sucedido
por otro) sigue Migration First (§2.4); (b) nada entra a `docs/archive/`
sin haber sido reemplazado y con referencias entrantes corregidas; (c) si un
documento no encaja en ninguna clase, se elimina (§2.3).

### 6.5 Encabezado estándar de documentos permanentes

Se ratifica y refina el encabezado de §2.5. Todo documento **nuevo** de clase
Permanente, Snapshot vivo o Diseño incluye cerca de su cabecera:

```text
Responsabilidad: <la pregunta única que responde, una línea>
Autoridad: Canónica | Derivada | Registro | Plantilla
Lifecycle: Permanente | Snapshot vivo | Rotativo | Diseño | Inmutable | Auditoría | Histórico | Temporal
Reemplaza: <ruta o "—">
Complementa: <ruta(s) o "—">
Consumidores: <quién lo lee y cuándo, ej. "todo agente, P0" / "solo sprints de la vertical Vision">
```

Los campos `Autoridad` y `Consumidores` se agregan respecto de §2.5; el
vocabulario de `Lifecycle` queda cerrado a las clases de §6.4. La exigencia
rige **hacia adelante** (documentos nuevos y documentos existentes cuando un
sprint los reescriba sustancialmente); no autoriza una migración masiva
retroactiva — coherente con §2.5.

### 6.6 Política de creación de documentos nuevos — flujo completo

Antes de crear cualquier `.md` nuevo, el agente responde **por escrito** (en
el propio diseño o commit del sprint) este cuestionario, en orden, y se
detiene en la primera salida:

1. **¿Qué pregunta única responde?** Si no puede enunciarse en una línea →
   no se crea.
2. **¿Ya existe un documento con esa responsabilidad?** (verificar contra
   `INDEX.md` §6.2) → si sí, **se actualiza el canónico**; no se crea.
3. **¿Reemplaza a uno existente?** → si sí, Migration First (§2.4): migrar,
   corregir referencias, eliminar el original, actualizar `INDEX.md`.
4. **¿Complementa a uno existente?** → justificar por qué no puede fusionarse
   en el existente (tamaño, audiencia o ciclo de vida distintos son las
   únicas razones válidas); declarar `Complementa:` en el encabezado.
5. **¿Es una vista derivada?** → declarar la fuente canónica y aceptar que
   pierde ante ella en todo conflicto; una derivada que exige mantenimiento
   por sprint probablemente no debe existir.
6. **¿Qué clase de ciclo de vida tiene (§6.4) y cuándo dejará de existir?**
   Un documento sin clase declarada ni fin previsible no se crea.
7. Si sobrevivió 1-6: crear con encabezado §6.5, ubicarlo según la
   convención vigente (`docs/designs/<feature>.md` o carpeta si tiene 2+
   artefactos; ADR en `docs/adr/`; auditoría en `docs/audits/`), y **agregar
   su fila a `INDEX.md`** en el mismo commit.

La salida por defecto del flujo es **no crear** — la carga de la prueba está
siempre del lado del documento nuevo.

### 6.7 Política de auditorías documentales

La auditoría documental **no tiene cadencia fija propia**. Se integra a los
disparadores ya definidos en §5.6, con dos refuerzos:

1. **Toda Architectural Audit Sprint incluye obligatoriamente una fase
   documental**: verificación de responsabilidades únicas (§6.2), enlaces
   internos, clasificación de ciclo de vida (§6.4), y consistencia
   Registry ↔ código ↔ tests. No existe auditoría "solo de código".
2. **Disparadores adicionales específicamente documentales**: (a) antes de
   cada Release etiquetada; (b) cuando cambia la propia gobernanza (una
   modificación de `GOVERNANCE.md`/`AGENTS.md` obliga a verificar que las
   vistas derivadas — `.ai/WORKFLOW.md`, `README.md`, `INDEX.md` — no
   quedaron contradictorias, en el mismo sprint); (c) cuando un agente
   detecta dos documentos con la misma responsabilidad (se registra en
   `docs/technical-debt.md` como deuda documental y se resuelve a más tardar
   en la siguiente auditoría).

*Alternativa evaluada y descartada*: cadencia fija "cada 10 sprints". Se
descarta porque desacopla la auditoría del trabajo real (una épica de 6
sprints quedaría sin auditar; diez sprints Nivel A no generan deriva que
justifique el costo) — mismo razonamiento con el que §5.6 rechazó la cadencia
fija para auditorías arquitectónicas. La salvaguarda de ~15 sprints de §5.6
aplica igualmente a la deriva documental. Reevaluada en Sprint 054C con el
mismo veredicto.

**Resumen de tres niveles (Sprint 054C)** — la política completa de revisión
periódica del proyecto queda así:

1. **Cada sprint**: Architecture Review sobre el commit pusheado (§5.3-§5.4)
   más el gate documental de cierre proporcional al Nivel de cambio
   (`.agents/AGENTS.md` §4.5.1). Ninguna excepción.
2. **Cada épica/vertical grande cerrada**: Architectural Audit Sprint
   integral — código, documentación y gobernanza en el mismo sprint (§5.6),
   con la fase documental obligatoria de esta sección.
3. **Disparadores extraordinarios**: Release etiquetada, cambio de la propia
   gobernanza, o detección de responsabilidad duplicada (los disparadores
   (a)-(c) del punto 2 de esta sección) — sin esperar al cierre de la épica
   en curso.

### 6.8 Veredicto: ¿"Sistema Operativo del Proyecto"?

Se evaluó formalizar una arquitectura nueva donde cada documento declare
consumidores explícitos ("Project OS"). **Veredicto: la jerarquía existente
ya es ese sistema; lo que faltaba era formalizarla, no reemplazarla.** Crear
un documento nuevo "sistema operativo" violaría §2.2 (fragmentación) y §6.6
(su responsabilidad ya la cubren `INDEX.md` + esta sección). La
formalización se logra con tres piezas ya diseñadas aquí: el mapa de
responsabilidades con autoridad (§6.2) como "tabla de procesos", la pirámide
(§6.3) como "orden de arranque", y el campo `Consumidores:` del encabezado
(§6.5) como declaración por documento. `INDEX.md` es y sigue siendo el único
localizador; en su próxima actualización natural puede incorporar la columna
de consumidores — sin crear ningún artefacto nuevo.
