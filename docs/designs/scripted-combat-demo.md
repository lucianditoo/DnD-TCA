# Demostración táctica automática y guionada

Responsabilidad: Cómo reproducir encuentros demostrativos mediante el motor productivo sin simular sus consecuencias.
Autoridad: Canónica para la vertical demo, subordinada a las reglas de combate vigentes.
Lifecycle: Diseño
Reemplaza: —
Complementa: [Combat Engine](../architecture/combat-engine.md), [Pipeline oficial](modifier-pipeline-architecture.md).
Consumidores: Propietario, implementador de la demo y Architecture Reviewer.

**Estado: remediación R1, pendiente de Gate Final Acotado; no implementada.**
Baseline original: `116d7e1`; remediación contrastada con `9a6b87d`. I5R1 no es dependencia de esta propuesta y su aprobación permanece separada. Nivel previsto de implementación: **D**, por la orquestación de comandos y el aislamiento de ejecución. Este documento no concede Proceed.

## 1. Objetivo y experiencia

Un clic en **Empezar demo** abre el tablero cargado y reproduce automáticamente una secuencia de encuentros. El usuario observa acciones reales, tiradas identificadas como preparadas, cambios de HP, condiciones, recursos y logs. No controla manualmente enemigos ni completa confirmaciones.

La demo es un guion, no IA, replay de estados, vídeo ni segundo motor. Cada consecuencia del combate procede de los handlers y reglas normales. La narración distingue intención, resultado observado y explicación; nunca anuncia éxito antes de confirmarlo.

Controles: pausar/continuar, siguiente paso cuando está pausada, velocidad de presentación, reiniciar escena, reiniciar demo y salir. El panel muestra escena, paso, actor, intención, estado de ejecución y mecánica observada. Selección visual y consulta de fichas siguen disponibles; los controles que mutan combate quedan deshabilitados durante la demo.

Objetivo orientativo: 5–8 minutos a velocidad normal, sin convertir esa duración en condición funcional. No requiere cámara nueva, sprites, sonidos ni animaciones. Se reutilizan Board, selección, CombatLog y ResultScreen actuales; el progreso y la explicación forman un panel adicional.

## 2. Evidencia y reutilización

| Componente existente | Responsabilidad que se conserva | Límite constatado |
|---|---|---|
| `packages/shared/src/demo-data.ts` | Fábricas de sala y combatientes desde fuentes | `demoBoard` es 16×8 sin terreno; no es un encuentro guionado. La nueva instancia de Board debe ser propia, nunca mutar la referencia compartida. |
| `apps/server/src/commands/roomCommands.ts` | Registro de participante y creación de sala | `create-room` no carga escenarios completos. |
| `apps/server/src/commands/dispatcher.ts` | Enrutamiento a handlers y gates de fase | Ya impide avanzar durante críticos/AdO; no tiene runner ni contexto de dados de demo. |
| `apps/server/src/auth/control.ts` | Ownership, GM y control de turno | El GM puede usar acciones normales solo sobre combatientes controlados por GM. |
| `attackCommands.ts` / `abilityCommands.ts` | Ataques, críticos, conjuros y recursos | Admiten opciones de dados en determinados handlers; no existe inyección completa por sesión desde el dispatcher. |
| `specialManeuverCommands.ts` | Maniobras y oposición transaccional | `ManeuverDiceSource` permite dados por propósito; hay llamadas auxiliares que deben inventariarse al implementar. |
| `apps/web/src/hooks/useWebSocketRoom.ts` | Conexión, `hello`, `room-update`, errores | No proporciona confirmación correlacionada de pasos de demo. |
| `scripts/e2e-websocket.mjs` | Ejemplos de comandos reales y comprobaciones | No es un guion visual; no debe ejecutarse como demo. Documenta que no hay edición de bloqueadores por WebSocket. |
| `apps/server/src/index.ts` | Servidor en puerto 3333 | `/api/test/reset` elimina todas las salas: **prohibido reutilizarlo para la demo**. |

