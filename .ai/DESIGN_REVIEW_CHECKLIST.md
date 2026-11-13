# Design Review Checklist (ADR & Architectural Decision Review)

Consultá estas preguntas para un diseño C/D cuando ayuden a verificar el impacto. La [gobernanza](../GOVERNANCE.md#52-nivel-de-cambio-y-evidencia) define el rigor aplicable.

---

## 1. El Filtro de Irreversibilidad (20 Sprints al Futuro)
Antes de proponer cualquier solución técnica, responde con honestidad intelectual:

> **¿Qué decisión o supuesto técnico dentro de este diseño será el más difícil, costoso o prohibitivo de cambiar dentro de 20 sprints?**
*Ejemplos a considerar: acoplamientos rígidos a payloads de red, presuponer que las criaturas solo ocupan una casilla de 5x5 ft, suposiciones de que el orden de turnos siempre es estricto y descendente (lo que rompería "Retrasar" o "Preparar" acción), o suponer que los efectos solo se aplican a identidades biológicas y no a coordenadas en el espacio.*

---

## 2. Complejidad Accidental
Detecta si estás diseñando alrededor de una decisión heredada del pasado:
* ¿Qué parte de este diseño existe exclusivamente porque la arquitectura actual te obliga o te limita?
* ¿Hay alguna deuda técnica o limitación que debas solucionar primero en lugar de construir un parche sobre ella?
* ¿Cómo se puede simplificar el Core para que esta mecánica fluya de forma natural?

---

## 3. Matriz de Reutilización de Infraestructura
No crees helpers ad-hoc. Comprueba si puedes apalancarte en las tres capas del motor:
1. **ActiveEffects (Capa de Datos)**: ¿La mecánica o estado puede modelarse como un `ActiveEffect` agregando un `Trait` lógico o modificadores numéricos a un catálogo declarativo sin lógica?
2. **Pure Helpers (`rules.ts`) (Capa de Reglas)**: ¿Existen ya funciones de cálculo de coordenadas, distancias o amenazas que deban ser reutilizadas o ligeramente parametrizadas?
3. **Resolvers Puros (Capa de Resolución)**: ¿La mecánica requiere alterar la matemática de los dados, o simplemente debe alimentar un contexto dinámico a `resolveAttack` o `opportunityAttackResolver`?

---

## 4. Extensibilidad

Compará casos reales que compartan el mismo contrato si la propuesta introduce infraestructura reutilizable. Identificá qué generalización hace falta para el alcance actual y qué decisiones pueden diferirse.

---

## 5. Matriz de Impacto de Subsistemas
Documenta explícitamente el impacto directo o colateral en cada uno de los siguientes componentes del motor:

- [ ] **Rule Engine (Cálculos y Validaciones)**: ¿Se modifican o agregan reglas puras o selectores?
- [ ] **CombatRoom / State Schema (Datos)**: ¿Requiere guardar propiedades en el estado de la sala?
- [ ] **WebSocket Contract (`ClientCommand` / `ServerMessage`)**: ¿Cambia el payload de red?
- [ ] **UI Presentation (Vistas y Controles)**: ¿La visualización necesita overlays o controles dinámicos?
- [ ] **Automatización de Tests (Unit & E2E)**: ¿Cómo se verificará mecánicamente el cambio?

---

## 6. ¿Qué NO Resuelve este Sprint?
Evita el *scope creep* y la sobre-ingeniería delimitando las fronteras del entregable:
* **Fuera de alcance:** ¿Qué reglas del manual relacionadas quedan explícitamente fuera?
* **Decisiones postergadas:** ¿Qué supuestos técnicos estamos asumiendo temporalmente?
* **Deuda técnica aceptada:** ¿Qué atajos conscientes se están tomando y bajo qué condiciones de mitigación?
