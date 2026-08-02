# Walkthrough — Sprint D-1B Capítulo 7

## Objetivo
Elaborar el Capítulo 7 de `normative-movement-design.md`, sirviendo como contrato final de integración de todos los componentes normativos de movimiento (Capítulos 1 a 6). Este capítulo consolida los límites, las responsabilidades, la dependencia de contratos y los invariantes globales preparatorios para la etapa de implementación en código.

## Secciones añadidas
- **7.1 Objetivo:** Establece el rol de integración del capítulo.
- **7.2 Consumo de contratos:** Enumera el flujo de consumo ordenado, desde Movement Actions hasta Publication.
- **7.3 Responsabilidades:** Asigna inequívocamente la autoridad de cada fase (Validar, Calcular coste, Verificar presupuesto, Resolver, Confirmar, Publicar).
- **7.4 Dependencias:** Registra D-1R1, D-1A y el Research como fuentes, y designa a Rules Engine, Commands, Preview, UI y TurnState como futuros consumidores.
- **7.5 Autoridad:** Reafirma al servidor como autoridad exclusiva normativa y al cliente como consumidor predictivo no autoritativo.
- **7.6 Invariantes globales:** Consolida los 10 principios rectores supremos del sistema de movimiento normativo (un solo cálculo de coste, contador diagonal por turno, una sola topología, etc.).
- **7.7 Límites:** Lista explícitamente lo que queda fuera del alcance del NDD para evitar fuga de responsabilidades hacia la fase de implementación o diseño de otros sistemas (TurnState, AoO, etc.).
- **7.8 Checklist de implementación:** Un checklist normativo que orienta el futuro sprint de código, exigiendo respeto de contratos, no duplicar validadores y reutilizar matemática predictiva.

## Archivos modificados
- `docs/designs/normative-movement-design.md`
- `PROJECT_STATUS.md`
- `walkthrough.md`

## Validación
- Zero Orphan Policy y SSOT cumplidos. Ninguna ODR nueva fue abierta. La estructura finaliza el diseño conceptual para dar paso a la fase de implementación.

READY FOR FINAL ARCHITECTURE REVIEW
