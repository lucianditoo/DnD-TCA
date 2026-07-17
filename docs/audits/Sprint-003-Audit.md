# Auditoría y Walkthrough: Sprint Arquitectónico 003

## 1. Alcance Implementado
Se construyó el **núcleo fundacional (Vertical Slice de Infraestructura)** para ActiveEffects sin integrar mecánicas de combate:
- **Estructuras de Datos (`contracts.ts` y `types.ts`)**: Se aislaron los modelos en su propio archivo de contratos para evitar dependencias circulares con el catálogo. Se definieron `EffectDefinition`, `EffectInstance`, `Traits`, y `DurationPolicy`. Los contratos aplican inmutabilidad estructural (`Readonly<T>`, `readonly T[]`).
- **Ownership Global**: `CombatRoom` (que funge temporalmente como `CombatState`) ahora aloja de manera mandatoria `effectInstances: EffectInstance[]`. Se inicializa atómicamente en salas nuevas y en legacy.
- **Catálogo Inerte (`catalog.ts`)**: Se incluyó únicamente `__INFRASTRUCTURE_SAMPLE__`, un placeholder neutro para testing de almacenamiento, sin traits mecánicos ni funciones.
- **Manager Puro e Inmutable (`manager.ts`)**: Funciones `add` y `remove` inmutables y deterministas. `add` realiza copias defensivas profundas (`targets`, `source`, `appliedAtEvent`, `duration`) para evitar mutaciones externas por referencia.
- **Query Layer (`queries.ts`)**: Aisló `getByTarget`.
- **Legacy Barrier (`roomState.ts`)**: Se tipificó `LegacyCombatRoom` explícitamente para documentar que `ensureLegacyRoomShape` es la única frontera donde `effectInstances` puede ser opcional.

## 2. Alcance Excluido (API Placeholder Eliminada)
Se removieron las funciones prematuras que lanzaban `throw new Error("Not implemented yet")` (`getBySource`, `removeBySource`, etc.), asegurando que solo exista código funcional y probado. No hay deuda técnica deliberada.

## 3. APIs Públicas Reales
El módulo `packages/shared/src/effects/index.ts` exporta exclusivamente:
- Tipos de infraestructura inmutables (`EffectDefinition`, `EffectInstance`, `EffectId`, etc.).
- `effectsCatalog` (Solo lectura y sin lógica anidada).
- `EffectManager`:
  - `add(room: CombatRoom, instance: EffectInstance): CombatRoom`
  - `remove(room: CombatRoom, instanceId: string): CombatRoom`
- `EffectQueries`:
  - `getByTarget(room: CombatRoom, targetId: string): EffectInstance[]`

## 4. Evidencia de Validación
Todas las pruebas exigidas se ejecutaron con éxito total en el entorno local (Node.js v24.18.0):

- **Typecheck**: `npm run typecheck`
  - **Resultado**: Exitoso (0 errores).
- **Tests (Reglas)**: `npm test`
  - **Resultado**: 137 tests pasados, 0 fallidos.
- **Tests (Infraestructura)**: `npx tsx --test tests/active-effects.test.mjs`
  - **Resultado**: 7 tests pasados, 0 fallidos. (Incluyendo test recursivo para el catálogo y test de inmutabilidad estructural profunda).
- **Build**: `npm run build`
  - **Resultado**: Completó exitosamente construyendo shared, server y web.
- **End to End (WebSocket)**: `node scripts/e2e-websocket.mjs`
  - **Resultado**: 30 eventos enviados/recibidos, todos validados (`"ok": true`).

*Nota*: `npm run test:ui` no está configurado para ejecutarse en este entorno no interactivo actualmente.

## 5. Pregunta de Auditoría

> **¿Qué parte de la arquitectura diseñada en el Sprint 002 continúa sin implementarse y por qué?**

A pesar de que el diseño del Sprint 002 documentó un ecosistema holístico de ActiveEffects, las siguientes piezas **no están implementadas** y quedaron fuera del alcance del Sprint 003:

1. **Tick Layer y Duraciones (Event Bus)**: El motor no reduce duraciones ni elimina efectos temporalmente. Esto se debe a que acoplar el `EffectManager` al `TurnManager` requiere un Sprint específico para asegurar que los eventos (ej. `TurnStarted`) se distribuyan sincrónicamente sin mutar el estado incorrectamente.
2. **Rule Engine y Traits Extractor**: Los modificadores y Traits presentes en el catálogo no afectan la CA, el movimiento ni los ataques. Su integración se excluyó porque modificar los helpers de reglas (AC, BAB) demanda que la capa de almacenamiento subyacente (este Sprint 003) ya estuviera probada, versionada y fuera absolutamente inmutable.
3. **Efectos del Manual (D&D 3.5)**: No se programó *Stunned*, *Haste* o *Fatigued*. Se hizo para honrar la política "Data Driven First", probando el sistema con un mock estricto, sin tentaciones de inyectar código particular para un efecto específico.