Los paths de handlers abreviados pertenecen a `apps/server/src/commands/`. Los contratos compartidos viven en `packages/shared/src/types.ts`; el servidor valida comandos mediante `apps/server/src/validation/validateClientCommand.ts`.

El catálogo contiene Bane (incluye Sneak Attack), Cedrick, Elaen y Canocrock. No contiene una criatura Large ni un mago específico de demostración. Se requieren perfiles de escenario explícitos, construidos con las fábricas source-first; no agregar estadísticas finales ni modificar los personajes canónicos para acomodar el guion.

## 3. Alcance cerrado de la primera entrega

Incluye tres escenas independientes, reproducción automática, controles, preparación aislada, dados repetibles, resultados comprobados y pruebas de extremo a extremo.

No incluye reglas nuevas, correcciones SRD, editor de mapas, persistencia de demos, importación de guiones del usuario, replays de partidas, IA, multijugador interactivo de demo, ni integración de I4/I5/I6. No redefine Movement Cost, Cover, LoE, Vision o Concealment.

La demo prueba **la versión productiva existente**; no certifica cobertura completa del PHB. En particular, no presenta Haste, vuelo, iluminación avanzada, AoE ni el nuevo contexto diagonal como funcionalidades completas. Las desviaciones conocidas no se arreglan mediante el guion. Se evitan diagonales difíciles consecutivas y otras combinaciones pendientes; la pantalla informa ese límite.

## 4. Autoridad y aislamiento

### 4.1 Sala de demostración

La solicitud de inicio solo selecciona una demo incorporada al servidor. No acepta un Board arbitrario, resultados, estadísticas, código ni un tape de dados enviado por el cliente.

El servidor crea una sala distinta, un Board clonado y combatientes nuevos. El participante propietario es el GM real registrado de esa conexión; todos los personajes de la demo se crean con control GM. No se omiten verificaciones de permisos, vida, turno, fase, alcance, economía o recursos.

La pertenencia a una sesión demo y su propietario se mantienen en un registro efímero del servidor, separado de `CombatRoom` y `CombatRulesSnapshot`. No son condiciones ni flags de reglas. En esa sala solo el runner puede originar comandos de combate; el propietario envía controles de reproducción. El servidor rechaza mutaciones ordinarias externas y el ingreso de otros participantes a esa sesión V1.

La preparación carga únicamente datos iniciales: mapa, perfiles, posiciones legales, inventario y slots. No usa HP reducidos o estados aplicados para hacer pasar por ejecutada una acción. Iniciativa se fija y ordena por los comandos existentes. Los límites/colisiones de las posiciones iniciales se verifican con helpers compartidos, no con otra geometría.

Reiniciar o pasar de escena cancela el trabajo pendiente y crea una nueva instancia aislada; nunca restablece partidas del usuario, localStorage ni el catálogo. Salir cancela temporizadores, cierra la sesión y retira únicamente sus salas. Desconectar pausa y cancela ejecución pendiente; reconectar/reanudar una sesión no forma parte de V1: se ofrece empezar otra. Debe existir limpieza de sesiones abandonadas con un plazo acotado documentado en implementación.

### 4.2 Frontera de comandos

El runner crea los mismos `ClientCommand` de combate que el cliente normal y los entrega al camino de validación, autorización, dispatch y handlers existente. No llama al resolver matemático para aplicar luego mutaciones por su cuenta.

La entrada externa y la ejecución interna comparten esa frontera. La extensión necesaria permite pasar dependencias de ejecución de demo a los handlers que ya admiten dados inyectables; el cliente no puede seleccionar esas dependencias. No se crean versiones de las reglas ni handlers de ataque/movimiento alternativos.

Las dependencias de ejecución se suministran mediante una entrada interna del dispatcher, accesible al runner del servidor. No pertenecen a `ClientCommand`, a los controles de demo ni a ningún objeto deserializado desde red. El receptor WebSocket conserva el despacho ordinario sin opciones de dados; solo la sesión interna autorizada proporciona la fuente preparada. Un payload externo no puede activar esa entrada mediante flags ni campos adicionales.

