# Fase 5: panel GM y curacion manual

## Objetivo

Darle al GM herramientas para corregir la mesa sin romper el flujo del combate. Las reglas siguen validando por defecto, pero el GM puede intervenir cuando haya una excepcion, una regla casera o una situacion aun no modelada.

## Implementado

- Curacion manual sobre el combatiente seleccionado.
- La curacion no revive muertos por defecto.
- Curar a un moribundo lo vuelve estable si sigue por debajo de 0 HP.
- Curar hasta 0 HP lo deja incapacitado.
- Curar a 1 HP o mas lo devuelve a activo.
- La curacion recibida se suma a estadisticas del encuentro.
- Panel GM para ajustar HP actual y HP maximo.
- Panel GM para forzar estado: activo, incapacitado, moribundo, estable o muerto.
- Panel GM para limpiar ataques de oportunidad pendientes.
- Panel GM para agregar notas al log.
- Panel GM para forzar Victoria o TPK.

## Pendiente

- Boton para reabrir un combate terminado desde pantalla final.
- Heal check DC 15 para estabilizar a otro personaje.
- Hechizos de curacion con alcance, objetivo y consumo de accion.
- Diferenciar curacion magica, descanso y primeros auxilios.
