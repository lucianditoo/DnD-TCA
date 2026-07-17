# Diseño: Daño Mínimo y Preservación de Estadísticas Base de Plantillas

## 1. Objetivo y problema que resuelve

### Problema
Se ha detectado un comportamiento donde un ataque exitoso inflige 0 puntos de daño ("Cedrick recibe 0 puntos de daño. HP restante: 47/47").

### Causa Raíz
1. **Derivación Destructiva**: El helper `applyEquipmentDerivedStats` en `packages/shared/src/equipmentStats.ts` sobrescribe incondicionalmente las estadísticas `armorClass` y `damageBase` del combatiente.
   * Si una criatura no tiene definido un equipamiento (`equipment`) ni puntuaciones de característica (`abilityScores`) en su plantilla (como Canocrock en `creatures.json`), el sistema asume que no tiene arma ni bonos y deriva un `damageBase` de `0` y un `armorClass` de `10`. Esto destruye los valores predefinidos en la plantilla (`damageBase: 13` y `armorClass: 22`).
2. **Falta de Regla de Daño Mínimo**: El resolvedor de ataques (`resolveAttack` en `apps/server/src/combat/attackResolver.ts`) no garantiza un daño mínimo de 1 para ataques exitosos de daño físico en ausencia de Damage Reduction (DR).

---

## 2. Arquitectura Propuesta

### A. Preservación de Estadísticas Base en Plantillas
Modificaremos `applyEquipmentDerivedStats` para que solo derive estadísticas si existe la propiedad `equipment` en el perfil:
* Si `profile.equipment` está ausente, conservaremos los valores definidos en la plantilla para `armorClass` y `damageBase`.
* Si `profile.equipment` está presente, derivaremos el equipamiento normalmente.

### B. Regla de Daño Mínimo
Modificaremos `resolveAttack` y `resolveCriticalConfirmation` para asegurar que todo impacto exitoso cause al menos `1` punto de daño.
```typescript
const damage = hits ? Math.max(1, damageInput ?? attacker.damageBase) : 0;
```

---

## 3. Respuestas a Preguntas de la Auditoría

1. **¿Existe alguna implementación actual de Damage Reduction, inmunidad, absorción o reducción que permita daño 0?**
   No. No hay ninguna regla de Damage Reduction (DR) o inmunidades implementada.
2. **¿Puede la iniciativa negativa afectar ataque o daño por error?**
   No. La iniciativa solo ordena el turno y es completamente independiente del ataque o daño.
3. **¿Canocrock, Cedrick y Bane están creados como demo/templates y no como perfiles guardados?**
   Sí, están definidos en `packages/shared/src/data/creatures.json` como plantillas estáticas.
4. **¿Los demo/templates pasan por el mismo flujo de derivación que los perfiles guardados?**
   Sí, todos pasan por `createCombatantSnapshotFromProfile` y `applyEquipmentDerivedStats`.
5. **¿Hay diferencias entre combatientes desde perfiles, templates y manuales?**
   Los templates y manuales de monstruos carecen de propiedades de equipamiento (`equipment`), a diferencia de los héroes creados por jugadores, lo que activa el bug de sobreescritura de estadísticas derivadas.
6. **¿El daño base puede quedar en 0 por datos incompletos o por equipo faltante?**
   Sí, porque la derivación fuerza un cálculo de arma equipada (que resulta en 0) y sobreescribe el valor base de la plantilla si esta no tiene equipamiento.
7. **¿El motor aplica mínimo 1 de daño para ataques exitosos cuando no hay DR?**
   No. Actualmente no hay un piso mínimo de 1 daño.
8. **¿El log puede estar mostrando 0 aunque internamente haya otro cálculo?**
   No, muestra el valor final de daño calculado e infligido, que es exactamente 0.

---

## 4. Estrategia de Testing

Añadiremos los siguientes tests de regresión en `tests/equipment-stats.test.mjs` y `tests/critical-flow.test.mjs`:
1. **Iniciativa negativa no afecta daño**: Validar que un combatiente con iniciativa negativa resuelva su ataque y daño de forma idéntica a uno con iniciativa positiva.
2. **Ataque exitoso sin DR no puede aplicar menos de 1 daño**: Validar que un ataque con daño base 0 aplique al menos 1 daño si impacta.
3. **Preservación de estadísticas de plantillas sin equipo**: Probar que una plantilla sin `equipment` (como Canocrock) conserve su `damageBase` y `armorClass` originales al crear su snapshot.
4. **Normalización equivalente**: Verificar que tanto perfiles guardados como plantillas usen el mismo flujo y produzcan datos de daño base consistentes.
