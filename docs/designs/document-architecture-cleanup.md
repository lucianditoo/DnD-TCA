# Sprint 040 — Document Architecture Cleanup

**Tipo de documento**: Diseño de gobernanza documental (DESIGN ONLY). No autoriza mover, renombrar ni eliminar ningún archivo. Cierra con solicitud explícita de `PROCEED`.

**Rev. 2 — CHANGES REQUIRED aplicado**. Esta revisión corrige una afirmación factualmente incorrecta de la Rev. 1: la Rev. 1 presentó el `.gitignore` de `implementation_plan.md` como una "decisión deliberada... convención previa... ratificada". El propietario del proyecto corrigió esto explícitamente: **fue un error, nunca hubo una política aprobada de que los planes de implementación fueran efímeros o no versionados.** Toda referencia a esa idea se elimina en esta revisión y se reemplaza por la política oficial de §4. Además: se adopta convención híbrida de designs (no migración masiva de las 46 features), se completan los 5 diffs semánticos pendientes, se registra evidencia real (no asumida) sobre los 7 huérfanos, y `walkthrough.md` se reclasifica como propuesta pendiente, no como decisión ratificada.

**Restricción respetada**: cero cambios en `packages/`, `apps/`, `tests/`, `scripts/`, código React, TypeScript, reglas del motor o `ActiveEffects`. Todo lo que sigue es auditoría y propuesta sobre `*.md`.

---

## 1. Corrección obligatoria: política de Implementation Plans

**Se retracta** cualquier lectura de la Rev. 1 que presentara el estado efímero/gitignored de `implementation_plan.md` como una decisión aprobada preexistente. No hay evidencia de tal aprobación — es un error de configuración que se corrige aquí.

**Política oficial (nueva, reemplaza cualquier práctica previa no aprobada):**

1. Todo plan de implementación canónico es documentación del proyecto y **debe versionarse en Git**.
2. El `.gitignore` no debe ignorar `implementation_plan.md`, `implementation-plan.md`, ni ningún plan ubicado dentro de `docs/`.
3. Ubicación permanente recomendada cuando la feature tiene 2+ documentos persistentes: `docs/designs/<feature-slug>/implementation-plan.md`.
4. Para features con un único documento persistente, el plan vive como una sección `## Plan de implementación` dentro de su `design.md` — no se crea un archivo separado ni una carpeta solo para contenerlo.
5. No se mantiene un archivo raíz global que se sobrescribe y pierde su historial como fuente canónica de planes.
6. **Acción concreta requerida por esta regla**: el `implementation_plan.md` actual en la raíz contiene el plan Rev. 2 del Sprint MOVE-WITHDRAW (TDD, numeración W1-W22, matriz de riesgos/gates) — información vigente y no duplicada en otro lugar. Bajo la regla 3, y dado que Withdraw ya califica como feature multi-documento (ver §2), este contenido debe migrarse a `docs/designs/withdraw/implementation-plan.md` antes de que el archivo raíz se reutilice para el siguiente sprint (ver §7, Lote C).
7. Los artefactos temporales internos de una conversación (borradores intermedios, notas de trabajo no destiladas) pueden seguir siendo efímeros — pero nunca sustituyen al plan canónico versionado de una feature real.

---

## 2. Convención de diseños — híbrida, sin migración masiva

Se descarta la Rev. 1 (carpeta obligatoria para las ~46 features). Regla adoptada:

- **Feature con un único documento persistente** → permanece plana: `docs/designs/<feature-slug>.md`. No se crea carpeta para contener un solo archivo.
- **Feature con dos o más documentos persistentes** (design + plan y/o análisis histórico co-ubicado) → carpeta:
  ```
  docs/designs/<feature-slug>/
  ├── design.md
  ├── implementation-plan.md      # solo si existe y es multi-fase/duradero
  └── analysis.md                 # solo si existe un análisis pre-NDD con valor histórico
  ```

Una carpeta se justifica únicamente cuando agrupa contenido real. Esto reduce drásticamente el alcance de la migración: de las ~46 designs de feature, **solo 3 califican hoy para carpeta** (ver recuento en §7).

---

## 3. Walkthrough — propuesta pendiente, no decisión ratificada

