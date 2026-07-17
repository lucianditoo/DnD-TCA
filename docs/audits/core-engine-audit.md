# Auditoría Técnica del Motor de Combate - MVP D&D 3.5

Este documento presenta una auditoría detallada de la arquitectura del motor de combate, identificando el estado actual, las fortalezas, debilidades, riesgos futuros y recomendaciones para cada subsistema clave del monorrepósito.

---

## Análisis de Subsistemas

### 1. CombatRulesSnapshot
* **Estado**: Implementado y en uso. Realiza un clon estructurado optimizado de la sala táctica y congela el objeto recursivamente con `deepFreeze` fuera de producción (desarrollo y tests).
* **Fortalezas**:
  * Excelente rendimiento al omitir los logs lineales de mensajes.
  * Garantiza la inmutabilidad en runtime, previniendo mutaciones accidentales en resolvers y validadores.
* **Debilidades**:
  * Mapeo manual en `combatSnapshot.ts`. Cualquier cambio en el modelo `CombatRoom` requiere actualización explícita.
* **Riesgos futuros**:
  * Inconsistencias entre el estado real del servidor y el snapshot del Rule Engine si un nuevo campo se agrega a `CombatRoom` pero no se mapea en `createCombatRulesSnapshot`.
* **Recomendaciones**:
  * Agregar un test de regresión automatizado que compare estructuralmente (mediante introspección de llaves) que todas las propiedades aplicables de `CombatRoom` estén contempladas en `CombatRulesSnapshot`.

### 2. CombatantSnapshot
* **Estado**: Implementado. Mapea la información derivada calculada de cada combatiente al crear el snapshot.
* **Fortalezas**:
  * Permite validar reglas de combate utilizando directamente modificadores ya calculados (BAB, CA, velocidad) sin coste computacional extra.
* **Debilidades**:
  * Copia profunda manual de colecciones (buffs, habilidades, stats) dentro del mapeador.
* **Riesgos futuros**:
  * Desalineación estructural si cambia el modelo de datos de `Combatant`.
* **Recomendaciones**:
  * Utilizar utilidades de TypeScript (`Pick`, `Omit` o tipados recursivos) para asegurar que el snapshot se mantenga en sincronía estática de tipos con `Combatant`.

### 3. Ownership (Control de Permisos)
* **Estado**: Implementado en la capa de comandos del servidor (`requireCombatantControl`, `requireTurnControl`).
* **Fortalezas**:
  * Previene de forma efectiva que jugadores manipulen enemigos o personajes de otros participantes.
  * Los comandos de GM tienen bypass autorizado.
* **Debilidades**:
  * Las comprobaciones de control están acopladas de forma imperativa dentro de los controladores de comandos (`attackCommands.ts`, etc.) y no forman parte del Rule Engine declarativo.
* **Riesgos futuros**:
  * Si se crea un comando nuevo y se omite la validación de control, se puede generar una vulnerabilidad donde un cliente modificado altere el juego.
* **Recomendaciones**:
  * Definir una propiedad declarativa de control o ownership dentro de los metadatos de cada comando, procesada por un middleware común en el despachador.

### 4. Rule Engine
* **Estado**: Biblioteca pura en `rules.ts`.
* **Fortalezas**:
  * 100% puro y determinista, libre de efectos de red o sockets.
  * Altamente testeable.
* **Debilidades**:
  * Algunas validaciones críticas (como la interrupción de movimiento por AdO o el bloqueo de flujo de críticos) están parcialmente orquestadas en los comandos del servidor y no de manera pura en el Rule Engine.
* **Riesgos futuros**:
  * Dispersión de la lógica de D&D 3.5 fuera del Rule Engine, dificultando la portabilidad del motor.
* **Recomendaciones**:
  * Hacer que las funciones del Rule Engine no solo respondan `ok: true/false`, sino que devuelvan los efectos resultantes (ej. `MovementResult` detallando interrupciones, coordenadas y buffs aplicados) para que el servidor solo los aplique.

### 5. EquipmentCatalog
* **Estado**: Implementado mediante JSON estático y conversión a `WeaponProfile`.
* **Fortalezas**:
  * Catálogo centralizado y consistente de armas, armaduras y escudos.
* **Debilidades**:
  * Los perfiles de armas y escudos calculan sus estadísticas derivadas una sola vez durante la carga, asumiendo condiciones estáticas.
