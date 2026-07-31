# Rules Engine

Este documento resume la separacion entre datos, reglas y UI. La guia principal es `CODEX_GUIDE.md`.

## Principio Central

El proyecto debe separar:

- Datos: catalogos y perfiles.
- Reglas: funciones puras compartidas y resolucion autoritativa del servidor.
- Presentacion: UI, overlays, formularios y feedback.

La UI puede guiar. El servidor decide.

## Ubicacion

Compartido:

- `packages/shared/src/types.ts`
- `packages/shared/src/rules.ts`
- `packages/shared/src/equipmentCatalog.ts`
- `packages/shared/src/equipmentStats.ts`
- `packages/shared/src/combatSnapshot.ts`

Servidor:

- `apps/server/src/combat`
- `apps/server/src/commands`
- `apps/server/src/auth/control.ts`

Datos:

- `packages/shared/src/data/equipment`
- `packages/shared/src/data/creatures.json`
- `packages/shared/src/data/abilities.json`

## Catalogos

### EquipmentCatalog

`EquipmentCatalog` es la API oficial para consultar:

- armas simples,
- armas marciales,
- armas exoticas,
- armaduras,
- escudos.

No acceder directamente a arrays del catalogo desde UI o servidor.

Los perfiles guardan IDs:

- `mainWeapon`
- `offHand`
- `armor`
- `shield`

Los datos completos se derivan desde el catalogo.

## Estadisticas Derivadas

Las estadisticas derivadas deben calcularse desde:

- estadisticas base,
- IDs de catalogo,
- reglas.

Ejemplo:

- `baseSpeedFeet`: input editable.
- `speedFeet`: output derivado.

Reglas importantes:

- Nunca usar una estadistica derivada anterior como input del siguiente calculo.
- **Derivación obligatoria de estadísticas**: `damageBase`, `armorClass`, `attackModifier` y `speedFeet` se derivan siempre desde características, tamaño, defensa intrínseca y referencias catalogadas. Las criaturas con ataques naturales declaran un `naturalAttackId`; no existen estadísticas manuales de respaldo.
- **Daño Mínimo**: Cualquier ataque físico exitoso (que impacta) aplica como mínimo **1 punto de daño**, incluso si el daño base o los penalizadores redujeran el daño a 0 o menos, mientras no se implemente Damage Reduction (DR), inmunidades o absorciones.
- **CA Desglosada**: Los perfiles/snapshots estructurados conservan `armorClassBreakdown`. `totalArmorClass` proyecta Normal, Touch y Flat-Footed sin mutar el snapshot. Touch ignora bonus positivos de armor/shield/natural armor; Flat-Footed ignora Destreza positiva y dodge, conservando penalizadores.
- **Integridad de CA**: no existe fallback a `armorClass` plano. Todo snapshot debe incluir un `armorClassBreakdown` estructurado derivado de fuentes V2; la ausencia de cualquier componente provoca un error descriptivo.

## CombatSnapshot

La primera version esta implementada como `CombatantSnapshot`.

Reglas actuales:

- Un perfil permanente se convierte en snapshot al entrar a una sala.
- El snapshot puede cambiar durante el combate.
- El perfil original no debe mutar.
- El servidor asigna ownership.
- Los valores derivados enviados por cliente se recalculan desde IDs de catalogo.
- El desglose de CA se copia defensivamente y las reglas lo consumen sin consultar la UI.

Helper principal:

`createCombatantSnapshotFromProfile`

Ubicacion:

`packages/shared/src/combatSnapshot.ts`

## Reglas Implementadas

### Tablero

- Tablero rectangular (V1 clásico).
- Casilla de 5 ft.
- Ocupación volumétrica / espacial. (La regla de "una criatura/token por casilla" ha sido supersedida por soporte de múltiples superficies y prismas corporales en `spatial-engine-2.5d.md`).
- No se permite destino ocupado (salvo en distintas elevaciones de superficie según NDD).

### Movimiento

- Ruta paso a paso.
- Diagonal 5/10/5/10 ft.
- No repetir casillas en la misma ruta.
- Paso de 5 ft.
- Movimiento GM separado, sin AdO ni consumo de turno.

Pendiente:

- terreno dificil.
- esquinas.
- movimiento por aliados.
- criaturas grandes.
- escurrirse.
- movimiento vertical.

### Ataques

- Ataque simple.
- Ataque completo.
- Luchar a la defensiva.
- D20 manual/automatico.
- Danio manual/automatico.
- Alcance melee por arma.
- Alcance distancia por incrementos.
- Penalizador por incremento de rango.
- Fuerza y media en armas a dos manos donde aplica.
- CA contextual Normal/Touch/Flat-Footed mediante dimensiones ortogonales de `AttackContext`.
- `resolveAttack` puede seleccionar Touch AC solo mediante una opción interna del servidor.
- Amenaza cuerpo a cuerpo derivada desde `ThreatProfile`, con estado vital, facción, `NO_THREAT` y alcance compartidos por flanqueo y AdO.
- Flanqueo 1×1 por oposición exacta: +2 circunstancial solo para ataques melee; ranged recibe siempre +0.
- Contexto táctico calculado antes del resolver mediante `getAttackContextModifiers`; `attackResolver.ts` no conoce geometría.