Reutilizar handlers no implica que todos sean transaccionales: el movimiento productivo muta la sala directamente y el lanzamiento puede registrar AdO y retornar antes de ejecutar el conjuro. El runner debe observar esas transiciones reales, sin asumir rollback general ni reintentar comandos por falta de un efecto final.

## 5. Guion declarativo y ejecución

El escenario contiene: identificador/versionado del guion, Board inicial, perfiles, aliases estables de actores, iniciativa, pasos ordenados, solicitudes de dados esperadas y checkpoints. Aliases se resuelven a IDs de la sala creada; nunca se reutilizan IDs de otra ejecución.

La preparación registra la correspondencia entre cada alias y el ID generado al crear ese actor. No deduce identidad exclusivamente del nombre visible ni de la plantilla: pueden repetirse. La correspondencia es única dentro de la ejecución y se descarta al reiniciarla.

Un paso declara intención, actor/objetivo por alias, parámetros permitidos por el comando normal, explicación y resultado observable esperado. No contiene callbacks normativos ni fórmulas duplicadas de ataque, defensa o movimiento. Los checkpoints verifican hechos del resultado: posición final, actor activo, fase, condición, recurso consumido o transición de HP. Los totales que se muestren provienen del servidor/proyecciones compartidas.

Flujo de reproducción:

`preparando → pausada o reproduciendo → ejecutando un comando → verificando resultado → pausa de presentación → siguiente paso → completada`

Cualquier rechazo no previsto, dado inesperado, timeout o checkpoint incumplido conduce a `fallida`, deteniendo nuevos comandos. Se informa escena/paso y error; nunca se reintenta una mutación automáticamente ni se corrige el estado para continuar.

Solo hay un comando en curso por sesión. El servidor asigna secuencia al avance de la demo y comunica el paso confirmado junto con la vista de sala correspondiente. No se interpreta cualquier `room-update` como éxito. Las pausas temporales son únicamente visuales: la corrección depende del retorno del handler y del checkpoint, no de sleeps.

Pausar detiene antes del próximo comando; el comando síncrono ya iniciado termina y su resultado se muestra. Siguiente paso ejecuta exactamente un comando y vuelve a pausar. Las confirmaciones de crítico y AdO son pasos explícitos del guion: pueden observarse por separado, pero en reproducción automática se resuelven sin intervención humana.

Los controles incluyen identidad de sesión/ejecución y secuencia para rechazar pulsaciones duplicadas o mensajes de una ejecución reiniciada. Esto es un contrato acotado de demo, no versionado global de las salas. Velocidad no altera dados, legalidad ni orden. Nunca usar `eventSequence` como acuse genérico de comandos de combate.

## 6. Dados reproducibles

Cada escena dispone de una secuencia de tiradas del lado servidor, asociada a paso, propósito cuando exista y caras del dado. Solicitudes imprevistas, valores fuera de rango o tiradas sobrantes en un checkpoint detienen la demo; no hay fallback aleatorio silencioso.

Se reutilizan `PhysicalAttackExecutionOptions`, `CastSpellExecutionOptions` y `ManeuverDiceSource`. Se identifican todas las tiradas transitivas de las acciones seleccionadas, incluidas precisión, ocultación y confirmación. Cualquier extensión necesaria se limita a transportar esa dependencia, conservando el comportamiento por defecto de las partidas normales. No parchear `Math.random` globalmente.

La reproducibilidad aún no está demostrada. Por ejemplo, el AdO interruptivo en `specialManeuverCommands.ts` usa la fuente inyectada para d100, pero delega otros dados a `rollDice`. El plan debe inventariar y cubrir estas llamadas transitivas antes de aceptar la escena; disponer de una opción `diceRoller` en un handler no acredita por sí solo el aislamiento completo. Los tests deben detectar cualquier consumo mecánico fuera de la fuente preparada, sin exigir IDs o timestamps deterministas.

