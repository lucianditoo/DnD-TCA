# NDD Sprint 009: Clase de Armadura Desglosada (AC Split)

## Objetivo
Implementar la infraestructura para que el motor de combate pueda calcular y utilizar las variantes de Clase de Armadura (Touch AC y Flat-Footed AC) requeridas por las reglas de D&D 3.5, extendiendo el sistema de modificadores contextuales (`attackContext`) y preparando el terreno para una integración fluida con mecánicas más complejas en el futuro (ataques furtivos, ataques de toque incorpóreos, etc.).

## 1. El Filtro de Irreversibilidad (20 Sprints al Futuro)
**¿Qué decisión o supuesto técnico dentro de este diseño será el más difícil, costoso o prohibitivo de cambiar dentro de 20 sprints?**
La forma en que almacenamos y calculamos los bonus base (Armor, Shield, Natural Armor). Si estos modificadores no están segregados estructuralmente, nunca podremos ignorarlos dinámicamente cuando un ataque sea "Touch". 
- **Solución Propuesta:** No agruparemos todos los bonus estáticos bajo un solo campo de "buffs" o "AC". El `totalArmorClass` base y los efectos activos deben preservar el *tipo* de bonus. Para esta iteración, ya contamos con la capacidad de clasificar los bonus y evaluarlos condicionalmente. Se debe asegurar que el CombatantSnapshot y la ficha guarden la diferenciación, de manera que un `Touch Attack` simplemente filtre o excluya tipos de bonus (Armor, Shield, Natural Armor) durante el cálculo final, sin modificar el estado del Snapshot.

## 2. Complejidad Accidental
Actualmente, `combatant.armorClass` es un valor escalar precalculado. Esto obliga a restar penalizadores o suprimir bonus de Destreza retroactivamente (como en `NO_DEX_TO_AC`).
- **Simplificación del Core:** Mantener `armorClass` como campo compatible, agregar un `armorClassBreakdown` opcional y componer la proyección efectiva dentro de `totalArmorClass`. Los snapshots estructurados dejan de "deshacer" sumas; los snapshots legacy usan una rama explícita y observable.

## 3. Matriz de Reutilización de Infraestructura
1. **ActiveEffects (Capa de Datos)**: Los modificadores numéricos del catálogo ya admiten `stackingGroup`. Los grupos de apilamiento ("armor", "shield", "natural", "deflection") serán fundamentales para la evaluación selectiva.
2. **Pure Helpers (`rules.ts`)**: Reutilización de `totalArmorClass` expandiendo `AttackContext` con `targetAcType: "normal" | "touch"` y un override ortogonal para consultas Flat-Footed.
3. **Resolvers Puros (Capa de Resolución)**: `resolveAttack` recibe `targetAcType` únicamente como opción interna del servidor. El estado Flat-Footed real se deduce de ActiveEffects.

## 4. Futuras Extensiones (La Regla de Tres)
Al desglosar la CA mediante `attackMode` y preservar el tipo de bonus, soportamos inmediatamente:
1. **Ataques de toque incorpóreos**: Criaturas como Espectros atacan a la "Touch AC" independientemente de la armadura que lleve el defensor.
2. **Engullir / Presa (Grapple / Swallow Whole)**: Las reglas de D&D 3.5 a menudo requieren atacar la "Touch AC" de una criatura para iniciar una maniobra táctica de apresamiento.
3. **Ataque Furtivo (Sneak Attack)**: Cuando el defensor es atacado y evaluado bajo el modo "flat-footed", el motor (en Sprints futuros) podrá saber fácilmente si se le negó su bonus de destreza, detonando automáticamente la validación para aplicar daño furtivo.