* **Riesgos futuros**:
  * Dificultad para implementar buffs que modifiquen el equipo dinámicamente (ej. *Arma mágica* o *Armadura de placas keen*).
* **Recomendaciones**:
  * Cambiar `toWeaponProfile` para que acepte los buffs activos del combatiente y recalcule modificadores dinámicos sobre el perfil resultante.

### 6. AttackResolver
* **Estado**: Separado en `resolveAttack` y `resolveCriticalConfirmation`.
* **Fortalezas**:
  * Centraliza modificadores de ataque complejos (distancia, penalizadores, lucha a la defensiva, buffs de ayuda).
* **Debilidades**:
  * Realiza mutaciones en caliente directamente sobre la sala mutable (`room.log`, `target.hpCurrent`, estadísticas acumuladas), rompiendo con el principio de pureza.
* **Riesgos futuros**:
  * Complejidad para mockear y probar resultados de ataque sin instanciar una sala de combate completa en memoria.
* **Recomendaciones**:
  * Refactorizar los resolutores para que retornen una lista de mutaciones aplicables (ej. cambios de HP, nuevos buffs, líneas de log) en lugar de aplicarlas directamente.

### 7. OpportunityAttack Flow
* **Estado**: Implementado mediante cola en `pendingOpportunityAttacks` e interrupciones en caliente del movimiento.
* **Fortalezas**:
  * Bloquea el flujo del combate impidiendo terminar turnos o realizar movimientos adicionales mientras haya AdO pendientes.
* **Debilidades**:
  * La lógica de resolución física del movimiento (desplazar atrás al objetivo) está acoplada al comando `resolve-opportunity-attack`.
* **Riesgos futuros**:
  * Si se encolan múltiples AdO del mismo objetivo por movimientos concatenados, el cálculo de retroceso puede volverse inconsistente.
* **Recomendaciones**:
  * Desacoplar la física de retroceso a un módulo especializado de resolución de trayectorias.

### 8. Critical Flow
* **Estado**: Implementado mediante interceptación en `resolveAttack` y el helper unificado `resolveThreatOutcome`.
* **Fortalezas**:
  * Utiliza un helper centralizado para confirmación y cancelación, evitando duplicidad.
  * Mantiene el principio de tiradas manuales del proyecto.
* **Debilidades**:
  * El bloqueo de flujos depende de la validación ad-hoc de `room.activeAttackThreat !== null` en el despachador y el Rule Engine.
* **Riesgos futuros**:
  * Si se añade una nueva acción en el servidor y se olvida añadir la validación de amenaza, el jugador podría evadir el bloqueo.
* **Recomendaciones**:
  * Integrar el bloqueo por amenaza de crítico en un estado de fase de sala formal (`phase: "active" | "critical-confirmation" | "opportunity-attack"`).

### 9. WebSocket Protocol
* **Estado**: Conexión JSON simple.
* **Fortalezas**:
  * Protocolo extremadamente liviano y fácil de depurar en tiempo real.
* **Debilidades**:
  * Falta de validación estructural (runtime validation) de los payloads JSON que entran al servidor (no se usa Zod o similar).
* **Riesgos futuros**:
  * Caídas del servidor por excepciones no controladas si un cliente malicioso o desactualizado envía parámetros mal formados.
* **Recomendaciones**:
  * Introducir esquemas de Zod en `@dnd-tactical/shared` para validar los comandos en la entrada del WebSocket.

### 10. Testing
* **Estado**: Suites en `tests/rules.test.mjs` y `tests/critical-flow.test.mjs` utilizando el ejecutor nativo Node y tsx.
* **Fortalezas**:
  * Ejecución ultra-rápida (menos de 500ms).
  * Cobertura de regresión para todos los bugs críticos históricos.
* **Debilidades**:
  * Nula cobertura de tests unitarios o visuales en la interfaz React (`apps/web`).
* **Riesgos futuros**:
  * Regresiones en la UI al actualizar dependencias o modificar componentes comunes como `Board` o `ActionsPanel`.
* **Recomendaciones**:
  * Integrar pruebas de integración de interfaz con Cypress o Playwright, o unitarias con Vitest/Testing Library.

### 11. E2E (WebSocket Tests)
* **Estado**: Script `scripts/e2e-websocket.mjs`.
* **Fortalezas**:
  * Garantiza la cohesión del monorrepósito simulando flujos reales de red y concurrencia.
