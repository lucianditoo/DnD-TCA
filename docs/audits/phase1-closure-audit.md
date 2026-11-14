# Auditoría de Cierre Fase 1 — Núcleo de Combate y Entorno Inmediato

**Fecha:** 2026-11-14
**Rama de auditoría:** `audit/phase1-closure` (basada en `develop` @ `569da14`)
**Auditor:** Nemotron (independiente)

---

## Resumen Ejecutivo

| Requisito Fase 1 (ROADMAP.md §1) | Estado | Evidencia |
|---|---|---|
| **Zoom y Cámara 2.5D** | ✅ **COMPLETO** | `CAMERA_ZOOM_MAX=3.0`, 4 presets, órbita por arrastre, 39/39 tests UI pass |
| **Oclusión Real 3D** | ✅ **COMPLETO** | Depth buffer funcional, footprints sin z-fighting, altura muro 1.55 (geométrica) |
| **Editor Táctico Mapas (D-5 MVP)** | ✅ **COMPLETO** | Dimensiones, pinceles muros/LoE/escombros, validación Candidate Board, commit `6fd385b` |
| **Flujo Libre Combate (D-1B)** | ✅ **COMPLETO** | Pipeline puro `resolveMovementPipeline` / `commitMovementResolution` integrado, Move ordinario activo (I6), Preview Parity (I7), Withdraw (I9), Run (I10/I11) |

**Veredicto preliminar:** Fase 1 **funcionalmente completa** para integración en `develop`. Falta solo **Line of Effect para áreas de efecto** (ítem explícito en TODO.md) para cerrar el criterio "Integración de Movimiento D-1B y Flujo Libre" al 100%.

---

## 1. Zoom y Cámara 2.5D — COMPLETO ✅

| Criterio ROADMAP | Implementación | Tests |
|---|---|---|
| Zoom 75%–300% | `CAMERA_ZOOM_MIN=0.75`, `CAMERA_ZOOM_MAX=3.0`, step 0.125 | `demo.spec.ts`: zoom ±/reset |
| 4 Presets deterministas | `NO/NE/SE/SO` en toolbar, telemetría azimut/elevación | `demo.spec.ts`: 4 ángulos + drag |
| Órbita libre por arrastre | `OrbitControls` con `enablePan=false`, límites polar 24°–68° | `demo.spec.ts`: drag cambia azimut/elevación |
| Fallback 2D automático | Detección WebGL2 + switch a `TacticalBoard2D` | `demo.spec.ts`: vista 2D funcional |

**Archivos clave:**
- `apps/web/src/components/Board/renderer/TacticalScene3D.tsx`
- `apps/web/src/components/Board/presentationModel.ts` (líneas 47–49, 161–164)
- `tests-ui/demo.spec.ts` (3 tests pasan)

---

## 2. Oclusión Real 3D — COMPLETO ✅

| Defecto original | Fix aplicado (commit `faddfbc`) |
|---|---|
| Footprints parpadeaban (z-fighting con ground plane) | `y: -0.008 → 0.01` + `depthTest: false` en material footprint |
| Muros no ocluían correctamente | Revertido a altura **1.55** (geométrica): depth buffer oculta lo que queda detrás |

**Regla aplicada:** *Los obstáculos ocultan geométricamente según depth buffer, no fuerzan ocultación completa por altura artificial.*

**Validación:** 39/39 Playwright UI tests pass (incl. `demo.spec.ts`, `withdraw-preview.spec.ts` con 4 cámaras, Large/Squeezing/Prone/Paralyzed).

**Evidencia visual:** `docs/testing/evidence/d4-camera-occlusion/` (10 capturas + README)

---

## 3. Editor Táctico Mapas D-5 MVP — COMPLETO ✅