Donde el protocolo normal ya admite tirada manual, el runner puede suministrar el valor permitido; donde el servidor tira, se inyecta la fuente preparada. Ambos casos se rotulan **Tirada preparada de demostración**. No se aceptan totales de impacto ni resultados de salvación del guion: los calcula el motor.

Reproducible significa mismos resultados mecánicos y progresión, no IDs ni timestamps idénticos. La demo debe detectar cambios de reglas que invaliden el fixture; nunca adaptar sus dados dinámicamente para ocultarlos.

## 7. Encuentros y guion propuesto

Todas las coordenadas siguientes son anclas x/y a `zFeet = 0`, en casillas de 5 ft. Son fixtures propuestos, no nuevas autoridades geométricas. El orden y presupuesto de cada acción deberán pasar los comandos reales en la prueba de aceptación antes de considerar el guion ejecutable. No se promete aquí una tirada mínima o un daño calculado manualmente.

### 7.1 Escena A — La emboscada

Board despejado 12×8. Cedrick en (3,3), enemigo resistente en (4,3), Bane en (6,3), Elaen en (1,6). Perfiles derivados de las plantillas; HP inicial explícito suficiente para sobrevivir a la exhibición, sin curaciones encubiertas. Iniciativa: enemigo, Cedrick, Bane, Elaen.

| Orden | Intención real | Qué debe verse |
|---|---|---|
| 1 | Ordenar iniciativa; enemigo termina su turno | Inicio de combate y expiración de su condición inicial de desprevenido. |
| 2 | Cedrick realiza ataque estándar y termina | Tirada, CA y HP modificados por el handler. |
| 3 | Bane se mueve de (6,3) a (5,3) | Ruta legal y gasto productivo actual; queda opuesto a Cedrick. |
| 4 | Bane declara ataque estándar y ataca al enemigo con amenaza de crítico preparada | Flanqueo, precisión elegible y fase de confirmación. |
| 5 | Confirmar crítico mediante comando normal; terminar turno | Resultado real de crítico; dados de precisión no multiplicados. |
| 6 | Elaen dispara y termina | Ataque a distancia y consumo de munición del inventario. |

Si aparece un AdO inesperado, el fixture falla; no se limpia con comando GM. La escena concluye como demostración completada, no como victoria inventada. El encuentro puede seguir teniendo enemigos vivos.

### 7.2 Escena B — Posición, cobertura y espacio estrecho

Board 16×8 con tres zonas separadas. Cada actor tiene su turno ordinario, los demás terminan el suyo mediante `end-turn` cuando el guion lo indica.

- **Cobertura:** Elaen (1,1), aliado interpuesto (3,1), enemigo (5,1). Primer disparo con cobertura por criatura. El aliado se aparta legalmente a (3,2) en su turno; el siguiente disparo de Elaen permite comparar la proyección sin interposición. No se atribuye cobertura a `impassableCells`.
- **AdO:** combatiente que se retira caminando de (9,1) hacia (11,1), pasando por (10,1), y enemigo melee en (9,2). Se usa ruta de dos pasos para no presentar como corregido el gap conocido de un paso. Al aparecer la fase pendiente, el guion resuelve el AdO por su ID real antes de continuar.
- **Large:** perfil de guardián Large, ancla inicial (0,5). Celdas estrechas (1,5) a (5,5); muros (2,6) a (5,6). Ruta ortogonal por (1,5), (2,5). La preparación verifica la huella inicial libre. Se observa ocupación comprimida, coste del flujo productivo y condición Squeezing. Sin terreno difícil superpuesto.
- **Terreno:** un actor independiente recorre (12,5) → (13,5) → (14,5), siendo (13,5) difícil. Permite observar el gasto adicional sin diagonales ni Squeezing.

No se confirma el éxito visual por mera animación: cada tramo requiere posición, fase y estado recibidos del servidor. Esta escena no aprueba la implementación futura del movimiento normativo.

