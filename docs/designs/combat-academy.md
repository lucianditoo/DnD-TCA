# Academia de Combate

**Estado:** diseño aprobado por el propietario; candidato en validación. Base: `804575a`.
**Gobernanza:** Nivel D para la implementación por los contratos de sesión,
la autoridad sobre intentos y el aislamiento de salas.

## Diagnóstico

La [demo actual](scripted-combat-demo.md) crea salas efímeras y ejecuta comandos
reales mediante un dispatcher interno. Su sala es de solo lectura para el
usuario y el guion controla el ritmo. La Academia requiere participación
manual, por lo que necesita su propio modo de sesión. Se reutilizan las
fábricas, el tablero y los contratos de combate que sean comunes. El runner
de Old Demo conserva su flujo.

`ResultScreen` ya calcula estadísticas desde la sala. Su encabezado actual
presupone victoria por eliminación o derrota por TPK. Una quest puede terminar
con ambos bandos en pie. El resultado de Academia se proyectará por separado
del resultado nativo del combate.

## Arquitectura propuesta

- **Catálogo de Academia.** Categoría, ID/versionado de escenario, instrucciones,
  fixture inicial, roles controlados, objetivos y condiciones terminales. Los
  fixtures resuelven referencias a catálogos existentes. El servidor construye
  una sala con IDs nuevos por intento. El cliente recibe solo metadatos públicos
  y progreso, no los criterios internos ni las decisiones de los NPC.
- **Sesiones privadas en memoria.** Un intento activo por socket, con participante
  vinculado a la sala y control de los héroes del escenario. Inicio por ID de
  escenario, reinicio y salida mediante mensajes específicos y validados. Reiniciar
  reconstruye el fixture y cambia identidad de intento y código de sala. Rechazar
  comandos obsoletos, acceso por join/resume y comandos fuera de una lista permitida
  que incluye solo las acciones que enseña el escenario. El cierre del socket
  libera sala y sesión. La primera entrega no guarda progreso ni reanuda intentos.
- **Motor real.** El jugador envía comandos normales con la identidad vinculada
  por el servidor. Los NPC ejecutan una política pequeña y predefinida a través
  de los mismos handlers y autorizaciones, mediante una entrada interna acotada
  al intento y a sus actores. La Academia no recibe opciones internas ni dados
  por red. Usa RNG normal y objetivos que no dependan de una tirada favorable.
- **Quests autoritativas.** Un evaluador puro observa la transición confirmada
  y evidencia estructurada. Captura actor, comando y las consecuencias de
  movimiento, reacción o conjuro necesarias para los pilotos. Agregar puntos de
  observación solo cuando los datos existentes sean insuficientes. No interpretar
  texto de logs ni premiar solicitudes rechazadas. Comprobar estados terminales
  después de resolver transiciones y reanudaciones. Derrota explícita prevalece
  ante condiciones simultáneas; si el motor termina sin lograr los objetivos,
  el intento fracasa. El resultado terminal queda fijado hasta salir o reiniciar.
- **Web.** Menú principal Tutoriales → Old Demo / Academia de Combate → categorías
  → escenario. Tablero y paneles existentes, objetivos en vivo y controles de
  salida. Victoria reutiliza `ResultScreen` con encabezado de Academia y las
  estadísticas reales. Derrota muestra **YOU FAILED**, razón, reiniciar y volver
  al menú. La cámara es local: puede guiar el ejercicio y verificarse en Chromium,
  pero los cambios de vista no certifican el triunfo ni se envían como evidencia.

## Pilotos propuestos