Corrección de encuadre: en la Rev. 1 se presentó la naturaleza global/efímera de `walkthrough.md` como algo ya "ratificado". Se corrige: es un patrón **observado empíricamente** en el repositorio (el comentario en `.gitignore` y el hecho verificado de que el archivo se sobrescribe sprint a sprint), pero no hay constancia de que haya sido una decisión explícita del propietario del proyecto — se reclasifica como **propuesta pendiente de aprobación**, independiente de la política de implementation plans ya corregida en §1.

Recomendación (sin ratificar todavía): mantenerlo como bitácora global y transitoria, con destilación obligatoria hacia `PROJECT_STATUS.md` + `.ai/PROJECT_MEMORY.md` + `docs/rules/registry.md` antes de cerrar cualquier sprint — ya se sigue así en la práctica de los últimos dos sprints. **No se modifica su regla en `.gitignore` en esta fase.**

---

## 4. Autoridades documentales (sin cambios respecto a la Rev. 1)

- `GOVERNANCE.md`: principios de gobernanza documental y técnica (SSOT, Zero Orphan, Minimal Documentation, Migration First).
- `.agents/AGENTS.md`: flujo operativo y Definition of Done. Requiere corrección de rutas obsoletas (ver §8, Lote A): referencia `docs/rules-coverage-checklist.md` (ya no existe, fue archivado) y describe `implementation_plan.md` como si viviera "en el directorio de artifacts de la conversación" (no refleja la práctica real ni la política corregida en §1).
- `.ai/WORKFLOW.md`: resumen navegable con cross-links explícitos a ambas autoridades — sin duplicar su contenido completo.

---

## 5. Archivos huérfanos — evidencia registrada (no asumida)

Búsqueda ejecutada: grep global de `fix.js`, `fix2.js`, `fix_rules.js`, `fix-rules2.js`, `fix-rules4.js`, `rewrite-rules.js`, `output.txt` contra todo el repositorio (código, docs, configuración) + inspección de `package.json` (raíz y los 3 workspaces) + lectura completa de los 6 scripts.

| Archivo | Importado/requerido | Llamado desde script de package.json | Referenciado en documentación | Migración pendiente sin aplicar |
|---|---|---|---|---|
| `fix.js` | No (0 matches) | No — ningún script de `package.json` raíz/`apps/*`/`packages/*` lo menciona | No (antes de esta auditoría) | **No** — ver análisis de contenido abajo |
| `fix2.js` | No | No | No | No |
| `fix_rules.js` | No | No | No | No |
| `fix-rules2.js` | No | No | No | No |
| `fix-rules4.js` | No | No | No | No |
| `rewrite-rules.js` | No | No | No | No |
| `output.txt` | N/A (no es código) | N/A | No | No |

**Análisis de contenido** (los 6 scripts fueron leídos completos, no solo su nombre): los seis son parches Node (`fs.readFileSync`/`writeFileSync`) que reescriben directamente `packages/shared/src/rules.ts`, aplicados en una secuencia de emergencia para recuperar el archivo de una corrupción pasada durante una edición fallida de `createRuleEvaluator` (evidencia: `fix_rules.js` y `fix-rules4.js` contienen código con caracteres de escape rotos y comentarios como *"The file is corrupted"*, *"I will just read the original file that I botched"*). El estado que estos scripts perseguían — `totalAttackBonus`, `totalArmorClass`, `totalSpeedFeet`, `evaluateActionAvailability`, `canMakeOpportunityAttack`, `getEffectiveAbilityModifier`, `getSpecialManeuverSizeModifier` dentro de `createRuleEvaluator` — **ya está presente y en uso activo** en el `rules.ts` actual (confirmado indirectamente: estas funciones han sido consumidas exitosamente durante toda esta sesión — Withdraw, ATK-RIM, etc. — y `npm run typecheck`/`build:shared` pasan limpio en cada sprint reciente). Conclusión: **no queda ninguna migración pendiente sin aplicar** en estos 6 scripts; son evidencia forense de un incidente ya resuelto, sin valor de referencia futura (no están documentados en ningún ADR ni walkthrough como el registro oficial del incidente). `output.txt` es una captura de debug accidental (UTF-16, JSON de un comando WebSocket) sin relación con los scripts.

