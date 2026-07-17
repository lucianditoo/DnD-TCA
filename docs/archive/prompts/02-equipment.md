# Equipment Prompt

Use this prompt for work related to weapons, armors, shields and derived equipment stats.

```text
Necesito trabajar sobre equipamiento D&D 3.5.

Lee primero CODEX_GUIDE.md, ARCHITECTURE.md y RULES_ENGINE.md.

Reglas de arquitectura:
- EquipmentCatalog es la fuente de verdad para armas, armaduras y escudos.
- La UI y el servidor no deben acceder directamente a arrays internos del catalogo.
- Los perfiles guardan IDs de catalogo, no copias completas de objetos.
- Los datos viven en packages/shared/src/data/equipment.
- Los calculos derivados viven en funciones puras testeables.
- Separar estadisticas base de estadisticas derivadas.
- El servidor recalcula desde IDs y no confia en valores derivados enviados por cliente.

No implementar todavia:
- armas magicas,
- materiales especiales,
- armas de otro tamanio,
- mejoras +1/+2,
- dotes de armas,
- penalizadores por incompetencia.

Al terminar ejecutar:
- npm test
- npm run typecheck
- npm run build
- node scripts/e2e-websocket.mjs

Reportar cambios, tests y deuda tecnica.
```

