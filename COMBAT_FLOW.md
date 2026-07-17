# Combat Flow

Este documento explica como fluye una partida. La guia principal es `CODEX_GUIDE.md`.

## Fases

El encuentro usa:

- `preparation`: carga y posicionamiento.
- `active`: combate en curso.
- `finished`: resultado final.

Y resultado:

- `ongoing`.
- `victory`.
- `tpk`.

## Preparacion

Objetivos:

1. Crear o unirse a una sala.
2. Agregar heroes/enemigos.
3. Colocar tokens.
4. Cargar iniciativas.
5. Iniciar combate.

Reglas:

- GM puede agregar enemigos y aliados/NPC controlados por GM.
- Jugadores pueden agregar heroes propios.
- El servidor asigna ownership; no confia en el cliente.
- La iniciativa ajena no puede ser modificada por jugadores.
- Al iniciar combate, el servidor valida iniciativas y participantes vivos.

## Inicio de Combate

Al ordenar/iniciar iniciativas:

1. El servidor valida que el combate pueda empezar.
2. Ordena `turnOrder`.
3. Cambia `phase` a `active`.
4. Crea `currentTurn`.
5. Selecciona automaticamente al combatiente activo.
6. La UI vuelve a modo `Ver`.

## Turno Activo

Durante `active`, normalmente solo actua el combatiente actual.

`currentTurn` registra:

- movimiento usado.
- accion de movimiento.
- accion estandar.
- ataque completo.
- paso de 5 ft.
- accion rapida.
- defensa total.
- estabilizacion.

El servidor valida que el participante controle al combatiente antes de aceptar comandos.

## Acciones

### Mover

UI:

1. El usuario elige `Mover`.
2. La UI muestra casillas verdes.
3. El usuario dibuja una ruta paso a paso.
4. Confirma movimiento.

Servidor:

1. Valida turno, ownership y fase.
2. Valida ruta.
3. Calcula coste.
4. Detecta AdO.
5. Aplica movimiento o deja AdO pendientes.
6. Actualiza turno y estadisticas.

### Atacar

UI:

1. El usuario elige `Atacar`.
2. La UI muestra amenaza melee y rango.
3. El usuario elige objetivo por lista o token.
4. Define d20/danio manual o automatico.
5. Confirma.

Servidor:

1. Valida turno, ownership y accion disponible.
2. Valida alcance.
3. Genera AdO si corresponde.
4. Resuelve ataque y danio.
5. Actualiza estadisticas.
6. Revisa fin de combate.

### Habilidad

Implementado en demo:

- Cure Light Wounds.
- Haste.
- Magic Missile simple.

Servidor valida objetivo, alcance y accion antes de aplicar efecto.

### Tacticas

Implementado:

- Defensa total.
- Carga.
- Prestar ayuda.

Cada tactica tiene validaciones propias en servidor.

## Ataques de Oportunidad

Cuando se generan:

1. Se agregan a `pendingOpportunityAttacks`.
2. Se loguean.
3. El flujo normal queda bloqueado.

Mientras hay AdO pendientes, solo deben permitirse:

- resolver AdO.
- limpiar AdO como GM.
- mover tokens como GM.

Resolucion:

1. Buscar el AdO.
2. Usar snapshot de atacante/objetivo en la casilla relevante.
3. Resolver ataque.
4. Si impacta y hace danio, el objetivo vuelve a origen.
5. Si falla o no hace danio, completa destino.
6. Borrar solo ese AdO.
7. Mantener otros AdO pendientes si existen.

## Fin de Turno

Comando: `end-turn`.

Servidor:

1. Verifica que no haya AdO pendientes.
2. Valida ownership o permisos GM.
3. Expira buffs que terminan al final del turno saliente.
4. Avanza al siguiente combatiente valido.
5. Aumenta ronda si corresponde.
6. Expira buffs de inicio de turno.
7. Crea nuevo `currentTurn`.
8. Loguea el cambio.

UI:

- selecciona automaticamente al nuevo activo.
- vuelve a `Ver`.
- limpia rutas/objetivos temporales.

## Estabilizacion

Un combatiente moribundo puede intentar estabilizarse segun el flujo implementado.

Regla actual:

- solo un intento de estabilizacion por combatiente por turno.

## Fin de Combate

Se revisa despues de cambios relevantes:

- danio.
- curacion/estado.
- ataque.
- habilidad.
- controles GM.

Condiciones:

- si no quedan enemigos vivos/activos: `victory`.
- si no quedan heroes vivos/activos: `tpk`.

Al terminar:

- `phase = finished`.
- se limpian AdO pendientes.
- UI muestra estadisticas.

## Estados A Vigilar

- AdO viejo pendiente.
- Buff expirado que sigue sumando.
- Accion fuera de turno.
- Jugador controlando token ajeno.
- Ruta de movimiento visible despues de cambiar de modo.
- Token en casilla ocupada.
- Valores derivados enviados por cliente como si fueran verdad.

