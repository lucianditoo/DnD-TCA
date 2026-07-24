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
