# Diseño: Flanqueo (Flanking) y Amenaza (Threatening)

> **Estado:** supersedido por [`flanking-and-threatening-design.md`](./flanking-and-threatening-design.md) y la implementación validada de Sprint 011. Este archivo conserva el corte histórico inicial; no es el contrato vigente para `ThreatProfile`, `NO_THREAT` ni el contexto tipado melee/ranged.

## 1. Objetivo
Incorporar la mecánica de flanqueo de D&D 3.5 en el combate táctico. Dos aliados que flanquean a un enemigo reciben +2 a las tiradas de ataque cuerpo a cuerpo. Al mismo tiempo, sentar las bases para todas las mecánicas que requieran conciencia espacial introduciendo el concepto de amenaza de manera limpia y reutilizable.

## 2. Reglas oficiales D&D 3.5
- **Cuándo flanquean**: Dos criaturas flanquean cuando ambas amenazan al mismo objetivo y se ubican en lados o esquinas exactamente opuestos del espacio de dicho objetivo.
- **Cuándo no flanquean**: Si no están en lados opuestos, o si alguna de las criaturas no amenaza al objetivo.
- **Armas a distancia**: Los ataques a distancia no reciben el bono por flanqueo. Un aliado armado exclusivamente a distancia no amenaza y, por lo tanto, no proporciona flanqueo.
- **Ataques de oportunidad**: El bono de flanqueo aplica también a ataques de oportunidad si las condiciones espaciales se mantienen en ese momento.

## 3. Capas del Motor Afectadas
- ✔ Amenaza (Threat)
- ✔ Ataque (Contexto Táctico)
- ✔ Modificadores

## 4. Conceptos Reutilizables Introducidos
**Sí.** Se introduce el concepto de "Amenaza" y el "Contexto Táctico" de un ataque.
Este concepto de amenaza (`threatensTarget`) servirá a futuro como el cimiento obligatorio para: Ataques de Oportunidad, Armas con Reach, Combat Reflexes, Armas de Asta, y el 5-foot Step. Extraer esta regla ahora evitará acoplar lógica repetitiva en futuras mecánicas. El Contexto Táctico permite agrupar modificadores previos al ataque sin contaminar los resolvers matemáticos.

## 5. Amenaza: threatensTarget
Firma: `export function threatensTarget(room, attacker, target): boolean`
Reglas:
- El atacante está consciente (su `lifeStatus` no es "dying", "stable" ni "dead").
- El atacante usa un arma cuerpo a cuerpo (melee) o ataca desarmado.
- La distancia entre el atacante y el objetivo es menor o igual a `attacker.weapon.meleeReachFeet`.
- El objetivo pertenece a la facción contraria (`attacker.type !== target.type`).

## 6. Oposición 1x1
Firma lógica. Sean T (Target), A (Attacker) y B (Ally):
- `dxA = Math.sign(A.x - T.x)`
- `dyA = Math.sign(A.y - T.y)`
- `dxB = Math.sign(B.x - T.x)`
- `dyB = Math.sign(B.y - T.y)`

Existen en lados opuestos si `dxA === -dxB` y `dyA === -dyB` (y al menos uno de los ejes es distinto de cero).

## 7. Flanqueo: isFlanking
Firma: `export function isFlanking(room, attacker, target): boolean`
Reglas:
- Verifica que `threatensTarget(room, attacker, target)` sea verdadero.
- Itera sobre los aliados del atacante y verifica si existe al menos uno donde `threatensTarget(room, ally, target)` sea verdadero y se cumpla la fórmula de *Oposición 1x1* entre atacante y aliado respecto al objetivo.

## 8. Contexto táctico: getAttackContextModifiers
Firma: `export function getAttackContextModifiers(room, attacker, target): { attackBonus: number; labelParts: string[] }`
Reglas:
- Evalúa modificadores espaciales, como flanqueo.
- Si `isFlanking` es verdadero, añade `2` a `attackBonus` e incluye `"flanqueo +2"` en `labelParts`.