## 5. Matriz de Impacto de Subsistemas
- [x] **Rule Engine (Cálculos y Validaciones)**: Extensión de `totalArmorClass` para procesar el filtro de bonus en función del `attackMode`.
- [x] **CombatRoom / State Schema (Datos)**: `armorClassBreakdown` opcional en perfiles y snapshots; `armorClass` permanece para compatibilidad legacy.
- [x] **WebSocket Contract (`ClientCommand` / `ServerMessage`)**: Sin cambios. El cliente no puede forzar Touch AC; la selección queda en el resolver autoritativo.
- [x] **UI Presentation (Vistas y Controles)**: El componente de Ficha (`CombatantDetails` / `TargetPreview`) deberá mostrar la Touch AC y Flat-Footed AC desglosadas al lado de la Total AC.
- [x] **Automatización de Tests (Unit & E2E)**: Se escribirán pruebas unitarias para asegurar que Touch excluye Armor/Shield y Flat-Footed excluye Dex/Dodge.

## 6. ¿Qué NO Resuelve este Sprint?
- **Desglose completo de inventario**: No reconstruiremos automáticamente toda la ficha de la criatura si sus campos base todavía agrupan el armor class de forma plana.
- **Ataque Furtivo automático**: Aunque la CA Flat-Footed se calculará correctamente, detonar el daño furtivo queda para el Sprint de Sneak Attack / Precision Damage.
- **Dotes de Esquiva Complejas (Dodge feat targeting)**: El bonus general de esquiva se manejará pero no la dote "Dodge" contra un objetivo específico designado.

## 7. Enmienda aprobada antes de implementación

La revisión arquitectónica determinó que `touch` y `flat-footed` no son modos mutuamente excluyentes. El contexto conservará dimensiones ortogonales:

- `attackType?: "melee" | "ranged"` describe la geometría del ataque y alimenta modificadores condicionales como Prone.
- `targetAcType?: "normal" | "touch"` selecciona la proyección defensiva solicitada por una acción autoritativa del servidor.
- `isFlatFootedOverride?: boolean` permite consultar la variante hipotética para presentación y pruebas. Durante una resolución real, `NO_DEX_TO_AC` continúa derivándose de ActiveEffects.

No se reutilizará el nombre `attackMode`, ya reservado en `TurnState` para distinguir ataques standard/full.

### 7.1. Contrato de componentes

`CreatureTemplate` y `CombatantSnapshot` admitirán un `armorClassBreakdown` opcional con componentes explícitos: base, armor, shield, natural armor, Dexterity aplicada, size, dodge, deflection y misc. El contenedor completo es opcional para aceptar perfiles anteriores; cuando existe, todos sus campos son obligatorios para impedir cálculos parciales silenciosos.

El snapshot persiste una copia del desglose producido en el límite de normalización. Los datos de equipo se resuelven mediante `EquipmentCatalog`; el Rule Engine no vuelve a consultar perfiles ni muta snapshots.

Los modificadores de ActiveEffects se filtran usando las trazas ya reducidas y su `stackingGroup`, preservando las políticas de apilamiento. Los buffs legacy pueden declarar opcionalmente su tipo de bonus de CA; los que no lo hagan se conservan en todas las variantes por retrocompatibilidad.

### 7.2. Semántica de las variantes

- Touch elimina únicamente bonus positivos de armor, shield y natural armor. Conserva Dexterity, dodge, deflection, size, misc y penalizadores.
- Flat-Footed elimina Dexterity positiva y bonus positivos de dodge. Conserva penalizadores de Dexterity.
- Touch + Flat-Footed aplica ambos filtros simultáneamente.

### 7.3. Compatibilidad legacy explícita

Un snapshot sin desglose conserva `armorClass` intacta para CA normal. Para una consulta Touch se usa un fallback determinista de `10 + modificador de Destreza conocido`; al combinarlo con Flat-Footed se conserva únicamente una Destreza negativa. Este fallback no inventa armor, natural armor, deflection ni size y se identifica en `parts` como estimación legacy. Flat-Footed normal mantiene el comportamiento histórico: solo descuenta una Destreza positiva conocida.

Los combatientes integrados que requieran exactitud completa deberán migrarse a componentes explícitos. La ausencia de componentes nunca producirá `NaN` ni alterará su CA normal.

### 7.4. Autoridad y contrato de red

El cliente no enviará `targetAcType` como verdad mecánica. `resolveAttack` aceptará esta selección únicamente como parámetro interno del servidor, cuyo caller debe derivarla de una habilidad, conjuro o maniobra autorizada. Los comandos WebSocket existentes permanecen sin cambios en este sprint.