**Veredicto**: se mantienen como candidatos de eliminación confirmados, sin necesidad de patrón de `.gitignore` (ya trackeados; se resuelven con `git rm` explícito, Migration First Policy).

---

## 6. Diffs semánticos — los 5 pares pendientes (resueltos)

### 6.1 `flanking.md` vs `flanking-and-threatening-design.md`
**Clasificación: uno supersede al otro (ya autodeclarado en el propio archivo).** `flanking.md` línea 3 dice literalmente: *"Estado: supersedido por `flanking-and-threatening-design.md`... este archivo conserva el corte histórico inicial; no es el contrato vigente"*. `flanking-and-threatening-design.md` es el NDD de Sprint 011, implementado y validado (221/221 tests, 80/80 E2E, 2/2 UI). **Recomendación**: archivar `flanking.md` en `docs/archive/`; `flanking-and-threatening-design.md` permanece como design plano (feature de un único documento persistente — no genera carpeta).

### 6.2 `saving-throws-core-design.md` vs `saving-throws-automation-design.md`
**Clasificación: complementarios, no duplicados.** El primero (Sprint 020) construye el núcleo (`Rules.totalSavingThrow`, endpoint manual `resolve-saving-throw`). El segundo (Sprint 024) construye automatización de salvaciones disparadas por conjuros **encima** del primero, y lo dice explícitamente: *"la salvación manual existente... se conserva como herramienta táctica histórica"* reutilizando `Rules.totalSavingThrow`. **Recomendación**: mantener ambos, ninguno se archiva; agregar cross-link explícito en la cabecera de cada uno señalando la relación de dependencia (Sprint 024 depende de Sprint 020). Ambos permanecen planos (documentos de un solo archivo cada uno).

### 6.3 `difficult-terrain-and-corners-design.md` vs `corners-geometry-design.md`
**Clasificación: duplicado parcial / supersesión parcial (no total).** Sprint 015 cubre DOS reglas: (a) costes de terreno difícil y (b) bloqueo de esquinas diagonales. Sprint 037 corrige **únicamente** (b) — cita textualmente la sección D.2 de Sprint 015 como la decisión que corrige (el manual no bloquea el vértice por criaturas, solo por obstáculos sólidos). La sección de costes de terreno difícil de Sprint 015 sigue vigente y no se toca. **Recomendación**: no archivar Sprint 015 completo. Insertar una nota de errata al inicio de su sección D (bloqueo de esquinas) señalando que fue corregida por `corners-geometry-design.md` (Sprint 037), siguiendo el mismo patrón de auto-anotación que ya usa `flanking.md`. Ambos permanecen planos.

### 6.4 `combat-engine-mvp.md` vs `docs/architecture/combat-engine.md`
**Clasificación: uno supersede al otro.** `combat-engine-mvp.md` es un documento de alcance/planificación muy temprano (pre-numeración de sprints) que lista como "Fuera de MVP" mecánicas que hoy están completamente implementadas (flanqueo, condiciones, salvaciones, etc. — confirmado contra el estado real de esta sesión) y termina recomendando "iniciar con la Consolidación del CombatSnapshot" como siguiente paso — un hito ya superado hace decenas de sprints. `docs/architecture/combat-engine.md` es la referencia técnica vigente. **Recomendación**: archivar `combat-engine-mvp.md` en `docs/archive/` como antecedente histórico de planificación; no se toca `docs/architecture/combat-engine.md`.

