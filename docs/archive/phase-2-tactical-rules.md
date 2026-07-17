# Fase 2: reglas tacticas base

Esta fase convierte la demo inicial en un asistente mas fiel a D&D 3.5 sin abandonar la regla principal del proyecto: las tiradas siguen siendo manuales.

## Implementado

- HP puede bajar por debajo de 0 hasta un minimo de -10.
- Estados derivados de HP: active, disabled, dying y dead.
- Los combatientes muertos o moribundos no pueden actuar.
- Un combatiente en 0 HP no puede hacer ataque completo.
- Un combatiente en 0 HP solo puede hacer movimiento o accion estandar basica durante el turno.
- Si actua estando en 0 HP, pierde 1 HP por esfuerzo y pasa a moribundo.
- El tablero detecta enemigos adyacentes.
- Si un combatiente se mueve mas de 5 pies desde una casilla amenazada, se crea un ataque de oportunidad pendiente.
- Los ataques de oportunidad se resuelven manualmente con d20 y dano ingresados por el usuario.
- Si el ataque de oportunidad impacta y hace dano, el objetivo vuelve a la casilla de origen.
- Si el ataque de oportunidad falla o no causa dano, el objetivo permanece en la casilla destino.
- El log registra cambios de estado, oportunidades, dano y calculos.

## Simplificaciones conscientes

- No se implemento todavia estabilizacion automatica ni tirada de estabilizacion.
- No se implemento perdida de 1 HP por ronda para moribundos.
- No se implementaron excepciones como withdraw, tumble, reach weapons, total defense o feats.
- No se implemento limite por cantidad de ataques de oportunidad por ronda.
- No hay confirmacion de criticos todavia.

## Siguiente paso sugerido

La proxima fase deberia cubrir estabilizacion, desangrado por ronda, curacion, acciones especiales para evitar ataques de oportunidad y un panel de GM para forzar/corregir estados.
