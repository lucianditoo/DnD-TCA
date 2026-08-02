# Walkthrough — Sprint D-1B Capítulo 5

## Objetivo

Incorporar al NDD canónico el ciclo normativo mediante el cual una intención de movimiento se convierte en un desplazamiento confirmado, sin diseñar implementación, estado persistido ni transporte.

## Capítulo redactado

- **5.1 Objetivo:** delimita el capítulo como contrato lógico.
- **5.2 Fases:** fija el orden Intent → Preview → Validation → Cost Assessment → Budget Verification → Resolution → Commit → Publication y una responsabilidad exclusiva por fase.
- **5.3 Validation:** consume los contratos canónicos sin redefinir topología, coste ni presupuesto.
- **5.4 Cost Assessment:** calcula y proyecta el contexto diagonal sin mutar ni consumir.
- **5.5 Budget Verification:** compara coste y presupuesto sin alterar legalidad o estado.
- **5.6 Resolution:** confirma únicamente Steps legales y reconoce el principio abstracto de resultado parcial.
- **5.7 Commit:** aplica posición, consumo y contador diagonal únicamente para Steps confirmados.
- **5.8 Publication:** expone el estado confirmado sin diseñar networking.
- **5.9 Autoridad:** preserva servidor autoritativo y cliente predictivo.
- **5.10–5.11 Invariantes y límites:** impiden redefiniciones, mutaciones prematuras y fugas hacia implementación futura.
- El ciclo se declaró como vista especializada compatible con el pipeline general de modificadores, sin crear una autoridad u orquestador paralelo.

## ODR y alcance

No se abrió ninguna ODR nueva. `D-1B-C3-01` permanece limitada a la composición simultánea de fuentes de coste. No se diseñaron AoO, hazards, interrupciones, rollback, networking, TurnState, TypeScript ni cambios del Rules Engine.

## Validación documental

- Capítulos 1–4 preservados sin cambios semánticos.
- Sin código ni tests modificados.
- Enlaces y responsabilidad canónica conservados en el mismo NDD.
- Alcance limitado a `docs/designs/normative-movement-design.md`, `PROJECT_STATUS.md`, `TODO.md` y este walkthrough rotativo.

READY FOR ARCHITECTURE REVIEW