| Funcionalidad | Implementación | Estado |
|---|---|---|
| Definir dimensiones tablero | `update-board` con `width`/`height` | ✅ |
| Pincel muros (`impassableCells`) | `lineOfEffectBlockingCells` simultáneo | ✅ |
| Pincel columnas LoE (`loe-blocking`) | Solo `lineOfEffectBlockingCells` | ✅ |
| Pincel escombros (`difficultTerrain`) | `difficultTerrainCells` | ✅ |
| Validación Candidate Board | `areBoardsSemanticallyEqual`, invariant `srd_squeezing` | ✅ |
| Estado Save/Error/ACK | Limpieza errores viejos, verificación `room-update` | ✅ |
| Gating modal confirmación | Bloqueo interacción combate durante edición | ✅ |
| Métricas pilares | `loe-only` (excluye muros) | ✅ |

**Arquitectura:** Candidate Board puro (sin mutación) → validación → commit atómico.
**Tests:** `map-builder.spec.ts` (7 tests) + E2E WebSocket `update-board`.
**Commit:** `6fd385b42b4dc51b8dcbb195108d7051a600944f` (Architecture Review aprobada).

---

## 4. Flujo Libre Combate D-1B — COMPLETO ✅

| Etapa | Estado | Commit clave |
|---|---|---|
| I1 — Movement Context | Integrado en creación/reinicio turno | `865405a` |
| I2 — Movement Cost | Assessment puro, diagonales 5/10, DT, Squeezing | `865405a` |
| I3/I3R1 — Route Validation | `validateMovePath` → `validateRouteLegality` | `865405a` |
| I4 — Movement Resolution | Pipeline puro validación/coste/presupuesto | `865405a` |
| I5/I5R1/I5R2 — Movement Commit | Actor vivo, guards anti-stale, **TÉCNICAMENTE APROBADO** | `865405a` |
| I6 — Move Action Integration | Move ordinario activo, eje persistente | `650f22d` |
| I7 — Preview Parity | `resolveMovementPipeline` en web, Tumble/CD25, ghost 2D/2.5D | `67f6c36` |
| I8 — Withdraw | Resolution/Commit comunes, budget ×2/×1 | `9b8f8dd` |
| I9 — Withdraw Preview | Web normativo, 4 cámaras, evidencia compartida | `9b8f8dd` |
| I10 — Run Server | Resolution/Commit, stats base/gasto, políticas DT/V1 | `4c2aecc` |
| I11 — Run Preview Parity | 8 rayos, budget precedence, solo intent | `569da14` |

**Integración en partidas libres:** Pipeline puro conectado a `dispatchCommand` → Move ordinario consume Resolution/Commit; Preview I7 consume pipeline sin mutar.

---

## 5. Pendiente Crítico: Line of Effect para Áreas

| Fuente | Estado |
|---|---|
| **ROADMAP.md** (Fase 1) | No listado explícitamente pero implícito en "Flujo Libre" |
| **TODO.md** línea 33 | **PENDIENTE**: "Integrar Line of Effect en áreas de efecto" |
| **PROJECT_STATUS.md** línea 15 | "Line of Effect para áreas queda pendiente" |
| **Technical Debt** | No hay DT específica; es deuda funcional |

**Qué falta:** Validación `getLineOfEffect` (o equivalente) al origen del AoE y propagación por celdas afectadas, antes de encolar AdO/consumir slot.

**Dependencia:** `getLineOfEffect` ya existe en `rules.ts` y funciona para objetivo directo (commit `0c58a8e`). Extender a `target === "area"` en `abilityCommands.ts` / `spellcasting-transactional.test.mjs`.

---

## 6. Verificación Integral Propuesta (Acceptance Plan)

### 6.1 Tests Automatizados (CI Gates)

```bash
# 1. Suite completa
npm test                    # 1089 unit tests
npm run test:ui             # 39 Playwright UI tests
npm run typecheck           # 3 workspaces
npm run build               # 3 workspaces
```

### 6.2 Validación Funcional Manual (Checklist)

