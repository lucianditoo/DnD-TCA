# COMBAT-HELPLESS y ACTION-COUP-DE-GRACE

## 1. Objetivo
Implementar la vertical oficial de combate contra oponentes indefensos (Helpless) de D&D 3.5. Esto abarca:
- La clasificación sistemática de un objetivo como indefenso.
- Las penalizaciones normativas a su CA (Destreza tratada como 0 y penalizador melee).
- La viabilidad del Ataque Furtivo (Sneak Attack).
- La acción de asalto completo *Coup de Grace* (Golpe de gracia).

## 2. Fuentes Normativas
- **Reglamento oficial D&D 3.5 (SRD)**: Combate > Modificadores de Combate > Defensores Indefensos.
- **Fuente primaria local**: `combat/10_modificadores_de_combate.txt:90-93`.

## 3. Terminología
- **Indefenso (Helpless)**: Combatiente paralizado, atado, durmiendo, inconsciente (incluye moribundos), o a merced total del oponente.
- **Coup de Grace (Golpe de Gracia)**: Acción de asalto completo para rematar a un objetivo indefenso adyacente. Asegura impacto, crítico y puede forzar la muerte inmediata si el objetivo falla su salvación de Fortaleza.

## 4. Clasificación Helpless y Objetivos Muertos
Actualmente, el sistema utiliza `lifeStatus` para el ruteo de movimiento y define el trait `HELPLESS` en efectos como `srd_unconscious` y `srd_paralyzed`.
**Decisión arquitectónica**:
Se debe separar explícitamente la clasificación usada para ocupar casillas de la clasificación `HELPLESS` de combate y de la elegibilidad para Coup de Grace.
- Toda consecuencia defensiva consultará exclusivamente el trait `HELPLESS` tras la proyección de modificadores y, dinámicamente, el `lifeStatus` (si es `dying` o `stable`).
- Un objetivo con `lifeStatus === "dead"` se mantiene como cuerpo no bloqueante en movimiento (si es la regla actual), pero **no** es un objetivo válido de Coup de Grace, no fuerza salvación, y no consume la acción. Debe ser rechazado antes de mutar mediante un validador semántico específico (ej. `isValidCoupDeGraceTarget`).

## 5. Proyección Defensiva Compartida (Destreza 0)
**Normativa RAW**:
- Un defensor indefenso tiene su Destreza tratada como 0 (Modificador -5).
- Contra ataques cuerpo a cuerpo (melee), sufre un penalizador adicional de -4 a la CA (+4 al ataque del oponente).
- Contra ataques a distancia (ranged), no aplica este penalizador de -4.

**Estado Actual**:
`attackResolver.ts` aplica `helplessBonus` (+4 a ataques melee). Falta la supresión canónica de Destreza.

**Solución Propuesta**:
No se introducirá aritmética especial "hardcodeada" dentro de `totalArmorClass`. En su lugar, se definirá o extenderá una proyección defensiva compartida pura (ej. `DefensiveAbilityProjection` o `ArmorClassEligibilityProjection`).
Esta proyección expresará:
- Destreza defensiva tratada como 0 (modificador resultante de -5).
- Supresión de bonus de Esquiva (Dodge).
- Motivo explícito: `HELPLESS` (para trazabilidad).
- Interacciones claras: `HELPLESS` no significa simplemente `NO_DEX_TO_AC`. `NO_DEX_TO_AC` elimina el uso normal de DEX positiva, mientras que `HELPLESS` además impone el tratamiento de la DEX como 0 (modificador -5, incluso si la DEX base ya era positiva o negativa). Flat-Footed no duplicará la supresión.
- Paralyzed obtiene esta semántica automáticamente por el rasgo `HELPLESS`.
Tanto el servidor (a través de `totalArmorClass`), el desglose de CA (`armorClassBreakdown`), y la UI consumirán esta misma proyección pura. El bonificador contextual de +4 melee seguirá manejándose por separado.

## 6. Ataque Furtivo (Sneak Attack)
**Normativa RAW**: "Los pícaros aplican también el daño adicional de sus ataques furtivos cuando dan el golpe de gracia a un oponente indefenso" (o en ataques normales).
**Estado Actual**: `canApplySneakAttack` evalúa `NO_DEX_TO_AC` y flanqueo. Un objetivo con `HELPLESS` no activa el Sneak Attack salvo que también tenga `NO_DEX_TO_AC` o esté flanqueado.
**Solución Propuesta**: Incluir `HELPLESS` explícitamente como habilitador en `canApplySneakAttack`.

