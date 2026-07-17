# Fase 10: habilidades accionables y panel derecho colapsable

## Implementado

- Se agrego el comando use-ability al protocolo cliente-servidor.
- Las habilidades ahora tienen boton Usar en la ficha del personaje.
- Cure Light Wounds cura al objetivo elegido usando el valor de Curacion.
- Haste aplica un buff simple: +1 ataque y +10 ft velocidad por 5 turnos.
- Magic Missile aplica dano manual usando el campo Dano.
- Usar una habilidad consume accion estandar.
- Si el personaje esta en 0 HP, usar habilidad aplica la perdida de 1 HP por esfuerzo.
- Arma y reglas, caracteristicas, habilidades, panel GM y ataques de oportunidad ahora son secciones colapsables.
- Se corrigieron exports/imports del paquete shared para que el typecheck del server funcione con NodeNext.

## Pendiente

- UI especifica por tipo de habilidad, con campos propios para dano, curacion, tiradas de salvacion y duraciones.
- Slots de conjuros, preparacion diaria y consumo de recursos.
- Concentracion, ataques de oportunidad por lanzar conjuros y reglas de conjurar defensivamente.
- Automatizar pruebas end-to-end con navegador.
