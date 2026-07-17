# Documento de Diseño: Total Migration V3 & Remaining Legacy Purge (Sprint 017)

## 1. Objetivo y Problema que Resuelve
En iteraciones anteriores, el monorrepósito evolucionó de usar valores planos estáticos (`armorClass`, `speedFeet`, `attackModifier`) a un pipeline de reglas puras (`Rules` y `EffectReducer`). Sin embargo, persistía el riesgo de regresiones donde un mock antiguo, un perfil persistido localmente (v1/v2) o un test mal configurado inyectara valores planos que desincronizaran el Single Source of Truth (SSOT).
El objetivo de este sprint es purgar cualquier vestigio estructural de propiedades escalares de las interfaces centrales, forzar una migración estricta en el almacenamiento de perfiles y levantar un Guard de TypeScript inquebrantable (`ForbiddenSnapshotScalarCache`) que impida la compilación si alguien intenta reintroducirlos.

## 2. Arquitectura Propuesta
- **TypeScript Guards:** Expansión de `ForbiddenSnapshotScalarCache` en `types.ts` para abarcar no solo `CombatantSnapshot`, sino también `CreatureTemplate` y `StoredProfile`.
- **Profile Migration (Idempotencia):** La capa `profileStorage.ts` garantizará que cualquier objeto que pase por `migrateLegacyProfile` sea forzado a deshidratarse hacia el esquema estricto de Zod sin fallbacks planos.
- **SSOT Absoluto:** `Rules.totalArmorClass`, `Rules.totalAttackBonus` y `Rules.totalSpeedFeet` se reafirman como las únicas vías de lectura de estas estadísticas en todo el monorrepósito.

## 3. DESIGN REVIEW CHECKLIST OBLIGATORIA (.ai/DESIGN_REVIEW_CHECKLIST.md)

### 3.1. Filtro de Irreversibilidad a 20 Sprints
**Pregunta:** Al obligar a que toda la matemática del juego derive de equipamiento catalogado y características fijas, ¿cómo protegemos al motor de cara a mecánicas que rompan el equipo (ej: maniobra de "Romper un arma" o el conjuro Sunder) para que el breakdown actualice el estado del combatiente de forma inmediata y automática?
**Respuesta:** Al ser `Rules` una función puramente proyectiva que lee directamente de `combatant.equipment` y `combatant.armorClassBreakdown` (el cual es derivado estáticamente en el Snapshot), una mecánica como "Sunder" solo necesita despachar un comando que marque el arma o armadura como `equipped: false` (o la elimine de la lista de equipo). Inmediatamente, la siguiente recomputación del snapshot derivará el breakdown sin ese ítem, y la UI / ataque reflejará la caída de estadísticas sin riesgo de desincronización de cachés.

### 3.2. Complejidad Accidental
**Pregunta:** Al purgar los fallbacks e ifs manuales de compatibilidad de `rules.ts` y `combatSnapshot.ts`, ¿qué reducción de líneas y simplificación algorítmica se consiguió en el Core?
**Respuesta:** Se erradica por completo la ambigüedad del estado (e.g. `const ac = combatant.armorClass ?? deriveAC(...)`). El compilador ahora garantiza que los datos en crudo siempre tienen la forma derivada V3 (como `armorClassBreakdown`). Esto reduce ramas de testing inútiles, previene "shadowing" de variables y blinda la predictibilidad de funciones dependientes de isomorfismo.

### 3.3. La Regla de Tres
**Pregunta:** Nombra tres mecánicas de D&D 3.5 que se beneficiarán directamente de esta purga de datos planos.
**Respuesta:**
1. **Sunder (Romper) / Disjunction (Disyunción de Mordenkainen):** Al destruir equipo (romper un escudo), el combatiente pierde inmediatamente la CA por escudo porque los valores son calculados *just-in-time* y no están "harcodeados" en `armorClass`.
2. **Daño/Drenaje a Características (Ability Drain):** Un veneno que baja la Destreza actualiza automática e isomorficamente la CA, el bono de ataque a distancia y los Reflejos sin tener que rastrear "qué" variables actualizar manualmente.
3. **Cambios de Tamaño (Enlarge Person / Polymorph):** Un cambio en la categoría de tamaño alterará instantáneamente el alcance (`meleeReachFeet`), la bonificación de ataque y la CA, ya que se leen en tiempo de evaluación desde la nueva propiedad derivada de tamaño + `EffectReducer`.

## 4. Riesgos y Componentes Afectados
- **Tests Legacy:** Cualquier test mockeado que dependiera de pasar `{ armorClass: 15 }` fallará de inmediato al no conformarse con la firma.
- **Persistencia Local:** Los usuarios con cachés antiguas de `localStorage` experimentarán migraciones automáticas al esquema V3. Si la migración falla, el perfil entra en cuarentena sin crashear el motor.
