# Fase 9: una criatura por casilla

## Implementado

- Al agregar un combatiente demo, el servidor revisa si su casilla inicial esta libre.
- Si la casilla esta ocupada, busca la casilla libre mas cercana al punto inicial.
- Si una sala vieja ya tenia combatientes superpuestos, el servidor los reubica automaticamente en casillas libres cercanas al recibir una accion.
- El log indica la casilla en la que entra cada nuevo combatiente.
- La regla de movimiento ya impedia entrar a una casilla ocupada; ahora el spawn respeta la misma idea.

## Pendiente

- Herramienta visual para que el GM elija manualmente la casilla inicial al crear un enemigo.
- Zonas de despliegue para heroes y enemigos.
- Criaturas grandes que ocupan mas de una casilla.
