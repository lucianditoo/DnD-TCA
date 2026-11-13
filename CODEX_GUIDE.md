# Codex Desktop y ECC en DnD TCA

Leé [AGENTS.md](AGENTS.md) para ejecutar una tarea, [GOVERNANCE.md](GOVERNANCE.md) para sus gates y [INDEX.md](INDEX.md) para localizar arquitectura, estado y contratos. El mapa de rutas del código está en [.ai/FILE_INDEX.md](.ai/FILE_INDEX.md).

## Qué aporta cada herramienta

Codex descubre las instrucciones de raíz, mantiene el plan y el chat, ejecuta comandos y edita el checkout bajo los permisos del host. Usá su plan para tareas con pasos dependientes. Usá un worktree cuando haya cambios superpuestos o trabajo paralelo que necesite aislamiento. Un objetivo persistente puede servir para tareas largas con criterio de cierre verificable cuando el usuario lo pida. El chat y Git permiten retomar sin depender de automatizaciones.

ECC 2.2.3 aporta procedimientos especializados. Cargá el cuerpo de una habilidad cuando su disparador aporte evidencia o criterio al paso actual. Elegí una por necesidad y reutilizá las verificaciones del proyecto. Si una habilidad describe otro harness, usá solo las prácticas transferibles. En Codex, ECC declara un hook de inicio de sesión sujeto a confianza del host. El proyecto funciona con sus instrucciones y evidencia aunque el hook no esté activo.

## Habilidades seleccionadas

| Habilidad ECC | Propósito | Activación |
|---|---|---|
| `intent-driven-development` | Traducir intención a aceptación y límites verificables | Solicitud ambigua o decisión de alto impacto. |
| `change-impact` | Rastrear contratos, callers y pruebas aguas abajo | Una modificación alcanza varias capas o un contrato compartido. |
| `tdd-workflow` | Reproducir, corregir y verificar comportamiento | Defecto con regresión reproducible o regla nueva con contrato observable. Usá los runners y fixtures existentes. |
| `e2e-testing` | Diseñar o depurar escenarios Playwright | Cambia un recorrido UI que requiere evidencia de navegador. |
| `verification-loop` | Revisar evidencia y detectar huecos | C/D con varios tipos de gates o fallos cruzados. Aplicá la matriz del repo y reutilizá resultados. |
| `architecture-decision-records` | Registrar una decisión difícil de revertir | Cambian fronteras, autoridad, persistencia o contratos transversales. |
| `security-review` | Revisar defensivamente límites de confianza y datos | Cambian ownership, autenticación, entradas WebSocket, secretos o almacenamiento. |
| `strategic-compact` | Compactar cerca de una transición natural | Un chat largo se aproxima al límite de contexto. Registrá el estado de reanudación primero. |
| `docs-governance` | Auditar responsabilidades, navegación y referencias | Hay deriva entre documentos o cambia la metodología. |

El agente principal suele compartir contexto entre diseño, implementación y corrección con menor costo. Delegar agrega contexto y una integración posterior. Compensa cuando una segunda lectura aporta independencia o cuando la investigación tiene rutas y resultado separables. La revisión de un diff de autoridad o compatibilidad es un buen caso. Repetir toda la exploración en varios agentes encarece una tarea lineal. La política de revisión y las condiciones del host determinan cuándo delegar. Los orquestadores que delegan cada fase y el aprendizaje continuo por hooks quedan fuera del flujo predeterminado. Usá el registro de la tarea y los ADR para preservar decisiones relevantes.

La configuración observada usa `gpt-6.1-sol` con esfuerzo `low`. Ese punto de partida es adecuado para tareas acotadas. Un razonamiento más profundo en una decisión normativa o de compatibilidad puede ahorrar retrabajo si el host permite elegirlo. Acotá búsquedas, diffs y logs al riesgo investigado. Medí con evidencia disponible por tarea, como tiempo, ciclos y gates repetidos. Los cambios de proceso por sí solos no acreditan un ahorro de cuota medido.

## Verificadores

| Evidencia | Comando o fuente |
|---|---|
| Diff y espacios | `git diff --check` |
| Tipos por workspace | `npm run typecheck:web`, `npm run typecheck:server`, `npm run typecheck:shared` |
| Suite global, tipos y compilación | `npm test`, `npm run typecheck`, `npm run build` |
| Protocolo real | `node scripts/e2e-websocket.mjs` con servidor del checkout en el puerto 3333 |
| Interacción UI | `npm run test:ui`, con filtro de Playwright cuando el cambio sea focalizado |
| Evidencia remota | [Windows CI](.github/workflows/windows-ci.yml), en un PR a `master`, un push autorizado a `master` o una ejecución manual habilitada |

Para una prueba focal, consultá el runner del [package.json](package.json) y el test afectado. Para iniciar el entorno local con las dependencias disponibles, usá `npm run dev`. Identificá el servidor que usa el E2E y cerrá los procesos que levantaste al terminar. Windows CI registra su propia evidencia sobre el SHA probado.
