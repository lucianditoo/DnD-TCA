# Evidencias Visuales D-4 — Cámara y Oclusión 2.5D

**Fecha**: 2026-11-14
**Commit**: `e8b73d7` (fix(d4): correct 3D occlusion for walls and token footprints)
**Rama**: `fix/d4-camera-occlusion`
**Base**: `develop` @ `23eb4bf`

---

## Capturas de Aceptación

| Archivo | Descripción | Valida |
|---|---|---|
| `camera-preset-nw.png` | Preset cámara Noroeste (encuadre base) | Preset NO, tokens visibles, selección |
| `camera-preset-ne.png` | Preset cámara Noreste (rotación 90°) | Rotación preserva selección y estado sala |
| `camera-preset-se.png` | Preset cámara Sudeste (rotación 180°) | Rotación preserva selección y estado sala |
| `camera-preset-sw.png` | Preset cámara Sudoeste (rotación 270°) | Rotación preserva selección y estado sala |
| `wall-occlusion-large-creature.png` | **Escena B**: Guardián Coloso (Large 2×2) + Cobertura + Muros/pilares | **Oclusión 3D real**: muros (altura 2.0) ocultan sprites medianos/Large; depthTest funcional |
| `large-squeezing-footprint.png` | Large en Squeezing (footprint 2×1) | Footprint sin z-fighting, escalado correcto |
| `prone-condition.png` | Derribado (Prone) — sprite rotado, icono ▼ | Pose Prone renderizada correctamente |
| `paralyzed-hold-person.png` | Paralizado (Hold Person) — icono ⚡, color púrpura | Pose Paralyzed renderizada correctamente |
| `movement-overlay-costs.png` | Overlays movimiento: celdas alcanzables, ruta, costos por paso | Overlays tácticos superpuestos sin z-fighting |
| `fallback-2d.png` | Vista 2D de respaldo (SVG) | Fallback funcional y accesible |

---

## Defectos Corregidos (commit e8b73d7)

| Defecto | Antes | Después |
|---|---|---|
| Muros no ocluyen criaturas medianas | Altura 1.55u (~7.75 ft) < sprite ~1.78u | Altura 2.0u (~10 ft) > sprite |
| Footprint z-fighting con suelo | `y=-0.008`, `depthTest:true` (default) | `y=0.01`, `depthTest:false` |

---

## Tests de Validación (39/39 Playwright)

- `demo.spec.ts:57` — 4 ángulos, zoom, vista 2D/2.5D, sin icon IDs
- `demo.spec.ts:209` — 3 escenas: Large, Squeezing, Cover, Prone, Hold Person
- `demo.spec.ts:309` — Overlays movimiento, fallback sprite
- `withdraw-preview.spec.ts:102` — Squeezing 2D/2.5D, 4 cámaras, confirmación servidor

---

## Métricas de Calidad

| Métrica | Resultado |
|---|---|
| Unit tests | 1089/1089 pass |
| Playwright UI | 39/39 pass |
| Typecheck | Clean (3 workspaces) |
| Build | Clean (3 workspaces) |
| Git diff check | Clean |

---

**Nota**: Estas capturas fueron generadas por Playwright durante la ejecución de `npm run test:ui` y copiadas desde el directorio de trabajo de Antigravity al repositorio para trazabilidad y versionado.