### 7.3 Escena C — Maniobras y magia

Board despejado 12×8 con dos grupos separados. Cedrick (2,2) y defensor (3,2); lanzador preparado (8,5) y otro enemigo (9,5). El lanzador es un perfil de demo con slots explícitos para `srd_shocking_grasp` y `srd_hold_person`, equipo catalogado y puntuaciones base; no depende del localStorage del usuario.

| Orden relativo | Acción | Evidencia |
|---|---|---|
| 1 | Cedrick intenta Trip | Si provoca, AdO interruptivo preparado sin daño; toque y oposición reales; `srd_prone` solo si el motor lo aplica. |
| 2 | Defensor se levanta en su turno | Retirada de Prone y resolución explícita de los AdO que realmente genere. |
| 3a | Primer `cast-spell` de Shocking Grasp desde (8,5) | El enemigo en (9,5) amenaza y dispone de un AdO. El handler registra la oportunidad y retorna: fase `opportunity-resolution`, slot intacto y conjuro todavía no ejecutado. |
| 3b | `resolve-opportunity-attack` por el ID recibido | Tirada preparada sin daño, oportunidad resuelta y retorno a `active`; lanzador habilitado, slot aún intacto. El defensor de este fixture tiene un único AdO disponible por ronda, sin fuentes de oportunidades adicionales. |
| 3c | Segundo `cast-spell`, con el mismo slot y objetivo | Tras comprobar que no quedan oportunidades disponibles del defensor, el comando vuelve a pasar todas las validaciones y ejecuta el toque; el slot se consume conforme al handler. |
| 4a–4c | Al siguiente turno del lanzador, Hold Person | Si el defensor recuperó su AdO y sigue amenazando, repetir explícitamente intento → resolución del AdO sin daño → segundo lanzamiento. Solo el lanzamiento efectivo realiza la salvación de Voluntad y consume el segundo slot. |

Esta secuencia describe el comportamiento productivo de `handleCastSpell`: no existe un conjuro pendiente que se reanude automáticamente. El segundo lanzamiento es un paso declarado y condicionado a los checkpoints anteriores, no un retry genérico. Cada comando puede observarse mediante Siguiente paso. Si el lanzador deja de estar habilitado, queda otra oportunidad pendiente o el slot se consumió antes de lo previsto, la demo falla y se detiene; no limpia oportunidades ni fuerza el lanzamiento. No se agrega Concentration ni otra regla para completar la escena.

Los turnos intermedios se terminan legalmente; no se reinicia la economía para adelantar el guion. Los resultados preparados pretenden mostrar las ramas de éxito, pero cada fixture debe demostrar que el catálogo, inmunidades y validaciones lo permiten. La narración presenta los conjuros tal como están implementados, no certifica que todo su modelado PHB esté completo.

Se omiten Grapple, Bull Rush, AoE, Haste y el resto de mecánicas en esta primera entrega. Podrán incorporarse como nuevas escenas después; no son condición para entregar una demo útil.

## 8. Contratos de presentación y transporte

Se utiliza el mismo transporte WebSocket, con contratos especializados `DemoClientCommand` y `DemoServerEvent` definidos y exportados por `@dnd-tactical/shared`. Sus discriminantes son distintos de los comandos normativos de combate; se incorporan al envelope de transporte sin convertir los controles en acciones del motor. El servidor los valida con schemas Zod antes de despacharlos al controlador de sesiones demo y comprueba la conexión propietaria.

La superficie comprende `start-demo`, `pause-demo`, `resume-demo`, `step-demo`, `set-demo-speed`, `restart-demo` (escena o demo) y `exit-demo`; el evento de progreso es `demo-session-state`. Inicio acepta únicamente un ID de demo incorporada. Los controles posteriores llevan identidad de sesión/ejecución y secuencia conforme a §5. El plan fijará los campos exactos y sus límites, sin cambiar esta sede única shared ni introducir un canal paralelo.

