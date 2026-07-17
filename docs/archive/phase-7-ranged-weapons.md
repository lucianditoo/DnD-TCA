# Fase 7: armas arrojadizas y ataques a distancia

## Implementado

- Bane ahora usa dagas arrojadizas como perfil de arma.
- Las dagas de Bane pueden atacar adyacente o lanzarse hasta 50 ft en la demo.
- Se agrego Elaen, un ranger demo con arco largo.
- El arco largo tiene alcance maximo de 1000 ft en la demo y usa Destreza para impactar.
- La ficha muestra alcance maximo del arma y distancia al objetivo seleccionado.
- El servidor valida el alcance antes de resolver un ataque.
- El log de ataque muestra la distancia al objetivo.

## Simplificaciones actuales

- Los penalizadores por incremento de alcance y los ataques de oportunidad por ataques a distancia se implementaron en la Fase 8.

- Todavia no se distingue una accion de cambiar arma/equipamiento.
- Todavia no se consume municion.
- Las dagas de Bane estan modeladas como perfil del personaje, no como inventario de objetos independientes.

## Siguiente paso sugerido

Crear inventario/equipamiento real: armas equipadas, armadura, escudo, municion, consumibles y cambio de arma. Eso permitiria que Bane elija entre atacar con daga en melee o lanzar una daga, y que el ranger administre flechas y bonificadores de arco.
