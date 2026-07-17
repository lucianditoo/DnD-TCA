# Architecture

Este documento describe la arquitectura tecnica. La guia principal es `CODEX_GUIDE.md`.

## Vision General

La aplicacion tiene tres capas principales:

- `apps/web`: UI React/Vite.
- `apps/server`: servidor local Express + WebSocket, autoridad del combate.
- `packages/shared`: tipos, catalogos, helpers puros y reglas compartidas.

El flujo general es:

1. El cliente abre WebSocket.
2. El cliente manda comandos.
3. El servidor valida permisos y reglas.
4. El servidor muta la sala.
5. El servidor emite `room-update`.
6. Los clientes renderizan el nuevo estado.

## Server

Ruta: `apps/server/src`

Responsabilidades:

- Crear salas.
- Registrar participantes.
- Mantener salas en memoria.
- Validar ownership/control.
- Validar permisos GM/player.
- Ejecutar comandos.
- Resolver ataques, danio, buffs, turnos y AdO.
- Detectar Victoria/TPK.
- Emitir logs y actualizaciones por WebSocket.

Estructura relevante:

```text
apps/server/src/
  auth/
    control.ts
  combat/
    abilityResolver.ts
    attackResolver.ts
    buffRules.ts
    chargeResolver.ts
    opportunityAttackResolver.ts
    turnManager.ts
  commands/
    dispatcher.ts
    roomCommands.ts
    combatantCommands.ts
    initiativeCommands.ts
    movementCommands.ts
    attackCommands.ts
    tacticalCommands.ts
    abilityCommands.ts
    gmCommands.ts
  gm/
    gmState.ts
  room/
    roomState.ts
    roomStore.ts
  index.ts
```

Regla clave: si una accion afecta el combate, el servidor debe validarla aunque la UI la oculte o deshabilite.

## Web

Ruta: `apps/web/src`

Responsabilidades:

- Crear/unirse a sala.
- Mantener conexion WebSocket.
- Mostrar tablero y paneles.
- Guiar seleccion de acciones.
- Mostrar overlays.
- Gestionar estado local de UI.
- Editar perfiles fuera del combate.

Estructura relevante:

```text
apps/web/src/
  components/
    ActionsPanel/
    Board/
    CharacterSheetForm/
    CombatantsPanel/
    CombatLog/
    ConnectionPanel/
    GmPanel/
    ProfileList/
    ResultScreen/
    SelectedInfo/
  hooks/
    useBoardSelection.ts
    useCombatActions.ts
    useStoredProfiles.ts
    useWebSocketRoom.ts
  pages/
    ProfilesPage.tsx
  App.tsx
  profileEquipment.ts
  viewModel.ts
```

La UI no debe duplicar reglas complejas. Puede calcular informacion visual, pero la legalidad real vive en servidor/shared.

## Shared

Ruta: `packages/shared/src`

Responsabilidades:

- Contrato de datos.
- Contrato WebSocket.
- Catalogos.
- Helpers puros.
- Calculos derivados.

Estructura relevante:

```text
packages/shared/src/
  data/
    equipment/
      armors.ts
      shields.ts
      weapons.simple.ts
      weapons.martial.ts
      weapons.exotic.ts
      helpers.ts
      types.ts
      index.ts
    abilities.json
    creatures.json
  equipmentCatalog.ts
  naturalAttackCatalog.ts
  sizeRules.ts
  equipmentStats.ts
  combatSnapshot.ts
  profileStorage.ts
  spells/
    contracts.ts
    catalog.ts
  rules.ts
  types.ts
```

## Catalogos y Datos

El catalogo oficial de equipo esta en:

`packages/shared/src/data/equipment`

Debe consultarse por:

`packages/shared/src/equipmentCatalog.ts`

Los perfiles y criaturas deben guardar IDs, por ejemplo:

```json
{
  "equipment": {
    "mainWeapon": "longsword",
    "armor": "chainmail",
    "shield": "heavy_steel_shield"
  }
}
```

No guardar copias completas del arma, armadura o escudo dentro del perfil.

## Estadisticas Base y Derivadas

Mantener separacion clara:

- Base: editable y persistente.
- Derivada: calculada desde base + catalogos + reglas.

Ejemplo:

- `baseSpeedFeet`: velocidad base editable.
- `speedFeet`: velocidad calculada segun armadura y buffs aplicables.

La logica de derivacion vive en `equipmentStats.ts` y debe seguir siendo pura y testeable.

## Profile To Combat Snapshot

Los perfiles permanentes no se mutan durante el combate.

Cuando un perfil o template entra a una sala, el servidor crea un `CombatantSnapshot` usando `createCombatantSnapshotFromProfile`.

El snapshot contiene estado temporal del encuentro:

