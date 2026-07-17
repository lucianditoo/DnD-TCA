# Checklist de testing del Tactical Combat Assistant

## Flujo de sala

- Crear sala como GM.
- Unirse como jugador con codigo valido.
- Manejar error con codigo inexistente.
- Sincronizar cambios entre GM y jugador.

## Spawns y tablero

- Agregar varios Bane, Cedrick, Ranger y Canocrock.
- Verificar que ningun token comparte casilla.
- Verificar que una sala vieja con tokens superpuestos se normaliza al recibir una accion.
- Intentar mover a una casilla ocupada y confirmar que se bloquea.
- Intentar mover fuera del tablero y confirmar que se bloquea.

## Turnos e iniciativa

- Cargar iniciativas manuales.
- Ordenar turnos.
- Terminar turno y avanzar ronda.
- Confirmar que muertos y estables no actuan.

## Movimiento y ataques de oportunidad

- Mover 5 ft desde amenaza y confirmar que no dispara AdO por movimiento.
- Mover mas de 5 ft desde amenaza y confirmar que crea AdO.
- Resolver AdO que impacta y hace dano: objetivo vuelve a casilla origen.
- Resolver AdO que falla o no hace dano: objetivo queda en destino.
- Disparar o lanzar arma estando amenazado y confirmar que crea AdO.
- Atacar con daga a objetivo adyacente y confirmar que no crea AdO por ataque a distancia.

## Ataques cuerpo a cuerpo y a distancia

- Ataque simple con impacto.
- Ataque simple con fallo.
- Ataque completo despues de no moverse mas de 5 ft.
- Bloquear ataque completo despues de moverse mas de 5 ft.
- Dagas arrojadizas: alcance 10 ft por incremento, maximo 50 ft.
- Arco largo: alcance 100 ft por incremento, maximo 1000 ft.
- Confirmar -2 por cada incremento posterior al primero.
- Confirmar bloqueo fuera de alcance maximo.

## Habilidades

- Cedrick usa Cure Light Wounds sobre Bane herido.
- Cure Light Wounds respeta alcance 5 ft y objetivo aliado.
- Cure Light Wounds no revive muertos con curacion normal.
- Haste aplica +1 ataque y +10 ft velocidad por 5 turnos.
- Magic Missile aplica dano manual a enemigo y actualiza estadisticas.
- Usar habilidad consume accion estandar.
- Usar habilidad en 0 HP aplica perdida de 1 HP por esfuerzo.

## Estados de vida

- HP baja a 0: incapacitado.
- HP baja por debajo de 0: moribundo.
- Tirada de estabilizacion exitosa deja estable.
- Tirada fallida hace perder 1 HP.
- HP llega a -10: muerto.
- Curacion desde negativo deja estable o activo segun HP final.

## Fin de combate y estadisticas

- Todos los enemigos muertos: Victoria.
- Todos los heroes muertos: TPK.
- Pantalla final muestra dano hecho, dano recibido, distancia, ataques, impactos, fallos, AdO, bajas, caidas y curacion.

## Interfaz

- Secciones de arma, caracteristicas, habilidades, panel GM y AdO se pueden colapsar.
- El panel derecho sigue usable con muchos datos.
- El log sigue accesible sin perder completamente el contexto del tablero.
- Los controles caben en viewport movil.

## Pruebas automatizadas actuales

- `npm test`: tests de perfiles, persistencia, equipamiento, estadísticas derivadas, critical flow, natural 1/20 y validación de comandos WebSocket.
- `npm run typecheck`: shared, web y server.
- `npm run build`: shared, web y server.
- `scripts/e2e-websocket.mjs`: prueba WebSocket con sala real.

Cobertura automatizada importante:

- ownership/permisos basicos.
- estabilizacion limitada a un intento por turno.
- perfiles guardados agregados al combate.
- servidor derivando equipo desde IDs de catalogo.
- spawn sin casillas duplicadas.
- habilidades demo.
- movimiento.
- Defensa total.
- Luchar a la defensiva.
- Carga.
- Prestar ayuda.
- AdO simple y multiples AdO.
- AdO que amenaza crítico (flujo completo).
- cancel-attack-threat aplica normalDamage.
- Natural 1 falla aunque total supere CA (attack-rules.test.mjs).
- Natural 20 amenaza crítico aunque total no supere CA (attack-rules.test.mjs).
- Ataque ordinario sigue usando total vs CA (attack-rules.test.mjs).
- Log diferenciado de natural 1/20 vs fallo ordinario.
- Validación Zod de comandos WebSocket (4 casos).

## Pendiente de automatizar

- Multiplicador de daño crítico x2/x3/x4 como test unitario.
- Expiración de buff por turno como test unitario.
- Límite de 1 AdO por criatura por ronda.
- CombatRulesSnapshot auto-verificación de campos vs CombatRoom.
- Pruebas end-to-end de UI con navegador para `/profiles`.
- Pruebas visuales de overlays/paneles.
- Tests de flanqueo, cobertura y condiciones.

Ver [docs/testing-coverage-report.md](./testing-coverage-report.md) para el análisis completo.

## Resultados ejecutados - 2026-07-04

- npm.cmd run typecheck: OK.
- npm.cmd run build: OK.
- Web typecheck: OK.
- Server typecheck: OK.
- Vite production build: OK.
- Server TypeScript build: OK.

## Cambios verificados en esta pasada

- Existe comando de servidor para usar habilidades.
- Cure Light Wounds cura mediante boton Usar y consume accion estandar.
- Haste aplica buff simple de ataque y velocidad.
- Magic Missile aplica dano manual.
- Secciones de arma, caracteristicas, habilidades, panel GM y AdO son colapsables.
- Imports del paquete shared corregidos para NodeNext.

## Resultados ejecutados - actualizacion colapsables y reglas de jugador

- npm.cmd run typecheck: OK.
- npm.cmd run build: OK.
- scripts/e2e-websocket.mjs: OK.
- Crear sala por WebSocket: OK.
- Spawnear Bane, Cedrick, Ranger y 3 Canocrock sin casillas duplicadas: OK.
- Iniciativa deja a Cedrick activo: OK.
- Cure Light Wounds cura 8 HP por comando de habilidad: OK.
- Movimiento a casilla ocupada se bloquea: OK.
- Jugador no puede agregar enemigos: OK.
- Jugador no puede controlar enemigos: OK.

## No ejecutado todavia / deuda

- Clicks reales en navegador con Playwright/Chromium: no ejecutado porque Playwright no esta instalado como dependencia del proyecto y el runtime interno no pudo cargarlo por permisos sobre la carpeta de Codex.
- Verificacion visual por screenshot de colapsables, tablero y log: pendiente.
- Pruebas multi-ventana reales GM/jugador: pendiente.
