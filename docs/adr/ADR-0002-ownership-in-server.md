# ADR-0002: Ownership Is Decided By The Server

## Estado

Aceptado

## Contexto

En multiplayer, cada jugador debe controlar solo sus propios heroes. El GM debe conservar permisos especiales. Si el cliente decide ownership, un jugador podria enviar comandos manuales para mover enemigos, terminar turnos ajenos o modificar iniciativas indebidas.

## Decision

El servidor asigna y valida ownership/control.

Cada combatiente conoce quien lo controla. Los comandos sensibles verifican permisos en servidor antes de modificar estado.

## Alternativas consideradas

- Confiar en botones ocultos/deshabilitados en UI: mejora experiencia, pero no es seguridad real.
- Enviar el controlador desde cliente y aceptarlo: permite manipulacion accidental o intencional.
- No modelar ownership hasta tener login real: bloquearia multiplayer correcto desde temprano.

## Consecuencias

Beneficios:

- Jugadores solo controlan sus heroes.
- GM puede controlar lo que corresponde al GM.
- Los tests pueden cubrir permisos con comandos manuales.
- El futuro login/autenticacion tiene una base clara.

Costos:

- Cada nuevo comando debe decidir si requiere ownership, GM o ambos.
- Los fixtures y tests deben crear participantes/controladores correctamente.

