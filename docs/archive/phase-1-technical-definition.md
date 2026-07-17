# Fase 1: definicion tecnica

## Entendimiento del producto

La aplicacion es una herramienta local para acelerar combates tacticos de D&D 3.5. No reemplaza al GM ni tira dados en la demo: los jugadores introducen tiradas manualmente y la app calcula, valida y explica resultados.

## Stack elegido

- Frontend: React + TypeScript + Vite.
- Backend: Node.js + TypeScript.
- Tiempo real: WebSocket con `ws`.
- Persistencia demo: memoria del servidor, preparada para migrar a JSON/SQLite.
- Monorepo: npm workspaces.

## Arquitectura

- `packages/shared`: contrato de dominio, eventos de red, reducers/reglas puras.
- `apps/server`: autoridad del estado de combate, salas, validacion de acciones, broadcast.
- `apps/web`: UI responsive para GM y jugador; no contiene reglas criticas duplicadas.

El servidor es la fuente de verdad. El cliente envia comandos intencionales, el servidor valida, actualiza estado y retransmite snapshots.

## Modelo inicial

- `CombatRoom`: sala con codigo, tablero, combatientes, turno y log.
- `Combatant`: personaje o enemigo con HP, CA, ataque, dano, velocidad, posicion y buffs.
- `Position`: `x`, `y`, `zFeet`; la demo muestra `x/y` y conserva altura para evolucionar.
- `Buff`: modificadores temporales extensibles.
- `Ability`: base simple para habilidades futuras.
- `TurnState`: movimiento usado, accion estandar, ataque completo y paso de 5 pies.
- `CombatLogEntry`: mensajes narrativos y mecanicos.

## Alcance exacto de la demo

Incluye sala local, tablero vacio, tokens, iniciativa manual, turnos, movimiento validado por velocidad, regla de paso de 5 pies, ataque manual contra CA, dano, HP, buffs simples y log.

No incluye autenticacion, persistencia en disco, terreno dificil, altura visual, sistema completo de hechizos ni tirada automatica.

## Roadmap

1. Fase 1: definicion tecnica y estructura.
2. Fase 2: base de monorepo, servidor, cliente y WebSocket.
3. Fase 3: modelo de combate compartido.
4. Fase 4: tablero y tokens.
5. Fase 5: acciones de turno.
6. Fase 6: calculos y validaciones.
7. Fase 7: log narrativo/matematico.
8. Fase 8: persistencia basica.
9. Fase 9: habilidades demo.

## Riesgos tecnicos

- Las reglas de D&D 3.5 pueden crecer rapido; deben quedar en modulos puros y testeables.
- Multiplayer local requiere autoridad clara; el servidor valida.
- La UI movil puede saturarse; el tablero y el turno actual tienen prioridad.
- La persistencia futura debe separar perfiles guardados del estado vivo de combate.
