# Fase 3: vida, estabilizacion y acciones base

Fuente base: SRD 3.5, secciones Injury and Death y Actions in Combat.

## Implementado

- Estado estable separado de moribundo.
- Un personaje moribundo conserva su turno en iniciativa para resolver estabilizacion manual.
- La tirada de estabilizacion usa d100 ingresado por el usuario: 10 o menos estabiliza.
- Si falla la estabilizacion, pierde 1 HP.
- El dano recibido por un personaje con HP negativo lo vuelve inestable.
- Los personajes estables siguen inconscientes y no pueden actuar.
- El turno ahora registra accion de movimiento, accion estandar, accion de asalto completo, paso de 5 pies y accion swift.

## Pendiente

- Curacion manual y magica con transiciones entre estable, incapacitado y activo.
- Heal check DC 15 para estabilizar a otro personaje.
- Desangrado y recuperacion por hora fuera del combate.
- Acciones que provocan ataque de oportunidad sin movimiento: lanzar conjuros, beber pociones, levantarse, ataques a distancia, etc.
- Retirada/withdraw y excepciones de paso de 5 pies.
