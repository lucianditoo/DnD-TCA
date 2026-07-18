# RULES_PHB_CHECKLIST — Reglas de Combate (PHB 3.5, Capítulo 8) vs Motor

**Tipo de documento**: Auditoría analítica de cobertura para la V1.0, bajo el marco de `.ai/coverage/V1_LAUNCH_MANIFESTO.md`. Cuarto checklist del Master Plan, complementando dotes/conjuros/equipo con las **reglas de combate** propiamente dichas.

**Diferencia clave con `combat/14_resumen_de_reglas.txt`**: aquel archivo marca ✔ las reglas *transcritas en el corpus normativo* (las 94). Este checklist marca `[x]` las reglas *implementadas en el motor* (servidor autoritativo + `rules.ts`). Son ejes ortogonales: una regla puede estar transcrita y no implementada (Retirada), o implementada con matices no transcritos (rutina iterativa, ver G-01 de `docs/audits/combat-rules-deviations.md`).

**Fuentes de verificación**: historial de sprints en `PROJECT_STATUS.md` (013-037), registro real de comandos Zod (`packages/shared/src/schemas/commands/*.ts`), `rules.ts`, `effects/catalog.ts`, y greps dirigidos ejecutados para esta auditoría. Las filas dudosas se marcaron `[ ]` con nota "PARCIAL" antes que inflar la cobertura.

**Estado**: `[x]` implementada y operacional · `[ ]` no implementada (o parcial).

## A. Tablero y Fundamentos

| Estado | Regla (según índice de `combat/14`) | Evidencia / Nota |
|---|---|---|
| [x] | Tablero de combate | `Board.tsx`, tablero de celdas server-authoritative. |
| [x] | Casillas y cuadrícula | Grid 5 ft por celda, `Position`. |
| [x] | Miniaturas | Tokens React, multicelda desde Sprint 025-A. |
| [x] | Cómo funciona el combate (ciclo) | Turnos cíclicos server-authoritative. |
| [x] | Asaltos | Global Round Tracker (Sprint 021). |
| [x] | Orden del combate | Orden de iniciativa persistente por sala. |
| [ ] | Asalto de sorpresa | Sin modelado de sorpresa/consciencia previa al asalto 1. |
| [x] | Iniciativa | Comandos `set-initiative`/`sort-initiative`. |
| [x] | Personajes desprevenidos | `srd_flat_footed` (`NO_DEX_TO_AC`). |

## B. Estadísticas de Combate

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [x] | Estadísticas de combate (agregado) | Read-models puros `totalAttackBonus`/`totalArmorClass`. |
| [x] | Tirada de ataque | Pipeline `resolve-attack` transaccional. |
| [x] | Bonificador de ataque | `Rules.totalAttackBonus` con desglose de partes. |
| [x] | Modificadores por tamaño (Tabla 8-1) | **Corrección de auditoría (2ª pasada)**: SÍ implementada. `SizeRulesCatalog` (`sizeRules.ts`) define `attackAndAcModifier` completo (Fine +8 ... Colossal -8), aplicado al ataque en `rules.ts:342` y a la CA como componente `size` de `deriveArmorClassBreakdown` (`equipmentStats.ts:206`). También cubre el modificador especial de presa (`grappleModifier`), espacio y alcance por tamaño. La primera pasada lo marcó `[ ]` por buscar el nombre incorrecto (`sizeModifier`). Pendiente solo: modificador de tamaño a Esconderse (sin sistema de habilidades). |
| [x] | Daño | Tiradas de daño con perfil de arma, multiplicadores de característica. |
| [x] | Clase de Armadura | `totalArmorClass` desglosada (armadura, escudo, Des, natural, desvío, esquiva vía `IntrinsicDefense`). |
| [x] | Clase de Armadura de toque | `targetAcType: "touch"` (`rules.ts:169,185`). |
| [x] | Puntos de golpe | `hpCurrent`/`hpMax` autoritativos. |
| [x] | Velocidad | `baseSpeedFeet` + bonos de buffs (`speedBonusFeet`). |
| [x] | Tiros de salvación | Automatización completa (Sprint 024): tipo, CD, 1/20 natural, consecuencia. |

