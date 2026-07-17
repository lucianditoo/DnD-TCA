# ADR-0001: Server Authoritative Combat State

## Estado

Aceptado

## Contexto

El combate tactico necesita reglas consistentes para todos los participantes. Si cada cliente decide resultados, movimiento, danio o estado, aparecen desincronizaciones, trampas accidentales y bugs dificiles de reproducir.

## Decision

El servidor es la autoridad del estado de combate.

Los clientes envian comandos. El servidor valida permisos, reglas y estado actual; luego muta la sala y emite actualizaciones por WebSocket.

Para ataques de aptitud, el cliente solo identifica la acción y entrega las tiradas permitidas por el contrato. El servidor deriva `attackType`, característica de ataque, alcance, crítico y CA objetivo desde el catálogo. El payload público no puede seleccionar `targetAcType`.

## Alternativas consideradas

- Cliente autoritativo: mas simple para prototipos, pero fragil en multiplayer.
- Estado distribuido entre clientes: dificil de depurar y propenso a conflictos.
- Validar solo en UI: comodo, pero inseguro e insuficiente.

## Consecuencias

Beneficios:

- Una unica fuente de verdad para cada sala.
- Mejor control de permisos.
- Tests E2E mas confiables.
- Menos riesgo de estados divergentes.

Costos:

- Cada accion importante requiere validacion en servidor.
- La UI no puede resolver reglas complejas por su cuenta.
- Algunas interacciones requieren mas ida y vuelta por WebSocket.