Los schemas no aceptan fuentes de dados, tapes, callbacks, estados de sala ni opciones internas del dispatcher. Los comandos GM no sustituyen estos controles. Los contratos de combate existentes conservan su significado.

El servidor publica estado de sesión (ejecución, escena, paso, estado, explicación y error) separado del snapshot de reglas. La sala continúa publicándose por el flujo existente; la progresión de demo correlaciona su resultado con un paso confirmado. La UI no manda el siguiente ataque ni decide que una tirada acertó.

Un refresh/desconexión no puede dejar comandos ejecutándose sin observador. V1 no ofrece reconexión resumible: se informa interrupción y se permite comenzar de nuevo. La implementación debe probar este lifecycle, no depender solamente de ocultar botones.

## 9. Matriz de impacto

| Área | Cambio previsto | No cambia |
|---|---|---|
| Rule Engine | Reutilización de proyecciones y validaciones | Fórmulas, Rule IDs y NDD congelados |
| CombatRoom / Snapshot | Instancias nuevas aisladas; ningún estado de reproducción dentro | Contrato normativo del combate |
| Servidor | Sesión/runner, carga de fixtures y transporte de dependencias de dados | Consecuencias calculadas por handlers existentes |
| WebSocket | Controles y progreso específicos de demo; autorización por conexión propietaria | Payloads normativos de ataques/movimiento |
| UI | Botón, panel, controles y enfoque visual del actor/objetivo | Board y renderer actuales |
| Persistencia | Ninguna; salas demo efímeras | Perfiles guardados y migraciones |
| Tests | Unidad del runner, integración real, WebSocket y Playwright | Suites existentes conservadas |

## 10. Criterios de aceptación

