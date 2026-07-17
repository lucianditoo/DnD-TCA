# Sprint Arquitectónico 024 — Automatización de salvaciones tácticas

## Estado

Diseño aprobado. Implementación completada y validada mediante `PROCEED`.

## Objetivo

Resolver salvaciones de Fortaleza, Reflejos y Voluntad automáticamente en el servidor cuando un conjuro válido impacta o alcanza a su objetivo. La salvación, la mitigación de daño o la anulación del efecto, el consumo del slot y los logs se comprometen como una sola transición de sala.

## Arquitectura

### Contrato declarativo

Cada `SpellDefinition` declara:

- `savingThrowType: "fortitude" | "reflex" | "will" | "none"`;
- `saveEffect: "none" | "half" | "negates"`.

El cliente nunca envía CD, tipo de salvación, efecto de la salvación ni tirada del defensor. Todo se deriva del slot y de `SpellsCatalog`.

### Regla pura

`rules.ts` expone una evaluación estricta de `d20 + modificador` contra CD, con validación de límites y las reglas de 1 natural como fallo automático y 20 natural como éxito automático. `Rules.totalSavingThrow` sigue siendo la única fuente del modificador efectivo del defensor.

### Resolución autoritativa

El handler `cast-spell` mantiene tres etapas:

1. **Preflight:** ownership, turno, acción, slot, objetivo, rango e input.
2. **Resolve:** ataque o resolución automática; si procede, tirada interna de salvación, DC dinámica y transformación declarativa del resultado.
3. **Commit:** daño/estado, slot gastado, acción, esfuerzo, stats, fase y logs se aplican sobre una copia de trabajo y reemplazan la sala una sola vez antes del broadcast.

La automatización se compone sobre `resolveAttack` y `resolveAbility`; ninguno recibe conclusiones mecánicas desde la red.

### Bundle descriptivo

El servidor representa la salvación con un bundle que conserva tirada natural, modificador, total, CD, tipo, éxito y efecto declarativo. Esto permite agregar en el futuro gates de SR, Evasion o metamagia sin alterar los command handlers.

### UI

`ActionsPanel` obtiene la CD mediante `Rules.calculateSpellSaveDC`, el bono del objetivo mediante `Rules.totalSavingThrow` y las etiquetas desde el catálogo. React solo proyecta el mismo snapshot compartido; no decide el resultado ni calcula reglas alternativas.

## Design Review Checklist

### Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería acoplar la mitigación a handlers WebSocket o a tipos concretos de conjuro. El pipeline separa definición, evaluación de salvación y transformación del resultado. Evasion podrá transformar `half` en cero ante éxito; Spell Resistance podrá insertar un gate anterior a la aplicación; la metamagia podrá transformar el bundle de daño o CD. Ninguno requerirá cambiar el comando `cast-spell`.

### Complejidad accidental

La salvación manual existente acepta CD y tirada desde la red, por lo que no puede ser la autoridad del lanzamiento automático. Se conserva como herramienta táctica histórica, pero el lanzamiento obtiene tipo y CD del catálogo y genera la tirada en el servidor. La UI reutiliza `Rules.calculateSpellSaveDC` y `Rules.totalSavingThrow`; no duplica fórmulas ni probabilidades.

### Matriz de reutilización

- **ActiveEffects:** `totalSavingThrow` ya incorpora modificadores y overrides activos. Los efectos negados se materializan únicamente si la salvación falla.
- **Pure helpers:** se reutilizan CD dinámica, salvaciones efectivas, rango, objetivos y snapshots inmutables.
- **Resolvers:** ataques de toque siguen en `resolveAttack`; daño, curación y efectos siguen en el pipeline de habilidades.

### Regla de tres

1. Fireball: Reflejos reduce el daño a la mitad.
2. Venenos: Fortaleza decide daño o estado inicial y secundario.
3. Aliento de dragón o mirada petrificante: salvación declarativa sobre daño o condición.

### Matriz de impacto

- [x] Rule Engine: evaluación pura de límites críticos.
- [ ] CombatRoom: no persiste estados intermedios de salvación.
- [ ] WebSocket: no cambia el payload; la tirada es interna.
- [x] UI: preview de CD, bono y consecuencia.
- [x] Tests: unitarios, integración transaccional y E2E.

## Riesgos y mitigaciones

- **Recursión de efectos:** un lanzamiento solo materializa efectos en el commit; no redispara el resolver.
- **Mutación parcial:** la resolución trabaja sobre una copia y solo reemplaza la sala al finalizar.
- **Críticos diferidos:** la mitigación se aplica al bundle normal antes de almacenarlo como amenaza crítica.
- **Manipulación del cliente:** el comando no contiene salvación, CD ni `saveEffect`.

## Fuera de alcance

- Evasion e Improved Evasion.
- Resistencia a conjuros.
- salvaciones periódicas al inicio o fin de turno;
- múltiples objetivos y áreas;
- contraconjuros y concentración.

## Validación

- daño `half` redondeado hacia abajo y mínimo 1 cuando existe daño conectado;
- `negates` impide materializar el efecto;
- 1 y 20 naturales prevalecen sobre modificadores y CD;
- consumo de slot, acción, daño/efecto y logs ocurren en un commit;
- `npm test`, `npm run typecheck`, `npm run build` y E2E WebSocket en verde.