## C. Acciones

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [x] | Acciones en combate (economía) | PARCIAL-SUSTANCIAL: presupuesto de movimiento, gating de ataques por rutina, modo de ataque; sin contador formal estándar+movimiento por turno. Se marca `[x]` porque los flujos jugables están gobernados. |
| [x] | Acciones estándar | Ataque, conjuro (`cast-spell`), maniobras como comandos dedicados. |
| [x] | Acciones de movimiento | `move-combatant` con presupuesto de velocidad; `stand-up` con coste modulable (`tacticalActionRules`). |
| [x] | Acciones de asalto completo | Ataque completo vía `declare-attack-mode` + rutina iterativa (Sprint 036). |
| [ ] | Acciones gratuitas | Sin categoría modelada. |
| [ ] | Acciones misceláneas | Sin categoría modelada. |

## D. Ataques

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [x] | Ataques cuerpo a cuerpo | Pipeline completo con alcance (Sprint 013). |
| [x] | Ataques a distancia | Incrementos de distancia (`rangeIncrementFeet`/`maxRangeIncrements`), munición finita (Sprint 026). |
| [ ] | Ataques sin armas | PARCIAL: `unarmed_strike` existe como arma del catálogo, pero sin AdO por atacar desarmado, sin daño no letal, sin distinción "armado". |
| [x] | Ataques de toque | Touch AC + conjuros de toque (`srd_shocking_grasp`). |
| [x] | Ataques múltiples | `getAttackRoutine` + `getEffectiveAttackRoutine` (Sprint 036) + gating de `attacksMade`. |
| [x] | Impactos automáticos (20 natural) | Manejo de naturales en el pipeline de resolución. |
| [x] | Fallos automáticos (1 natural) | Ídem. |
| [x] | Golpes críticos | `criticalThreatFrom`/`criticalMultiplier` + confirmación (`resolve-attack-confirmation`). |
| [ ] | Daño a objetos | Sin dureza/PG de objetos. |
| [x] | Lanzar un conjuro | `cast-spell` + pipeline de salvaciones/AoE (Sprints 024/033). |
| [ ] | Concentración | Sin tiradas de Concentración. |
| [ ] | Habilidades sortílegas | Sin modelado diferenciado. |
| [ ] | Habilidades sobrenaturales | Sin modelado (expulsión de muertos vivientes incluida). |

## E. Ataques de Oportunidad y Movimiento

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [x] | Ataques de oportunidad | Sistema completo con interrupción transaccional (Sprint 032). |
| [x] | Casillas amenazadas | `MeleeThreatSource` con alcance min/max (Sprint 013), multiposición (Sprint 027). |
| [x] | Provocar AdO | Oráculo puro `actionProvokesOpportunityAttack` + límite 1/ronda + Reflejos de Combate (`rules.ts:516`). |
| [x] | Paso de 5 pies | Comando `five-foot-step`. |
| [x] | Retirada (Withdraw) | **Sprint MOVE-WITHDRAW**: sub-acción `withdraw` de `use-tactical-action` (`handleWithdraw`, patrón Charge). Asalto completo a 2× velocidad (`usedFullAttack` + `movementUsedFeet`); rama RAW "retirada limitada" para Disabled (1×, `usedStandardAction` + esfuerzo). Huella inicial completa exenta del disparo de AdO (parámetro puro en `findTriggeredOpportunityAttacksForPath`, default neutro); resto de la ruta provoca normal. Simplificaciones V1 documentadas: invisibles también exentos (pro-defensor), Cegado sin validar, sin Acrobacias ni atravesar enemigos. Tests: `withdraw.test.mjs` + `withdraw-server.test.mjs`. |
| [x] | Movimiento táctico | `validateMovePath` completo. |
| [ ] | Movimiento doble | Sin acción de doble movimiento. |
| [x] | Correr | Sprint 041 (`MOVE-RUN`): ×4/×3 velocidad, línea recta, sin paso de 5', terreno difícil bloqueado, `FORBID_RUN` consumido, pérdida de Destreza/Esquiva salvo dote. Parcial respecto de la resistencia multi-asalto (Constitución/CD creciente/descanso), diferida — ver `docs/technical-debt.md`. |
| [x] | Movimiento diagonal | 1-2-1-2 (Sprint 015). |
| [x] | Distancia | Distancia entre footprints O(1) (Sprint 027). |
| [x] | Terreno difícil | Coste doble, 10/20 ft diagonal (Sprint 015). |
| [x] | Obstáculos | `isImpassable` + esquinas corregidas (Sprint 037, MOVE-05). |
| [x] | Apretujarse (Squeezing) | `srd_squeezing` dinámico 2×1 (Sprint 028). |
| [x] | Criaturas grandes y pequeñas | Footprints multicelda completos (Sprints 025-A/027/028). |
| [x] | Espacio ocupado | Índice de ocupación. |
| [x] | Alcance natural | `minReachFeet`/`maxReachFeet` (armas de alcance excluyen adyacente). |
| [x] | Adyacencia | Geometría de footprints. |

