# Roadmap

> **Responsabilidad canónica:** orden futuro y dependencias. No define estados
> de Rule IDs; para eso prevalece
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Orden propuesto

1. **Transición al Spatial Engine 2.5D (Nuevos Diseños Hijos)**
   - D-1: Geometría Normativa Espacial.
   - D-2: Fog of War y Participant Projection.
   - D-3: Protocolo, Identidad, Reconexión y Persistencia Durable.
   - D-4: Renderer, Presentación 2.5D y Cámara.
   - D-5: Editor Táctico V2.
   - D-6: Objetos Ambientales.

2. **Vision, Line of Effect y Concealment**
   - Extender Line of Effect a conjuros y áreas de efecto (AdO ya cerrado en
     Sprint 055B).
   - Incorporar sentidos alternativos, fuentes dinámicas de luz y fenómenos
     visuales.
   - Completar las consecuencias todavía no modeladas de oscuridad y
     Concealment.

2. **Conditions pendientes**
   - Concentration para Entangled.
   - Dazzled/Shaken después de skills/checks.
   - Stunned con caída de objetos.
   - Frightened/Panicked con movimiento obligatorio y escalado de miedo.

3. **Composición de rutinas de ataque**
   - Rapid Shot, Haste, Two-Weapon Fighting, ataques naturales y
     Cleave/Great Cleave deben contribuir a las reglas existentes mediante el
     pipeline oficial.

4. **Feats y Spells Core**
   - Entregar lotes pequeños, dependientes de las capas anteriores.
   - Mantener Equipment como fuente catalogada, sin resultados derivados
     persistidos.

5. **Plataforma y deuda**
   - Ownership transversal, buffs de equipo, stacking, persistencia de salas,
     editores, autenticación y mejoras UI.
   - El orden interno se decide por riesgo y por
     [`docs/technical-debt.md`](docs/technical-debt.md).

Cada vertical requiere NDD, revisión, `Proceed`, validación completa, commit,
push y CI verde. Power Attack permanece congelado hasta decisión explícita de
producto.