* **Debilidades**:
  * Fragilidad en tests de ataques: tuvimos que cambiar tiradas d20 de 20 a 15 porque el nuevo sistema de críticos interceptaba el tiro de 20 como una amenaza y bloqueaba la resolución inmediata del test.
* **Riesgos futuros**:
  * Falsos positivos o fallos difíciles de diagnosticar si se alteran las mecánicas base de combate.
* **Recomendaciones**:
  * Permitir configurar el "semillero" o interceptar tiradas en modo de prueba (testing bypass) para validar flujos específicos sin alterar los valores estándar de dados.

### 12. Documentación
* **Estado**: Extensa (`CODEX_GUIDE.md`, `ARCHITECTURE.md`, `RULES_ENGINE.md`, `TODO.md`).
* **Fortalezas**:
  * Muy detallada y clara sobre las decisiones tomadas (ADRs).
* **Debilidades**:
  * Fragmentación del estado del proyecto en múltiples ficheros markdown, lo que puede provocar que la información de deuda técnica quede desactualizada.
* **Riesgos futuros**:
  * Desincronización entre la documentación y la implementación real del código.
* **Recomendaciones**:
  * Mantener un único "Tablero de Control" dinámico para deudas técnicas y consolidar guías complementarias.

---

## Tabla de Evaluación de Riesgos

| Sistema | Estado | Riesgo | Prioridad |
| :--- | :--- | :--- | :--- |
| **WebSocket Protocol** | Parcial (Sin validación runtime) | Alto (Crash de servidor) | Alta |
| **Critical Flow** | Implementado (Bloqueo ad-hoc) | Medio (Evasión de flujo) | Alta |
| **AttackResolver** | Implementado (Mutable imperativo) | Medio (Deuda/Testeo complejo)| Media |
| **Ownership** | Implementado (Acoplado en server) | Medio (Inconsistencias) | Media |
| **CombatRulesSnapshot** | Implementado (Mapeo manual) | Bajo (Desincronización) | Media |
| **OpportunityAttack** | Implementado (Acoplado) | Medio (Interrupciones complejas)| Media |
| **EquipmentCatalog** | Implementado (Estático) | Bajo (Rigidez de items) | Baja |
| **Testing UI** | Inexistente | Medio (Regresiones en React) | Media |
| **E2E** | Implementado (Frágil ante tiradas)| Bajo (Mantenimiento) | Baja |
| **Documentación** | Implementada | Bajo (Desactualización) | Baja |

---

## Top 10 Mejoras Arquitectónicas Recomendadas

1. **Validación de Payloads en WS**: Implementar validación de comandos del cliente usando esquemas de Zod en `dispatcher.ts` antes de procesar cualquier acción.
2. **Máquina de Estados Formal para la Sala**: Migrar `encounterPhase` de la sala a una máquina de estados explícita (`phase: "preparation" | "active" | "opportunity-attack-resolution" | "critical-confirmation"`), eliminando los bloqueos ad-hoc imperativos de `activeAttackThreat` y `pendingOpportunityAttacks`.
3. **Pureza en AttackResolver**: Refactorizar `resolveAttack` y `resolveCriticalConfirmation` para que retornen un conjunto de transformaciones del estado (mutaciones puras), delegando la aplicación real al comando del servidor.
4. **Middleware de Ownership Declarativo**: Configurar una política de seguridad centralizada basada en anotaciones en los comandos, evitando que cada handler compruebe de forma imperativa los permisos.
5. **Autoverificación de Snapshots**: Añadir un test que compruebe mediante reflexión que todas las propiedades de `CombatRoom` aplicables se reflejen en `CombatRulesSnapshot`.
6. **Mapeo Dinámico de EquipmentCatalog**: Modificar `toWeaponProfile` para inyectar buffs del atacante y calcular estadísticas derivadas (peso, penalizadores, rango) en caliente.
7. **Abstracción de Movimiento**: Extraer la física táctica de interrupción, celdas y coste diagonal a un módulo puro `MovementResolver`.
8. **Testing en React**: Configurar Vitest y React Testing Library en `apps/web` para cubrir regresiones interactivas de la interfaz.
9. **Simulador de Dados en Tests**: Añadir soporte de inyección de dados mockeados en el servidor para evitar alterar valores de pruebas de integración E2E.
10. **Unificación de Codex y TODOs**: Centralizar la deuda técnica y el TODO en un único archivo de estado del proyecto para optimizar las consultas del Codex.