## F. Modificadores de Combate

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [ ] | Modificadores de combate (Tablas 8-5/8-6 completas) | PARCIAL: flanqueo, tumbado, cobertura y desprevenido sí; deslumbrado, enmarañado, estremecido, gateando, sentado no. |
| [ ] | Modificadores a la tirada de ataque (Tabla 8-5) | Subconjunto (flanqueo +2, prone -4 vía condicionales). |
| [ ] | Modificadores a la CA (Tabla 8-6) | Subconjunto (prone, flat-footed). |
| [x] | Cobertura | +4 CA por intercepción de línea (`hasObstacleInterception`, Sprint 013). |
| [ ] | Cobertura mejorada | Sin grados de cobertura. |
| [ ] | Cobertura total | Sin bloqueo de ataque por cobertura total. |
| [ ] | Ocultación | El contrato `CONCEALMENT` (con %) existe en `Modifier`, pero sin consumidor verificado en `rules.ts` — la tirada de fallo porcentual no está cableada. |
| [ ] | Ocultación total | Sin implementar. |
| [x] | Flanquear | +2 por caras opuestas con excepción multicasilla (Sprints 025-A/027). |
| [ ] | Defensores indefensos | PARCIAL: trait `HELPLESS` declarado y `srd_paralyzed` existe; la matemática -4 CA cuerpo a cuerpo / Des efectiva 0 no verificada como implementada. |
| [x] | Disparar/lanzar a combate cuerpo a cuerpo (-4) | **Sprint ATK-RANGED-INTO-MELEE**: `getRangedIntoMeleeAssessment` (helper puro en `rules.ts`) integrado en `getAttackContextModifiers.byAttackType.ranged` — consumido isomórficamente por servidor (armas + conjuros con tirada de ataque) y UI. Formulación RAW "either threatens" (ver D-11), excepción de 10 ft por footprints, exención declarativa de Disparo Preciso. Tests: `tests/ranged-into-melee.test.mjs` (13 casos). |
| [x] | Combatir a la defensiva | Buff legado "Luchar a la Defensiva" (-4 ataque / +2 CA). |
| [ ] | Combate montado | Sin sistema de monturas. |