1. Desde la pantalla inicial, un clic carga y completa las tres escenas sin acciones manuales.
2. Todos los pasos de combate atraviesan handlers normales; no existen escrituras directas de HP, turno, posición o efectos desde el runner durante la reproducción.
3. Dos ejecuciones producen la misma secuencia mecánica, sin exigir iguales IDs/timestamps.
4. Crítico y AdO se resuelven automáticamente en reproducción y se pueden observar paso a paso al pausar.
5. Pausa, velocidad y siguiente paso no duplican comandos; reinicios invalidan toda ejecución anterior.
6. Error o checkpoint fallido detiene la demo; la UI no muestra completada una escena fallida.
7. Sala ordinaria abierta en paralelo permanece intacta al iniciar, reiniciar, salir o desconectar la demo; sus dados mantienen comportamiento normal.
8. Cliente ajeno no controla la demo ni configura sus dados; no puede invocar sus capacidades sobre una sala normal.
9. No se usa `/api/test/reset`, ni se toca localStorage, ni se conecta I4/I5.
10. Validación completa: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs`, `npm run test:ui`, `git diff --check`, más CI. Playwright debe pulsar Empezar demo y observar el final, sin saltarse el runner mediante mutaciones del test.

Pruebas específicas: orden y pausa del runner; rechazo y timeout; doble clic; dado imprevisto; aislamiento de RNG; idempotencia de controles; desconexión; reinicio durante pausa; error de una acción; mapeo de aliases; permisos; escena completa con handlers y fixtures reales. Un modo rápido de presentación para tests elimina esperas visuales, no validaciones ni acciones.

Regresiones de R1: primer lanzamiento provocador conserva slot y no aplica el conjuro; AdO confirma la transición esperada; segundo lanzamiento consume exactamente un slot; al cambiar de ronda se contempla el AdO recuperado; payload externo no puede inyectar opciones de ejecución; controles malformados fallan en Zod; aliases de personajes con nombres/plantillas repetidos conservan identidad. Las pruebas de dados incluyen las llamadas auxiliares de maniobras, no solo los resolvers principales.

## 11. Checklist arquitectónico

**Irreversibilidad a 20 sprints.** El acoplamiento peligroso sería convertir los guiones en un segundo protocolo de reglas o en grabaciones de snapshots. Se conservan intenciones ordinarias, aliases y checkpoints; cada cambio futuro del motor puede invalidar explícitamente un fixture en vez de convivir con fórmulas antiguas. Versionar el guion no crea versiones de Rule IDs.

**Complejidad accidental.** La preparación especial es necesaria porque hoy no hay loader de mapas; debe cargar escenarios incorporados, no convertirse en editor. Las fuentes de dados ya existen parcialmente: se completa su transporte para estas acciones, sin refactor general de RNG. No se construye sobre I5R1 ni se corrigen sus problemas desde la demo.

**Reutilización.** ActiveEffects conserva condiciones; rules/shared calcula previews; handlers/resolvers producen consecuencias; el runner no es un efecto ni una regla. Los IDs de conjuros/condiciones en fixtures identifican contenido, no activan matemática alternativa.

**Regla de tres.** Futuras escenas de Grapple, Bull Rush y ataques completos podrán consumir la misma orquestación una vez verificada su integración. Esto habilita su demostración, no implementa esas reglas ni promete sus extensiones pendientes.

## 12. Riesgos, alternativas y decisiones pendientes

- **Guion frágil ante cambios:** checkpoints y dados estrictos fallan visiblemente; no autocorrección.
- **Privilegios demo escapando a producción:** registro privado por sesión, propietario ligado a conexión, fixtures/dados no configurables desde red y pruebas negativas.
- **RNG transitivo incompleto:** inventariar las llamadas de cada escena antes de prometer reproducibilidad. Si requiere una reforma general, reducir la escena y pedir revisión del alcance; no parchear globales.
- **Trabajo concurrente:** no editar módulos de movimiento ni el plan raíz de I5R1. Este NDD no altera PROJECT_STATUS/walkthrough del sprint de Gravity.
- **Fidelidad:** el contenido muestra capacidades actuales y declara límites; no convierte tests verdes en afirmación de V1 completa.

Descartados: macros de clicks como arquitectura de producto (frágiles); replay de snapshots (no ejercita motor); IA (otro problema); endpoint global de reset (destruye otras salas); delays como confirmación (carreras); guiones arbitrarios cargados por clientes (superficie innecesaria).

Decisiones propuestas para aprobación: tres escenas delimitadas, tiradas preparadas explícitas, orquestación autoritativa y efímera, ausencia de takeover manual y reconexión resumible en V1. No se abre una ODR normativa de combate. Falta el gate de este diseño y el plan de implementación con fixtures/tape exactos verificados; este NDD no asegura que el guion haya sido ejecutado.

## 13. Responsabilidad documental y continuidad

No se localizó otro NDD de reproducción automática en el índice. Este documento complementa al Combat Engine porque gobierna un lifecycle de demostración, no matemática ni cobertura. Es una vertical independiente de I5R1. Se incorpora a INDEX para no quedar huérfano.

No se crea ni reemplaza `implementation_plan.md` durante esta tarea. Tras aprobar el NDD, coordinar la planificación sin sobrescribir el plan activo de Gravity. Después de su Proceed se implementará y validará la vertical completa; el diseño por sí solo no habilita el botón.

**READY FOR ARCHITECTURE REVIEW**

### Registro de remediación R1

- MAJOR 1: §7.3 explicita el ciclo real de lanzamiento/AdO/segundo lanzamiento y sus checkpoints, también para el turno siguiente.
- MINOR 1: §4.2 separa las dependencias internas de ejecución de cualquier payload externo.
- MINOR 2: §8 fija transporte WebSocket existente, contratos shared discriminados y validación Zod.
- NOTE de aliases: §5 registra identidad al crear actores, sin depender de nombres únicos.
- Aclaración de evidencia: §4.2 y §6 no presuponen transaccionalidad ni inyección RNG completa en todos los handlers.

Corrección exclusivamente documental. No se ejecutaron los fixtures, no se implementó la demo y no se aprueba I5R1. El siguiente gate verifica estas correcciones, no reabre las reglas de combate.