- `hpCurrent`.
- `initiative`.
- `buffs`.
- `position`.
- `isStable`.
- estadisticas de combate.
- ownership asignado por servidor.
- `armorClassBreakdown` obligatorio con componentes tipados para proyecciones Normal, Touch y Flat-Footed.
- características, categoría de tamaño y dotes resueltas.
- `ThreatProfile.meleeSources` derivado desde equipo/ataques naturales, validado y copiado de forma inmutable.
- `preparedSpells` derivado desde el loadout persistente, con slots individuales y estado de gasto temporal.

El perfil V2 no admite `armorClass`, `attackModifier`, `damageBase` ni `speedFeet` como fuentes. El helper deriva esos valores desde características, tamaño, defensa intrínseca y IDs de catálogo; un perfil incompleto o con IDs desconocidos falla antes de ingresar a combate.

## Modelo Principal

### CombatRoom

Representa una sala/encuentro.

Campos clave:

- `code`
- `board`
- `combatants`
- `turnOrder`
- `activeTurnIndex`
- `round`
- `phase`
- `outcome`
- `currentTurn`
- `pendingOpportunityAttacks`
- `log`

### Combatant / CombatantSnapshot

Representa una criatura/token en tablero. En el modelo compartido, `CombatantSnapshot` nombra explicitamente la instancia temporal de combate. `Combatant` sigue como alias compatible para no romper el contrato WebSocket existente.

Campos clave:

- `sourceProfileId` opcional.
- identidad y ownership.
- HP/CA/BAB/ataque/danio.
- desglose obligatorio de CA (`base`, `armor`, `shield`, `naturalArmor`, `dexterity`, `size`, `dodge`, `deflection`, `misc`).
- equipo resuelto.
- perfil de amenaza melee derivado (`sourceId`, clase de fuente y alcance máximo).
- habilidades.
- buffs.
- posicion.
- estadisticas de combate.

### ClientCommand

Union type en `packages/shared/src/types.ts`.

Es el contrato publico entre web y server. Cambiarlo requiere cuidado y E2E.

### Contexto táctico espacial

`packages/shared/src/rules.ts` concentra `threatensTarget`, `isFlanking` y `getAttackContextModifiers`. La amenaza se calcula desde el snapshot y ActiveEffects; el flanqueo no se persiste. Los handlers del servidor eligen la rama melee/ranged de la fuente autoritativa e inyectan solo el modificador numérico a `resolveAttack`.

React usa el mismo helper para el preview, pero el resultado definitivo siempre se recalcula en el servidor. `getCombatantOccupiedCells` deriva una única topología desde tamaño y escala del tablero; distancia, amenaza, flanqueo, movimiento, colocación, carga, AdO y Board consumen esa misma huella. El flanqueo clasifica caras opuestas del rectángulo ocupado, por lo que preserva tokens 1×1 y soporta Large 2×2 sin estado geométrico persistido.

### Pipeline de conjuros y salvaciones

`SpellsCatalog` declara nivel, característica asociada, tipo de salvación y consecuencia (`none`, `half` o `negates`). `handleCastSpell` valida el slot y resuelve el lanzamiento sobre una copia de trabajo. El servidor calcula la CD, obtiene el bono efectivo mediante `Rules.totalSavingThrow`, tira el d20 internamente y aplica daño/efecto, gasto de slot, acción y logs en un único commit antes del broadcast. La UI reutiliza los selectores compartidos únicamente para preview.

### Proyección vital y acciones modificadas por dotes

`FeatCatalog` declara contribuciones mecánicas inmutables. `getLifeStateProjection` separa estado visible, consciencia, capacidad de actuar, economía Disabled y sangrado; `normalizeLifeStateAfterHpChange` asegura la postcondición después de mutaciones de HP. Tick Layer pregunta `bleedsAtRoundStart` y no conoce IDs de dote. `getStandUpActionProfile` deriva coste, consumo de acción y provocación para que servidor y React compartan exactamente la misma decisión.

## Testing

Capas actuales:

- `npm test`: tests unit-style en `tests/*.test.mjs`.
- `scripts/e2e-websocket.mjs`: flujo E2E por WebSocket.
- `npm run typecheck`: shared, web y server.
- `npm run build`: shared, web y server.

## Como Agregar Una Accion

1. Definir si requiere cambio de `ClientCommand`.
2. Agregar/ajustar tipos en `packages/shared/src/types.ts`.
3. Agregar helper compartido si la regla es reusable.
4. Implementar validacion autoritativa en servidor.
5. Conectar UI en componentes/hooks.
6. Agregar tests unitarios si hay calculo puro.
7. Agregar E2E si afecta flujo de combate/multiplayer.
8. Actualizar docs relevantes.

## Grapple V2 y fuentes de habilidad

Sprint 030 incorpora `SkillRanks` como fuente persistente V6 y de snapshot. La relación de Presa continúa representada por una única `EffectInstance` binaria; no se crean entidades paralelas ni se persisten modificadores derivados.

Las consultas puras del paquete shared derivan vínculo, perfiles enfrentados y elegibilidad de ataque. El handler WebSocket ejecuta el escape en una copia transaccional de la sala y solo publica el commit final. React reutiliza las mismas consultas para previews, pero el servidor recalcula y conserva la autoridad.