## 7. Coup de Grace
**Regla oficial (`combat/10_modificadores_de_combate.txt:93`)**:
- Acción de asalto completo (Full-round action).
- Armas permitidas: melee, o arco/ballesta si se está **adyacente**.
- Consecuencia: Impacto automático y **Golpe crítico** automático. Daño furtivo si corresponde.
- Fortaleza: Si sobrevive al daño, debe pasar Fortaleza (CD 10 + el daño sufrido) o morir.
- Restricciones: Provoca Ataques de Oportunidad (AdO).

## 8. Economía de Acciones
Implementar `handleCoupDeGrace` en `tacticalCommands.ts`. Exigirá consumo de acción `full-round`.

## 9. Alcance y Armas
Se validará que el atacante posea un arma melee que alcance al objetivo, o un arma a distancia y se encuentre estrictamente adyacente (distancia <= 5 ft).

## 10. Crítico Automático Sin Tiradas Falsas
No se fabricarán resultados de dados (nada de `d20Roll = 20` ni pasar por confirmaciones fingidas).
**Solución Propuesta**:
Coup de Grace se modelará como impacto y crítico automáticos sin tirada de ataque ni threat de por medio.
Se utilizará una ruta explícita y pura para reutilizar la matemática de daño crítico (por ejemplo, una función pura para construir un `DamageBundle` con critical mode `"automatic"`, o reutilizando directamente la función canónica de multiplicación de daño sin la fase de ataque).
Quedará estrictamente garantizado que:
- Sneak Attack se añade cuando corresponda.
- El daño de precisión y daño extra no se multiplica por el crítico.
- Únicamente los componentes multiplicables del arma usan el multiplicador.
- No se disparan reglas ligadas a sacar "natural 20".

## 11. Transición Canónica a Muerte
No se asignará `lifeStatus = "dead"` directamente en el handler ni se saltará la capa canónica de vida.
Se diseñará una operación canónica y reutilizable para matar al objetivo por fallo de salvación (ej. a través de un helper en Mutation Layer). Esta mutación autoritativa producirá exactamente un cambio de estado, emitirá logs una sola vez, será idempotente frente a un objetivo ya muerto y distinguirá si la muerte fue por pérdida de HP o por fallo de Fortitude.
**Flujo detallado**:
- El daño se aplica ANTES de la salvación.
- El daño que alimenta la CD de la salvación de Fortaleza es el **daño final realmente sufrido** (post-RD). Si el daño sufrido es 0, la CD es 10.
- Si el objetivo queda muerto por HP (`lifeStatus === "dead"`) tras aplicar el daño, **no** se realiza la salvación (para no duplicar el evento de muerte).
- Si el objetivo sobrevive al daño (queda `dying`, `stable` o con HP positivo), entonces se realiza la salvación de Fortaleza.
- Si ya era `dead` antes del Coup de Grace, la acción es rechazada en preflight.

## 12. Inmunidad a Críticos
Se mantendrá la decisión normativa: no puede realizarse Coup de Grace contra objetivos inmunes a golpes críticos.
Esta validación consultará exclusivamente el trait normativo general `IMMUNE_TO_CRITICAL_HITS` (o su proyección canónica). No se revisará `creatureType === "construct"` o listas hardcodeadas.
El rechazo ocurrirá atómicamente en el preflight (antes de consumir acciones, antes de generar AdO y sin mutaciones).

