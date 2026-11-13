# Walkthrough — DT-008 autorización centralizada

Estado: DT-008 integrado y resuelto en `03854a9` mediante el PR #1. La evidencia siguiente corresponde a la preparación del candidato.
Fecha: 2026-11-13. Rama: `codex/dt-008-authorization`.
Base y HEAD: `17eafec716a4e65cb34246c570f9bb85f041fa02` (origin/master actualizado).
El walkthrough anterior queda preservado en Git.

El [informe de DT-008](docs/audits/dt-008-authorization.md) contiene el contraste
individual de los ocho hallazgos, diseño, riesgos residuales, archivos y pruebas.
Se implementó una tabla exhaustiva de autorización para los 37 comandos de sala,
con membresía y rechazo por defecto antes de ejecutar handlers. Permanecen todas
las validaciones previas y las semánticas de GM, jugadores, bootstrap, reacciones
y continuaciones. No se modificaron contratos ni mecánicas de combate.

Evidencia local: 48 pruebas nuevas; suite global 1073/1073, sin skips; typecheck
shared/web/server y build correctos. Build advierte sobre tamaño del bundle web.
UI 39/39 aprobada previamente. Repetición completa WebSocket: 141/141,
cero fallos, salida 0. La expectativa corregida comprueba un error nuevo de
autorización y ausencia de cambios en los snapshots de jugador y GM.
Se reutilizaron suite global, UI, tipos y build sin repetirlos ni cambiar código.
Diff final revisado y `git diff --check` correcto. Servidor residual de pruebas
cerrado tras identificar su proceso; puerto 3333 libre. Detalles y limitaciones
de evidencia: consultar el informe de DT-008.

La regresión de comando desconocido se observó roja antes del cambio. Se corrigió
una selección de campo anidado de maniobra detectada por TypeScript y una fixture
de reanudación sin orden de iniciativa (un ciclo por causa). No hay causas de
fallo de código pendientes. La primera suite global con esa fixture incompleta
falló; la ejecución posterior pasó.

Al terminar la preparación local quedaban pendientes la publicación y la revisión.
`docs/planning/` era contenido ajeno sin seguimiento y se preservó.
El PR #1 se integró posteriormente tras Architecture Review aprobada y Windows CI exitoso, según el propietario.
