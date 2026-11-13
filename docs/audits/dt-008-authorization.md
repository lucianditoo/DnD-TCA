# DT-008: autorización centralizada y contraste de auditoría

Estado: candidato local para revisión independiente de Nemotron; no integrado.
Fecha de verificación: 2026-11-13 (America/Buenos_Aires).
Base: `origin/master`, actualizado mediante fetch, `17eafec716a4e65cb34246c570f9bb85f041fa02`.
Rama: `codex/dt-008-authorization`.

Este documento conserva diseño, contraste de los ocho hallazgos, evidencia y
límites del candidato. La deuda integrada sigue registrada en
[technical-debt.md](../technical-debt.md#dt-008). El informe recibido de Nemotron
declara el mismo HEAD, pero fecha 2026-11-14; esa fecha y sus resultados de tests
son afirmaciones del informe, no evidencia ejecutada en esta tarea.

## Alcance y aceptación

Nivel D por el alcance transversal de autorización; requiere revisión
arquitectónica y defensiva independiente antes de integrar, según
[GOVERNANCE.md](../../GOVERNANCE.md#52-nivel-de-cambio-y-evidencia).
La implementación conserva las decisiones de autoridad vigentes: no cambia
contratos WebSocket, persistencia, asignación de roles, ownership, reglas SRD ni
semántica de desconexión/reanudación. No introduce una decisión arquitectónica
difícil de revertir. Si se desea cambiar esas decisiones, requiere aprobación
separada del propietario.

Criterios: todos los comandos de sala tienen política explícita, las entradas
externas conservan el vínculo socket/identidad/sala, un comando desconocido se
rechaza, se preservan creación/unión, controles GM/jugador, reacciones y
continuaciones; se conservan todas las validaciones anteriores. Verificación:
matriz negativa/positiva, regresiones de flujos, suite global, tipos, build,
WebSocket real y suite UI completa.

## Contraste de los ocho hallazgos

No se confirmó un bypass explotable por WebSocket entre los ocho hallazgos.
Esto no constituye una garantía de ausencia de otras vulnerabilidades.

| ID | Dictamen | Evidencia del código y consecuencia |
|---|---|---|
| VULN-001 | Riesgo potencial confirmado, no vulnerabilidad crítica demostrada | Los handlers repiten invocaciones a helpers centrales de `auth/control.ts`. Omitirlas en un comando futuro es un riesgo real; la mera repetición no demuestra un bypass actual. Se añade política exhaustiva con rechazo por defecto. |
| VULN-002 | Falso positivo | `resumed` es una opción interna de los handlers, no un campo del contrato. `resumeStationaryAction` llama a `handleUseTacticalAction(..., true)`. Zod elimina el campo adicional del payload; la prueba negativa confirma que no evita ownership. Propagarlo desde el cliente crearía un riesgo nuevo. |
| VULN-003 | Falso positivo | `dispatchCommand` vincula `actorId` al socket registrado. `handleResolveSavingThrow` obtiene el rol del registro servidor y comprueba sala. Un jugador no puede fingir GM con `actorId`; hay prueba negativa y comprobación de no mutación. |
| VULN-004 | Falso positivo como bypass reportado; límite de confianza documentado | La acción pendiente se crea después de autorizar, guarda comando y tipo de control en memoria servidor, no se publica al cliente y la reanudación compara control vigente con actor original/tipo guardado. No usa la identidad del reactor. Cambiar de propietario cancela la continuación. No exige que siga conectado el iniciador: la prueba preserva esa conducta existente. |
| VULN-005 | Falso positivo | Crear/unirse establece identidad; no requiere un turno ni una identidad previa. `register` impide registrar dos veces el mismo socket; join solo concede player. Unirse en fases activas o finalizadas no autoriza a actuar fuera de fase. Bloquear join por fase sería una decisión nueva de producto. |
| VULN-006 | Falso positivo | La primera búsqueda del objetivo en `handleResolveSavingThrow` usa `findCombatant(room, targetId)`, que solo busca en `room.combatants` y lanza si falta. También verifica membresía. Pruebas para objetivo ajeno/inexistente, owner y GM. |
| VULN-007 | Falso positivo | La entrada interna de demo valida esquema, socket de sesión, sala e identidad y excluye create/join. `resume-gm-session` se procesa separadamente en `index.ts`, con `allowGmResume` y token; no es un comando interno de combate. Los controles de reproducción demo tienen su propia autorización de sesión. |
| VULN-008 | Falso positivo | La continuación exige coincidencia exacta del turno, evalúa disponibilidad y estado vital tras AdO. Permitir `finished` en la comprobación inicial permite contabilizar la pérdida de un conjuro; `available` exige `active` antes de ejecutarlo. `ensureActiveTurn` solo comprueba discrepancia si hay turno y no reemplaza estos controles más específicos. Pruebas de cambio de turno, incapacitación y concentración. |

El inventario de Nemotron también atribuye a la confirmación de crítico
`requireTurnControl`, pero en esta base usa `requireCombatantControl`. No se
amplió esa facultad del GM. Muchos handlers GM no tienen membresía local: la
entrada WebSocket ya la verifica y el nuevo punto central la vuelve a exigir.
Las llamadas directas a handlers son una superficie interna, no una API remota.

Hallazgo adicional reproducido: un comando desconocido pasado directamente al
dispatcher tipado retornaba sin error. Zod ya rechaza esos comandos en la entrada
WebSocket; se trata de defensa en profundidad para callers internos y evolución
del código, no de un exploit remoto demostrado. La regresión falló antes del
cambio con `Missing expected exception` y pasa con la política central.

## Diseño implementado

1. Se mantienen las entradas de bootstrap (`create-room`, `join-room`), identidad
   WebSocket, aislamiento demo y recuperación de sesión GM existentes.
2. En `dispatchCommandCore`, después de los bloqueos de fase existentes y antes
   de cualquier handler o continuación, se llama a `authorizeRoomCommand`.
   Esto cubre tanto comandos públicos como ejecución interna de demo.
3. `commandAuthorizationPolicies` contiene las 37 políticas. El mapped type
   sobre `RoomCommand["type"]` obliga a decidir la política de cada comando nuevo
   al compilar. `Object.hasOwn` rechaza desconocidos en ejecución y evita aceptar
   propiedades heredadas. La tabla está congelada.
4. La membresía se verifica antes de la política. Los permisos reutilizan los
   helpers existentes. Los actores se seleccionan explícitamente por contrato:
   combatant, caster, attacker, `maneuver.attackerId`, atacante de amenaza/AdO
   pendiente o combatiente del turno. No se infieren a partir de target genérico.
5. Se conservan los overrides GM existentes: iniciativa, fin de turno, AdO y
   salvaciones. Ataques normales y confirmaciones no adquieren ese override.
   Las altas de héroes no requieren ownership de un combatiente aún inexistente;
   las altas de enemigos requieren GM.
6. Turno, fases, legalidad y economía de acciones quedan en sus capas actuales.
   No se impone un perfil genérico de movimiento/acción estándar que rompería
   preparación, ataques completos, reacciones o acciones ya consumidas.
7. Las continuaciones de movimiento y acciones estacionarias permanecen
   internas, con sus comprobaciones existentes sobre estado servidor. No vuelven
   a pasar por una política de comando nuevo ni requieren el socket original.

Se descartó copiar el middleware propuesto: exigir participante/sala a
create-room/join-room rompe bootstrap; las selecciones genéricas omiten actores
anidados y reacciones; los perfiles propuestos alteran facultades de iniciativa
y economía de acciones. El pseudocódigo también contiene referencias a campos
no definidos y entradas duplicadas. No se utilizó como implementación validada.

## Compatibilidad y recuperación

Se agregan un módulo servidor y tres líneas de integración; no se elimina ningún
control previo. Las denegaciones pueden ocurrir antes del handler y cambiar
qué error aparece primero si un comando viola varias condiciones. No se cambia
el formato de mensajes ni el resultado de acciones válidas.

Recuperación: retirar la llamada/import central devuelve el comportamiento
previo, porque los controles de los handlers permanecen intactos; retirar el
módulo y sus pruebas completa la reversión. No hay migración ni datos nuevos.
Este procedimiento es un plan, no una reversión ejecutada. No hacer reset de
archivos ajenos ni tocar master.

## Verificación observada

- Regresión de rechazo por defecto: rojo antes del cambio, verde después.
- `tests/authorization-policy.test.mjs`: 48/48, matriz de los 37 comandos,
  identidad/membresía/roles, propietarios, selección de actores reactivos,
  salvaciones, bootstrap por fase y continuaciones tras desconexión, cambio de
  dueño, cambio de turno o incapacitación; rechazo de replay sin mutación.
- `npm test`: 1073/1073, 28 suites, sin skips ni fallos (incluye demo, GM resume,
  identidad, movimiento interrumpido, carga, concentración y críticos).
- `npm run typecheck`: shared, web y server correctos.
- Build correcto y UI 39/39: resultados aprobados de la ejecución anterior,
  reutilizados en esta reanudación sin cambios funcionales ni repetición.
- `node scripts/e2e-websocket.mjs`: repetición completa 141/141, cero fallos,
  código de salida 0. El resultado anterior 140/141 se debía a la expectativa
  de error de preparación: la autorización central rechaza primero con
  `Solo el GM puede usar este control.`. La regresión corregida exige exactamente
  un error nuevo y snapshots idénticos al anterior tanto para jugador como GM;
  no se limita a buscar un mensaje histórico. Esta observación verifica el
  estado publicado; las pruebas unitarias también comparan el estado servidor.
- `git diff --check`: correcto. Sin cambios funcionales en esta reanudación.
- El inicio de otro servidor devolvió `EADDRINUSE`; se identificó el servidor
  residual de pruebas iniciado por Codex (PID 12088, padre 20508, comando
  `node --import tsx apps/server/src/index.ts`). Se ejecutó el E2E contra él y
  se cerró únicamente ese proceso al terminar; puerto 3333 sin listeners.

Incidencias de implementación: el primer typecheck detectó la selección de
`attackerId` de maniobras en el nivel incorrecto; una corrección a
`maneuver.attackerId` resolvió el fallo. La primera fixture nueva de reanudación
omitía `turnOrder`; `syncEncounterPhase` volvía correctamente a preparación.
Se completó la fixture y pasaron las cinco variantes. La primera suite global
se inició con esa fixture incompleta y falló; la ejecución global posterior
pasó. Un ciclo de corrección por cada causa, sin modificar mecánicas ni tests
existentes.

## Riesgos residuales y revisión requerida

- La exhaustividad obliga a tener una política, pero no demuestra que una
  política nueva sea correcta: exige revisión y pruebas negativas por comando.
- Permanecen controles redundantes como defensa y compatibilidad para callers
  internos; su futura eliminación queda fuera de este candidato.
- Una continuación autorizada puede completarse tras desconectarse el dueño;
  cancelar por desconexión cambiaría el contrato actual y requiere decisión
  explícita. No hay endpoints nuevos para alterar ownership o pendientes.
- El acceso directo a handlers desde código servidor presupone caller de
  confianza. No se convierten todos los handlers en APIs independientes seguras
  ante código interno malicioso.
- CI y dictamen independiente no se sustituyen por pruebas locales. Nemotron
  debe revisar selección de actores, overrides GM, separación entre nuevas
  intenciones y continuaciones, exhaustividad y efectos antes de denegación.

Archivos del candidato: `apps/server/src/auth/commandAuthorization.ts`,
`apps/server/src/commands/dispatcher.ts`, `tests/authorization-policy.test.mjs`,
`scripts/e2e-websocket.mjs`, este informe, `docs/technical-debt.md`, `INDEX.md` y `walkthrough.md`.
`docs/planning/` era trabajo ajeno sin seguimiento y se preservó.
Sin merge, push ni publicación de PR; revisión independiente pendiente.