## 9. Separación de responsabilidades
- `attackResolver.ts` NO calcula flanqueo.
- `attackResolver.ts` NO importa `isFlanking`.
- `attackResolver.ts` NO recorre combatientes.
- `attackResolver.ts` solo recibe un `attackModifier` numérico general inyectado desde afuera.
- `getAttackContextModifiers` es invocado por `attackCommands.ts` antes de la resolución matemática.
- `ActionsPanel` (React frontend) utiliza la helper `getAttackContextModifiers` únicamente para renderizar *previews*, sin recalcular posiciones del grid.

## 10. Archivos a modificar
- `packages/shared/src/rules.ts`: Definición de `threatensTarget`, `isOpposite1x1`, `isFlanking`, y `getAttackContextModifiers`.
- `apps/server/src/commands/attackCommands.ts`: Lectura del contexto táctico previo e inyección del bono numérico en `resolveAttack`.
- `apps/web/src/components/ActionsPanel.tsx`: Uso del contexto táctico para UI visual.
- `tests/flanking.test.mjs`: Archivo nuevo con casos de prueba.

## 11. Tests propuestos
- **Unitarios (`flanking.test.mjs`)**:
  - Norte / Sur flanquea.
  - Este / Oeste flanquea.
  - Diagonal NE / SW flanquea.
  - Norte / Este NO flanquea.
  - Aliado dead no proporciona flanqueo (test individual).
  - Aliado dying no proporciona flanqueo (test individual).
  - Aliado stable no proporciona flanqueo (test individual).
  - Atacante ranged no recibe flanqueo.
  - Aliado ranged no proporciona flanqueo.
  - Daga (thrown) a distancia cuerpo a cuerpo amenaza (correctamente clasifica como melee).
  - Daga (thrown) lanzada a distancia ranged no amenaza (distancia > meleeReachFeet).
  - Target fuera de reach no flanquea.
  - Flanqueo agrega exactamente +2 al `attackBonus`.
  - Sin flanqueo retorna `attackBonus: 0`.
- **E2E WebSocket (`scripts/e2e-websocket.mjs`)**:
  - Simular dos aliados que rodean a un enemigo, realizar el ataque y validar en el output del server que el +2 fue aplicado matemáticamente y aparece en el log.

## 12. Simplificaciones aceptadas
- Solo se considera oposición matemática para criaturas 1x1. El soporte de tamaños grandes se abordará en futuras iteraciones.
- La línea de visión (LoS) y línea de efecto (LoE) se asumen libres para esta iteración de la función amenaza.
- **Armas arrojadizas (`thrown`) y flanqueo**: Una daga (`handedness === "thrown"`) puede usarse tanto como arma melee como lanzada. La función `threatensTarget` la clasifica como _capaz de amenazar_ si la distancia al objetivo es ≤ `meleeReachFeet` (5 ft), lo cual es correcto cuando el combatiente está adyacente. Si el combatiente lanza la daga a distancia, la posición no cambia en el contexto de evaluación, pero la distancia al objetivo superará `meleeReachFeet`, con lo cual `threatensTarget` devolverá `false` y el bono de flanqueo no se aplicará. Esta simplificación es segura en el modelo actual, donde `getAttackContextModifiers` se evalúa con las posiciones reales antes del ataque. Cuando se implemente cambio de modo de ataque (melee vs. ranged para armas duales) o el inventario de armas distinguido por slot, esta lógica deberá revisarse.

## 13. Riesgos
Ninguno de alto impacto. La separación matemática mantiene intacta la pureza de la resolución de daños. El cálculo iterativo para buscar aliados es mínimo (O(N) donde N es muy bajo).

## 14. Definition of Done
- Diseño aprobado antes de implementar.
- Código finalizado, sin duplicaciones, sin código muerto ni TODOs.
- `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs` y `npm run test:ui` finalizan correctamente.
- Sincronización documental de backlog (TODO.md, technical-debt.md, rules-coverage-checklist.md).
- Resumen emitido en `walkthrough.md`.