### 6.5 `effects-tick-layer.md` vs familia de documentos de effects
**Clasificación: complementario, con una porción específica ya enmendada (no un duplicado ni una supersesión total).** `effects-tick-layer.md` (Sprint 004) diseñó el `EventBus`/`Tick Layer` originales — y su código sigue vivo hoy (`packages/shared/src/combat/tickLayer.ts`, `src/effects/tick.ts`, `src/events/bus.ts`, confirmado por búsqueda en código). `effects-system-architecture.md` es la arquitectura ActiveEffects más amplia y posterior, que cita expresamente `ADR-0008-Temporal-Anchor-Semantics.md` como la enmienda formal de una parte concreta de `effects-tick-layer.md` (el `DurationPolicy` original usaba inferencia relativa al turno; `ADR-0008` lo corrigió a anclas explícitas). `effect-storage-analysis.md` también es citado explícitamente por `effects-system-architecture.md` como el análisis previo que motivó el modelo de ownership actual — es un antecedente referenciado, no un duplicado. **Recomendación**: no archivar nada de esta familia; agrupar los cuatro documentos relacionados (`effects-system-architecture.md`, `effects-tick-layer.md`, `effect-storage-analysis.md`, `effects-vs-conditions-analysis.md`) bajo `docs/architecture/active-effects/` en vez de dispersarlos sueltos en `docs/architecture/` — construyen una sola narrativa arquitectónica con capas y enmiendas, calificando como "2+ documentos persistentes relacionados" bajo la misma lógica de §2. Insertar en `effects-tick-layer.md` una nota apuntando a `ADR-0008` para la porción de `DurationPolicy` ya enmendada.

---

## 7. Plan de migración recalculado (NO ejecutado — pendiente `PROCEED`)

### 7.1 Se eliminarán (7, sin cambios respecto a Rev. 1, evidencia ahora registrada en §5)
`output.txt`, `fix.js`, `fix2.js`, `fix_rules.js`, `fix-rules2.js`, `fix-rules4.js`, `rewrite-rules.js` — vía `git rm`.

### 7.2 Se renombrarán (1)
`.ai/coverage/V1_LAUNCH_MANIFESTO.md` → `.ai/coverage/README.md`.

### 7.3 Se reclasificarán fuera de `docs/designs/` (inequívocas, sin diff pendiente)
| Origen | Destino | Motivo |
|---|---|---|
| `ADR-0008-Temporal-Anchor-Semantics.md` | `docs/adr/ADR-0008-temporal-anchor-semantics.md` | Es un ADR, no un design; kebab-case por consistencia. |
| `combat-rules-deviations.md` | `docs/audits/combat-rules-deviations.md` | Auditoría cruzada contra el corpus PHB, no design de feature. |
| `combat-documentation-integration.md`, `rule-engine-integration.md` | `docs/architecture/<mismo-nombre>.md` | Transversales, no atados a una única mecánica. |
| `effects-system-architecture.md`, `effects-tick-layer.md`, `effect-storage-analysis.md`, `effects-vs-conditions-analysis.md` | `docs/architecture/active-effects/<mismo-nombre>.md` | Familia de 4 documentos con una sola narrativa arquitectónica (ver §6.5) — calinsa como "carpeta con 2+ documentos reales". |
| `ai-agent-onboarding.md`, `project-hygiene.md`, `architectural-cleanup-phase1.md`, `sprint-006-conditions.md`, `combat-engine-mvp.md` | `docs/archive/<mismo-nombre>.md` | Diseños ya implementados/ejecutados o superados (histórico, ver §6.4). |

### 7.4 Carpetas por feature — SOLO 3 casos califican bajo la convención híbrida de §2
| Feature | Contenido de la carpeta | Motivo |
|---|---|---|
| `docs/designs/full-attack-v2/` | `design.md` (← `full-attack-v2-haste-rapid-shot-design.md`), `implementation-plan.md` (← `full-attack-v2-implementation-plan.md`) | Ya existían como 2 documentos separados. |
| `docs/designs/large-footprints-v1/` | `design.md`, `implementation-plan.md` | Ídem. |
| `docs/designs/prone-eschewal-diehard/` | `design.md`, `implementation-plan.md` | Ídem. |
| `docs/designs/withdraw/` | `design.md` (← `withdraw-design.md`), `analysis.md` (← `withdraw-analysis.md`), `implementation-plan.md` (← contenido vigente del `implementation_plan.md` raíz, ver §1 punto 6) | Pasa de 2 a 3 documentos tras aplicar la corrección de §1. |

