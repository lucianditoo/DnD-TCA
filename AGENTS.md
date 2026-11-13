# D&D 3.5 Tactical Combat Assistant

Estas son las instrucciones operativas del repositorio. Aplicá [GOVERNANCE.md](GOVERNANCE.md) para riesgo, autorización y publicación. [CODEX_GUIDE.md](CODEX_GUIDE.md) explica qué habilidad de ECC cargar cuando haga falta.

## Inicio y alcance

1. Para editar, comprobá rama, HEAD y `git status --short`. Usá `develop` actualizado para las tareas ordinarias según la política de publicación. Preservá cambios ajenos. Si hay solapamiento, aislá el trabajo cuando el host lo permita o resolvé el conflicto con el usuario. Compará con la base remota antes de publicar.
2. Definí objetivo, alcance, criterios de aceptación, nivel A–D y comprobaciones. Para cambios chicos alcanza un plan breve en el chat. Para C/D seguí el diseño y la revisión que pide la gobernanza.
3. Leé el código, los tests y las fuentes de la vertical afectada. Consultá [INDEX.md](INDEX.md) para ubicarlas. Para reglas SRD consultá el Registry, el NDD aplicable y la fuente normativa pertinente. Para contratos y arquitectura consultá el ADR/NDD afectado. Leé estado, backlog o último cierre cuando la tarea dependa de ellos. Ante una discrepancia, verificá la evidencia y corregí la vista derivada si entra en alcance. Si cambia el comportamiento esperado o quedan decisiones incompatibles, pedí una definición.

## Ejecución y recuperación

- Una solicitud de implementación con alcance claro habilita el trabajo según la gobernanza. Una vez autorizado, el agente principal lleva la tarea hasta el cierre, incluidas pruebas, correcciones y documentación. Conservá autoridad del servidor, reglas puras, catálogos canónicos y snapshots inmutables. Revisá los [invariantes técnicos](.ai/DO_NOT_BREAK.md) que apliquen.
- Para un defecto reproducible, capturá el fallo con una regresión automatizada en la capa más cercana al contrato y comprobá que falla por la causa esperada antes de corregir. Si el entorno impide reproducirlo, registrá la limitación y la evidencia disponible. Para comportamiento nuevo, cubrí el contrato observable y los bordes relevantes. Para refactors, verificá la equivalencia con las pruebas existentes y agregá cobertura si falta para un riesgo concreto.
- Empezá por el verificador más específico. Si falla, registrá problema, hipótesis, cambio y resultado. Un ciclo consume un intento al aplicar una corrección y volver a verificarla. El máximo es **tres ciclos por causa** dentro de la tarea, incluyendo CI y reanudaciones. Síntomas de la misma causa comparten contador. Un fallo de entorno confirmado se reporta con su requisito faltante. Tras el tercer fallo, pausá el trabajo dependiente y entregá la evidencia y la decisión necesaria para seguir. Continuá las partes independientes que sigan en alcance.
- El agente principal integra y verifica el resultado. Puede usar un subagente para una revisión independiente de riesgo alto o una investigación realmente separable si el host y la autorización lo permiten. Dale una pregunta concreta, un diff o rutas acotadas y una salida breve con evidencia. Para escrituras paralelas, exigí superficies sin solapamiento y verificá la integración. Evitá duplicar una investigación que ya está resuelta.

## Verificación y cierre

- Revisá el diff propio, los criterios de aceptación y la matriz de verificación en [GOVERNANCE.md](GOVERNANCE.md#52-nivel-de-cambio-y-evidencia). Ejecutá `git diff --check`. Reutilizá resultados observados para el mismo alcance y estado de código. Si cambia un insumo relevante, repetí las comprobaciones afectadas.
- Actualizá la fuente documental cuyo contenido cambió. Para nuevas reglas o estados de reglas, sincronizá el Registry y su evidencia. Actualizá el inventario PHB si cambia su cobertura, el índice si cambian rutas o responsabilidades, y los documentos de estado o pendientes si cambia el dato que poseen. Verificá enlaces tocados y correspondencia entre código, pruebas y documentación.
- Aplicá la política de publicación y revisión de [GOVERNANCE.md](GOVERNANCE.md#53-publicación-y-revisión). Informá resultado, verificaciones observadas, pendientes y, si existe, SHA o PR. Diferenciá validación local, CI y dictamen arquitectónico.

## Continuidad

Cuando se interrumpa una tarea, dejá un resumen breve en el chat o en el Issue/PR existente si corresponde. Incluí objetivo autorizado, rama y HEAD, decisiones y diff, comprobaciones ejecutadas, ciclos por problema y siguiente acción. Antes de retomar, contrastá ese resumen con Git y verificá qué evidencia sigue vigente. Al cerrar, usá `walkthrough.md` cuando haya evidencia material que dejar en el repo y el commit o PR no sea suficiente. Los hechos durables van a su fuente canónica. Un hook o la compactación pueden ayudar a recuperar contexto. La referencia de continuidad es el estado verificable del trabajo.