## 13. Acción Pendiente y Reanudación tras AdO
No se obligará al usuario a "volver a pulsar" la acción como una nueva declaración si provoca AdO.
Se diseñará una única acción full-round suspendible utilizando un estado pendiente, conceptualmente equivalente a una interface `PendingCoupDeGrace` (almacenada a nivel de turno o encounter phase).
**Reglas del flujo suspendible**:
- El usuario declara Coup de Grace una sola vez.
- Se completa el preflight antes de abrir la cola de AdO. Actor, objetivo, arma y contexto normativo quedan congelados.
- La acción queda suspendida. No se consume dos veces la acción y no se aplica daño todavía.
- Preferencia arquitectónica: reanudación automática tras resolver la cola de AdO. Si la infraestructura exige acción manual (ej. botón de "Continuar"), se usará un comando explícito de reanudación (ej. `resume-coup-de-grace`) que no permita alterar parámetros.
- Al reanudar, el servidor revalidará solo condiciones dinámicas: el actor sigue vivo, puede actuar, no fue desplazado fuera de alcance; el objetivo sigue siendo válido y `HELPLESS`; el arma está disponible y las fases son correctas. Si deja de ser válida, se cancela sin daño ni salvación.

## 14. UI
La UI forma parte del alcance para ser una vertical jugable completa.
En el ActionsPanel (o similar):
- Habrá una acción "Golpe de gracia" (separada de "Ataque completo").
- Solo visible con objetivo válido seleccionado (con preview no autoritativo de elegibilidad).
- Indicará que es una acción de asalto completo y advertirá visualmente que provoca AdO, detallando el arma seleccionada.
- Representará el estado pendiente durante la resolución de AdO y su posterior resultado (éxito, fallo o errores server-authoritative).
La UI consumirá helpers compartidos para la elegibilidad y nunca tirará dados ni decidirá autoridad.

## 15. Compatibilidad Legacy
Evitaremos depender del cálculo de `lifeStatus` de forma hardcodeada donde haya un trait. Los evaluadores usarán proyecciones universales.

## 16. Rule IDs
Se propondrán 2 Rule IDs (tras auditar el Registry para no pisar IDs existentes):
- `COMBAT-HELPLESS`: Clasificación y consecuencias generales (DEX defensiva, Sneak Attack).
- `ACTION-COUP-DE-GRACE`: La acción específica, su validación, crítico y muerte.

## 17. Test Strategy
La estrategia de tests cubrirá los siguientes casos:
- **Crítico automático**: No consume RNG de ataque ni confirmación, no registra natural 20, usa los componentes multiplicables correctos, no multiplica Sneak Attack, no activa reglas de natural 20.
- **Acción pendiente**: Declaración genera AdO y crea intención pendiente. Segunda declaración denegada. Parámetros congelados. Actor sobrevive y reanuda (aplica efecto). Actor muere/incapacitado/desplazado (cancela acción). Target deja de ser helpless o muere en la cola (cancela acción). Sin doble consumo/daño/save.
- **Defensa**: DEX 18 helpless usa -5. DEX 8 helpless usa -5. `NO_DEX_TO_AC` sin `HELPLESS` no fuerza -5. Flat-Footed no duplica. Paralyzed recibe la semántica por `HELPLESS`. Servidor y UI producen el mismo breakdown.
- **Muerte**: Daño letal por HP no duplica save/muerte. Sobrevive al daño y pasa save. Sobrevive al daño y falla save. Muerte por save efectúa transición y logs únicos. CD usa daño real. Target `dead` es rechazado atómicamente.
- **Inmunidad**: `IMMUNE_TO_CRITICAL_HITS` rechaza en preflight de forma agnóstica al tipo de criatura.
- **UI**: Botón y visibilidad atados a objetivo válido. Estado pendiente y errores autoritativos.

## 18. Opción Recomendada
**Opción A (Helpless Combat completo)**. El diseño cubre la defensa helpless, DEX defensiva 0, +4 melee, ataque, Sneak Attack, Coup de Grace, armas/alcance, crítico automático real, DamageBundle correcto, Fortitude, muerte canónica, inmunidad a críticos, AdO con suspensión/reanudación, UI, tests y trazabilidad.

## 19. Definition of Done
- Proyección pura para defensa implementada e integrada (impone DEX 0 y suprime bonos).
- `canApplySneakAttack` permite furtivos contra `HELPLESS`.
- Comando táctico `coup-de-grace` y su contraparte de reanudación.
- Validación de `isValidCoupDeGraceTarget`.
- Resolución atómica: impacto y crítico automático (sin RNG 20) -> Daño -> Salvación si sobrevive (CD 10+daño real) -> Muerte canónica y única.
- Suspensión y reanudación segura de la acción ante AdO.
- UI completa (botón, preview, advertencias, pending states).
- Tests que pasen todos los escenarios detallados.
