# Gobernanza del Proyecto

DnD TCA modela el combate táctico de D&D 3.5. Este documento define las garantías técnicas, el alcance de la autonomía y la evidencia exigida. [AGENTS.md](AGENTS.md) contiene el flujo operativo y [INDEX.md](INDEX.md) ubica las fuentes del proyecto.

## 1. Garantías técnicas

- El servidor decide legalidad, ownership, RNG, consecuencias y commit. La UI expresa intenciones y muestra previews. Probá la paridad del preview con la resolución autoritativa cuando cambie ese contrato.
- Conservá las fronteras entre catálogos canónicos, proyecciones inmutables, reglas puras, resolución y commit. La cobertura de reglas usa Rule IDs estables y evidencia ejecutable. Consultá el [Registry](docs/rules/registry.md) y el NDD de la vertical.
- Mantené compatibilidad con datos y consumidores soportados. Para cambios de contratos, revisá esquemas, callers, versiones y rutas de error. Las migraciones requieren una estrategia de transición y recuperación.
- La evidencia describe resultados observados. Registrá fallos previos, pruebas bloqueadas y resultados pendientes. Preservá el trabajo ajeno y protegé secretos y datos sensibles.

## 2. Gobernanza documental

### 2.1 Fuente canónica y mantenimiento

Cada hecho tiene un dueño. [INDEX.md](INDEX.md) localiza esas fuentes. El código y las pruebas muestran el comportamiento observado. El SRD, el NDD y los ADR vigentes establecen la intención aplicable. Si divergen, registrá qué diverge y resolvé dentro del alcance autorizado o escalá si exige una decisión de producto o arquitectura.

### 2.3 Ciclo de vida

Mantené los documentos activos, de referencia, históricos y plantillas identificables. Corregí referencias obsoletas que afecten la tarea. Conservá diseños y revisiones históricos cuando aporten trazabilidad. Al reemplazar un documento, preservá el contenido útil, actualizá enlaces entrantes y comprobá que el destino sea accesible antes de retirar el origen.

### 2.5 Documentos nuevos

Reutilizá el dueño existente si admite el contenido. Si un documento nuevo aporta una responsabilidad propia, identificá propósito, relación con artefactos previos y estado de vigencia, y enlazalo desde el índice o desde su fuente de entrada. Guardá el plan persistente junto con el diseño de la vertical o en el Issue/PR de la tarea.

## 3. Decisiones arquitectónicas

Usá un NDD para definir comportamiento de una vertical, casos límite y evidencia esperada. Registrá en `docs/adr/` las decisiones estructurales difíciles de revertir y sus consecuencias. Referenciá decisiones vigentes desde el diseño. Para análisis de alto impacto, revisá compatibilidad, alternativas, rutas de fallo y recuperación. Los diseños históricos documentan su autorización y ejecución originales. Su existencia no concede autorización nueva.

## 4. Alcance y autonomía

Una petición de ejecutar una tarea con objetivo y límites claros autoriza los pasos ordinarios dentro de ese alcance, incluida la validación y la documentación necesaria. Una petición de análisis o diseño termina en ese entregable. El agente avanza con supuestos reversibles cuando puede verificarlos. Consulta al usuario si falta una decisión material, debe ampliar el alcance o necesita una autorización que todavía no tiene.

En A/B y C con diseño vigente, alcance acotado y comportamiento determinado, la autorización de implementar es suficiente. Para C con una decisión normativa nueva o D con un cambio de contrato, autoridad, persistencia o arquitectura difícil de revertir, obtené acuerdo sobre la decisión de diseño antes de modificar esa superficie. Podés usar un diseño ya aceptado y una autorización vigente. Los gates específicos de una tarea, los límites del propietario y las restricciones del host siguen aplicando.

## 5. Evidencia y revisión

### 5.2 Nivel de cambio y evidencia

Clasificá según el efecto real, con el nivel más alto que aplique a la implementación. Un diseño sin código se verifica documentalmente y recibe la revisión de diseño correspondiente al cambio futuro.

| Nivel | Alcance típico | Evidencia para cerrar |
|---|---|---|
| A | Documentación, análisis o cambios operativos sin ejecución de la aplicación | Diff, enlaces tocados y coherencia entre instrucciones, fuentes y alcance. Para cambios de metodología, recorré escenarios representativos. |
| B | UI o cambio localizado, reversible y sin cambio de regla, autoridad ni contrato | Pruebas focalizadas y typecheck del workspace afectado para cambios de código. Build si cambia el empaquetado o las dependencias entre workspaces. Verificación UI cuando cambie una interacción o presentación relevante. |
| C | Reglas SRD, resolvers, catálogos o integración con impacto en el comportamiento de combate | Diseño vigente o actualizado, regresiones y tests de la regla, límites y callers afectados. Suite global, typecheck y build. WebSocket y UI cuando cambien flujos observables por esas superficies. Revisión arquitectónica focalizada en el diff. |
| D | Contratos compartidos, autoridad, persistencia, migración o infraestructura transversal | Diseño y plan verificable, compatibilidad y recuperación según el cambio. Suite global, typecheck, build y E2E WebSocket. UI cuando la superficie cambie. Revisión arquitectónica independiente antes de integrar y revisión defensiva de seguridad cuando corresponda. |

La [guía de ejecución](CODEX_GUIDE.md#verificadores) ubica los comandos. Cuando un gate requerido se cubra con Windows CI autorizado, evitá repetirlo por rutina. Verificá el resultado sobre el candidato correspondiente y registrá cualquier comprobación local que siga siendo necesaria. Sin entorno disponible o resultado observado, el gate queda pendiente.

### 5.3 Publicación y revisión

`develop` es la rama permanente de trabajo. Partí de `origin/develop` actualizado y agrupá los cambios de cada tarea en un commit descriptivo. Publicá las tareas autorizadas directamente en `develop`, sin PR individual y mediante push normal. Conservá los cambios ajenos y resolvé cualquier divergencia antes de publicar. `master` es la rama estable y su actualización requiere autorización explícita del propietario y respeto de sus protecciones.

Aplicá las pruebas y revisiones del nivel correspondiente. Si se requiere revisión independiente, obtené el dictamen sobre el diff o SHA del candidato antes de incorporarlo a `develop`. Registrá la evidencia y las aprobaciones en el registro de la tarea. Cuando corresponda Windows CI, usá el workflow existente sobre el SHA de `develop` y comprobá el resultado. El push a `develop` no activa por sí solo ese workflow. Un CI verde acredita sus verificadores. El dictamen arquitectónico acredita los invariantes y decisiones revisados.

En C, el agente principal puede hacer la revisión focalizada si el diseño ya está aceptado y el cambio conserva contratos e invariantes. Una revisión independiente aporta valor cuando el impacto es transversal, hay incertidumbre normativa material o existe riesgo de que implementación y verificación compartan el mismo supuesto. En D, usá un revisor independiente habilitado por el host o un revisor humano. Una revisión independiente pendiente se informa como tal.

### 5.6 Auditorías

Abrí una auditoría cuando se cierre una épica con impacto cruzado, haya divergencia normativa, deuda acumulada que dificulte el cambio o evidencia de regresiones repetidas. Acotá la auditoría a la evidencia y al área afectada.

## 6. Continuidad

Git conserva el historial de cambios. Los ADR conservan decisiones durables. El estado integrado, el backlog y la evidencia de reglas se actualizan en las fuentes localizadas en [INDEX.md](INDEX.md). Usá el registro de la tarea o del chat para reanudar trabajo en curso y [AGENTS.md](AGENTS.md#continuidad) para su contenido mínimo.
