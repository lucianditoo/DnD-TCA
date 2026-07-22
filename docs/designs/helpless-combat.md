# COMBAT-HELPLESS y ACTION-COUP-DE-GRACE

## 1. Objetivo
Implementar la vertical oficial de combate contra oponentes indefensos (Helpless) de D&D 3.5. Esto abarca:
- La clasificación sistemática de un objetivo como indefenso.
- Las penalizaciones normativas a su CA (DEX 0 y penalizador melee).
- La viabilidad del Ataque Furtivo (Sneak Attack).
- La acción de asalto completo *Coup de Grace* (Golpe de gracia).

## 2. Fuentes Normativas
- **Reglamento oficial D&D 3.5 (SRD)**: Combate > Modificadores de Combate > Defensores Indefensos.
- **Fuente primaria local**: `combat/10_modificadores_de_combate.txt:90-93`.

## 3. Terminología
- **Indefenso (Helpless)**: Combatiente paralizado, atado, durmiendo, inconsciente (incluye moribundos), o a merced total del oponente. 
- **Coup de Grace (Golpe de Gracia)**: Acción de asalto completo para rematar a un objetivo indefenso adyacente. Asegura impacto, crítico y puede forzar la muerte inmediata si el objetivo falla su salvación de Fortaleza.

## 4. Clasificación Helpless
Actualmente, el sistema utiliza `lifeStatus` para el ruteo de movimiento y define el trait `HELPLESS` en efectos como `srd_unconscious` y `srd_paralyzed`.
**Decisión arquitectónica**: Toda consecuencia defensiva debe consultar exclusivamente el trait `HELPLESS` tras la proyección de modificadores y, dinámicamente, el `lifeStatus` (si es `dying`, `stable` o `dead`).

## 5. Ataques Normales y Defensa
**Normativa RAW**: 
- Un defensor indefenso tiene su Destreza tratada como 0 (Modificador -5). 
- Contra ataques cuerpo a cuerpo (melee), sufre un penalizador adicional de -4 a la CA (+4 al ataque del oponente). 
- Contra ataques a distancia (ranged), no aplica este penalizador de -4.

**Estado Actual**:
- `attackResolver.ts` aplica `helplessBonus` (+4 a ataques melee). 
- **Bug/Deuda**: El trait `HELPLESS` no remueve bonificadores de Destreza a la CA nativamente en `rules.ts`. `srd_paralyzed` impone `DEXTERITY 0`, pero `srd_unconscious` no, dejando inconsistencias en la pérdida de la Destreza. 

**Solución Propuesta**:
El pipeline de `totalArmorClass` deberá detectar `HELPLESS` y forzar `suppressDexAndDodge = true`, sumando además el diferencial hacia un penalizador de Destreza fijo de -5 (DEX 0), sin importar la destreza base, de forma puramente declarativa.

## 6. Ataque Furtivo (Sneak Attack)
**Normativa RAW**: "Los pícaros aplican también el daño adicional de sus ataques furtivos cuando dan el golpe de gracia a un oponente indefenso" (o en ataques normales).
**Estado Actual**: `canApplySneakAttack` evalúa `NO_DEX_TO_AC` y flanqueo. Un objetivo con `HELPLESS` no activa el Sneak Attack salvo que también tenga `NO_DEX_TO_AC` o esté flanqueado. 
**Solución Propuesta**: Incluir `HELPLESS` explícitamente como habilitador en `canApplySneakAttack` (el blanco pierde su bonificador de Destreza a la CA). Concealment y critical immunity seguirán bloqueándolo, lo cual es RAW.

## 7. Coup de Grace
**Regla oficial (`combat/10_modificadores_de_combate.txt:93`)**:
- Acción de asalto completo (Full-round action).
- Armas permitidas: melee, o arco/ballesta si se está **adyacente**.
- Consecuencia: Impacto automático y **Golpe crítico** automático. Daño furtivo si corresponde.
- Fortaleza: Si sobrevive al daño, debe pasar Fortaleza (CD 10 + el daño sufrido) o morir.
- Restricciones: Provoca Ataques de Oportunidad (AdO). 
- **Inmunidades**: No realizable contra objetivos inmunes a críticos. (No hay discrepancia: tanto nuestro txt como el SRD dicen que simplemente "no se puede dar un golpe de gracia" a golems/constructos).

## 8. Economía de Acciones
Implementar `handleCoupDeGrace` en `tacticalCommands.ts` análogo a `handleCharge`. Exigirá consumo de `full-round` action.