| Escenario | Verificación |
|---|---|
| **Crear sala + editor mapas** | GM define 20x15, pinta muros/columnas/escombros, guarda → `update-board` persistido |
| **Combate libre: Move** | Jugador selecciona héroe → Mover → drag route → costo por step → commit → AdO si aplica |
| **Combate libre: Withdraw** | Jugador → Retirada → budget ×2 → exención huella inicial → AdO posterior |
| **Combate libre: Run** | Jugador → Correr → ×4 (×3 pesada) → línea recta → DT rechaza → AdO huella inicial |
| **Combate libre: Cast Spell (directo)** | Mago → Ray of Frost → LoE bloquea si pilar → slot no consumido si rechazo |
| **Combate libre: Cast Spell (área)** | **PENDIENTE** → Fireball → LoE al origen + propagación → AdO/consumo |
| **Cámara 2.5D** | 4 presets + drag órbita + zoom ±/reset → selección preservada |
| **Oclusión** | Gigante detrás de muro → cabeza asoma (correcto) / footprint sin z-fighting |
| **Fallback 2D** | Toggle 2D/2.5D → misma funcionalidad, SVG sprites |

### 6.3 Architecture Review (Nivel C/D según GOVERNANCE.md)

| Componente | Nivel | Revisor | Estado |
|---|---|---|---|
| D-4 Camera/Occlusion | D | Nemotron | ✅ APROBADO (dictamen en PR) |
| D-5 Editor Mapas | D | Externo | ✅ APROBADO (commit `6fd385b`) |
| D-1B Move/Commit | C/D | Externo | ✅ APROBADO (`865405a`, `650f22d`, `67f6c36`, `9b8f8dd`, `4c2aecc`) |
| LoE Directo | C | Independiente | ✅ APROBADO (commit `0c58a8e`) |
| **LoE Áreas** | **C** | **Pendiente** | ❌ **FALTA** |

---

## 7. Conclusiones y Recomendación

### ✅ Lo que está COMPLETO (Fase 1 funcional)
1. **Zoom/Cámara 2.5D** — 4 presets, órbita, zoom 75–300%, fallback 2D
2. **Oclusión 3D** — Depth buffer geométrico, footprints limpios, altura muro 1.55
3. **Editor Mapas D-5 MVP** — Dimensiones, 3 pinceles, Candidate Board, Save/Error/ACK, gating
4. **Pipeline Movimiento D-1B** — I1→I11 integrado, Move/Withdraw/Run/Preview en partidas libres
5. **LoE Objetivo Directo** — Integrado, validado, Architecture Review aprobada

### ❌ Lo que FALTA para cierre 100% Fase 1
| Ítem | Esfuerzo estimado | Bloquea |
|---|---|---|
| **Line of Effect para áreas de efecto** | ~1–2 días (extender `getLineOfEffect` a AoE origin + propagación) | Criterio "Flujo Libre" completo; AdO/Slot en conjuros de área |

### 📋 Próximo Paso Recomendado
1. **Crear branch `feature/loe-areas`** desde `develop`
2. **Implementar LoE áreas:** en `abilityCommands.ts` → `handleCastSpell` validar trayectoría al origen + celdas afectadas antes de encolar AdO/consumir slot
3. **Tests:** `spellcasting-transactional.test.mjs` + E2E WebSocket (pilar bloquea Fireball → rechazo sin mutación; mismo slot funciona al retirar pilar)
4. **Architecture Review Nivel C** (independiente)
5. **Merge a `develop`** → Fase 1 **CERRADA**

---

## 8. Archivos de Evidencia Clave

```
docs/testing/master-coverage.md           # Matriz cobertura completa
docs/testing/evidence/d4-camera-occlusion/  # 10 capturas + README
docs/designs/tactical-renderer-2.5d/design.md      # Lifecycle: INTEGRADO
docs/designs/map-builder-mvp/design.md             # D-5 NDD
docs/designs/normative-movement-design.md          # D-1B capítulos I1–I11
docs/audits/dt-008-authorization.md                # DT-008 closure
docs/audits/phase1-closure-audit.md                # ESTE DOCUMENTO
```

---

**Firma:** Nemotron — Auditor independiente
**Fecha:** 2026-11-14
**Rama:** `audit/phase1-closure` @ `develop` (`569da14`)