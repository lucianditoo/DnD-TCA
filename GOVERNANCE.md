# Gobernanza del Proyecto

`dnd-tactical-combat-assistant` es un motor táctico de combate para Dungeons & Dragons 3.5. Este documento define los principios técnicos, estructurales y organizativos innegociables para cualquier agente o desarrollador que contribuya al repositorio.

## 1. Visión y Dirección Técnica
El proyecto persigue modelar el combate táctico de D&D 3.5 construyendo una base mantenible a largo plazo. 

La arquitectura debe favorecer:
- **Servidor Autoritativo**: El servidor valida y decide el estado real. La UI es un cliente sin autoridad que provee feedback y experiencia.
- **Funciones Puras y Datos Desacoplados**: Separación estricta entre Catálogos (datos estáticos), Estado (CombatSnapshot) y Reglas Puras (Cálculos).
- **Testing Exhaustivo**: Todo bug detectado se convierte en un caso de test automatizado. Los cambios exigen ejecución exitosa de unit tests, typecheck, builds y E2E.
- **Sin Hacks Rápidos**: Prohibido implementar lógica compleja en UI, duplicar reglas o acoplar mecánicas para resolver bugs rápidamente sin justificación arquitectónica.

## 2. Gobernanza Documental

### 2.1 Single Source of Truth
Debe existir **una única ubicación para cada concepto**. Queda estrictamente prohibida la duplicación de documentación o el mantenimiento de múltiples archivos con el mismo propósito (ej. matrices de cobertura redundantes).

### 2.2 Minimal Documentation Principle
La mejor documentación es la mínima necesaria. No crear documentos únicamente para "mejorar la organización" si no aportan información nueva. Todo documento debe justificar su existencia. Las redundancias deben ser integradas y consolidadas.

### 2.3 Zero Orphan Policy
Todo documento debe pertenecer exactamente a una de las siguientes categorías:
1. **Activo**: Vigente y en uso.
2. **Histórico**: Hitos pasados preservados por trazabilidad, archivados obligatoriamente en `docs/archive/`.
3. **Plantilla**: Estructuras base reutilizables.
4. **Referencia**: Índices o registros.
Todo documento que no encaje en esta clasificación, o que se encuentre obsoleto sin utilidad histórica, **debe ser eliminado inmediatamente**. Quedan prohibidas las carpetas vacías y los archivos sin propósito.

### 2.4 Migration First Policy
Cuando un documento deba cambiar de ubicación o ser reemplazado, se aplicará el siguiente procedimiento:
1. Migrar el contenido útil al nuevo destino.
2. Actualizar todas las referencias entrantes.
3. Verificar que no queden enlaces internos rotos.
4. Validar la consistencia de la migración.
5. **Eliminar el documento original.**
Ningún documento se eliminará antes de validar la migración.

## 3. Decisiones Arquitectónicas (ADR)
Las decisiones estructurales consolidadas deben registrarse en `docs/adr/`. Los ADRs actúan como memoria inmutable del porqué se tomaron decisiones de alto nivel. Las mecánicas en desarrollo permanecerán en `docs/designs/` hasta estabilizarse.

## 4. Ciclo de Trabajo (Sprints)

### 4.1 Definition of Ready (DoR)
Un Sprint o tarea no puede comenzar su implementación sin:
- Diseño documentado y aprobado.
- Plan de implementación claro.
- Reglas afectadas identificadas en el Rule Registry.
- Riesgos y dependencias mapeados.

### 4.2 Definition of Done (DoD)
Una funcionalidad o Sprint se considera finalizada únicamente cuando:
- Compilación y validación de tipos son exitosas (`npm run build`, `npm run typecheck`).
- Tests unitarios y E2E pasan al 100%.
- La documentación, ADRs y Rule Registry están actualizados.
- Se ha generado el informe de auditoría final o walkthrough correspondiente.
- No existen referencias rotas ni deuda técnica injustificada.