## 9. Alcance y Armas
Se validará que el atacante posea un arma melee que alcance al objetivo, o un arma a distancia y se encuentre estrictamente adyacente (distancia <= 5 ft).

## 10. Crítico Automático
Se creará una proyección de ataque especial o se reutilizará `resolveAttack` puenteando la tirada de d20 (ej. pasando artificialmente `d20Roll = 20` o forzando un flag). Para conservar la pureza de `attackResolver.ts`, el `d20Roll` se pasará como 20, pero se debe añadir un flag `isAutomaticCritical` o tratar el resultado mediante `resolveCriticalConfirmation` pasando `confirmD20Roll = 20`.

## 11. DamageBundle
El DamageBundle resultante contendrá el multiplicador del arma más cualquier dado extra de daño masivo y Sneak Attack (fiel al `attackResolver.ts` actual).

## 12. Fortitude y Muerte
Se extenderá `tacticalCommands.ts` para que, posterior a `applyDamage(target, finalDamage)`, si el objetivo sigue con vida (`hpCurrent >= 0` o `dying/stable`), resuelva un `resolveSavingThrow` de Fortaleza con `DC = 10 + finalDamage`. 
Si falla, se forzará su transición al estado `dead` con un `logStatusChange`. La mutación atómica se resolverá sincrónicamente (no habrá fase de espera del usuario para la tirada de salvación, la tira el servidor autoritativamente).

## 13. Immunidades
Pre-flight check: Si el objetivo posee `IMMUNE_TO_CRITICAL_HITS`, se rechaza el comando `coup-de-grace` completamente antes de mutar.

## 14. AdO y Fases
Como las acciones en el motor actual rechazan e interrumpen el flujo si hay AdO pendiente, `handleCoupDeGrace` identificará amenazas. Si hay amenazas que pueden realizar AdO, llenará `room.pendingOpportunityAttacks` y **retornará**. El jugador deberá sobrepasar el AdO y re-hacer clic en Coup de Grace (patrón ya utilizado por `handleCastSpell` y `movementCommands`).

## 15. Pipeline
- **Intención**: ClientCommand `coup-de-grace`.
- **Preflight**: Validar turno, arma, adyacencia, inmunidad a crítico, `HELPLESS`.
- **AdO**: Chequear provocación. Si hay AdO, abortar mutación, poblar `pendingOpportunityAttacks`.
- **Proyección**: Impacto automático (resolver base y crítico directo).
- **Consecuencias**: `applyDamage`. Calcular CD. `resolveSavingThrow(fortitude)`. Aplicar muerte si corresponde.
- **Commit**: Broadcast `room`.

## 16. UI
- Botón "Coup de Grace (Asalto Completo)" visible en la barra de acciones sobre objetivos seleccionados indefensos.
- Advertencia visual "Provoca AdO".

## 17. Compatibilidad Legacy
Evitaremos depender del cálculo de `lifeStatus` para AC dentro del resolver de forma harcodeada; delegamos la responsabilidad a traits o a detectores puros.

## 18. Rule IDs
Se propondrán 2 Rule IDs al Registry:
- `COMBAT-HELPLESS`: Abarca penalizaciones AC, Sneak Attack y el rasgo general.
- `ACTION-COUP-DE-GRACE`: Abarca exclusivamente la acción, el crítico y la Fortitude.

## 19. Alcance Fuera del Sprint
- Targeting indirecto o por casillas adivinando en total concealment. Las reglas indican 2 asaltos completos si hay concealment total (uno para encontrar, uno para rematar); el sistema requerirá que el jugador elija el objetivo visible (lo que implica que ya superó el concealment total o no aplica).

## 20. Opción Recomendada
**Opción A (Helpless Combat completo)**. La arquitectura actual es lo suficientemente madura como para sostener la lógica defensiva y la acción de Coup de Grace. La infraestructura de AdO (cancelar-y-reintentar), el motor de Sneak Attack y el motor de salvaciones autoritativas ya pueden cubrir todo el espectro normativo sin reingeniería pesada.

## 21. Definition of Done
- `Rules.totalArmorClass` impone DEX 0 y suprime bonos a Helpless.
- `canApplySneakAttack` permite furtivos contra Helpless.
- Nuevo comando táctico `coup-de-grace`.
- Resolución asíncrona (si provoca AdO) alineada a `cast-spell`.
- Resolución atómica de Daño -> Salvación (CD 10+daño) -> Muerte.
- Unit Tests completos para el pipeline de Helpless.