| Categoría y piloto | Objetivo y prueba de victoria | Derrota |
|---|---|---|
| Tablero · Cámara y oclusión | Inspeccionar desde dos perspectivas una criatura tapada por muro o pilar. En 2D o 2.5D, llegar a la casilla marcada por una ruta legal confirmada por el servidor. Chromium verifica profundidad, selección y trayectoria con la cámara girada. | Agotar el presupuesto de turnos sin alcanzar la meta. |
| Conjuros · Fireball | Orientarse con el preview y lanzar hacia un punto tras una barrera. Verificar consumo del slot, impacto adelantado y resolución sobre la criatura alcanzada, con una criatura protegida que conserva sus HP. Los fixtures permiten cumplir aun tras una salvación exitosa. | Consumir el único slot en un lanzamiento que no produce el resultado exigido. |
| Reacciones · Ataques de oportunidad | Moverse por un trayecto que sale de amenaza, observar la posición publicada hasta el AdO y completar el recorrido después de la reacción. El NPC resuelve el AdO mediante el handler real. El acierto o fallo por sí solo no cambia el veredicto; el actor se prepara para continuar aun con el daño máximo del piloto. | Terminar el turno sin completar la secuencia o quedar incapacitado. |

Las tres escenas son independientes. Añadir un escenario amplía el catálogo
y sus verificadores cuando sean necesarios, sin incorporar otro motor de reglas.

## Orden de implementación y verificación

1. **Núcleo de sesión.** Contratos aditivos, fábrica, autorización, progreso
   y limpieza. Pruebas de dos intentos aislados, intentos obsoletos, rechazo sin
   mutación, acceso cruzado, desconexión y repetición segura. Probar que las
   partidas normales y Old Demo conservan sus contratos.
2. **UI y piloto de cámara.** Completar menú, selección, objetivos, resultado,
   derrota y reinicio con una primera quest confirmada por movimiento real.
   Chromium prueba el recorrido completo, incluida Old Demo desde el nuevo menú.
3. **Pilotos Fireball y AdO.** Reusar proyecciones y resolvers vigentes. Probar
   estados antes/después, objetivos protegidos, slot gastado una vez,
   movimiento suspendido y reanudado, y derrota real en cada piloto.
4. **Cierre Nivel D.** Diff, enlaces y evidencia; suite global, typecheck, build,
   WebSocket y Chromium sobre los tres pilotos y las regresiones existentes.
   Revisión arquitectónica independiente del diseño y del candidato, con foco
   en autoridad, aislamiento y evidencia de las quests. Actualizar las fuentes
   canónicas cuando cambie el estado de la entrega.

**Decisiones para aprobar:** sesión individual efímera, cámara como guía local,
RNG normal con objetivos robustos a la tirada y alcance limitado a estos tres
pilotos. El propietario aprobó estas decisiones y autorizó implementar en la rama aislada.

## Evidencia del candidato

Validación local: 1100/1100 globales, typecheck y build correctos,
146/146 WebSocket y E2E de Academia con aislamiento, derrota, reinicio y
salida. Chromium pasó 6/6 entre los tres pilotos y Old Demo. La prueba de
cámara verifica preset, selección conservada y política de profundidad;
la oclusión de píxeles y una selección nueva en WebGL requieren inspección visual.

La revisión independiente aprobó arquitectura y autoridad. La integración
queda pendiente de autorización del propietario.

## Correcciones de UX de los pilotos

Cámara y AdO explican que la ruta debe llegar a la meta en una sola acción.
Si el borrador termina antes, se advierte antes de confirmar. Cuando el
movimiento ya se gastó, el panel indica cómo reiniciar. El roster separa
la inspección de la unidad controlada y conserva la ruta. Los controles de
combate ajenos al piloto quedan ocultos o deshabilitados.

Fireball muestra la casilla elegida como punto de lanzamiento. La selección
se conserva si el servidor rechaza el comando y se limpia al recibir un
intento nuevo. El log de AdO se genera en el servidor con la casilla de
interrupción, el resultado de la reacción y la continuación observada.

Los recorridos están cubiertos por [Chromium](../../tests-ui/combat-academy.spec.ts).
Las pruebas de picking con cámara rotada continúan en el backlog visual.