### 7.5 Errata in-situ (no son movimientos, son ediciones menores de una nota, sin tocar el resto del contenido)
- `flanking.md`: ya se autodeclara superseded — no requiere edición, solo mover a `archive/` (§7.3 implícito, agregar a esa tabla).
- `difficult-terrain-and-corners-design.md`: insertar nota de errata en su sección D apuntando a `corners-geometry-design.md` (§6.3). Permanece en `docs/designs/` plano.
- `effects-tick-layer.md`: insertar nota apuntando a `ADR-0008` para la porción enmendada de `DurationPolicy` (§6.5).
- `power-attack-v6-declarative.md`: agregar banner `> Estado: CONGELADO` al inicio (su estado hoy solo consta en `PROJECT_STATUS.md`). Permanece plano.

### 7.6 El resto de `docs/designs/` (~41 features) permanece plano, sin carpeta
Regla general de §2 aplicada: todo lo no listado en §7.3/§7.4/§7.5 se queda exactamente donde está, con su nombre actual. Esto incluye (lista completa, sin cambios): `ac-split-design.md`, `acrobatic-movement-squeezing-design.md`, `advanced-aoo-limits-design.md`, `bull-rush-and-squeezing-design.md`, `combat-room-snapshot.md`, `conditions-v2-design.md`, `conditions-v3-fatigued-prone.md`, `core-rules-consolidation.md`, `corners-geometry-design.md`, `cover-and-dynamic-reach-design.md`, `critical-hits.md`, `difficult-terrain-and-corners-design.md` (con errata), `disabled-exertion.md`, `dodge-mobility-feats-design.md`, `dt-007-opportunity-limits-design.md`, `environmental-saves-automation-design.md`, `five-foot-step.md`, `flanking-and-threatening-design.md`, `grapple-core-v1-design.md`, `grapple-core-v2-actions-design.md`, `inventory-and-ammunition-core-design.md`, `iterative-attacks-core-design.md`, `large-footprints-core-integration-design.md`, `migration-and-touch-attacks-design.md`, `minimum-damage-and-derived-stats.md`, `movement-validation.md`, `power-attack-v6-declarative.md` (con banner), `ranged-into-melee-penalty.md`, `saving-throws-automation-design.md` (con cross-link), `saving-throws-core-design.md` (con cross-link), `sneak-attack-and-legacy-purge-design.md`, `special-maneuvers-trip-design.md`, `special-movement-and-roller-v2-design.md`, `spell-aoe-geometry-design.md`, `spellcasting-foundation-design.md`, `total-migration-v3-design.md`, `websocket-command-validation.md`.

### 7.7 Permanecen sin cambios (fuera de `docs/designs/`)
`README.md`, `CODEX_GUIDE.md`, `GOVERNANCE.md`, `ARCHITECTURE.md`, `RULES_ENGINE.md`, `COMBAT_FLOW.md`, `PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md`, `INDEX.md`, `.agents/AGENTS.md` (contenido corregido in situ), todo `.ai/*` salvo el rename de §7.2, `docs/adr/ADR-0001` a `ADR-0007`, `docs/audits/*` existentes, `docs/testing/*`, `docs/archive/*` existentes, `docs/rules/registry.md`, `docs/technical-debt.md`. `walkthrough.md` e `implementation_plan.md` (raíz) permanecen como archivos vivos — el segundo deja de estar gitignored (§1, §8) pero conserva su rol de plan de trabajo del sprint activo.

---

## 8. Auditoría corregida del `.gitignore`

**Diff exacto propuesto (no ejecutado):**

```diff
 # ── Documentos de trabajo por-sprint (decisión previa del proyecto, preservada) ──
 walkthrough.md
-implementation_plan.md
```