## G. Ataques Especiales

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [ ] | Ataques especiales (agregado) | PARCIAL: 5 de 12 maniobras implementadas (ver filas siguientes). |
| [ ] | Arrollar (Overrun) | Sin comando. |
| [x] | Cargar | Comando `charge` + `chargeResolver.ts` (con la salvedad SP-02 del Apéndice A de `combat-rules-deviations.md`: criaturas indefensas en ruta, pendiente de re-verificación). |
| [ ] | Combatir con dos armas | Sin ataque de mano torpe ni Tabla 8-8. |
| [x] | Derribo (Trip) | Sprint 018: pipeline transaccional completo con Touch AC y oposición. |
| [ ] | Desarmar | Sin comando. |
| [x] | Embestir (Bull Rush) | Sprint 028: `bull_rush` con movimiento forzado. |
| [ ] | Expulsar/reprender muertos vivientes | Sin implementar. |
| [ ] | Fintar | Sin sistema de amago (requiere habilidades Engañar/Averiguar intenciones). |
| [ ] | Lanzar armas deflagradoras | Sin armas de salpicadura (ver consumibles 0/14 en `EQUIPMENT_PHB_CHECKLIST.md`). |
| [x] | Prestar ayuda (Aid Another) | Comandos `aid-another`/`choose-aid-bonus` + campos `aid*` en `Buff`. |
| [x] | Realizar una presa (Grapple) | Sprints 029/030: pipeline completo con escape. |
| [ ] | Romper arma (Sunder) | Sin comando ni dureza/PG de armas. |
| [ ] | Romper un objeto | Sin implementar. |

## H. Heridas, Muerte y Acciones de Iniciativa

| Estado | Regla | Evidencia / Nota |
|---|---|---|
| [x] | Heridas y muerte (agregado) | Economía de vida completa (Sprints 021/025-R). |
| [x] | Pérdida de puntos de golpe | Daño autoritativo. |
| [x] | Incapacitado (0 PG) | Economía Disabled (Sprint 025-R) — conforme al manual, ver D-01 de la auditoría normativa. |
| [x] | Moribundo (-1 a -9) | Sangrado pasivo por ronda (Sprint 021). |
| [x] | Muerto (-10) | Umbral de muerte. |
| [x] | Estabilización | Comando `roll-stabilization` + `autoStabilizeNegativeHp` (Diehard). |
| [ ] | Recuperación (natural, fuera de combate) | Fuera del alcance del motor táctico actual. |
| [x] | Curación | `heal-combatant` + conjuros de curación (`srd_cure_light_wounds`). |
| [ ] | Puntos de golpe temporales | Sin implementar. |
| [ ] | Daño no letal | Sin implementar (bloquea también golpe desarmado RAW y grogui). |
| [ ] | Retrasar | Sin comando. |
| [ ] | Preparar una acción | Sin comando (sin sistema de acciones disparadas). |
| [ ] | Golpe de gracia | Sin comando (regla presente en el corpus, `10`/`11`). |
| [x] | Defensa total | Comando `total-defense`. |

## Resumen de cobertura (cifras inequívocas, 2ª pasada de auditoría)

- **Reglas auditadas**: 96 filas (las 94 del índice normativo `combat/14` + Golpe de gracia y Defensa total, presentes en el corpus pero ausentes de aquel índice).
- **Completas** (implementadas sin salvedad): **61** (Disparar a combate cuerpo a cuerpo -4 por ATK-RANGED-INTO-MELEE; Retirada por MOVE-WITHDRAW).
- **Parciales**: **5** — 1 contabilizada como `[x]` en el dashboard con nota explícita ("Acciones en combate", economía sustancial pero sin contador formal estándar+movimiento), y 4 contabilizadas como `[ ]` (Ataques sin armas; Modificadores de combate Tablas 8-5/8-6; Defensores indefensos; Ataques especiales agregado).
- **No implementadas**: **30**.
- **Cifra del dashboard (oficial, calculada por el script)**: 62/96 = 65% (cuenta `[x]`, es decir, 61 completas + 1 parcial-sustancial marcada explícitamente). La política de conteo es: una parcial solo se cuenta como implementada si su fila lo declara con nota; hoy hay exactamente una en ese caso.
- Las brechas se concentran en: modificadores situacionales de las Tablas 8-5/8-6, ocultación, acciones de iniciativa (retrasar/preparar), maniobras restantes (desarmar, arrollar, romper arma, fintar, expulsión), daño no letal/PG temporales, y todo lo montado.
- Cada `[ ]` requiere su propia NDD y `Proceed` antes de implementarse, igual que el resto del Master Plan.
