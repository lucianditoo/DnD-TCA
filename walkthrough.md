# Walkthrough — Sprint 045 (Pre-diseño arquitectónico)

## Resultado

Se completó una auditoría documental y de código, sin implementación funcional. El diseño está en `docs/designs/rule-and-modifier-classification.md`.

## Estado Git inicial

- Rama: `master`.
- HEAD auditado: `40e90d29cd8ba509c5d98c16eb5a294601e4f3b9`.
- Sin commits locales pendientes respecto de `origin/master` al iniciar.
- Única excepción local autorizada: `.claude/settings.local.json`, archivo no seguido y expresamente fuera de alcance. No se leyó, modificó, staged ni incluyó en la auditoría.

## Hallazgos principales

1. `ATTACK-FULL` es una regla base única. Rapid Shot, Haste, Two-Weapon Fighting, ataques naturales múltiples y Cleave/Great Cleave son reglas independientes que modifican o reaccionan al ataque; necesitan Rule IDs separadas.
2. `getEffectiveAttackRoutine` no compone contribuciones: solo proyecta la rutina BAB y el bonus efectivo. El servidor continúa gateando con `getAttackRoutine`, de modo que hoy ninguna fuente productiva puede añadir ataques de forma end-to-end.
3. El modelo de modificadores está repartido entre ActiveEffects, `Buff`, contexto táctico, handlers y resolver. `EffectReducer` tiene stacking y traza sólidos para modificadores numéricos, pero no cubre buffs, traits, mechanics, condicionales ni entradas de rutina.
4. “Condiciones Restantes” no puede implementarse fielmente como un solo lote:
   - Blinded necesita Concealment, visión y media velocidad.
   - Entangled necesita media velocidad y Concentration.
   - Dazzled/Shaken necesitan skills/checks para cierre completo.
   - Frightened/Panicked necesitan huida obligatoria, escalado de miedo y, para Panicked, caída real de objetos.
   - Exhausted necesita media velocidad y transición de descanso/stacking.
   - Stunned solo carece del drop, pero el repositorio no representa objetos en el suelo.
   - Helpless tiene parte de la defensa/ataque, pero falta Sneak Attack por helplessness y todo Coup de Grace.
5. `srd_paralyzed` fuerza DEX 0 pero no STR 0, pese a la definición oficial; la fila `EFFECT-PARALYZED` debe reauditarse antes de conservar estado Completo.

## Recorte recomendado

Opción F: `DEFENSE-CONCEALMENT` como vertical única antes de Blinded.

Motivos:

- es una regla oficial concreta, no infraestructura especulativa;
- el contrato mechanic `CONCEALMENT` ya existe sin consumidor;
- desbloquea Blinded, Invisible, oscuridad y niebla;
- puede seguir el patrón compartido de `CoverAssessment` y mantener la tirada autoritativa en servidor.

Fuera de alcance hasta otro gate: condiciones, visión, Blind-Fight, Total Cover, compositor de Full Attack y migración global de Buffs.

## Documentación

- Creado: `docs/designs/rule-and-modifier-classification.md`.
- Actualizados: `ROADMAP.md`, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`.
- No se creó `implementation_plan.md`: el recorte recomendado aún requiere una NDD específica antes de planificar código.
- No se modificó `docs/rules/registry.md`; primero se entrega la recomendación exacta, como exigía el gate.

## Gate

La ejecución se detiene después del commit/push documental. Se requiere `Proceed` explícito antes de modificar producción o tests.
