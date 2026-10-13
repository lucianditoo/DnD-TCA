# Walkthrough — normalización visual de sprites 2.5D

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [NDD D-4](docs/designs/tactical-renderer-2.5d/design.md), [Plan D-4](docs/designs/tactical-renderer-2.5d/implementation-plan.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado

La revisión visual detectó dos defectos presentacionales en el renderer Three.js:
el caballero parecía menor que las demás familias y, en cámaras rasantes, las
líneas del tablero podían dibujarse sobre los personajes.

La causa del primer defecto era el margen transparente del PNG del caballero:
su silueta ocupa aproximadamente un 25 % menos de altura útil que las restantes.
El renderer aplica ahora una compensación visual de familia `1.25` al caballero,
sin modificar su tamaño, huella o posición mecánicos.

Los sprites de combatientes usan además una capa frontal explícita. La
cuadrícula, las huellas y los overlays tácticos permanecen sobre el suelo; los
personajes se dibujan después, y las etiquetas e indicadores de estado conservan
sus capas superiores. Así las líneas ya no atraviesan visualmente las figuras.

## 2. Archivos

- `apps/web/src/components/Board/renderer/TacticalScene3D.tsx`: compensación
  visual del caballero y política frontal de profundidad para sprites.
- `tests-ui/demo.spec.ts`: regresión de escala y de la política de capa frontal.

No se modificaron reglas, snapshots, servidor, contratos de red ni footprints.
`test.txt` continúa intacto, sin seguimiento y fuera de los commits.

## 3. Validación

- `npm test`: 657/657.
- `npm run typecheck`: verde en shared, web y server.
- `npm run build`: verde en shared, web y server. La ejecución dentro del
  sandbox encontró un bloqueo `EPERM` de OneDrive; la repetición fuera del
  sandbox compiló correctamente.
- `node scripts/e2e-websocket.mjs`: 107/107.
- `npm run test:ui`: 10/10.
- `git diff --check`: sin errores.

## 4. Estado

Corrección de UI Nivel B lista para validación visual del propietario y
Architecture Review. D-4 mantiene sus límites: la escena sigue siendo una
presentación 2.5D sin autoridad sobre la simulación espacial.
