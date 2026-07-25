# DO_NOT_BREAK — Reglas no negociables

Antes de escribir una sola línea de código, revisá esta lista. Romper cualquiera de estas reglas invalida la arquitectura del motor.

## 1. El servidor es autoritativo
El servidor dicta la verdad. El cliente manda "intenciones" (comandos), el servidor las valida, ejecuta y envía el nuevo estado. Nunca confíes en un dato crítico que venga del cliente si podés calcularlo en el servidor.

## 2. El cliente no decide ownership
La regla de quién controla a quién (`requireCombatantControl` en `control.ts`) la define el servidor. Un payload malicioso que intente mover un monstruo siendo jugador debe rebotar en la capa de auth.

## 3. El cliente no envía stats derivados
El cliente no le dice al servidor "tengo +5 de ataque". El servidor recibe "id de arma", consulta el `EquipmentCatalog`, toma el BAB del perfil y calcula el `totalAttackBonus`.

## 4. `EquipmentCatalog` es la fuente de verdad
Toda arma, armadura o escudo vive en `packages/shared/src/equipmentCatalog.ts`. Los combatientes solo guardan el ID del equipo.

## 5. Todo combatiente declara fuentes V3 completas
No existen estadísticas escalares manuales como vía alternativa. Todo perfil o template debe declarar características, tamaño, tipo de criatura, features, equipo explícito (aunque sus slots sean `null`), defensa intrínseca y anatomía aplicable. La creación del snapshot deriva sus estadísticas y debe fallar de forma descriptiva ante fuentes ausentes o referencias de catálogo inválidas; nunca estimar ni aplicar fallbacks silenciosos.

## 6. Daño mínimo 1 en impactos
Un ataque físico que impacta siempre hace al menos 1 de daño base. (Esto puede cambiar en el futuro cuando se implemente Damage Reduction, pero por ahora es regla de oro).

## 7. Cero reglas en la UI
React (`apps/web`) puede mostrar previews, pero debe consumir las mismas
proyecciones puras de `packages/shared` que usa el servidor. Nunca decide la
legalidad final ni mantiene una fórmula paralela.

## 8. Funciones puras para reglas
La matemática y las proyecciones reutilizables viven en funciones puras de
`packages/shared`; los resolvers reciben contexto ya construido y no mutan la
sala. Los Command Handlers del servidor orquestan consecuencias y commit.
DT-001 está resuelta: `attackResolver.ts` es puro. Toda transición de fase
debe pasar por `syncEncounterPhase(room)`.

## 9. No cambiar WebSocket sin diseño
Cualquier cambio a `ClientCommand` o `ServerMessage` afecta a clientes, servidor, E2E y validación Zod. Nunca cambiar este contrato sin pasar por Fase 2 (Diseño).

## 10. Validación temprana (Zod)
Todo comando que llega por WebSocket debe pasar por `validateClientCommand.ts` antes de llegar al dispatcher.

## 11. Todo bug = test de regresión
Si encontrás un bug importante de lógica, escribí un test unitario que falle reproduciendo el bug, y luego arreglalo para que el test pase.

## 12. No borrar tests para "pasar" el build
Los tests que fallan exponen deuda técnica o regresiones. Si una mecánica nueva rompe un test viejo, el diseño de la mecánica es incorrecto o el test debe evolucionar de forma justificada en un walkthrough. ¡Nunca borrar ni usar `test.skip` para ocultarlo!