Justificación línea por línea de lo que se mantiene:
- `node_modules/`, `dist/`, `build/`, `*.tsbuildinfo` — sin cambios, artefactos de build.
- `/coverage/` (anclado a raíz) — sin cambios, ya corregido en sesión previa; preserva `.ai/coverage/*.md`.
- `.tmp.driveupload/`, `.tmp.drivedownload/`, `.tmp-*`, `.tmp/`, `temp/` — sin cambios, sincronización de nube.
- `*.log`, `logs/`, `npm-debug.log*` — sin cambios; verificado que ya cubre `test_output.log`/`.server-e2e.*.log` (no trackeados).
- `.env`, `.env.*`, `!.env.example` — sin cambios.
- `playwright-report/`, `test-results/` — sin cambios.
- `.eslintcache`, `.vite/`, `.turbo/`, `.npm/`, `.DS_Store`, `Thumbs.db`, `Desktop.ini`, `.vscode/`, `.idea/`, `*.swp` — sin cambios.
- `walkthrough.md` — **se mantiene ignorado en esta fase**, por instrucción explícita de no tocar su regla hasta que la propuesta de §3 sea aprobada por separado.
- `implementation_plan.md` — **se elimina la línea**. Confirmado que ningún patrón genérico del archivo captura `docs/designs/**/implementation-plan.md` (los patrones existentes son nombres literales sin comodines, y el nombre con guion es distinto del nombre raíz con guion bajo — no hay colisión, y ahora es irrelevante porque el archivo raíz también se versiona).

No se detectaron casos adicionales de archivos versionados que deberían ignorarse, ni de archivos ignorados que deberían versionarse, más allá de esta corrección.

---

## 9. Plan de migración por lotes auditables

**Lote A — Correcciones seguras** (cero ambigüedad, cero riesgo de referencia rota):
- Aplicar el diff de `.gitignore` (§8) y `git add implementation_plan.md` de inmediato para que quede versionado desde este commit.
- `git rm` de los 7 huérfanos (§7.1).
- Completar índices: `.ai/README.md` (agregar `PROMPT_TEMPLATES.md`, `COMMON_COMMANDS.md`), `INDEX.md` (listar `.ai/` completo).
- Corregir referencias obsoletas en `.agents/AGENTS.md` (ruta de `implementation_plan.md`, `docs/rules-coverage-checklist.md` → `docs/rules/registry.md`/`docs/technical-debt.md`/`.ai/coverage/`).
- Cross-links entre `GOVERNANCE.md` / `.agents/AGENTS.md` / `.ai/WORKFLOW.md`.

**Lote B — Reclasificación inequívoca**:
- `ADR-0008` → `docs/adr/`.
- `combat-rules-deviations.md` → `docs/audits/`.
- Familia `effects-*` → `docs/architecture/active-effects/`.
- `combat-documentation-integration.md`, `rule-engine-integration.md` → `docs/architecture/`.
- `.ai/coverage/V1_LAUNCH_MANIFESTO.md` → `.ai/coverage/README.md`.
- Documentos históricos → `docs/archive/` (`ai-agent-onboarding.md`, `project-hygiene.md`, `architectural-cleanup-phase1.md`, `sprint-006-conditions.md`, `combat-engine-mvp.md`, `flanking.md`).

**Lote C — Features con múltiples documentos** (solo 4 carpetas, §7.4):
- `full-attack-v2/`, `large-footprints-v1/`, `prone-eschewal-diehard/`, `withdraw/` (incluye migrar el `implementation_plan.md` raíz vigente antes de reutilizarlo).
- `git mv` para preservar historial; actualizar referencias entrantes.

**Lote D — Erratas in-situ** (ediciones de nota, no movimientos):
- `difficult-terrain-and-corners-design.md`, `effects-tick-layer.md`, `power-attack-v6-declarative.md`, `saving-throws-core-design.md`/`saving-throws-automation-design.md` (cross-links).

Cada lote es reversible de forma independiente (`git revert` del commit del lote). Ningún lote depende de otro para funcionar, salvo Lote C con Lote A (el `implementation_plan.md` raíz debe estar ya versionado antes de que su contenido se migre con `git mv`-equivalente).

---

## 10. Entregables de esta fase

1. Corrección de la política de implementation plans — §1.
2. Convención híbrida de designs — §2.
3. Walkthrough marcado como decisión pendiente — §3.
4. Resultados de los cinco diffs semánticos — §6.
5. Evidencia sobre los siete huérfanos — §5.
6. Auditoría corregida del `.gitignore` — §8.
7. Plan de migración por lotes — §9.
8. Lista exacta de archivos que cambiaría cada lote — §7 y §9.

Solo se actualizó este documento de diseño. No se modificó ningún otro documento, código, test ni regla.

**Ejecución detenida. No se emite PROCEED. Esperando revisión.**

**Estado: READY FOR MIGRATION REVIEW**