Pendiente:

- criticos.
- 1 natural y 20 natural.
- cobertura.
- linea visual.
- tamanio.
- condiciones.
- resistencias/reducciones.

### Danio y Vida

- Aplicar danio.
- HP minimo -10.
- Muerte a -10.
- Estados active/disabled/dying/stable/dead.
- Estabilizacion limitada a un intento por turno.
- Estadisticas de danio hecho/recibido.

Pendiente:

- danio no letal.
- sangrado por ronda.
- transiciones completas de curacion.

### Buffs

Implementado:

- Haste.
- Defensa total.
- Luchar a la defensiva.
- Carga.
- Prestar ayuda.
- Buffs demo existentes en datos.

Pendiente:

- tipos de bonus.
- stacking por tipo.
- concentracion.
- duraciones reales por nivel/ronda.

### Ataques de Oportunidad

Implementado:

- movimiento que abandona amenaza.
- ataque a distancia amenazado.
- zona amenazada reutiliza `threatensTarget` y fuentes melee derivadas en lugar de asumir mera adyacencia.
- bloqueo de flujo con AdO pendientes.
- multiples AdO.
- resolucion contra casilla/snapshot.
- defensa total impide hacer AdO.

Pendiente:

- limite por ronda.
- Combat Reflexes.
- mas acciones que provocan.
- armas con alcance complejo.

### Tacticas

Implementado:

- Defensa total.
- Carga.
- Prestar ayuda.

Pendiente:

- derribar.
- desarmar.
- embestida.
- arrollar.
- presa.
- finta.
- combatir con dos armas.

### Habilidades y Conjuros

Implementado demo:

- Cure Light Wounds.
- Haste.
- Magic Missile simple.
- Shocking Grasp como ataque de toque cuerpo a cuerpo autoritativo.
- Ray of Frost como ataque de toque a distancia autoritativo.
- Catálogo discriminado entre daño automático, tirada de ataque, curación y efecto.
- Slots preparados individuales derivados al snapshot y consumidos por el servidor.
- CD dinámica mediante nivel de conjuro y característica mental efectiva.
- Salvaciones automáticas de Fortaleza, Reflejos y Voluntad con 1/20 natural.
- Consecuencias declarativas `half` y `negates`, con resolución transaccional y log desglosado.

Pendiente:

- resistencia a conjuros.
- componentes.
- concentracion.
- áreas y múltiples objetivos.
- Evasion/Improved Evasion y salvaciones periódicas.
- carga retenida de conjuros de toque y ataques de oportunidad por lanzamiento.

## Testing De Reglas

Actual:

- `tests/equipment-stats.test.mjs` cubre persistencia, equipo y derivados.
- `scripts/e2e-websocket.mjs` cubre flujos de combate, permisos y regresiones clave.

Cada nueva regla importante debe tener:

- test puro si se puede aislar,
- E2E si afecta flujo real de combate,
- documentacion actualizada.

## Huellas multicelda

Implementado en Sprint 025:

- `getCombatantOccupiedCells` deriva el lado desde `SizeRulesCatalog.spaceFeet / board.cellSizeFeet`.
- distancia, amenaza y flanqueo operan sobre huellas completas; el flanqueo exige caras opuestas.
- movimiento, colocación, carga y AdO validan cada celda del cuerpo en cada ancla candidata.
- React renderiza un único token con `span` dinámico y permite seleccionarlo desde cualquier celda ocupada.

Evolución futura: huellas no cuadradas, rotación y `Squeezing` con espacio temporal sin cambiar las APIs públicas.

## Vida proyectada y Stand Up

Implementado en Sprint 025-R:

- `LifeStateProjection` desacopla HP/estabilidad de consciencia, acción y sangrado.
- `normalizeLifeStateAfterHpChange` estabiliza Diehard inmediatamente entre −1 y −9; −10 conserva precedencia fatal.
- la economía Disabled se aplica también a Diehard en negativos: una acción estándar o de movimiento, nunca full-round.
- Tick Layer consume `bleedsAtRoundStart` sin condicionales por dote.
- `getStandUpActionProfile` conserva la regla normal y deriva para Prone Eschewal 0 pies, move action y ausencia de AdO.

## Grapple Core V2

- Presa: `1d20 + BAB + modificador de Fuerza efectiva + grappleModifier`.
- Escapismo: `1d20 + modificador de Destreza efectiva + ranks.escape_artist`.
- El retenedor siempre opone una prueba de Presa derivada; `resolveOpposedCheck` conserva la política única de empates.
- `getGrappleLink` exige una sola relación binaria íntegra y falla de forma cerrada ante ambigüedad.
- `getGrappleAttackEligibility` permite en agarre únicamente el arma melee ligera equipada o un ataque natural válido.
- `srd_grappling` inyecta `forcejeo en presa -4`; las etiquetas condicionales se preservan en el breakdown.
