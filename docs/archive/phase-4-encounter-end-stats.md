# Fase 4: cierre de encuentro y estadisticas

## Implementado

- El combate ahora tiene resultado: ongoing, victory o tpk.
- Si todos los enemigos llegan a muerto, se marca Victoria.
- Si todos los heroes llegan a muerto, se marca TPK.
- Al terminar el combate se limpian ataques de oportunidad pendientes.
- El servidor bloquea nuevas acciones despues del cierre.
- Cada combatiente acumula estadisticas durante el encuentro.
- Pantalla final con resumen por bando y por combatiente.

## Estadisticas actuales

- Dano realizado.
- Dano recibido.
- Distancia recorrida.
- Ataques realizados.
- Impactos y fallos.
- Ataques de oportunidad realizados.
- Bajas causadas.
- Veces que cayo a 0 HP o menos.
- Curacion recibida queda preparada para futuras reglas de curacion.

## Pendiente

- Boton de nueva sala/revancha.
- Exportar resumen a JSON o texto para el GM.
- Diferenciar derrota por todos inconscientes versus TPK real.
- Estadisticas por jugador conectado cuando haya personajes personalizados.
