# ADR-0004: Permanent Profiles Are Separate From Combat State

## Estado

Aceptado

## Contexto

Un perfil representa una criatura/personaje persistente. Un combatiente representa una instancia dentro de una batalla. Mezclar ambos modelos vuelve dificil guardar personajes, reiniciar combates, calcular estadisticas finales o aplicar efectos temporales.

## Decision

Los perfiles permanentes y el estado de combate deben mantenerse separados.

El editor de perfiles vive fuera de la pantalla de combate. Al agregar un perfil a una sala, el servidor crea una instancia de combatiente con ownership, posicion, HP actual, iniciativa, buffs y estadisticas propias del encuentro.

La primera version tecnica de esa instancia se llama `CombatantSnapshot`. `Combatant` sigue existiendo como alias compatible para no romper el contrato WebSocket actual.

Desde Sprint 010, el perfil V2 conserva únicamente fuentes mecánicas explícitas. CA, modificador de ataque, daño y velocidad efectiva se derivan al crear el snapshot; `armorClassBreakdown` es obligatorio en combate. Perfiles legacy incompletos quedan en cuarentena y no se convierten mediante estimaciones.

## Alternativas consideradas

- Editar perfiles directamente dentro del combate: rapido, pero mezcla responsabilidades.
- Usar el perfil como combatiente vivo: hace que danio, buffs o muerte contaminen la plantilla permanente.
- Duplicar todo en ambos lados: aumenta riesgo de inconsistencias.

## Consecuencias

Beneficios:

- El combate no modifica accidentalmente el perfil permanente.
- Se pueden reutilizar perfiles en multiples encuentros.
- Las estadisticas finales pertenecen a la instancia de combate.
- El editor puede crecer sin ensuciar la UI tactica.
- Los tests pueden verificar que mutar HP, buffs, posicion o iniciativa del snapshot no altera el perfil.

Costos:

- Hace falta transformar perfil a combatiente.
- Hay que definir que campos son base, derivados o temporales.
- Cada evolución del perfil requiere una migración versionada y validada antes de admitir el dato a combate.
